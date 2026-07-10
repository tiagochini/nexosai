import { Router } from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import OpenAIClient from "openai";
import { logger } from "../../lib/logger.js";
import { env } from "../../lib/env.js";
import { getAnthropic, getOpenAI, callVisionChat, hasOpenAIIntegration } from "../ai-gateway/ai-gateway.service.js";
import { ATLAS_CINEMATOGRAPHY_LIBRARY } from "../agents/scene-director.agent.js";

const router = Router();

const UPLOAD_DIR = "/tmp/nexos-video-editor/uploads";
const OUTPUT_DIR = "/tmp/nexos-video-editor/outputs";

// Whisper caps requests at 25MB; our mp3 extraction (64kbps mono) yields ~1.9MB/min of audio,
// so 25MB comfortably covers footage up to ~30min (the target take length for pro editing).
const MAX_UPLOAD_DURATION_SECONDS = 35 * 60;

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

interface VisualAnalysisResult {
  overallScore: number;
  summary: string;
  frames: Array<{ timestamp: number; notes: string; issues: string[]; strengths: string[] }>;
  recommendations: string[];
}

const jobs = new Map<string, JobStatus>();
const uploadedFiles = new Map<string, { filePath: string; originalName: string; duration: number; size: number }>();
const transcriptCache = new Map<string, TranscriptResult>();
const visualAnalysisCache = new Map<string, VisualAnalysisResult>();
// Video-editor is a standalone tool (no workspace auth) — used only to tag AI cost logs.
const VIDEO_EDITOR_LOG_WORKSPACE_ID = "video-editor-standalone";

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
  // 2GB — comfortably covers a 30min 1080p take; duration (not just size) is validated below.
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
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
    const { client } = getOpenAI();
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

// ─── Frame extraction for visual/cinematographic analysis ────────────────────

function extractFrames(inputPath: string, duration: number, count: number): Promise<Array<{ timestamp: number; path: string }>> {
  return new Promise((resolve, reject) => {
    const dir = fs.mkdtempSync(path.join(UPLOAD_DIR, "frames-"));
    const safeDuration = Math.max(duration, 1);
    const timestamps = Array.from({ length: count }, (_, i) =>
      Math.min(safeDuration - 0.2, ((i + 0.5) / count) * safeDuration),
    );
    ffmpeg(inputPath)
      .on("end", () => {
        // fluent-ffmpeg's %i in the filename template is 1-indexed and not guaranteed to match
        // our requested order exactly, so read back the actual files instead of assuming names.
        const generated = fs.readdirSync(dir).sort();
        resolve(generated.map((name, i) => ({
          timestamp: Math.round((timestamps[i] ?? 0) * 10) / 10,
          path: path.join(dir, name),
        })));
      })
      .on("error", (err: Error) => reject(err))
      .screenshots({
        timestamps,
        filename: "frame-%i.jpg",
        folder: dir,
        size: "640x?",
      });
  });
}

function frameToDataUrl(framePath: string): string {
  const buffer = fs.readFileSync(framePath);
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

// ─── Visual/Cinematographic Analysis — real frame-level footage review ───────
// Extracts sample frames and asks ATLAS (same cinematography library used for AI-generated
// storyboards) to score the REAL uploaded footage on composition, lighting, framing and mood.

router.post("/visual-analysis/:fileId", async (req, res): Promise<void> => {
  const { fileId } = req.params;
  const fileInfo = uploadedFiles.get(fileId);
  if (!fileInfo) {
    res.status(404).json({ error: "Arquivo não encontrado." });
    return;
  }

  const cached = visualAnalysisCache.get(fileId);
  if (cached) {
    res.json({ fileId, cached: true, ...cached });
    return;
  }

  const frameCount = Math.min(10, Math.max(4, Math.round(fileInfo.duration / 60)));
  let frames: Array<{ timestamp: number; path: string }> = [];

  try {
    frames = await extractFrames(fileInfo.filePath, fileInfo.duration, frameCount);
    const dataUrls = frames.map(f => frameToDataUrl(f.path));

    const systemPrompt = `Você é ATLAS — o Diretor de Fotografia-Chefe da NexOS AI. Sua missão aqui NÃO é gerar cenas — é analisar frames REAIS de uma filmagem já gravada e dar um veredito técnico honesto de cinematografia, como se estivesse revisando dailies no set.

${ATLAS_CINEMATOGRAPHY_LIBRARY}

Você receberá ${frames.length} frames extraídos em sequência de um take real, com o timestamp de cada um. Avalie composição, iluminação, enquadramento, estabilidade aparente e transmissão emocional — não invente o que não está visível na imagem.

Retorne SOMENTE JSON válido, sem markdown:
{
  "overallScore": 0-100,
  "summary": "veredito geral em 2-3 frases, tom de diretor de fotografia experiente, em PT-BR",
  "frames": [
    { "frameIndex": 0, "notes": "o que a imagem mostra e como está a fotografia", "issues": ["problema técnico específico, se houver"], "strengths": ["ponto forte específico, se houver"] }
  ],
  "recommendations": ["ação prática e específica para melhorar a próxima gravação, em PT-BR"]
}`;

    const userMessage = `Frames do take "${fileInfo.originalName}" (duração ${fileInfo.duration}s), timestamps em segundos: ${frames.map(f => f.timestamp).join(", ")}. Analise cada frame na ordem enviada.`;

    const result = await callVisionChat(
      systemPrompt,
      [{ role: "user", content: userMessage }],
      dataUrls,
      VIDEO_EDITOR_LOG_WORKSPACE_ID,
      logger,
    );

    let jsonText = result.content;
    const codeBlock = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) jsonText = codeBlock[1]!;
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonText = jsonMatch[0];

    const parsed = JSON.parse(jsonText) as {
      overallScore: number;
      summary: string;
      frames: Array<{ frameIndex: number; notes: string; issues: string[]; strengths: string[] }>;
      recommendations: string[];
    };

    const analysis: VisualAnalysisResult = {
      overallScore: parsed.overallScore,
      summary: parsed.summary,
      recommendations: parsed.recommendations ?? [],
      frames: (parsed.frames ?? []).map(f => ({
        timestamp: frames[f.frameIndex]?.timestamp ?? 0,
        notes: f.notes,
        issues: f.issues ?? [],
        strengths: f.strengths ?? [],
      })),
    };

    visualAnalysisCache.set(fileId, analysis);
    res.json({ fileId, cached: false, ...analysis });
  } catch (err) {
    logger.error({ err, fileId }, "Visual analysis failed");
    res.status(500).json({ error: "Falha na análise visual do take." });
  } finally {
    for (const f of frames) {
      try { fs.unlinkSync(f.path); } catch {}
    }
    if (frames.length > 0) {
      try { fs.rmdirSync(path.dirname(frames[0]!.path)); } catch {}
    }
  }
});

// ─── Live Director Chat — on-demand ATLAS consultation during editing ────────
// Free-form chat, not a fixed pipeline step: the editor can ask ATLAS about framing, pacing,
// which take to prefer, or how to fix a specific shot, at any point while editing.

router.post("/director-chat", async (req, res): Promise<void> => {
  const { message, history, script, fileIds } = req.body as {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    script?: string;
    fileIds?: string[];
  };

  if (!message?.trim()) {
    res.status(400).json({ error: "Mensagem é obrigatória." });
    return;
  }

  const takesContext = (fileIds ?? [])
    .map(id => {
      const info = uploadedFiles.get(id);
      const analysis = visualAnalysisCache.get(id);
      if (!info) return null;
      return `- ${info.originalName} (${info.duration}s)${analysis ? ` — análise visual: score ${analysis.overallScore}/100, "${analysis.summary}"` : " — ainda sem análise visual"}`;
    })
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `Você é ATLAS — o Diretor de Cena-Chefe da NexOS AI, agora em modo de consultoria ao vivo durante a edição real de um vídeo. O editor pode te perguntar qualquer coisa sobre enquadramento, ritmo, escolha de takes, correção de cor, ou decisões de montagem, e você responde como um diretor sênior no set, direto e prático.

${ATLAS_CINEMATOGRAPHY_LIBRARY}

CONTEXTO DA EDIÇÃO ATUAL:
${script ? `Roteiro:\n${script.slice(0, 3000)}` : "Sem roteiro fornecido ainda."}

Takes disponíveis:
${takesContext || "Nenhum take carregado ainda."}

Responda em PT-BR, de forma direta e acionável — não repita a biblioteca de referência, apenas aplique-a à pergunta do editor.`;

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...(history ?? []).slice(-10),
    { role: "user", content: message.trim() },
  ];

  try {
    let reply: string;
    try {
      const { client } = getAnthropic();
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });
      const content = response.content[0];
      reply = content?.type === "text" ? content.text : "Não consegui gerar uma resposta.";
    } catch (anthropicErr) {
      logger.warn({ err: anthropicErr }, "Director chat: Anthropic failed — falling back to OpenAI");
      const { client } = getOpenAI();
      try {
        const completion = await client.chat.completions.create({
          model: "gpt-5.5",
          max_completion_tokens: 1024,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        });
        reply = completion.choices[0]?.message?.content ?? "Não consegui gerar uma resposta.";
      } catch (openaiErr: unknown) {
        const isModelAccessError =
          openaiErr instanceof Error &&
          (("status" in openaiErr && (openaiErr as { status?: number }).status === 403) ||
            ("code" in openaiErr && (openaiErr as { code?: string }).code === "model_not_found"));
        if (!isModelAccessError) throw openaiErr;
        logger.warn({ err: openaiErr }, "Director chat: gpt-5.5 not accessible — retrying with gpt-4o");
        try {
          const completion = await client.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 1024,
            messages: [
              { role: "system", content: systemPrompt },
              ...messages,
            ],
          });
          reply = completion.choices[0]?.message?.content ?? "Não consegui gerar uma resposta.";
        } catch (openaiErr2: unknown) {
          if (!hasOpenAIIntegration()) throw openaiErr2;
          logger.warn({ err: openaiErr2 }, "Director chat: gpt-4o not accessible either — retrying via Replit AI Integrations proxy");
          const integrationClient = new OpenAIClient({
            apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY,
            baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          });
          const completion = await integrationClient.chat.completions.create({
            model: "gpt-5.5",
            max_completion_tokens: 1024,
            messages: [
              { role: "system", content: systemPrompt },
              ...messages,
            ],
          });
          reply = completion.choices[0]?.message?.content ?? "Não consegui gerar uma resposta.";
        }
      }
    }
    res.json({ reply });
  } catch (err) {
    logger.error({ err }, "Director chat failed");
    res.status(500).json({ error: "Falha ao consultar o diretor." });
  }
});

// ─── Upload ───────────────────────────────────────────────────────────────────

router.post("/upload", upload.single("video"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo enviado." });
    return;
  }
  try {
    const info = await probeVideo(req.file.path);
    if (info.duration > MAX_UPLOAD_DURATION_SECONDS) {
      try { fs.unlinkSync(req.file.path); } catch {}
      res.status(413).json({
        error: `Vídeo muito longo (${Math.round(info.duration / 60)}min). O limite atual é ${MAX_UPLOAD_DURATION_SECONDS / 60}min por take.`,
      });
      return;
    }
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
    const { client } = getAnthropic();
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
