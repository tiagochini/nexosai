import { Router } from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { logger } from "../../lib/logger.js";

const router = Router();

const UPLOAD_DIR = "/tmp/nexos-video-editor/uploads";
const OUTPUT_DIR = "/tmp/nexos-video-editor/outputs";

for (const dir of [UPLOAD_DIR, OUTPUT_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

interface JobStatus {
  status: "processing" | "done" | "failed";
  progress: number;
  resultFileId?: string;
  resultFileName?: string;
  error?: string;
  createdAt: Date;
}

const jobs = new Map<string, JobStatus>();
const uploadedFiles = new Map<string, { filePath: string; originalName: string; duration: number; size: number }>();

// Cleanup jobs older than 2 hours
setInterval(() => {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 30 * 60 * 1000);

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/") || file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Somente arquivos de vídeo ou áudio são permitidos."));
    }
  },
});

function probeVideo(filePath: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === "video");
      const duration = metadata.format.duration ?? 0;
      resolve({
        duration: Math.floor(duration),
        width: videoStream?.width ?? 1920,
        height: videoStream?.height ?? 1080,
      });
    });
  });
}

router.post("/upload", upload.single("video"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo enviado." });
    return;
  }
  try {
    const info = await probeVideo(req.file.path);
    const fileId = uuidv4();
    uploadedFiles.set(fileId, {
      filePath: req.file.path,
      originalName: req.file.originalname,
      duration: info.duration,
      size: req.file.size,
    });
    res.json({
      fileId,
      originalName: req.file.originalname,
      duration: info.duration,
      size: req.file.size,
      width: info.width,
      height: info.height,
    });
  } catch (err) {
    logger.error({ err }, "Failed to probe uploaded video");
    res.status(500).json({ error: "Erro ao processar vídeo." });
  }
});

interface ClipSpec {
  fileId: string;
  startTime: number;
  endTime: number;
  label?: string;
}

interface SubtitleSpec {
  text: string;
  startTime: number;
  endTime: number;
}

router.post("/process", async (req, res): Promise<void> => {
  const { clips, subtitles = [], outputFormat = "mp4" } = req.body as {
    clips: ClipSpec[];
    subtitles?: SubtitleSpec[];
    outputFormat?: string;
  };

  if (!clips || clips.length === 0) {
    res.status(400).json({ error: "Nenhum clipe definido." });
    return;
  }

  for (const clip of clips) {
    if (!uploadedFiles.has(clip.fileId)) {
      res.status(400).json({ error: `Arquivo não encontrado: ${clip.fileId}` });
      return;
    }
    if (clip.startTime < 0 || clip.endTime <= clip.startTime) {
      res.status(400).json({ error: "Intervalo de tempo inválido em um dos clipes." });
      return;
    }
  }

  const jobId = uuidv4();
  jobs.set(jobId, { status: "processing", progress: 0, createdAt: new Date() });
  res.status(202).json({ jobId });

  setImmediate(() => void processJob(jobId, clips, subtitles as SubtitleSpec[], outputFormat));
});

async function processJob(
  jobId: string,
  clips: ClipSpec[],
  subtitles: SubtitleSpec[],
  outputFormat: string
): Promise<void> {
  const tmpClips: string[] = [];
  const job = jobs.get(jobId)!;

  try {
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const fileInfo = uploadedFiles.get(clip.fileId)!;
      const clipPath = path.join(UPLOAD_DIR, `clip_${jobId}_${i}.mp4`);
      tmpClips.push(clipPath);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(fileInfo.filePath)
          .setStartTime(clip.startTime)
          .setDuration(clip.endTime - clip.startTime)
          .outputOptions(["-c:v libx264", "-c:a aac", "-avoid_negative_ts make_zero"])
          .output(clipPath)
          .on("end", () => resolve())
          .on("error", (err: Error) => reject(err))
          .run();
      });

      job.progress = Math.round(((i + 1) / clips.length) * 60);
    }

    const concatListPath = path.join(UPLOAD_DIR, `list_${jobId}.txt`);
    const listContent = tmpClips.map(p => `file '${p}'`).join("\n");
    fs.writeFileSync(concatListPath, listContent);

    const resultFileId = uuidv4();
    const outputExt = outputFormat === "webm" ? ".webm" : ".mp4";
    const outputPath = path.join(OUTPUT_DIR, `${resultFileId}${outputExt}`);

    job.progress = 70;

    if (subtitles.length > 0) {
      const srtPath = path.join(UPLOAD_DIR, `subs_${jobId}.srt`);
      const srtContent = subtitles
        .map((sub, idx) => {
          const fmt = (s: number) => {
            const h = Math.floor(s / 3600).toString().padStart(2, "0");
            const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
            const sec = Math.floor(s % 60).toString().padStart(2, "0");
            const ms = Math.round((s % 1) * 1000).toString().padStart(3, "0");
            return `${h}:${m}:${sec},${ms}`;
          };
          return `${idx + 1}\n${fmt(sub.startTime)} --> ${fmt(sub.endTime)}\n${sub.text}\n`;
        })
        .join("\n");
      fs.writeFileSync(srtPath, srtContent);

      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(["-f concat", "-safe 0"])
          .input(srtPath)
          .outputOptions([
            "-c:v libx264",
            "-c:a aac",
            "-c:s mov_text",
            "-metadata:s:s:0 language=por",
          ])
          .output(outputPath)
          .on("progress", (p) => { job.progress = 70 + Math.round((p.percent ?? 0) * 0.25); })
          .on("end", () => resolve())
          .on("error", (err: Error) => reject(err))
          .run();
      });

      fs.unlinkSync(srtPath);
    } else {
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(["-f concat", "-safe 0"])
          .outputOptions(["-c:v libx264", "-c:a aac"])
          .output(outputPath)
          .on("progress", (p) => { job.progress = 70 + Math.round((p.percent ?? 0) * 0.25); })
          .on("end", () => resolve())
          .on("error", (err: Error) => reject(err))
          .run();
      });
    }

    uploadedFiles.set(resultFileId, {
      filePath: outputPath,
      originalName: `nexos_video_final${outputExt}`,
      duration: 0,
      size: fs.statSync(outputPath).size,
    });

    for (const clipPath of tmpClips) {
      try { fs.unlinkSync(clipPath); } catch {}
    }
    try { fs.unlinkSync(concatListPath); } catch {}

    job.status = "done";
    job.progress = 100;
    job.resultFileId = resultFileId;
    job.resultFileName = `nexos_video_final${outputExt}`;
  } catch (err) {
    logger.error({ err, jobId }, "Video processing failed");
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Erro desconhecido no processamento.";
    for (const clipPath of tmpClips) {
      try { fs.unlinkSync(clipPath); } catch {}
    }
  }
}

router.get("/jobs/:jobId", (req, res): void => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job não encontrado." });
    return;
  }
  res.json({
    status: job.status,
    progress: job.progress,
    resultFileId: job.resultFileId,
    resultFileName: job.resultFileName,
    error: job.error,
  });
});

router.get("/files/:fileId", (req, res): void => {
  const file = uploadedFiles.get(req.params.fileId);
  if (!file) {
    res.status(404).json({ error: "Arquivo não encontrado." });
    return;
  }
  if (!fs.existsSync(file.filePath)) {
    res.status(404).json({ error: "Arquivo expirado ou removido." });
    return;
  }
  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Disposition", `${disposition}; filename="${file.originalName}"`);
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Accept-Ranges", "bytes");
  const stat = fs.statSync(file.filePath);
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    res.setHeader("Content-Length", chunkSize);
    res.status(206);
    const stream = fs.createReadStream(file.filePath, { start, end });
    stream.pipe(res);
  } else {
    res.setHeader("Content-Length", stat.size);
    fs.createReadStream(file.filePath).pipe(res);
  }
});

router.delete("/files/:fileId", (req, res): void => {
  const file = uploadedFiles.get(req.params.fileId);
  if (file) {
    try { fs.unlinkSync(file.filePath); } catch {}
    uploadedFiles.delete(req.params.fileId);
  }
  res.json({ ok: true });
});

export default router;
