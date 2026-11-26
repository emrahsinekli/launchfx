// One-time setup: checks the tools the pack needs, installs the Python packages and downloads the voice model.
// node engine/setup.mjs
import { spawnSync } from "node:child_process"
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const py = process.platform === "win32" ? "python" : "python3"
// No shell here: it would mangle arguments such as ">=" on Windows.
const ok = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, stdio: "ignore" }).status === 0
let bad = false
const need = (label, pass, fix) => { console.log(`${pass ? "ok     " : "MISSING"} ${label}${pass ? "" : "  ->  " + fix}`); if (!pass) bad = true }

need("Node 18+", +process.versions.node.split(".")[0] >= 18, "install Node.js 18 or newer from nodejs.org")
need("ffmpeg", ok("ffmpeg", ["-version"]), "install ffmpeg and make sure it is on PATH (winget install ffmpeg / brew install ffmpeg / apt install ffmpeg)")
need("Python 3.9+", ok(py, ["-c", "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)"]), "install Python 3.9 or newer from python.org")
const chrome = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => existsSync(p))
need("Chrome / Chromium / Edge", !!chrome, "install Google Chrome, or set CHROME_PATH to a Chromium-based browser")
if (bad) { console.log("\nFix the items marked MISSING, then run this again."); process.exit(1) }

if (!existsSync(join(ROOT, "node_modules", "puppeteer-core"))) {
  console.log("installing node packages...")
  if (spawnSync("npm install --no-fund --no-audit", { cwd: ROOT, stdio: "ignore", shell: true }).status !== 0) { console.log("npm install failed"); process.exit(1) }
}
if (!ok(py, ["-c", "import kokoro_onnx, soundfile, numpy"])) {
  console.log("installing python packages (kokoro-onnx, soundfile, numpy)...")
  if (!ok(py, ["-m", "pip", "install", "--quiet", "kokoro-onnx", "soundfile", "numpy"])) { console.log("pip install failed. Try: " + py + " -m pip install kokoro-onnx soundfile numpy"); process.exit(1) }
}
// The voice model (Kokoro, Apache-2.0) is downloaded from its public release, about 350 MB once.
const BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
mkdirSync(join(ROOT, "models"), { recursive: true })
for (const [f, min] of [["kokoro-v1.0.onnx", 300e6], ["voices-v1.0.bin", 20e6]]) {
  const dst = join(ROOT, "models", f)
  if (existsSync(dst) && statSync(dst).size > min) continue
  console.log(`downloading ${f} ...`)
  const r = await fetch(BASE + f)
  if (!r.ok) { console.log(`download failed (${r.status}). Download ${BASE + f} by hand into the models folder.`); process.exit(1) }
  await pipeline(Readable.fromWeb(r.body), createWriteStream(dst + ".part"))
  renameSync(dst + ".part", dst)
}
console.log("\nReady. Make the sample video with:\n  node engine/make.mjs <template id> templates/<template id>/content.json --draft")
