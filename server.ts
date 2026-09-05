import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

const DEFAULT_TEXT_MODEL = "gemini-3.8-flash";
const DEFAULT_LIVE_MODEL = "gemini-3.1-flash-live-preview";

const parsePort = (value: string | undefined) => {
  const port = Number(value ?? 1234);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }
  return port;
};

const readString = (value: unknown, name: string, maxLength: number) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  if (value.length > maxLength) {
    throw new Error(`${name} exceeds ${maxLength} characters`);
  }
  return value;
};

const requestApiKey = (req: express.Request) => {
  const suppliedKey = req.get("x-gemini-api-key")?.trim();
  if (suppliedKey && suppliedKey.length >= 20 && suppliedKey.length <= 256) {
    return suppliedKey;
  }
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
};

const aiErrorStatus = (error: unknown) => {
  const status = typeof error === "object" && error && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 0;
  if (status === 400 || status === 401 || status === 403 || status === 429) return status;
  return 502;
};

async function startServer() {
  const app = express();
  const port = parsePort(process.env.PORT);
  const isDevelopment = process.argv.includes("--dev");

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: isDevelopment ? false : undefined,
    contentSecurityPolicy: isDevelopment ? false : {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "wss://generativelanguage.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        workerSrc: ["'self'", "blob:"],
      },
    },
  }));

  // JSON parsing middleware
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", (req, res, next) => {
    const localHost = req.hostname === "localhost" || req.hostname === "127.0.0.1" || req.hostname === "::1";
    if (req.get("x-gemini-api-key") && !req.secure && !localHost) {
      res.status(400).json({ error: "A secure HTTPS connection is required when using a session API key." });
      return;
    }
    next();
  });

  const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.AI_RATE_LIMIT ?? 40),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "AI request limit reached. Please try again later." },
  });

  const liveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.LIVE_RATE_LIMIT ?? 12),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Live-session limit reached. Please try again later." },
  });

  // API Health check
  app.get("/api/health", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      status: "ok",
      environment: isDevelopment ? "development" : "production",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/config", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()),
      textModel: process.env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL,
      liveModel: process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL,
      byokSupported: true,
    });
  });

  app.post("/api/ai/generate", aiLimiter, async (req, res) => {
    const apiKey = requestApiKey(req);
    if (!apiKey) {
      res.status(503).json({ error: "AI is not configured. Add GEMINI_API_KEY on the server or provide a session key." });
      return;
    }

    try {
      const prompt = readString(req.body?.prompt, "prompt", 160_000);
      const systemInstruction = req.body?.systemInstruction == null
        ? undefined
        : readString(req.body.systemInstruction, "systemInstruction", 80_000);
      const responseMimeType = req.body?.responseMimeType === "application/json"
        ? "application/json"
        : "text/plain";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90_000);

      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType,
            abortSignal: controller.signal,
          },
        });
        const text = response.text?.trim();
        if (!text) {
          res.status(502).json({ error: "The AI service returned an empty response." });
          return;
        }
        res.set("Cache-Control", "no-store");
        res.json({
          text,
          usage: response.usageMetadata ? {
            promptTokens: response.usageMetadata.promptTokenCount ?? 0,
            responseTokens: response.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: response.usageMetadata.totalTokenCount ?? 0,
          } : undefined,
        });
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const status = error instanceof Error && /required|exceeds/.test(error.message)
        ? 400
        : aiErrorStatus(error);
      console.error("Gemini generation request failed", {
        status,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      res.status(status).json({
        error: status === 429
          ? "The AI service is rate limited. Please retry shortly."
          : status === 400
            ? (error instanceof Error ? error.message : "Invalid request")
            : "The AI service is temporarily unavailable.",
      });
    }
  });

    app.post("/api/ai/validate", aiLimiter, async (req, res) => {
      const apiKey = requestApiKey(req);
      if (!apiKey) {
        res.status(503).json({ error: "AI is not configured. Add a Gemini API key to continue." });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL,
          contents: "Reply with exactly OK.",
          config: { abortSignal: controller.signal, maxOutputTokens: 8 },
        });
        if (!response.text?.trim()) throw new Error("The AI provider returned an empty response.");
        res.set("Cache-Control", "no-store");
        res.json({ ok: true, model: process.env.GEMINI_TEXT_MODEL || DEFAULT_TEXT_MODEL });
      } catch (error) {
        const status = aiErrorStatus(error);
        console.error("Gemini access validation failed", {
          status,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        res.status(status).json({
          error: status === 401 || status === 403
            ? "Google rejected this key. Check the key and its Gemini API access."
            : status === 429
              ? "This key is valid but currently rate limited. Try again shortly."
              : "Gemini could not be reached with this key. Please retry.",
        });
      } finally {
        clearTimeout(timeout);
      }
    });

  app.post("/api/live/token", liveLimiter, async (req, res) => {
    const apiKey = requestApiKey(req);
    if (!apiKey) {
      res.status(503).json({ error: "Live AI is not configured. Add GEMINI_API_KEY on the server or provide a session key." });
      return;
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });
      const now = Date.now();
      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          newSessionExpireTime: new Date(now + 60_000).toISOString(),
          expireTime: new Date(now + 35 * 60_000).toISOString(),
        },
      });
      if (!token.name) {
        res.status(502).json({ error: "The AI service did not issue a live-session token." });
        return;
      }
      res.set("Cache-Control", "no-store");
      res.json({
        token: token.name,
        model: process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL,
      });
    } catch (error) {
      const status = aiErrorStatus(error);
      console.error("Gemini live-token request failed", {
        status,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      res.status(status).json({
        error: status === 429
          ? "The live AI service is rate limited. Please retry shortly."
          : "Unable to start a live AI session.",
      });
    }
  });

  // Integrate Vite dev middleware or serve static built files
  if (isDevelopment) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist", "client");
    const indexPath = path.join(distPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      throw new Error("Production assets are missing. Run `npm run build` before `npm start`.");
    }

    app.use(express.static(distPath, {
      index: false,
      maxAge: "1y",
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }));

    // Express 5 no longer accepts the legacy "*" route pattern.
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api/") || req.path.startsWith("/assets/") || path.extname(req.path)) {
        next();
        return;
      }
      res.set("Cache-Control", "no-cache");
      res.sendFile(indexPath);
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status)
      : 500;
    if (status === 400) {
      res.status(400).json({ error: "Invalid JSON request body." });
      return;
    }
    if (status === 413) {
      res.status(413).json({ error: "Request body is too large." });
      return;
    }
    console.error("Unhandled request error", error);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`InterviewCoach server running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
