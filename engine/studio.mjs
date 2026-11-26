// LaunchFX Studio: a local page to preview a template with sound, edit every word and colour, and render.
// node engine/studio.mjs [--port 4173] [--no-open]
import { spawn } from "node:child_process"
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { dirname, extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i < 0 ? d : process.argv[i + 1] }
const py = process.platform === "win32" ? "python" : "python3"
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".md": "text/plain; charset=utf-8", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".wav": "audio/wav", ".mp4": "video/mp4" }
const okName = (n) => typeof n === "string" && /^[a-z0-9][a-z0-9-]{0,40}$/.test(n)
const okTemplate = (t) => typeof t === "string" && /^[a-z0-9-]+$/.test(t) && existsSync(join(ROOT, "templates", t, "template.html"))
const run = (cmd, args, onLine) => new Promise((done) => {
  const p = spawn(cmd, args, { cwd: ROOT })
  let log = ""
  const take = (b) => { log += b; onLine?.(String(b)) }
  p.stdout.on("data", take); p.stderr.on("data", take)
  p.on("error", (e) => done({ ok: false, log: log + e.message }))
  p.on("close", (c) => done({ ok: c === 0, log }))
})
const readJson = (f) => JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, ""))
const contentPath = (n) => join(ROOT, "projects", n, "content.json")
const job = { running: false, log: "", ok: null, files: [] }

const api = {
  "GET /api/state": () => ({
    templates: readdirSync(join(ROOT, "templates")).filter(okTemplate).sort(),
    projects: existsSync(join(ROOT, "projects")) ? readdirSync(join(ROOT, "projects")).filter((n) => okName(n) && existsSync(contentPath(n))).map((n) => { let t = ""; try { t = readJson(contentPath(n)).template ?? "" } catch {} return { name: n, template: t } }) : [],
  }),
  "GET /api/project": (q) => {
    if (!okName(q.name) || !existsSync(contentPath(q.name))) throw new Error("no such project")
    const out = join(ROOT, "out", q.name)
    return { content: readJson(contentPath(q.name)), vo: existsSync(join(out, "vo.json")) ? readJson(join(out, "vo.json")) : null, mix: existsSync(join(out, "mix.wav")) }
  },
  "POST /api/create": (q, b) => {
    if (!okName(b.name)) throw new Error("Name: lower-case letters, digits and dashes only.")
    if (!okTemplate(b.template)) throw new Error("no such template")
    if (existsSync(contentPath(b.name))) throw new Error("A project with that name already exists.")
    mkdirSync(join(ROOT, "projects", b.name), { recursive: true })
    writeFileSync(contentPath(b.name), JSON.stringify({ template: b.template, ...readJson(join(ROOT, "templates", b.template, "content.json")) }, null, 2) + "\n")
    return { ok: true }
  },
  "POST /api/save": (q, b) => {
    if (!okName(b.name) || !b.content) throw new Error("bad request")
    mkdirSync(join(ROOT, "projects", b.name), { recursive: true })
    writeFileSync(contentPath(b.name), JSON.stringify(b.content, null, 2) + "\n")
    return { ok: true }
  },
  // Speaks the voice lines again; the page then rebuilds the timeline and asks for a new mix.
  "POST /api/voice": async (q, b) => {
    api["POST /api/save"](q, b)
    const r = await run(py, ["engine/tts.py", contentPath(b.name), join(ROOT, "out", b.name)])
    if (!r.ok) throw new Error("Voice failed. Has setup been run? (node engine/setup.mjs)\n" + r.log.slice(-600))
    return { vo: readJson(join(ROOT, "out", b.name, "vo.json")) }
  },
  "POST /api/mix": async (q, b) => {
    if (!okName(b.name) || !okTemplate(b.template) || !b.timeline) throw new Error("bad request")
    const out = join(ROOT, "out", b.name)
    writeFileSync(join(out, "timeline.json"), JSON.stringify({ id: b.template, fps: 60, ...b.timeline }))
    const r = await run(py, ["engine/audio.py", out, "--mix-only"])
    if (!r.ok) throw new Error("Sound failed.\n" + r.log.slice(-600))
    return { ok: true }
  },
  "POST /api/render": (q, b) => {
    if (job.running) throw new Error("A render is already running.")
    if (!okName(b.name) || !okTemplate(b.template)) throw new Error("bad request")
    Object.assign(job, { running: true, log: "", ok: null, files: [] })
    run("node", ["engine/make.mjs", b.template, contentPath(b.name), "--out", b.name, ...(b.draft ? ["--draft"] : []), ...(b.social ? ["--social"] : [])], (s) => { job.log = (job.log + s).slice(-4000) }).then((r) => {
      job.running = false; job.ok = r.ok
      job.files = [b.name, ...(b.social ? [b.name + "-vertical", b.name + "-square"] : [])].map((f) => `out/${b.name}/${f}.mp4`).filter((f) => existsSync(join(ROOT, f)))
    })
    return { ok: true }
  },
  "GET /api/job": () => job,
  // Reads the product's real website into the project folder (see engine/brand.mjs).
  "POST /api/brand": async (q, b) => {
    if (!okName(b.name) || !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(b.url ?? "")) throw new Error("Give a web address such as https://yoursite.com")
    const keep = existsSync(contentPath(b.name)) ? readFileSync(contentPath(b.name)) : null
    const r = await run("node", ["engine/brand.mjs", b.url, b.name])
    if (keep) writeFileSync(contentPath(b.name), keep)
    if (!r.ok) throw new Error("Could not read that site.\n" + r.log.slice(-400))
    return readJson(join(ROOT, "projects", b.name, "brand.json"))
  },
}

const server = createServer(async (req, res) => {
  const u = new URL(req.url, "http://x")
  const send = (code, body) => res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(body))
  const h = api[`${req.method} ${u.pathname}`]
  if (h) {
    try {
      let body = {}
      if (req.method === "POST") { let s = ""; for await (const c of req) s += c; body = s ? JSON.parse(s) : {} }
      return send(200, await h(Object.fromEntries(u.searchParams), body))
    } catch (e) { return send(400, { error: e.message }) }
  }
  const path = u.pathname === "/" ? "/engine/studio.html" : decodeURIComponent(u.pathname)
  const f = resolve(ROOT, "." + path)
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) return res.writeHead(404).end()
  // Range requests, so the browser can seek inside sound and video files.
  const size = statSync(f).size, m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "")
  const head = { "content-type": MIME[extname(f)] ?? "application/octet-stream", "accept-ranges": "bytes", "cache-control": "no-store" }
  if (m && size) {
    const a = m[1] ? +m[1] : Math.max(0, size - +m[2]), z = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1
    if (a > z) return res.writeHead(416, { "content-range": `bytes */${size}` }).end()
    res.writeHead(206, { ...head, "content-range": `bytes ${a}-${z}/${size}`, "content-length": z - a + 1 })
    return createReadStream(f, { start: a, end: z }).pipe(res)
  }
  res.writeHead(200, { ...head, "content-length": size })
  createReadStream(f).pipe(res)
})
const want = +arg("port", 4173)
server.on("error", () => server.listen(0, "127.0.0.1"))
server.on("listening", () => {
  const url = `http://127.0.0.1:${server.address().port}/`
  console.log(`LaunchFX Studio: ${url}\nLeave this running; press Ctrl+C to stop.`)
  if (!process.argv.includes("--no-open")) {
    const [c, a] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]]
    spawn(c, a, { stdio: "ignore", detached: true }).on("error", () => {})
  }
})
server.listen(want, "127.0.0.1")
