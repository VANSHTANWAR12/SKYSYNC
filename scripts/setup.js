const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");
const envExamplePath = path.join(frontendDir, ".env.example");
const envPath = path.join(frontendDir, ".env");
const backendReqPath = path.join(rootDir, "backend", "req.txt");

function createFrontendEnv() {
  if (!fs.existsSync(envExamplePath)) {
    console.warn("Skipping frontend/.env creation: frontend/.env.example not found.");
    return;
  }

  if (fs.existsSync(envPath)) {
    console.log("frontend/.env already exists.");
    return;
  }

  fs.copyFileSync(envExamplePath, envPath);
  console.log("Created frontend/.env from frontend/.env.example.");
}

function readMapboxToken(filePath) {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  const contents = fs.readFileSync(filePath, "utf8");
  const match = contents.split(/\r?\n/).find((line) => line.startsWith("VITE_MAPBOX_TOKEN="));
  if (!match) return "";

  return match.split("=")[1] ? match.split("=").slice(1).join("=").trim() : "";
}

function reportMapboxStatus() {
  const token = readMapboxToken(envPath);
  if (!token) {
    console.warn(
      "frontend/.env does not contain a Mapbox token. Add your Mapbox publishable token to VITE_MAPBOX_TOKEN in frontend/.env."
    );
    console.warn("Example:");
    console.warn("  VITE_MAPBOX_TOKEN=YOUR_MAPBOX_PUBLISHABLE_TOKEN");
    return;
  }

  console.log("frontend/.env already contains a VITE_MAPBOX_TOKEN.");
}

function installBackendDependencies() {
  if (!fs.existsSync(backendReqPath)) {
    console.warn("Skipping backend dependency install: backend/req.txt not found.");
    return;
  }

  const pythonExec = process.platform === "win32" ? "python" : "python3";
  const pythonCheck = spawnSync(pythonExec, ["--version"], { stdio: "ignore" });

  if (pythonCheck.status !== 0) {
    console.warn("Python is not available in PATH. Install backend dependencies manually with:");
    console.warn("  python -m pip install -r backend/req.txt");
    return;
  }

  const installResult = spawnSync(pythonExec, ["-m", "pip", "install", "-r", backendReqPath], {
    stdio: "inherit",
    cwd: rootDir,
  });

  if (installResult.status !== 0) {
    console.warn("Backend dependency installation failed. Run manually if needed:");
    console.warn("  python -m pip install -r backend/req.txt");
    return;
  }

  console.log("Backend dependencies installed from backend/req.txt.");
}

function main() {
  console.log("Running Skysync setup...");
  createFrontendEnv();
  reportMapboxStatus();
  installBackendDependencies();
  console.log("Setup complete. If frontend/.env was created, add your Mapbox token before starting the app.");
}

main();
