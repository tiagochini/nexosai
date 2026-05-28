import { Router } from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { logger } from "../../lib/logger.js";
import { getAnthropic, getOpenAI } from "../ai-gateway/ai-gateway.service.js";

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

interface TranscriptSegment { text: string; start: number; end: number; }
interface TranscriptResult { text: string; segments: TranscriptSegment[]; }

const jobs = new Map<string, JobStatus>();
const uploadedFiles = new Map<string, { filePath: string; originalName: string; duration: number; size: number }>();
const transcriptCache = new Map<string, TranscriptResult>();

// Cleanup jobs and transcripts older than 2 hours
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

function extractAudioMp3(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate("64k")
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .run();
  });
}

async function transcribeFile(fileId: string): Promise<TranscriptResult> {
  const cached = transcriptCache.get(fileId);
  if (cached) return cached;

  const fileInfo = uploadedFiles.get(fileId);
  if (!fileInfo) throw new Error(`Arquivo não encontrado: ${fileId}`);

  const audioPath = path.join(UPLOAD_DIR, `audio_${fileId}.mp3`);
  await extractAudioMp3(fileInfo.filePath, audioPath);

  try {
    const client = getOpenAI();
    const { toFile } = await import("openai");
    const buffer = fs.readFileSync(audioPath);
    const file = await toFile(buffer, "audio.mp3", { type: "audio/mpeg" });

    const response = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "pt",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    const data = response as unknown as {
      text: string;
      segments: Array<{ text: string; start: number; end: number }>;
    };

    const result: TranscriptResult = {
      text: data.text ?? "",
      segments: (data.segments ?? []).map(s => ({
        text: s.text.trim(),
        start: Math.round(s.start * 100) / 100,
        end: Math.round(s.end * 100) / 100,
      })),
    };

    transcriptCache.set(fileId, result);
    logger.info({ fileId, segments: result.segments.length }, "Whisper transcription with timestamps complete");
    return result;
  } finally {
    try { fs.unlinkSync(audioPath); } catch {}
  }
}

// ─── Upload ───────────────────────────────────────────────────────────────────

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

// ─── Transcribe a single file with segment timestamps ─────────────────────────

router.post("/transcribe/:fileId", async (req, res): Promise<void> => {
  const { fileId } = req.params;
  const fileInfo = uploadedFiles.get(fileId);
  if (!fileInfo) {
    res.status(404).json({ error: "Arquivo não encontrado." });
    return;
  }

  try {
    const result = await transcribeFile(fileId);
    res.json({ fileId, originalName: fileInfo.originalName, ...result });
  } catch (err) {
    logger.error({ err, fileId }, "Transcription failed");
    res.status(500).json({ error: "Falha na transcrição. Verifique se o arquivo de vídeo tem áudio." });
  }
});

// ─── Smart Edit — AI maps script sections to best takes ──────────────────────

router.post("/smart-edit", async (req, res): Promise<void> => {
  const { fileIds, script } = req.body as { fileIds: string[]; script: string };

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    res.status(400).json({ error: "fileIds é obrigatório e não pode ser vazio." });
    return;
  }
  if (!script?.trim() || script.trim().length < 20) {
    res.status(400).json({ error: "Roteiro muito curto. Cole o roteiro completo do CPL." });
    return;
  }

  // Transcribe all files (uses cache when available)
  const transcripts: Array<{
    fileId: string;
    fileName: string;
    duration: number;
    text: string;
    segments: TranscriptSegment[];
  }> = [];

  for (const fileId of fileIds) {
    const fileInfo = uploadedFiles.get(fileId);
    if (!fileInfo) continue;
    try {
      const result = await transcribeFile(fileId);
      transcripts.push({
        fileId,
        fileName: fileInfo.originalName,
        duration: fileInfo.duration,
        ...result,
      });
    } catch (err) {
      logger.warn({ err, fileId }, "Smart-edit: transcription skipped for file");
    }
  }

  if (transcripts.length === 0) {
    res.status(400).json({ error: "Nenhum take pôde ser transcrito. Verifique se os vídeos possuem áudio." });
    return;
  }

  // Build takes context for Claude
  const takesText = transcripts.map((t, i) => {
    const letter = String.fromCharCode(65 + i);
    const segText = t.segments.length > 0
      ? t.segments.map(s => `[${s.start.toFixed(1)}s-${s.end.toFixed(1)}s] "${s.text}"`).join("\n")
      : `[transcription] "${t.text.slice(0, 2000)}"`;
    return `TAKE ${letter} (fileId: "${t.fileId}", duração: ${t.duration}s, arquivo: "${t.fileName}"):\n${segText}`;
  }).join("\n\n---\n\n");

  const systemPrompt = `Você é um editor de vídeo profissional especialista em lançamentos digitais no Brasil.

Receberá o roteiro de um CPL/VSL e as transcrições com timestamps de múltiplos takes filmados.

Sua missão: construir a melhor edição possível, mapeando cada seção do roteiro ao trecho do take mais adequado.

CRITÉRIOS DE SCORE:
- 90-100: texto quase idêntico ao roteiro, entrega fluente, frase completa
- 70-89: mesmo conteúdo com palavras ligeiramente diferentes, entrega natural
- 55-69: tema correto mas diverge consideravelmente do texto do roteiro
- < 55: não usar — descarte

REGRAS OBRIGATÓRIAS:
1. Inclua apenas clips com score >= 55
2. Adicione 0.3s de buffer no início e 0.5s depois de cada segmento
3. Nunca ultrapasse 0 ou a duração máxima do arquivo
4. Ordene os clips na mesma sequência do roteiro
5. Em empate de score, prefira o take com entrega mais natural e objetiva
6. Se um parágrafo não tiver correspondência adequada em nenhum take, pule-o
7. Label máximo de 6 palavras em PT-BR descrevendo o conteúdo do clip
8. Você pode usar múltiplos segmentos do mesmo take para cobrir parágrafos longos

Retorne SOMENTE JSON válido, sem markdown nem explicação adicional:
{
  "clips": [
    {
      "fileId": "id-exato-do-arquivo",
      "startTime": 0.0,
      "endTime": 8.5,
      "label": "Abertura e gancho principal",
      "scriptSection": "primeiras 8 palavras desta seção do roteiro",
      "score": 92
    }
  ],
  "summary": "X clips • ~Y min • Z takes utilizados",
  "coverage": 85
}`;

  const userMessage = `ROTEIRO COMPLETO:\n---\n${script.trim()}\n---\n\nTAKES DISPONÍVEIS:\n\n${takesText}`;

  try {
    const client = getAnthropic();
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const content = message.content[0];
    if (!content || content.type !== "text") {
      throw new Error("Resposta inválida da IA.");
    }

    // Extract JSON from response (handles markdown code blocks)
    let jsonText = content.text;
    const codeBlock = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) jsonText = codeBlock[1]!;
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonText = jsonMatch[0];

    const result = JSON.parse(jsonText) as {
      clips: Array<{
        fileId: string;
        startTime: number;
        endTime: number;
        label: string;
        scriptSection: string;
        score: number;
      }>;
      summary: string;
      coverage: number;
    };

    // Validate and clamp timestamps
    for (const clip of result.clips) {
      const info = uploadedFiles.get(clip.fileId);
      const maxDuration = info?.duration ?? 99999;
      clip.startTime = Math.max(0, Number(clip.startTime) || 0);
      clip.endTime = Math.min(maxDuration, Number(clip.endTime) || 0);
      if (clip.endTime <= clip.startTime) clip.endTime = clip.startTime + 1;
    }

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Smart edit AI mapping failed");
    res.status(500).json({ error: "Falha no mapeamento por IA. Tente novamente." });
  }
});

// ─── Process (concat + subtitles + encode) ───────────────────────────────────

interface ClipSpec { fileId: string; startTime: number; endTime: number; label?: string; }
interface SubtitleSpec { text: string; startTime: number; endTime: number; }

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
      const clip = clips[i]!;
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

// ─── Job status ───────────────────────────────────────────────────────────────

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

// ─── File download / streaming ────────────────────────────────────────────────

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
    const start = parseInt(parts[0]!, 10);
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
    transcriptCache.delete(req.params.fileId);
  }
  res.json({ ok: true });
});

export default router;
