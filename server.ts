import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import apiRouter from "./server/routes.js";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.disable("x-powered-by");

  const allowedOrigins = new Set<string>([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  if (process.env.APP_URL) {
    try {
      allowedOrigins.add(new URL(process.env.APP_URL).origin);
    } catch {
      console.warn("[Server] Invalid APP_URL format; skipping from CORS allowlist.");
    }
  }

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "microphone=(self)");
    next();
  });

  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      if (!origin) {
        return callback(null, { origin: false });
      }
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const sameOrigin = host ? `${proto}://${host}` : null;

      if (allowedOrigins.has(origin) || (sameOrigin && origin === sameOrigin)) {
        return callback(null, {
          origin: true,
          methods: ["GET", "POST", "PUT", "DELETE"],
          allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma", "Expires"],
        });
      }
      return callback(new Error("CORS origin not allowed"));
    })
  );

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API routes
  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
