# 001 Aurora: content guide

A 15-second dark, high-energy launch video in five scenes: hook, logo reveal, product, question and answer, end card. Scenes are cut on the beat and each one stretches when its voice line is long, so keep lines inside the limits to stay near 15 seconds.

## brand

| Field | Meaning |
|---|---|
| `name` | Product name. Best at 4 to 10 letters; longer names shrink to fit. |
| `url` | Shown on the end card button, without `https://`. |
| `color` | Main brand colour as hex, e.g. `"#4f46e5"`. The two accent colours are derived from it. |
| `color2`, `color3` | Optional accents as hex, if the brand has them. |
| `logo` | Optional. Path to a square logo, e.g. `"projects/acme/logo.png"`. It sits on a gradient tile. |
| `logoPlain` | Optional `true`: show the logo by itself, without the gradient tile (use when the logo already has its own shape). |

## Scene 1: hook

| Field | Meaning | Limit |
|---|---|---|
| `hook` | Two lines. Line 1 is white, line 2 is in the brand gradient. Name the pain the customer wants to stop. | 2 to 3 words per line, 16 characters per line |
| `strike` | One word from line 1 that gets glitched and struck out: the thing they will stop doing. Must match that word exactly, without punctuation. | 1 word |

## Scene 2: logo

| Field | Meaning | Limit |
|---|---|---|
| `tagline` | What the product is, in one line under the name. | 40 characters |

## Scene 3: product (`dash`)

| Field | Meaning | Limit |
|---|---|---|
| `lines` | Exactly three short lines on the left; the third is highlighted with a live dot. | 16 characters each |
| `image` | Optional. Path to a real screenshot, e.g. `"projects/acme/screen.png"`. If set, it fills the card and `title`, `kpis`, `chartTitle` and `series` are ignored. | at least 1600 px wide |
| `title` | Heading of the drawn dashboard. | 20 characters |
| `kpis` | Two or three tiles: `label`, `value` (a number, it counts up), optional `prefix`, `suffix`, `dec` (decimals) and `delta` (small green chip). | label 16 characters |
| `chartTitle` | Label above the chart. | 34 characters |
| `series` | 8 to 24 numbers for the line chart; it should end higher than it starts. | |
| `sats` | Up to two floating notification cards: `title` and `sub`. | title 16, sub 26 characters |

## Scene 4: question and answer (`ask`)

| Field | Meaning | Limit |
|---|---|---|
| `kicker` | Small label above the box, e.g. "Ask Acme". | 18 characters |
| `q` | A question the customer would type. It is typed out on screen. | 44 characters |
| `label` | Small label on the answer card. | 10 characters |
| `a` | The answer, large. | 16 characters |
| `detail` | One supporting line. | 40 characters |
| `bars` | Two to four bars: `l` (label) and `v` (number, shown as a percentage). The first is highlighted. | label 10 characters |

## Scene 5: end card (`end`)

| Field | Meaning | Limit |
|---|---|---|
| `line` | The outcome in a few words. | 24 characters |
| `cta` | Button text. | 14 characters |

## Voice

`vo` is exactly five lines, one per scene, in order. Limits in words: 5, 3, 7, 9, 5. Line 2 is usually "Meet <name>." and line 5 "<name>. <outcome>."

`voice` picks the speaker:

```json
"voice": { "engine": "kokoro", "name": "am_michael", "speed": 1.05, "lang": "en-us" }
```

| Language | `lang` | Voices |
|---|---|---|
| English (US) | `en-us` | `af_heart`, `af_bella`, `af_nicole`, `am_michael`, `am_fenrir`, `am_puck` |
| English (UK) | `en-gb` | `bf_emma`, `bf_isabella`, `bm_george`, `bm_fable` |
| Spanish | `es` | `ef_dora`, `em_alex` |
| French | `fr-fr` | `ff_siwis` |
| Italian | `it` | `if_sara`, `im_nicola` |
| Portuguese (BR) | `pt-br` | `pf_dora`, `pm_alex` |

Names starting with `af`/`bf`/`ef` are female, `am`/`bm`/`em` are male. `speed` between 0.95 and 1.15 sounds natural.
