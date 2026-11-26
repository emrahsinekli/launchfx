// One command from content file to finished video.
// node engine/make.mjs <template id> <content.json> [--out name] [--draft] [--social]
//   --social also writes vertical (9:16) and square (1:1) versions with word-by-word captions
//   --draft  quick preview: 30 fps, no motion blur (about 8x faster)
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const [id, content] = process.argv.slice(2)
const flag = (n) => process.argv.includes("--" + n)
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i < 0 ? d : process.argv[i + 1] }
if (!id || !content || !existsSync(content)) { console.error("usage: node engine/make.mjs <template id> <content.json> [--out name] [--draft]"); process.exit(1) }
if (!existsSync(join(ROOT, "templates", id, "template.html"))) { console.error(`template "${id}" is not in this pack (templates/${id})`); process.exit(1) }
const name = arg("out", basename(dirname(resolve(content))) === "templates" ? id : basename(resolve(content), ".json") === "content" ? basename(dirname(resolve(content))) : basename(resolve(content), ".json"))
const out = join(ROOT, "out", name)
const py = process.platform === "win32" ? "python" : "python3"
const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" }); if (r.status !== 0) { console.error(`\nstep failed: ${cmd} ${args[0]}`); process.exit(r.status ?? 1) } }

run(py, ["engine/tts.py", resolve(content), out])
run("node", ["engine/render.mjs", id, "--content", resolve(content), "--out", name, ...(flag("draft") ? ["--fps", "30", "--mb", "1", "--crf", "24"] : [])])
run(py, ["engine/audio.py", out])
if (flag("social")) run("node", ["engine/social.mjs", name, "--content", resolve(content)])
console.log(`\nvideo: ${join(out, name + ".mp4")}`)
