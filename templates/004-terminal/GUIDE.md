# 004 Terminal: content guide

A 15-second launch video for developer tools, in five scenes: a command typed in a terminal, the name decoding out of noise, a code diff that collapses, a speed comparison, and an end card with the install command. Monospace throughout, one glowing brand colour on near-black, glitch cuts.

## brand

| Field | Meaning |
|---|---|
| `name` | Product name. Up to about 10 letters at full size; longer names shrink. |
| `url` | Shown on the end card, without `https://`. |
| `color` | The brand colour as hex. It is pushed to a bright version of its hue so it glows on the dark background. |

There is no logo slot: the name itself is the logo in this template.

## Scene 1: terminal (`term`)

| Field | Meaning | Limit |
|---|---|---|
| `hook` (top level) | The headline above the terminal. It decodes in. | 30 characters |
| `title` | Text in the terminal's title bar. | 24 characters |
| `command` | The command that gets typed. Use the product's real command. | 34 characters |
| `output` | Two to four result lines; each gets a check mark. Only real output, or clearly sample values. | 44 characters each |

## Scene 2: name

| Field | Meaning | Limit |
|---|---|---|
| `tagline` | Typed under the name. | 34 characters |

## Scene 3: diff (`diff`)

| Field | Meaning | Limit |
|---|---|---|
| `file` | File name on the editor tab. | 24 characters |
| `before`, `after` | Optional unchanged lines above and below (up to 2 each). | 44 characters per line |
| `remove` | Three to seven lines that are deleted (red). Keep indentation with spaces. | 44 characters per line |
| `add` | One to three lines that replace them (brand colour). | 44 characters per line |
| `caption` | Two parts beside the editor: the old state, which is struck out, and the new state, which is large. | 20 and 12 characters |

The code must be believable for the product: real config or API of the user's tool, not invented syntax.

## Scene 4: comparison (`bench`)

| Field | Meaning | Limit |
|---|---|---|
| `title` | Heading. | 22 characters |
| `note` | Source or caveat, e.g. "Measured on a 200-route app" or "Sample figures". Always fill this in. | 40 characters |
| `rows` | Two or three bars: `label`, `value`, optional `prefix`, `suffix`, `dec`, and `us: true` on the product's own row. Bars are drawn to scale. | label 14 characters |

Only use figures the user can stand behind. If they have none, keep the note that says the figures are samples, or ask.

## Scene 5: end card (`end`)

| Field | Meaning | Limit |
|---|---|---|
| `line` | The outcome in a few words. | 26 characters |
| `install` | The install or start command, typed into a box. | 34 characters |

## Voice

`vo` is exactly five lines, one per scene, in order. Limits in words: 5, 3, 7, 7, 5.

```json
"voice": { "engine": "kokoro", "name": "am_michael", "speed": 1.08, "lang": "en-us" }
```

| Language | `lang` | Voices |
|---|---|---|
| English (US) | `en-us` | `af_heart`, `af_bella`, `af_nicole`, `am_michael`, `am_fenrir`, `am_puck` |
| English (UK) | `en-gb` | `bf_emma`, `bf_isabella`, `bm_george`, `bm_fable` |
| Spanish | `es` | `ef_dora`, `em_alex` |
| French | `fr-fr` | `ff_siwis` |
| Italian | `it` | `if_sara`, `im_nicola` |
| Portuguese (BR) | `pt-br` | `pf_dora`, `pm_alex` |

Names starting with `af`/`bf`/`ef` are female, `am`/`bm`/`em` are male.
