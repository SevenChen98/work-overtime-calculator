import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3001);
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "overtime-state.json");
const distDir = path.join(__dirname, "dist");

async function ensureDataDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readState() {
  try {
    const content = await fs.readFile(dataFile, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeState(state) {
  await ensureDataDir();
  await fs.writeFile(dataFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

app.use(express.json({ limit: "1mb" }));

app.get("/api/state", async (_req, res) => {
  try {
    const state = await readState();
    res.json(state || {});
  } catch (error) {
    res.status(500).json({ message: "读取本地数据失败", detail: error.message });
  }
});

app.put("/api/state", async (req, res) => {
  const state = req.body;

  if (!state || typeof state !== "object" || Array.isArray(state)) {
    res.status(400).json({ message: "提交的数据格式不正确" });
    return;
  }

  try {
    await writeState(state);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "写入本地数据失败", detail: error.message });
  }
});

async function setupStaticHosting() {
  try {
    await fs.access(distDir);
    app.use(express.static(distDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, "index.html"));
    });
  } catch {
    // Dev mode: Vite serves the frontend separately.
  }
}

await setupStaticHosting();

app.listen(port, () => {
  console.log(`Overtime tracker server running at http://localhost:${port}`);
  console.log(`Data file: ${dataFile}`);
});
