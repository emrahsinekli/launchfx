// Turns a finished video into vertical (9:16) and square (1:1) versions with the name on top and word-by-word captions.
// node engine/social.mjs <name> --content <content.json> [--formats vertical,square]
// Reads out/<name>/<name>.mp4 and timeline.json; writes out/<name>/<name>-vertical.mp4 and <name>-square.mp4.
// The spoken lines are the captions. A content file may add "captions": [...] to show different spelling than the voice reads.
import { spawn } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import puppeteer from "puppeteer-core"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i < 0 ? d : process.argv[i + 1] }
const name = process.argv[2]
const OUT = join(ROOT, "out", name || "")
const src = join(OUT, name + ".mp4")
if (!name || !existsSync(src) || !arg("content")) { console.error("usage: node engine/social.mjs <name> --content <content.json> [--formats vertical,square]\nRender the video first with engine/make.mjs."); process.exit(1) }
const content = JSON.parse(readFileSync(arg("content"), "utf8"))
const tl = JSON.parse(readFileSync(join(OUT, "timeline.json"), "utf8"))
const FPS = 30
const FORMATS = {
  // w, h of the output; y of the 16:9 picture; head: logo and name; cap: caption centre and size; url: bottom pill.
  vertical: { w: 1080, h: 1920, y: 470, head: { y: 250, size: 76, logo: 96 }, cap: { y: 1400, size: 104, width: 940 }, url: { y: 1730, size: 38 } },
  square: { w: 1080, h: 1080, y: 150, head: { y: 76, size: 44, logo: 56 }, cap: { y: 905, size: 78, width: 980 }, url: null },
}
const formats = arg("formats", "vertical,square").split(",").filter((f) => FORMATS[f])

// Captions: every voice line is cut into groups of up to three words; a word's moment is its share of the line's letters.
const lines = content.captions ?? content.vo ?? []
const groups = []
lines.forEach((line, i) => {
  const v = tl.vo?.[i]; if (!v || !line) return
  const words = line.trim().split(/\s+/), total = words.join("").length
  let at = 0, g = null
  for (const w of words) {
    const t = v.t + (v.d * at) / total
    if (!g || g.words.length === 3 || g.close) groups.push((g = { t, end: v.t + v.d + 0.35, words: [] }))
    g.words.push({ w, t }); g.close = /[.,!?;:]$/.test(w); at += w.length
  }
})
groups.forEach((g, i) => { const n = groups[i + 1]; if (n && n.t < g.end) g.end = n.t })

const b = content.brand ?? {}
const colour = b.color || (b.hue != null ? `oklch(0.72 0.19 ${b.hue})` : "#ffffff")
const file = (p) => pathToFileURL(resolve(ROOT, p)).href
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const page_ = (F) => `<!doctype html><meta charset="utf8"><style>
@font-face{font-family:D;src:url("${file("fonts/display.woff2")}")}
@font-face{font-family:M;src:url("${file("fonts/mono.woff2")}")}
*{margin:0;box-sizing:border-box}
html,body{width:${F.w}px;height:${F.h}px;background:transparent;overflow:hidden;font-family:D,system-ui,sans-serif;color:#fff}
#edge{position:absolute;left:0;top:${F.y}px;width:${F.w}px;height:${Math.round((F.w * 9) / 16)}px;box-shadow:0 0 0 2px rgba(255,255,255,.14),0 40px 90px rgba(0,0,0,.55),0 -30px 80px rgba(0,0,0,.35)}
#head{position:absolute;left:0;width:100%;top:${F.head.y}px;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;gap:${F.head.logo * 0.3}px;font-size:${F.head.size}px;font-weight:800;letter-spacing:-.03em;text-shadow:0 4px 30px rgba(0,0,0,.5)}
#head img{width:${F.head.logo}px;height:${F.head.logo}px;object-fit:contain}
#cap{position:absolute;left:50%;top:${F.cap.y}px;width:${F.cap.width}px;transform:translate(-50%,-50%);text-align:center;font-size:${F.cap.size}px;font-weight:800;line-height:1.08;letter-spacing:-.035em;text-shadow:0 6px 40px rgba(0,0,0,.65),0 2px 6px rgba(0,0,0,.5)}
#cap span{display:inline-block;margin:0 .13em;will-change:transform}
#url{position:absolute;left:50%;top:${F.url?.y ?? 0}px;transform:translate(-50%,-50%);font:500 ${F.url?.size ?? 0}px M,monospace;padding:.55em 1.1em;border-radius:99px;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.22);white-space:nowrap}
</style><div id="edge"></div>
<div id="head">${b.logo ? `<img src="${file(b.logo)}">` : ""}<span>${esc(b.name)}</span></div>
<div id="cap"></div>${F.url && b.url ? `<div id="url">${esc(b.url)}</div>` : ""}
<script>
const G = ${JSON.stringify(groups)}, T = ${tl.T}, HOT = "color-mix(in oklch, ${colour} 62%, white)"
const cap = document.getElementById("cap"), head = document.getElementById("head"), url = document.getElementById("url")
const out = (x) => { x = Math.min(1, Math.max(0, x)); return 1 - Math.pow(1 - x, 3) }
const back = (x) => { x = Math.min(1, Math.max(0, x)); const c = 2.2; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }
let shown = -1
window.frame = (t) => {
  const i = G.findIndex((g) => t >= g.t && t < g.end)
  if (i !== shown) { shown = i; cap.innerHTML = i < 0 ? "" : G[i].words.map((w) => "<span>" + w.w.replace(/[&<]/g, (c) => (c === "&" ? "&amp;" : "&lt;")) + "</span>").join("") }
  if (i >= 0) [...cap.children].forEach((e, k) => {
    const w = G[i].words[k], nx = G[i].words[k + 1], a = t - w.t
    const live = a >= 0 && (!nx || t < nx.t)
    e.style.opacity = a < 0 ? 0.001 : 1
    e.style.transform = "translateY(" + (1 - out(a / 0.14)) * 26 + "px) scale(" + (0.86 + 0.14 * back(a / 0.2)) * (live ? 1.04 : 1) + ")"
    e.style.color = live ? HOT : "#fff"
  })
  const k = out(t / 0.5) * out((T - t) / 0.3 + 0.0001)
  head.style.opacity = k; head.style.transform = "translateY(calc(-50% + " + (1 - out(t / 0.5)) * -24 + "px))"
  if (url) url.style.opacity = out((t - 0.3) / 0.5)
}
</script>`

const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => existsSync(p))
if (!CHROME) { console.error("Chrome was not found. Install Google Chrome, or set CHROME_PATH to a Chrome/Chromium/Edge executable."); process.exit(1) }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--allow-file-access-from-files", "--hide-scrollbars", "--force-color-profile=srgb"] })
const still = arg("still")
for (const f of formats) {
  const F = FORMATS[f]
  const html = join(OUT, `overlay-${f}.html`)
  writeFileSync(html, page_(F))
  const page = await browser.newPage()
  page.on("pageerror", (e) => console.error("page error:", e.message))
  await page.setViewport({ width: F.w, height: F.h, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(html).href)
  await page.evaluate(() => Promise.all([...document.fonts].map((x) => x.load())))
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))))
  const cdp = await page.createCDPSession()
  await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } })
  // The picture sits on a blurred, darkened copy of itself; the overlay frames arrive on the pipe.
  const ph = Math.round((F.w * 9) / 16)
  const graph = `[0:v]split[a][b];[a]scale=-2:${F.h / 4},crop=${F.w / 4}:${F.h / 4},boxblur=14:2,eq=brightness=-0.3:saturation=1.3,scale=${F.w}:${F.h}[bg];[b]scale=${F.w}:${ph}[fg];[bg][fg]overlay=0:${F.y}[m];[m][1:v]overlay=0:0:eof_action=repeat,format=yuv420p[v]`
  const dst = still ? join(OUT, `${name}-${f}.jpg`) : join(OUT, `${name}-${f}.mp4`)
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", ...(still ? ["-ss", still] : []), "-i", src, "-f", "image2pipe", "-c:v", "png", "-framerate", String(FPS), "-i", "-", "-filter_complex", graph, "-map", "[v]", ...(still ? ["-frames:v", "1", "-q:v", "3"] : ["-map", "0:a?", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-c:a", "copy", "-movflags", "+faststart"]), dst], { stdio: ["pipe", "inherit", "inherit"] })
  const done = new Promise((r) => ff.on("close", r))
  ff.stdin.on("error", () => {})
  const n = still ? 1 : Math.round(tl.T * FPS)
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.frame(t), still ? +still : i / FPS)
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" })
    if (!ff.stdin.write(Buffer.from(data, "base64"))) await new Promise((r) => ff.stdin.once("drain", r))
  }
  ff.stdin.end()
  if ((await done) !== 0) { console.error(`${f} failed`); process.exit(1) }
  await page.close()
  console.log(`${f}: ${dst}`)
}
await browser.close()
