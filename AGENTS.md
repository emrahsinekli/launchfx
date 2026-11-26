# LaunchFX

This folder is a LaunchFX pack: a render engine (`engine/`) and one or more video templates (`templates/<id>/`). You turn the user's product into a finished, voiced video by writing one content file and running one command. You do not edit the template or the engine.

## 1. Setup (once)

Run `node engine/setup.mjs`. It checks Node, Python, ffmpeg and Chrome, installs the packages and downloads the voice model (about 350 MB). If it prints `MISSING`, tell the user exactly what to install and stop until it passes.

## 2. Learn the product

**If the user gave a website, read it first:**

```
node engine/brand.mjs <url>
```

It opens the real site and writes `projects/<name>/`: `brand.json` (name, tagline, description, headings, button texts, brand colours, dark or light theme, and `figures`, every sentence on the page that contains a number), `logo.png`, `screen.png` plus `screen-2.png` and `screen-3.png` (the page at three scroll positions, 3200 px wide), `mobile.png` (the phone view), `full.jpg` (the whole page), and `tour/` and `tour-mobile/` (the page scrolling, recorded frame by frame). When a template's `image` field points at `screen.png` (or `mobile.png` on a phone template), the renderer plays that recording inside the picture automatically, so the real site moves in the video; put `"tour": false` in the content file to keep it still. Look at `screen.png` and `full.jpg` yourself before writing anything. Use `brand.color` as the brand colour (if it is empty the site is black and white: ask, or choose one that suits the template), `logo.png` as the logo unless the report says it is small, and the screenshots wherever the template guide has an `image` field. Numbers on screen may only come from `figures` or from the user.

You need: product name, website, one brand colour (hex), what the product does, who it is for, and the single outcome the customer gets. Get these from, in order: what the user told you, files in this folder, then the product's website if you can read it. Ask the user only for what is still missing. Never invent numbers, customers, reviews or results: every figure on screen must come from the user or be an obviously illustrative sample they approved.

Optional but better:
- **Logo**: a square PNG or SVG with a transparent background. Save it as `projects/<name>/logo.png`.
- **Screenshot** of the real product (16:10 or wider, at least 1600 px wide). Save it as `projects/<name>/screen.png`. Without one, the template draws a dashboard from numbers you provide.

## 3. Write the content file

List the templates in `templates/`. If there is more than one, pick the one the user named, otherwise show the list and recommend one.

Copy `templates/<id>/content.json` to `projects/<name>/content.json` and rewrite every value for the product. Keep the same keys. Read `templates/<id>/GUIDE.md` first: it gives the meaning and length limit of every field for that template. Staying inside the limits is what keeps the result looking like the sample.

Writing rules that apply to every template:
- Sell the outcome, not the feature. "Get paid on time", not "automated invoice reminders".
- Short words, present tense, no jargon, no exclamation marks.
- The voice lines are spoken, so write them for the ear and keep each one inside its limit; a long line makes its scene longer.
- Write in the language the user asked for. See the voice table in the template guide for supported languages.

## 4. Render

Preview first, it takes about a minute:

```
node engine/make.mjs <id> projects/<name>/content.json --draft
```

Open `out/<name>/<name>.mp4`, or check frames with `node engine/render.mjs <id> --content projects/<name>/content.json --out <name> --stills 1,3,6,9,13` (JPEGs land in `out/<name>/stills/`). Look at the frames yourself before showing the user: text must not overlap or be cut off, the logo must be visible, and nothing may be left over from the sample product. Fix the content file and preview again until it is clean.

Then the final render (60 fps with motion blur, several minutes):

```
node engine/make.mjs <id> projects/<name>/content.json
```

Add `--social` to also get `out/<name>/<name>-vertical.mp4` (9:16, for TikTok, Reels and Shorts) and `<name>-square.mp4` (1:1, for feeds). Both carry the product name on top and the voice lines as word-by-word captions, so the video works with the sound off. If a voice line is spelled for the ear (for example "Launch F X"), add a `"captions"` list to the content file with the same five lines as they should be read on screen. To make them from a video that is already rendered: `node engine/social.mjs <name> --content projects/<name>/content.json`.

Give the user the path `out/<name>/<name>.mp4`. For a smaller file to post on social media:

```
ffmpeg -i out/<name>/<name>.mp4 -c:v libx264 -crf 22 -preset slow -c:a aac -b:a 192k out/<name>/<name>-share.mp4
```

## Studio

`node engine/studio.mjs` opens a local page where the user can watch the video with sound before rendering, change every word, number and colour in a form, re-voice it, read their site and start the render with a button. Offer it when the user wants to tweak things themselves; keep the command running while they use it. Projects made there are the same `projects/<name>/content.json` files (with a `"template"` key naming the template).

## 5. Changes

The user will ask for changes in plain words ("make it faster", "different voice", "our colour is green"). Change the content file and render again. Voice, colours, every word and every number are in the content file. Scene order, animation and sound design belong to the template and are not adjustable; say so plainly if asked.
