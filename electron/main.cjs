const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const isDev = !app.isPackaged;
let mainWindow = null;

function getStateFilePath() {
  return path.join(app.getPath("userData"), "overtime-state.json");
}

async function ensureStateDir() {
  await fs.mkdir(path.dirname(getStateFilePath()), { recursive: true });
}

async function readState() {
  try {
    const content = await fs.readFile(getStateFilePath(), "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeState(state) {
  await ensureStateDir();
  await fs.writeFile(getStateFilePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  ipcMain.handle("state:load", async () => {
    return readState();
  });

  ipcMain.handle("state:save", async (_event, state) => {
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new Error("Invalid state payload");
    }
    await writeState(state);
    return { ok: true, path: getStateFilePath() };
  });

  ipcMain.handle("state:path", async () => {
    return getStateFilePath();
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
