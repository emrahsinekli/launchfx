// Reads a product's real website and collects what a video needs: name, words, numbers, brand colours, logo and screenshots.
// node engine/brand.mjs <url> [name]
// Writes projects/<name>/brand.json, logo.png, screen.png, screen-2.png, screen-3.png, mobile.png and full.jpg.
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import puppeteer from "puppeteer-core"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
let url = process.argv[2]
if (!url) { console.error("usage: node engine/brand.mjs <url> [name]"); process.exit(1) }
if (!/^https?:\/\//i.test(url)) url = "https://" + url
const host = new URL(url).hostname.replace(/^www\./, "")
const slug = (process.argv[3] || host.split(".")[0]).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product"
const OUT = join(ROOT, "projects", slug)
mkdirSync(OUT, { recursive: true })

const CHROME = process.env.CHROME_PATH || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => existsSync(p))
if (!CHROME) { console.error("Chrome was not found. Install Google Chrome, or set CHROME_PATH to a Chrome/Chromium/Edge executable."); process.exit(1) }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--force-color-profile=srgb", "--lang=en-US"] })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const open = async (page) => {
  // A site that never goes quiet still counts once it has loaded.
  await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 }).catch(async (e) => { if (!(await page.title().catch(() => ""))) throw e })
  await sleep(1200)
  // Cookie and consent bars would end up in every screenshot.
  await page.evaluate(() => {
    for (const e of document.querySelectorAll("body *")) {
      const s = getComputedStyle(e)
      if (s.position !== "fixed" && s.position !== "sticky") continue
      const r = e.getBoundingClientRect()
      if (/cookie|consent|gdpr/i.test(e.innerText || "") && r.width * r.height < innerWidth * innerHeight * 0.6) e.remove()
    }
  })
}

const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 })
try { await open(page) } catch (e) { console.error(`could not open ${url}: ${e.message}`); await browser.close(); process.exit(1) }

const info = await page.evaluate(() => {
  const meta = (n) => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content?.trim() || ""
  const box = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 4 && r.height > 4 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.1 ? r : null }
  const clean = (t) => (t || "").replace(/\s+/g, " ").trim()
  const texts = (sel, max, len = 200) => [...new Set([...document.querySelectorAll(sel)].filter(box).map((e) => clean(e.innerText)).filter((t) => t.length > 1 && t.length <= len))].slice(0, max)

  // Any CSS colour, in any notation, as r g b a.
  const cv = document.createElement("canvas"); cv.width = cv.height = 1
  const cx = cv.getContext("2d", { willReadFrequently: true })
  const px = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data] }
  const hex = (c) => "#" + c.slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("")
  // The brand colour is the saturated colour the site spends on its buttons, links and accents.
  const score = new Map()
  const add = (css, w) => {
    if (!css || css === "none") return
    const c = px(css); if (c[3] < 128) return
    const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2])
    if (mx - mn < 45 || mx < 70) return
    const k = hex(c.map((v) => Math.min(255, Math.round(v / 12) * 12)))
    const o = score.get(k) ?? { w: 0, c }
    o.w += w * ((mx - mn) / mx); score.set(k, o)
  }
  const stops = (bg) => bg.match(/(rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi) ?? []
  for (const e of document.querySelectorAll("a,button,[role=button],input[type=submit],h1,h2,h3,span,strong,em,mark,svg,path,div,section,header")) {
    const r = box(e); if (!r || r.top > innerHeight * 4) continue
    const s = getComputedStyle(e), area = Math.min(r.width * r.height, 60000) / 60000
    const act = e.matches("a,button,[role=button],input[type=submit]")
    add(s.backgroundColor, (act ? 6 : 1) * area)
    for (const g of stops(s.backgroundImage)) add(g, (act ? 4 : 1.5) * area)
    if (e.matches("a,h1,h2,h3,span,strong,em,mark")) add(s.color, act ? 1 : 0.6)
    if (e.matches("svg,path")) { add(s.fill, 0.5); add(s.stroke, 0.3) }
  }
  if (meta("theme-color")) add(meta("theme-color"), 2)
  const colors = [...score.values()].sort((a, b) => b.w - a.w).slice(0, 5).map((o) => hex(o.c))

  let bg = [255, 255, 255, 255]
  for (const e of [document.body, document.documentElement]) { const c = px(getComputedStyle(e).backgroundColor); if (c[3] > 128) { bg = c; break } }
  const dark = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2] < 110

  const icons = [...document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"],link[rel="apple-touch-icon-precomposed"],link[rel="mask-icon"]')].map((l) => {
    const size = parseInt(l.sizes?.value) || (l.rel.includes("apple") ? 180 : 0), svg = /svg/.test(l.type) || /\.svg(\?|$)/.test(l.href)
    return { href: l.href, rank: l.rel === "mask-icon" ? 1 : svg ? 1000 : size || 16 }
  }).sort((a, b) => b.rank - a.rank).map((i) => i.href)
  icons.push(new URL("/favicon.ico", location.href).href)

  const h1 = texts("h1", 2)
  const title = clean(document.title)
  const site = meta("og:site_name") || meta("application-name")
  const hostWord = location.hostname.replace(/^www\./, "").split(".")[0]
  const part = title.split(/\s[|\-–—·]\s|:\s/).map(clean).sort((a, b) => a.length - b.length).find((p) => p.toLowerCase().replace(/[^a-z0-9]/g, "").includes(hostWord.replace(/[^a-z0-9]/g, "")))
  // Sentences with digits in them: the only numbers a video may quote.
  const figures = [...new Set([...document.querySelectorAll("h1,h2,h3,h4,p,li,span,strong,b,div,td,dd")].filter((e) => !e.children.length && box(e)).map((e) => clean(e.innerText)).filter((t) => /\d/.test(t) && t.length > 1 && t.length <= 90 && !/©|copyright|\b(19|20)\d\d\b.*rights/i.test(t)))].slice(0, 24)
  return {
    name: site || part || hostWord[0].toUpperCase() + hostWord.slice(1),
    title, tagline: h1[0] || meta("og:title") || title,
    description: meta("description") || meta("og:description"),
    lang: document.documentElement.lang || "",
    theme: dark ? "dark" : "light", background: hex(bg), color: colors[0] || "", colors,
    font: (h1.length ? getComputedStyle(document.querySelector("h1")).fontFamily : getComputedStyle(document.body).fontFamily).split(",")[0].replace(/["']/g, "").trim(),
    headings: texts("h1,h2,h3", 14, 120),
    paragraphs: texts("main p, section p, header p, article p, p", 8, 260),
    buttons: texts("a[class*=btn],a[class*=button],a[class*=cta],button,[role=button]", 8, 32),
    figures, icons,
  }
})

const files = {}
await page.evaluate(() => scrollTo(0, 0))
const shot = await page.screenshot({ path: join(OUT, "screen.png") }); files.screen = `projects/${slug}/screen.png`
const tall = await page.evaluate(() => document.documentElement.scrollHeight)
files.screens = [files.screen]
for (let i = 1; i <= 2 && i * 900 < tall - 500; i++) {
  await page.evaluate((y) => scrollTo(0, y), i * 900); await sleep(700)
  await page.screenshot({ path: join(OUT, `screen-${i + 1}.png`) }); files.screens.push(`projects/${slug}/screen-${i + 1}.png`)
}
// The whole page as one image, for the agent to read; walk down first so lazy sections load.
for (let y = 0; y < Math.min(tall, 9000); y += 800) { await page.evaluate((y) => scrollTo(0, y), y); await sleep(120) }
await page.evaluate(() => scrollTo(0, 0)); await sleep(300)
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })
await page.screenshot({ path: join(OUT, "full.jpg"), type: "jpeg", quality: 80, clip: { x: 0, y: 0, width: 1600, height: Math.min(tall, 9000) } }).then(() => { files.full = `projects/${slug}/full.jpg` }).catch(() => {})

// The logo: the best icon the site declares, drawn at 512 px on a transparent background.
let logoShot
const tile = await browser.newPage()
await tile.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 })
for (const href of info.icons) {
  await tile.setContent(`<body style="margin:0;background:transparent"><img id="i" style="width:512px;height:512px;object-fit:contain;display:block" src="${href.replace(/"/g, "&quot;")}">`)
  const w = await tile.evaluate(() => new Promise((r) => { const i = document.getElementById("i"); const done = () => r(i.naturalWidth || (i.complete && i.naturalHeight === 0 && /svg/.test(i.src) ? 512 : 0)); if (i.complete) done(); else { i.onload = done; i.onerror = () => r(0); setTimeout(() => r(0), 8000) } }))
  if (!w) continue
  logoShot = await tile.screenshot({ path: join(OUT, "logo.png"), omitBackground: true })
  files.logo = `projects/${slug}/logo.png`; files.logoSourceWidth = w
  break
}
// What the pixels say: the page background decides dark or light, and a site with no coloured buttons still has a coloured logo.
const pixels = (buf, w, h) => tile.evaluate(async (src, w, h) => {
  const i = new Image(); i.src = src; await i.decode()
  const c = document.createElement("canvas"); c.width = w; c.height = h
  const x = c.getContext("2d"); x.drawImage(i, 0, 0, w, h)
  return [...x.getImageData(0, 0, w, h).data]
}, "data:image/png;base64," + Buffer.from(buf).toString("base64"), w, h)
const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
await tile.setContent("<body></body>")
{
  const d = await pixels(shot, 160, 100), n = new Map()
  for (let y = 0; y < 100; y++) for (let x = 0; x < 160; x++) {
    if (x > 2 && x < 157 && y > 2 && y < 97) continue
    const i = (y * 160 + x) * 4, k = hex(d[i], d[i + 1], d[i + 2]); n.set(k, (n.get(k) ?? 0) + 1)
  }
  info.background = [...n].sort((a, b) => b[1] - a[1])[0][0]
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(info.background.slice(i, i + 2), 16))
  info.theme = 0.2126 * r + 0.7152 * g + 0.0722 * b < 110 ? "dark" : "light"
}
if (logoShot) {
  const d = await pixels(logoShot, 48, 48), n = new Map()
  for (let i = 0; i < d.length; i += 4) {
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2])
    if (d[i + 3] < 200 || mx - mn < 45 || mx < 70) continue
    const k = hex(...[d[i], d[i + 1], d[i + 2]].map((v) => Math.min(255, Math.round(v / 24) * 24)))
    const o = n.get(k) ?? { w: 0, c: [d[i], d[i + 1], d[i + 2]] }; o.w += (mx - mn) / mx; n.set(k, o)
  }
  info.logoColors = [...n.values()].sort((a, b) => b.w - a.w).slice(0, 3).map((o) => hex(...o.c))
  if (!info.color && info.logoColors.length) { info.color = info.logoColors[0]; info.colorFrom = "logo" }
}
if (!info.color) info.note = "No brand colour found: the site is black and white. Ask the user for one, or pick a colour that suits the template."
await tile.close()

// The phone view, for templates that show the product on a phone.
const phone = await browser.newPage()
await phone.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
await phone.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
try { await open(phone); await phone.screenshot({ path: join(OUT, "mobile.png") }); files.mobile = `projects/${slug}/mobile.png` } catch {}
await browser.close()

delete info.icons
const brand = { url, host, ...info, files }
writeFileSync(join(OUT, "brand.json"), JSON.stringify(brand, null, 2) + "\n")
console.log(`name     ${brand.name}`)
console.log(`tagline  ${brand.tagline}`)
console.log(`colour   ${brand.color || "(none found, ask the user)"}  ${brand.colors.slice(1).join(" ")}`)
console.log(`theme    ${brand.theme}`)
console.log(`logo     ${files.logo ? `${files.logo} (source ${files.logoSourceWidth} px wide${files.logoSourceWidth < 128 ? ", small: ask the user for a better one" : ""})` : "(none found)"}`)
console.log(`shots    ${[...files.screens, files.mobile, files.full].filter(Boolean).join(", ")}`)
console.log(`\nwritten  projects/${slug}/brand.json`)
