# 🎠 Carousel Engine

Render HTML slide templates into **1080×1080 PNGs** (Instagram/TikTok) and **LinkedIn-ready PDFs** using Puppeteer.

## Setup

```bash
npm install
```

> Puppeteer will auto-download a Chromium binary on first install.

## Usage

### Render all slides
```bash
npm run render -- --template templates/pai3/slides.html --out out/pai3
```

### Render specific slides only
```bash
npm run render -- --template templates/pai3/slides.html --out out/pai3 --slides 1,3,5
```

### PDF only (LinkedIn document)
```bash
npm run render -- --template templates/pai3/slides.html --out out/pai3 --pdf-only
```

### Skip PDF or ZIP
```bash
npm run render -- --template templates/pai3/slides.html --out out/pai3 --skip-pdf
npm run render -- --template templates/pai3/slides.html --out out/pai3 --skip-zip
```

### PAI3 shortcut
```bash
npm run render:pai3
```

## Output

All files land in the `--out` directory:
```
out/pai3/
  slide-01.png  ...  slide-10.png   ← Instagram/TikTok ready
  carousel-slides.zip               ← All PNGs in one download
  carousel-linkedin.pdf             ← Upload to LinkedIn as a Document post
```

## Creating a New Template

1. Duplicate `templates/pai3/` → `templates/your-brand/`
2. Edit `slides.html` — each slide is a `.slide` div with a matching `.sN` class
3. Drop brand assets (logo, bg, product shots) into `assets/`
4. Run the renderer pointing at your new template

## Brand Tokens (PAI3)

| Token | Value |
|-------|-------|
| Background | `#000` / `#0a0e0a` |
| Accent green | `#00e968` |
| Danger red | `#ff4444` |
| Heading font | Space Grotesk |
| Body font | Inter |
| Slide size | 1080 × 1080 px |

## How It Works

Each slide is a `1080×1080` CSS div. Puppeteer loads the HTML, shows one slide at a time, and takes a screenshot. For the PDF it injects `@media print` CSS so all slides render as separate pages.

No Remotion. No React. No build step. Pure HTML/CSS → PNG.
