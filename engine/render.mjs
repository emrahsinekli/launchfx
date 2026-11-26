// node engine/render.mjs <template id> [--content file] [--fps 60] [--stills 1.2,3.4]
// Draws a template frame by frame in headless Chrome and pipes the frames to ffmpeg.
import { createServer } from "node:http"
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, extname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import puppeteer from "puppeteer-core"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i < 0 ? d : process.argv[i + 1] }
const id = process.argv[2]
const OUT = join(ROOT, "out", arg("out", id))
const FPS = +arg("fps", 60)
const content = JSON.parse(readFileSync(arg("content", join(ROOT, "templates", id, "content.json")), "utf8"))
const vo = JSON.parse(readFileSync(join(OUT, "vo.json"), "utf8"))
const stills = arg("stills")?.split(",").map(Number)

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" }
const server = createServer((q, r) => {
  const f = resolve(ROOT, "." + decodeURIComponent(new URL(q.url, "http://x").pathname))
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) return r.writeHead(404).end()
  r.writeHead(200, { "content-type": MIME[extname(f)] ?? "application/octet-stream" }).end(readFileSync(f))
})
await new Promise((r) => server.listen(0, "127.0.0.1", r))

const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => existsSync(p))
if (!CHROME) { console.error("Chrome was not found. Install Google Chrome, or set CHROME_PATH to a Chrome/Chromium/Edge executable."); process.exit(1) }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: [...(process.platform === "win32" ? ["--use-angle=d3d11"] : []), "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--hide-scrollbars", "--force-color-profile=srgb", "--lang=en-US"] })
const page = await browser.newPage()
page.on("pageerror", (e) => console.error("page error:", e.message))
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
await page.goto(`http://127.0.0.1:${server.address().port}/templates/${id}/template.html`)
// Fonts load lazily, so force them in before anything is measured.
await page.evaluate(() => Promise.all([...document.fonts].map((f) => f.load())))
const tl = await page.evaluate((c, v) => window.setup(c, v), content, vo)
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))))
// Live footage: where a template shows projects/<name>/screen*.png or mobile*.png and a recorded tour sits beside it,
// the tour plays in that picture while it is on screen. "tour": false in the content file turns this off.
if (content.tour !== false) {
  const shown = await page.evaluate(() => [...document.images].map((im, i) => ({ i, path: decodeURIComponent(new URL(im.src, location.href).pathname) })))
  const list = []
  for (const o of shown) {
    const m = o.path.match(/^\/(.+)\/(screen|mobile)[^/]*\.(png|jpe?g|webp)$/i); if (!m) continue
    const dir = `${m[1]}/${m[2].toLowerCase() === "mobile" ? "tour-mobile" : "tour"}`
    if (existsSync(join(ROOT, dir, "tour.json"))) list.push({ i: o.i, dir, ...JSON.parse(readFileSync(join(ROOT, dir, "tour.json"), "utf8")) })
  }
  if (list.length) {
    const plays = await page.evaluate((list, T, clicks) => {
      const imgs = [...document.images]
      const seen = (e) => {
        const r = e.getBoundingClientRect()
        if (r.width < 120 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false
        for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === "none" || s.visibility === "hidden" || +s.opacity < 0.05) return false }
        return true
      }
      const plays = list.map((o) => ({ ...o, el: imgs[o.i], t0: -1, t1: -1, at: 0 }))
      // When is each picture on screen? Walk the whole video once and note it.
      for (let t = 0; t <= T; t += 0.1) { window.frame(t); for (const p of plays) if (seen(p.el)) { if (p.t0 < 0) p.t0 = t; p.t1 = t } }
      for (const p of plays) {
        if (p.t0 < 0) continue
        // A click in the scene sets the page moving; otherwise it starts shortly after the picture arrives.
        const c = clicks.find((t) => t > p.t0 && t < p.t1 - 0.8)
        p.start = c != null ? c + 0.2 : p.t0 + 0.45
        p.span = Math.max(0.5, Math.min(p.frames / p.fps, p.t1 - p.start - 0.3))
      }
      const draw = window.frame
      window.frame = async (t) => {
        draw(t)
        for (const p of plays) {
          if (p.t0 < 0) continue
          const n = 1 + Math.round(Math.min(1, Math.max(0, (t - p.start) / p.span)) * (p.frames - 1))
          if (n === p.at) continue
          p.at = n; p.el.src = "/" + p.dir + "/" + String(n).padStart(4, "0") + ".jpg"
          await p.el.decode().catch(() => {})
        }
      }
      return plays.filter((p) => p.t0 >= 0).map((p) => `${p.dir} ${p.start.toFixed(1)}-${(p.start + p.span).toFixed(1)} s`)
    }, list, tl.T, (tl.cues ?? []).filter((c) => c.k === "click").map((c) => c.t))
    if (plays.length) console.log("live footage:", plays.join(", "))
  }
}
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, "timeline.json"), JSON.stringify({ id, fps: FPS, ...tl }))
console.log("length", tl.T.toFixed(2), "s, scenes at", tl.s.map((x) => x.toFixed(2)).join(" "))

if (stills) {
  mkdirSync(join(OUT, "stills"), { recursive: true })
  for (const t of stills) {
    await page.evaluate((t) => window.frame(t), t)
    await page.screenshot({ path: join(OUT, "stills", `${t.toFixed(2)}.jpg`), type: "jpeg", quality: 88 })
  }
} else {
  // Motion blur: MB sub-frames are drawn for every output frame and averaged. Bloom and film grain are added after.
  const MB = +arg("mb", 4), RATE = FPS * MB
  const lut = "clip((val-150)*2.4,0,255)"
  // A template sets its own finish: dark ones glow (bloom), light ones must not.
  const post = { bloom: 0.5, grain: 6, ...(tl.post ?? {}) }
  const mix = `[0:v]format=gbrp${MB > 1 ? `,tmix=frames=${MB},select='eq(mod(n,${MB}),${MB - 1})',setpts=N/(${FPS}*TB)` : ""}`
  const end = `${post.grain ? `noise=alls=${post.grain}:allf=t,` : ""}scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]`
  const graph = post.bloom ? `${mix},split[a][b];[b]lutrgb=r='${lut}':g='${lut}':b='${lut}',gblur=sigma=26[c];[a][c]blend=all_mode=screen:all_opacity=${post.bloom},${end}` : `${mix},${end}`
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(RATE), "-i", "-", "-filter_complex", graph, "-map", "[v]", "-r", String(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", arg("crf", "15"), "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", "-movflags", "+faststart", join(OUT, "silent.mp4")], { stdio: ["pipe", "inherit", "inherit"] })
  const done = new Promise((r) => ff.on("close", r))
  const cdp = await page.createCDPSession()
  const n = Math.round(tl.T * RATE)
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.frame(t), i / RATE)
    const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 93, optimizeForSpeed: true })
    if (!ff.stdin.write(Buffer.from(data, "base64"))) await new Promise((r) => ff.stdin.once("drain", r))
    if (i % 480 === 0) console.log("frame", i, "/", n)
  }
  ff.stdin.end()
  await done
  console.log("picture done")
}
await browser.close()
server.close()
