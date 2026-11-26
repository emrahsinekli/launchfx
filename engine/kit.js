// Shared timing helpers. Every template draws a frame as a pure function of time, so renders are repeatable.
window.K = {
  clamp: (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)),
  p: (t, s, d) => Math.min(1, Math.max(0, (t - s) / d)),
  lerp: (a, b, x) => a + (b - a) * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inCubic: (x) => x * x * x,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  fmt: (v, o = {}) => (o.prefix ?? "") + v.toLocaleString("en-US", { minimumFractionDigits: o.dec ?? 0, maximumFractionDigits: o.dec ?? 0 }) + (o.suffix ?? ""),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  // Seeded random numbers, so every render of a template is identical.
  rnd: (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 },
  // Paths in a content file are relative to the pack folder.
  asset: (p) => (/^(https?:|data:|\/)/.test(p) ? p : "/" + p.split("\\").join("/")),
  // Any CSS colour as [r, g, b] in 0..1.
  rgb: (css) => { const c = document.createElement("canvas"); c.width = c.height = 1; const x = c.getContext("2d"); x.fillStyle = css; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255] },
  // Fills in the three brand hues from whatever the buyer gave: hues, hex colours, or one hex colour.
  brand: (b) => { if (b.hue == null) b.hue = b.color ? K.hue(b.color) : 268; if (b.hue2 == null) b.hue2 = b.color2 ? K.hue(b.color2) : (b.hue + 292) % 360; if (b.hue3 == null) b.hue3 = b.color3 ? K.hue(b.color3) : (b.hue + 62) % 360; return b },
  // Shrinks an element's font size until it is no wider than max.
  fit: (e, max) => { const w = e.offsetWidth; if (w > max) e.style.fontSize = (parseFloat(getComputedStyle(e).fontSize) * max) / w + "px" },
  // Scene start times on the beat grid G; a scene grows when its voice line needs more room.
  timeline: (vo, min, off, tail, G) => { const s = [0]; for (let i = 0; i < min.length; i++) s.push(Math.ceil((s[i] + Math.max(min[i], off[i] + vo[i] + tail[i])) / G - 1e-6) * G); return { s, dur: s.slice(1).map((x, i) => x - s[i]) } },
  // Hue (0-360, OKLCH) of a hex colour, so a buyer can just give their brand colour.
  hue: (hex) => {
    const n = parseInt(hex.replace("#", ""), 16), f = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
    const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255)
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return Math.round(((Math.atan2(0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s) * 180) / Math.PI + 360) % 360)
  },
  // Smooth curve through points (Catmull-Rom to cubic Bezier).
  curve: (pts) => {
    let d = `M${pts[0][0]},${pts[0][1]}`
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], e = pts[Math.min(pts.length - 1, i + 2)]
      d += ` C${b[0] + (c[0] - a[0]) / 6},${b[1] + (c[1] - a[1]) / 6} ${c[0] - (e[0] - b[0]) / 6},${c[1] - (e[1] - b[1]) / 6} ${c[0]},${c[1]}`
    }
    return d
  },
}
