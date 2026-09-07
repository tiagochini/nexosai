import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { AppError } from "./lib/errors.js";
import { env } from "./lib/env.js";

const app: Express = express();

// ─── Trust proxy (Replit reverse proxy) ───────────────────────────────────────
app.set("trust proxy", 1);

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: env.NODE_ENV === "production",
  }),
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins: string[] = env.ALLOWED_ORIGINS
  ? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (env.NODE_ENV !== "production") return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Workspace-ID"],
  maxAge: 600,
};

app.use(cors(corsOptions));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "development",
  message: { error: "Too many requests — tente novamente em 15 minutos", code: "RATE_LIMITED" },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "development",
  message: { error: "Muitas tentativas de autenticação — tente novamente em 15 minutos", code: "AUTH_RATE_LIMITED" },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "development",
  message: { error: "Limite de requisições de IA atingido — tente novamente em 1 minuto", code: "AI_RATE_LIMITED" },
});

app.use("/api", generalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/intake/:id/extract", aiLimiter);
app.use("/api/intake/:id/conversation", aiLimiter);
app.use("/api/campaigns/:id/orchestrate", aiLimiter);

// ─── Body parsing ─────────────────────────────────────────────────────────────
// Meta's signature covers raw bytes. Its two compatibility endpoints parse their
// body locally only after signature verification.
const isMetaWebhook = (req: { url?: string }): boolean => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  return pathname === "/api/social/webhooks/meta" ||
    pathname === "/api/social-moderation/webhooks/meta";
};
const isJsonRequest = (req: { headers?: Record<string, string | string[] | undefined> }): boolean => {
  const value = req.headers?.["content-type"];
  const contentType = Array.isArray(value) ? value[0] : value;
  return typeof contentType === "string" &&
    (contentType.toLowerCase().includes("application/json") || contentType.toLowerCase().includes("+json"));
};
app.use(express.json({
  limit: "10mb",
  type: (req) => !isMetaWebhook(req) && isJsonRequest(req),
  verify: (req, _res, buf) => { (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buf); },
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Request logging ──────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", router);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error && err.message.startsWith("CORS:")) {
    res.status(403).json({ error: err.message, code: "CORS_FORBIDDEN" });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
});

export default app;
