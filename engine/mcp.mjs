// LaunchFX MCP server (stdio). Lets any MCP client (Claude Code, Claude Desktop, Cursor, Codex, Windsurf) read a
// product's site, plan a launch, write the content, look at preview frames and render the video on this computer.
//   node engine/mcp.mjs            run the server (the client starts it; you do not run it by hand)
//   node engine/mcp.mjs --config   print the settings to paste into each client
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { createInterface } from "node:readline"
import { fileURLToPath } from "node:url"
import { core, fail, ok, RULES } from "./mcp-core.mjs"

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, "..")
const SELF = join(HERE, "mcp.mjs").replaceAll("\\", "/")

if (process.argv.includes("--config")) {
  const j = JSON.stringify({ mcpServers: { launchfx: { command: "node", args: [SELF] } } }, null, 2)
  console.log(`Claude Code (run in any folder):\n  claude mcp add launchfx -- node "${SELF}"\n  (inside this folder nothing is needed: .mcp.json is already here)\n\nCodex:\n  codex mcp add launchfx -- node "${SELF}"\n\nClaude Desktop (Settings > Developer > Edit Config), Cursor (~/.cursor/mcp.json), Windsurf:\n${j}\n\nNo local install, ideas and scripts only (claude.ai > Settings > Connectors > Add custom connector):\n  https://launchfx.dev/mcp`)
  process.exit(0)
}

const json = (f) => JSON.parse(readFileSync(f, "utf8"))
const tpl = (id, f) => join(ROOT, "templates", id, f)
const C = core({
  catalog: json(join(HERE, "catalog.json")), kits: json(join(HERE, "kits.json")), local: true,
  read: (id, f) => (existsSync(tpl(id, f)) ? readFileSync(tpl(id, f), "utf8") : null),
  installed: (id) => existsSync(tpl(id, "template.html")),
})
const PY = process.platform === "win32" ? "python" : "python3", NODE = process.execPath
const safe = (s, d) => String(s ?? d ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const rel = (f) => f.slice(ROOT.length + 1).replaceAll("\\", "/")
const tail = (s, n = 1500) => (s.length > n ? "…" + s.slice(-n) : s)

// ---------------------------------------------------------------- jobs: long steps run in the background
const jobs = new Map(); let seq = 0
function start(label, steps, finish) {
  const job = { id: "job-" + ++seq, label, state: "running", log: "", started: Date.now(), finish }
  const add = (b) => { job.log = (job.log + b).slice(-6000) }
  job.done = (async () => {
    for (const [cmd, args] of steps) {
      const code = await new Promise((res) => { const p = spawn(cmd, args, { cwd: ROOT, windowsHide: true }); p.stdout.on("data", add); p.stderr.on("data", add); p.on("error", (e) => { add(e.message); res(1) }); p.on("close", res) })
      if (code !== 0) { job.state = "failed"; return }
    }
    job.state = "done"
  })()
  jobs.set(job.id, job)
  return job
}
async function answer(job, wait = 40) {
  await Promise.race([job.done, new Promise((r) => setTimeout(r, Math.max(0, Math.min(55, +wait || 0)) * 1000))])
  const secs = Math.round((Date.now() - job.started) / 1000)
  if (job.state === "running") return ok({ job: job.id, state: "running", task: job.label, seconds: secs, log: tail(job.log, 400), next: `Still working. Call job_status with job "${job.id}" until it is done.` })
  if (job.state === "failed") return fail(`${job.label} failed after ${secs} s.\n${tail(job.log)}\nIf a tool is missing, run the setup tool.`)
  return job.finish ? await job.finish(job) : ok({ job: job.id, state: "done", task: job.label, seconds: secs })
}
const run = (cmd, args) => new Promise((res) => { const p = spawn(cmd, args, { cwd: ROOT, windowsHide: true, stdio: "ignore" }); p.on("error", () => res(1)); p.on("close", res) })
// A picture small enough to send to the model.
async function image(file, name) {
  const out = join(ROOT, "out", ".mcp"); mkdirSync(out, { recursive: true })
  const small = join(out, name + ".jpg")
  const code = await run("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-vf", "scale=960:-2", "-q:v", "4", small])
  if (code !== 0 || !existsSync(small)) return null
  return { type: "image", data: readFileSync(small).toString("base64"), mimeType: "image/jpeg" }
}

// ---------------------------------------------------------------- projects
function project(a) {
  const name = safe(a.project), file = safe(a.file, "content") || "content"
  if (!name) throw new Error("project is required: the folder name under projects/, e.g. 'acme'.")
  const path = join(ROOT, "projects", name, file + ".json")
  return { name, file, path, out: file === "content" ? name : `${name}-${file}` }
}
function loaded(a) {
  const p = project(a)
  if (!existsSync(p.path)) throw new Error(`${rel(p.path)} does not exist. Write it with save_content first.`)
  const content = json(p.path), t = C.find(a.template ?? content.template)
  if (!t) throw new Error(`${rel(p.path)} has no "template" key. Save it again with save_content and name the template.`)
  if (!existsSync(tpl(t.id, "template.html"))) throw new Error(`Template ${t.name} is not installed in this folder. ${C.getIt}`)
  return { ...p, content, id: t.id }
}
// What differs from the sample: missing keys, wrong number of voice lines, text left over from the sample product.
function check(content, sample) {
  const notes = []
  const walk = (s, c, at) => {
    if (s === null || typeof s !== "object" || Array.isArray(s)) return
    for (const k of Object.keys(s)) {
      if (k === "voice") continue
      if (c?.[k] === undefined) { notes.push(`missing "${at}${k}" (the sample has it; fine only if the guide calls it optional)`); continue }
      walk(s[k], c[k], at + k + ".")
    }
  }
  walk(sample, content, "")
  if (Array.isArray(sample.vo) && Array.isArray(content.vo) && sample.vo.length !== content.vo.length) notes.push(`"vo" has ${content.vo.length} lines; this template needs exactly ${sample.vo.length}`)
  const was = sample.brand?.name, now = content.brand?.name
  if (was && now && was !== now) {
    const hits = []; const scan = (v, at) => { if (typeof v === "string") { if (v.includes(was)) hits.push(at) } else if (v && typeof v === "object") for (const k of Object.keys(v)) scan(v[k], at ? at + "." + k : k) }
    scan(content, "")
    if (hits.length) notes.push(`the sample product's name "${was}" is still in: ${hits.join(", ")}`)
  }
  for (const k of ["logo"]) if (content.brand?.[k] && !existsSync(join(ROOT, content.brand[k]))) notes.push(`brand.${k} points at ${content.brand[k]}, which does not exist`)
  return notes
}

// ---------------------------------------------------------------- tools that need this computer
const P = { project: { type: "string", description: "Project folder name under projects/, e.g. 'acme'." }, file: { type: "string", description: "Optional. Content file name without .json when a project has several videos, e.g. '01-teaser'. Default 'content'." }, wait_seconds: { type: "number", description: "Optional. How long to wait for the result before returning a job id (0 to 55, default 40)." } }
const tools = [
  {
    name: "setup",
    description: "Check and install what LaunchFX needs on this computer (Node packages, Python packages, the voice model, ffmpeg, Chrome). Run once, or when another tool reports something missing.",
    inputSchema: { type: "object", properties: { wait_seconds: P.wait_seconds } },
    run: (a) => answer(start("setup", [[NODE, ["engine/setup.mjs"]]], (j) => ok(tail(j.log, 3000))), a.wait_seconds),
  },
  {
    name: "read_site",
    description: "Open the product's real website and collect its brand: name, tagline, description, headings, button texts, colours, light or dark theme, every sentence with a number, the logo, desktop and phone screenshots and a scrolling recording that templates play as live footage. Returns the facts and a screenshot. Run it first whenever the user gives a URL.",
    inputSchema: { type: "object", properties: { url: { type: "string" }, project: { type: "string", description: "Optional project folder name. Default: the first part of the domain." }, wait_seconds: P.wait_seconds }, required: ["url"] },
    run: (a) => {
      let host; try { host = new URL(/^https?:\/\//i.test(a.url) ? a.url : "https://" + a.url).hostname.replace(/^www\./, "") } catch { return fail("That is not a valid URL.") }
      const name = safe(a.project || host.split(".")[0]) || "product", dir = join(ROOT, "projects", name)
      return answer(start(`reading ${host}`, [[NODE, ["engine/brand.mjs", a.url, name]]], async () => {
        const b = json(join(dir, "brand.json")), shot = existsSync(join(dir, "screen.png")) ? await image(join(dir, "screen.png"), name + "-screen") : null
        return { content: [{ type: "text", text: JSON.stringify({ project: name, folder: `projects/${name}`, brand: b, next: "Use brand.color and the file paths above in the content file. Numbers on screen may only come from brand.figures or from the user. If brand.color is empty, ask the user for a colour." }, null, 1) }, ...(shot ? [shot] : [])] }
      }), a.wait_seconds)
    },
  },
  {
    name: "list_projects",
    description: "The products already set up in this folder: their content files, which template each uses and which videos are rendered.",
    inputSchema: { type: "object", properties: {} },
    run: () => {
      const dir = join(ROOT, "projects"), list = []
      for (const name of existsSync(dir) ? readdirSync(dir) : []) {
        const d = join(dir, name); if (!statSync(d).isDirectory()) continue
        const files = readdirSync(d).filter((f) => f.endsWith(".json") && !["brand.json", "tour.json"].includes(f))
        list.push({ project: name, site_read: existsSync(join(d, "brand.json")), videos: files.map((f) => { const file = f.slice(0, -5), o = file === "content" ? name : `${name}-${file}`; let template = null; try { template = json(join(d, f)).template ?? null } catch {} ; return { file, template, rendered: existsSync(join(ROOT, "out", o, o + ".mp4")) ? `out/${o}/${o}.mp4` : null } }) })
      }
      return ok({ projects: list })
    },
  },
  {
    name: "save_content",
    description: "Write a video's content file (projects/<project>/<file>.json) for one template and check it against the template: missing fields, wrong number of voice lines, text left over from the sample, missing logo. Read get_template first and keep the sample's keys.",
    inputSchema: { type: "object", properties: { project: P.project, template: { type: "string", description: "Template id or name." }, content: { type: "object", description: "The whole content object, same keys as the template's sample content file." }, file: P.file }, required: ["project", "template", "content"] },
    run: (a) => {
      const p = project(a), t = C.find(a.template)
      if (!t) return fail(`No template "${a.template}". Call list_templates.`)
      if (!existsSync(tpl(t.id, "content.json"))) return fail(`Template ${t.name} is not installed in this folder. ${C.getIt}`)
      const content = typeof a.content === "string" ? JSON.parse(a.content) : a.content
      if (!content || typeof content !== "object") return fail("content must be the JSON object for the template.")
      mkdirSync(dirname(p.path), { recursive: true })
      writeFileSync(p.path, JSON.stringify({ template: t.id, ...content, template: t.id }, null, 2) + "\n")
      const notes = check(content, json(tpl(t.id, "content.json")))
      return ok({ saved: rel(p.path), template: t.id, check: notes.length ? notes : "no problems found", next: "Call preview_frames and look at the frames before rendering." })
    },
  },
  {
    name: "preview_frames",
    description: "Voice the content and draw still frames of the video at the given seconds, returned as images so you can see them. Always look before rendering: text must not overlap or be cut off, the logo must show, nothing may be left from the sample product. Fix with save_content and preview again.",
    inputSchema: { type: "object", properties: { project: P.project, file: P.file, times: { type: "array", items: { type: "number" }, description: "Optional. Seconds to capture, at most 8. Default [1, 4, 7, 10, 13.5], one per scene of a 15-second template." }, wait_seconds: P.wait_seconds }, required: ["project"] },
    run: (a) => {
      const p = loaded(a), times = (Array.isArray(a.times) && a.times.length ? a.times : [1, 4, 7, 10, 13.5]).slice(0, 8).map(Number).filter((t) => t >= 0)
      const out = join(ROOT, "out", p.out)
      return answer(start(`preview of ${p.out}`, [[PY, ["engine/tts.py", p.path, out]], [NODE, ["engine/render.mjs", p.id, "--content", p.path, "--out", p.out, "--stills", times.join(",")]]], async () => {
        const content = [{ type: "text", text: `Frames of ${rel(p.path)} (${p.id}) at ${times.join(", ")} s. Full-size files: out/${p.out}/stills/. If everything is clean, call make_video.` }]
        for (const t of times) { const f = join(out, "stills", t.toFixed(2) + ".jpg"); const im = existsSync(f) && (await image(f, `${p.out}-${t.toFixed(2)}`)); if (im) content.push({ type: "text", text: `${t} s` }, im) }
        return { content }
      }), a.wait_seconds)
    },
  },
  {
    name: "make_video",
    description: "Render the finished video with voice, music and sound effects to out/<name>/<name>.mp4. draft is a quick 30 fps preview (about a minute); the final render is 60 fps with motion blur and takes several minutes. social also writes vertical 9:16 and square 1:1 versions with word-by-word captions. Returns a job id when it takes long; poll job_status.",
    inputSchema: { type: "object", properties: { project: P.project, file: P.file, draft: { type: "boolean", description: "Quick preview quality. Default true; pass false for the final render." }, social: { type: "boolean", description: "Also make the vertical and square versions. Default false." }, wait_seconds: P.wait_seconds }, required: ["project"] },
    run: (a) => {
      const p = loaded(a), draft = a.draft !== false
      return answer(start(`${draft ? "draft" : "final"} render of ${p.out}`, [[NODE, ["engine/make.mjs", p.id, p.path, "--out", p.out, ...(draft ? ["--draft"] : []), ...(a.social ? ["--social"] : [])]]], () => {
        const dir = join(ROOT, "out", p.out), files = readdirSync(dir).filter((f) => f.endsWith(".mp4") && f.startsWith(p.out) && f !== "silent.mp4").map((f) => ({ file: join(dir, f).replaceAll("\\", "/"), mb: +(statSync(join(dir, f)).size / 1048576).toFixed(1) }))
        return ok({ state: "done", quality: draft ? "draft" : "final", videos: files, next: draft ? "Tell the user where the file is. When they are happy, call make_video again with draft false (and social true for vertical and square versions)." : "Give the user the file paths." })
      }), a.wait_seconds)
    },
  },
  {
    name: "job_status",
    description: "Check a long-running step (render, site reading, setup) started by another tool. Waits up to wait_seconds for it to finish and returns its result.",
    inputSchema: { type: "object", properties: { job: { type: "string" }, wait_seconds: P.wait_seconds }, required: ["job"] },
    run: (a) => { const j = jobs.get(a.job); return j ? answer(j, a.wait_seconds) : fail(`No job "${a.job}". Jobs: ${[...jobs.keys()].join(", ") || "none"}`) },
  },
  {
    name: "open_studio",
    description: "Open the LaunchFX Studio in the user's browser: a page where they watch the video with sound, change every word, number and colour in a form and start the render themselves. Offer it when the user wants to fine-tune by hand.",
    inputSchema: { type: "object", properties: {} },
    run: () => { const p = spawn(NODE, ["engine/studio.mjs"], { cwd: ROOT, detached: true, stdio: "ignore", windowsHide: true }); p.unref(); return ok("Studio is starting at http://127.0.0.1:4173 and opens in the browser.") },
  },
]

const INSTRUCTIONS = `LaunchFX makes voiced, animated launch videos for the user's product on this computer.
One video: read_site (if there is a URL) -> list_templates -> get_template -> save_content -> preview_frames (look, fix, repeat) -> make_video (draft first, then draft false).
A whole launch: list_launch_kits -> plan_launch -> then the steps above for each video, one content file per video (file "01-teaser", "02-launch" and so on).
Long steps return a job id: call job_status until done. If a tool says something is missing, call setup.
${RULES}`

// ---------------------------------------------------------------- stdio transport: one JSON message per line
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n")
createInterface({ input: process.stdin }).on("line", async (line) => {
  if (!line.trim()) return
  let msg; try { msg = JSON.parse(line) } catch { return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) }
  for (const m of Array.isArray(msg) ? msg : [msg]) { const r = await C.handle(m, tools, INSTRUCTIONS); if (r) send(r) }
})
