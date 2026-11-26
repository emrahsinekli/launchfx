# 006 Pocket: content guide

A 15-second launch video for mobile apps, in five scenes: hook, a phone that spins in while chips fly out of it, a carousel of three app screens, notifications dropping beside the phone, and an end card with the app icon. Bright two-colour gradient, glossy floating shapes, bouncy type, circle wipes.

## brand

| Field | Meaning |
|---|---|
| `name` | App name. |
| `url` | Shown on the button, without `https://`. |
| `color` | Main brand colour as hex. The background gradient runs from it to a neighbouring hue. |
| `color2` | Optional second gradient colour as hex. |
| `logo` | Optional. Path to the app icon artwork (transparent background). It is used on the end card icon and in the notifications. |

## Scene 1: hook

| Field | Meaning | Limit |
|---|---|---|
| `hook` | Two lines of big type. | 18 characters per line |

## Scene 2: hero phone (`hero`)

| Field | Meaning | Limit |
|---|---|---|
| `title` | Headline beside the phone. | 26 characters |
| `screen` | Which of the three screens the phone shows: 0, 1 or 2. | |
| `chips` | Three small pills that fly out of the phone: short facts or states. | 18 characters each |

## Scene 3: the three screens (`screens`)

Exactly three screens. Each has a `title` (the caption shown under the carousel, 26 characters) and is one of these kinds:

| Kind | Fields | Notes |
|---|---|---|
| any | `image` | Path to a real screenshot of the app (portrait, about 9:19.5). When set, the other fields of that screen are ignored. Use real screenshots whenever the user has them. |
| `ring` | `heading`, `sub`, `value` (0 to 100), `items` (up to 3) | A progress ring that fills, with rows under it. |
| `bars` | `heading`, `sub`, `big` (number), `label`, `values` (7 numbers), optional `labels` (7 letters) | A big number over a week of bars. |
| `list` | `heading`, `sub`, `items` (up to 5), `done` (how many get ticked), optional `button` | A checklist that ticks itself. |

Text inside a screen is small: keep headings under 14 characters and rows under 20.

## Scene 4: notifications (`notify`)

| Field | Meaning | Limit |
|---|---|---|
| `title` | Headline above the stack. | 32 characters |
| `items` | Exactly three notifications: `title` and `text`. | title 24, text 32 characters |

## Scene 5: end card (`end`)

| Field | Meaning | Limit |
|---|---|---|
| `line` | The outcome in a few words. | 22 characters |
| `cta` | Button text. Do not use store badges or store names unless the user confirms the app is live there. | 14 characters |

## Voice

`vo` is exactly five lines, one per scene, in order. Limits in words: 5, 6, 9, 6, 4. The cut is fast, so stay inside the limits.

```json
"voice": { "engine": "kokoro", "name": "af_heart", "speed": 1.12, "lang": "en-us" }
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
