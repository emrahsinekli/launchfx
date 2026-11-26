// The part of the LaunchFX MCP server that needs no local machine: catalogue, guides, launch kits and plans.
// Used by engine/mcp.mjs (runs on the buyer's computer) and by the hosted server at https://launchfx.dev/mcp.
export const VERSION = "1.0.0"
export const SITE = "https://launchfx.dev"
export const REPO = "https://github.com/emrahsinekli/launchfx"
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"]

export const RULES = `Rules for every LaunchFX video:
- Sell the customer's outcome, not the feature. Short words, present tense, no exclamation marks.
- Never invent numbers, customers, reviews or results. A figure on screen must come from the user or their site; otherwise leave it out or mark it as a sample the user approved.
- Keep every field inside the limit in the template guide; that is what keeps the video looking like the sample.
- Voice lines are spoken: write them for the ear.`

const text = (t) => ({ content: [{ type: "text", text: typeof t === "string" ? t : JSON.stringify(t, null, 1) }] })
export const fail = (t) => ({ content: [{ type: "text", text: t }], isError: true })
export const ok = text

// catalog: engine/catalog.json. kits: engine/kits.json. read(id, file) returns a template file's text or null.
// installed(id) says whether the template can be rendered here; null on the hosted server.
export function core({ catalog, kits, read, installed = () => null, local = false }) {
  const T = catalog.templates
  const find = (q) => { const k = String(q ?? "").toLowerCase().trim(); return T.find((t) => t.id === k || t.slug === k || t.name.toLowerCase() === k || t.id.split("-")[0] === k.padStart(3, "0")) }
  const where = (t) => { const i = installed(t.id); return i === null ? (t.free ? "free" : "all-access pack") : i ? "installed" : "not installed" }
  const row = (t) => ({ id: t.id, name: t.name, category: t.category, about: t.about, length: t.length, scenes: t.scenes, availability: where(t), sample: t.page })
  const getIt = `Free engine and three templates: ${REPO}. All ${T.length} templates, one payment of $${catalog.price}: ${catalog.checkout}`

  const tools = [
    {
      name: "list_templates",
      description: "List every LaunchFX video template with its category, look, scenes and whether it can be rendered here. Call this first when the user wants a launch, promo, feature or announcement video.",
      inputSchema: { type: "object", properties: { category: { type: "string", description: "Optional. Only templates in this category, e.g. 'Mobile app'." } } },
      run: ({ category }) => {
        const list = T.filter((t) => !category || t.category.toLowerCase() === String(category).toLowerCase())
        return text({ templates: list.map(row), categories: [...new Set(T.map((t) => t.category))], note: local ? "Templates marked 'not installed' are in the all-access pack. " + getIt : getIt })
      },
    },
    {
      name: "get_template",
      description: "The full content guide of one template (every field, its meaning and its length limit) and the sample content file to rewrite. Read it before writing content for that template.",
      inputSchema: { type: "object", properties: { template: { type: "string", description: "Template id or name, e.g. '002-daylight' or 'daylight'." } }, required: ["template"] },
      run: async ({ template }) => {
        const t = find(template); if (!t) return fail(`No template "${template}". Call list_templates.`)
        const g = await read(t.id, "GUIDE.md"), c = await read(t.id, "content.json")
        if (!g) return text({ ...row(t), note: "This template's guide is not in this folder. " + getIt })
        return text(`${JSON.stringify(row(t), null, 1)}\n\n${g}\n\n## Sample content file\n\n\`\`\`json\n${c}\n\`\`\`\n\n${RULES}`)
      },
    },
    {
      name: "list_launch_kits",
      description: "Ready-made launch plans: each kit is a sequence of videos (teaser, launch, demo, story, milestone and so on) for one situation such as a launch week, a developer tool, a mobile app, a sale or a year in review. Use it when the user asks what to post, wants ideas, or is planning a launch.",
      inputSchema: { type: "object", properties: {} },
      run: () => text({ kits: kits.map((k) => ({ id: k.id, name: k.name, for: k.for, outcome: k.outcome, videos: k.steps.map((s) => `${s.title} (${find(s.template).name})`) })), next: "Call plan_launch with a kit id and the launch date." }),
    },
    {
      name: "plan_launch",
      description: "Turn a launch kit into a dated plan for the user's product: which video to post on which day, on which channels, with which template, what each video must achieve, the opening hook, and the real facts you must get from the user before writing it.",
      inputSchema: { type: "object", properties: { kit: { type: "string", description: "Kit id from list_launch_kits, e.g. 'launch-week'." }, launch_date: { type: "string", description: "Optional. Day 0 as YYYY-MM-DD. Without it the plan uses day numbers." }, product: { type: "string", description: "Optional. Product name, used in the hooks." } }, required: ["kit"] },
      run: ({ kit, launch_date, product }) => {
        const k = kits.find((x) => x.id === String(kit).toLowerCase() || x.name.toLowerCase() === String(kit).toLowerCase())
        if (!k) return fail(`No kit "${kit}". Kits: ${kits.map((x) => x.id).join(", ")}`)
        const d0 = launch_date ? Date.parse(launch_date + "T00:00:00Z") : NaN
        if (launch_date && isNaN(d0)) return fail("launch_date must look like 2026-12-01.")
        const steps = k.steps.map((s, i) => {
          const t = find(s.template)
          return { video: i + 1, day: s.day, ...(isNaN(d0) ? {} : { date: new Date(d0 + s.day * 864e5).toISOString().slice(0, 10) }), title: s.title, template: t.id, template_name: t.name, availability: where(t), job: s.job, hook: product ? s.hook.replaceAll("<product>", product).replaceAll("<tool>", product) : s.hook, channels: s.channels, ask_the_user_for: s.needs, file: `projects/<name>/${String(i + 1).padStart(2, "0")}-${s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.json` }
        })
        const missing = steps.filter((s) => s.availability === "not installed")
        return text({
          kit: k.name, for: k.for, outcome: k.outcome, steps,
          how: local
            ? "For each video: get_template, write the content, save_content (project, template, file), preview_frames and look at them, then make_video. Ask the user for everything under ask_the_user_for before writing; do not fill gaps with invented facts."
            : "Write each video's content with get_template. Rendering happens on the user's own computer with the LaunchFX pack: " + getIt,
          ...(missing.length ? { not_installed: `${missing.map((s) => s.template_name).join(", ")}: in the all-access pack. ${getIt}. The plan still works with the installed templates; say which ones are missing.` } : {}),
          rules: RULES,
        })
      },
    },
  ]

  const prompts = [
    { name: "launch_video", description: "Make one launch video for a product from its website.", arguments: [{ name: "url", description: "The product's website", required: true }],
      text: (a) => `Make a launch video for ${a.url || "my product"} with LaunchFX. ${local ? "Read the site with read_site, look at the screenshot, pick the best template with list_templates and tell me why, read its guide with get_template, write and save the content, check preview_frames yourself and fix anything cut off or left over from the sample, then render a draft with make_video and give me the file path." : "Pick the best template with list_templates, read its guide with get_template and write the full content file for me."} Ask me only for facts you cannot find. Never invent numbers.` },
    { name: "launch_plan", description: "Plan a whole launch: which videos to post on which day.", arguments: [{ name: "product", description: "What the product is and who it is for", required: true }, { name: "date", description: "Launch date, YYYY-MM-DD", required: false }],
      text: (a) => `Plan my launch with LaunchFX. Product: ${a.product || "(ask me)"}. ${a.date ? "Launch date: " + a.date + ". " : ""}Call list_launch_kits, choose the kit that fits and say why, then call plan_launch and show me the plan as a table. List the facts you need from me for each video before writing anything.` },
  ]

  // Answers one JSON-RPC message. extra: more tools ({name, description, inputSchema, run}).
  async function handle(msg, extra = [], instructions = "") {
    const all = [...tools, ...extra]
    const reply = (result) => ({ jsonrpc: "2.0", id: msg.id, result })
    const error = (code, message) => ({ jsonrpc: "2.0", id: msg.id, error: { code, message } })
    if (msg.id === undefined || msg.id === null) return null // a notification
    switch (msg.method) {
      case "initialize": {
        const v = msg.params?.protocolVersion
        return reply({ protocolVersion: PROTOCOLS.includes(v) ? v : PROTOCOLS[0], capabilities: { tools: {}, prompts: {} }, serverInfo: { name: "launchfx", title: "LaunchFX", version: VERSION }, instructions })
      }
      case "ping": return reply({})
      case "tools/list": return reply({ tools: all.map(({ run, ...t }) => t) })
      case "tools/call": {
        const t = all.find((x) => x.name === msg.params?.name)
        if (!t) return error(-32602, `Unknown tool: ${msg.params?.name}`)
        try { return reply(await t.run(msg.params.arguments ?? {})) } catch (e) { return reply(fail(String(e?.message ?? e))) }
      }
      case "prompts/list": return reply({ prompts: prompts.map(({ text: _, ...p }) => p) })
      case "prompts/get": {
        const p = prompts.find((x) => x.name === msg.params?.name)
        if (!p) return error(-32602, `Unknown prompt: ${msg.params?.name}`)
        return reply({ description: p.description, messages: [{ role: "user", content: { type: "text", text: p.text(msg.params.arguments ?? {}) } }] })
      }
      case "resources/list": return reply({ resources: [] })
      case "resources/templates/list": return reply({ resourceTemplates: [] })
      default: return error(-32601, `Method not found: ${msg.method}`)
    }
  }
  return { handle, find, tools, getIt }
}
