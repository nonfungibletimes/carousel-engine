#!/usr/bin/env node
/**
 * carousel-engine/src/render.mjs
 * Renders an HTML slide deck into PNGs + a LinkedIn-ready PDF.
 *
 * Usage:
 *   node src/render.mjs --template templates/pai3/slides.html --out out/pai3
 *   node src/render.mjs --template templates/pai3/slides.html --out out/pai3 --slides 1,3,5
 *   node src/render.mjs --template templates/pai3/slides.html --out out/pai3 --pdf-only
 */

import puppeteer from 'puppeteer';
import { existsSync, mkdirSync, statSync, createWriteStream } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const has = (flag) => args.includes(flag);

const templateArg = get('--template', null);
const outDir      = get('--out', 'out');
const slideFilter = get('--slides', null); // e.g. "1,3,5" or null = all
const slideSize   = parseInt(get('--size', '1080'), 10);
const pdfOnly     = has('--pdf-only');
const skipPdf     = has('--skip-pdf');
const skipZip     = has('--skip-zip');

if (!templateArg) {
  console.error('Error: --template <path> is required');
  process.exit(1);
}

const templatePath = resolve(templateArg);
if (!existsSync(templatePath)) {
  console.error(`Error: template not found at ${templatePath}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

// ─── Count slides in template ────────────────────────────────────────────────
async function countSlides(page) {
  return page.evaluate(() => document.querySelectorAll('.slide').length);
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n🎨 Carousel Engine`);
  console.log(`   Template : ${templatePath}`);
  console.log(`   Output   : ${resolve(outDir)}`);
  console.log(`   Size     : ${slideSize}x${slideSize}px\n`);

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: slideSize, height: slideSize, deviceScaleFactor: 1 });

  const fileUrl = 'file://' + templatePath;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500)); // let fonts/images settle

  const total = await countSlides(page);
  const indices = slideFilter
    ? slideFilter.split(',').map(n => parseInt(n.trim(), 10))
    : Array.from({ length: total }, (_, i) => i + 1);

  console.log(`   Slides   : ${total} total, rendering [${indices.join(', ')}]`);

  const pngPaths = [];

  if (!pdfOnly) {
    for (const num of indices) {
      await page.evaluate((n) => {
        document.querySelectorAll('.slide').forEach((s, idx) => {
          s.style.display = idx === n - 1 ? 'flex' : 'none';
        });
      }, num);
      await new Promise(r => setTimeout(r, 300));

      const filename = `slide-${String(num).padStart(2, '0')}.png`;
      const outPath = `${outDir}/${filename}`;
      await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: slideSize, height: slideSize } });
      pngPaths.push(outPath);
      process.stdout.write(`   ✓ ${filename}\n`);
    }
  }

  // ── PDF (LinkedIn document format) ──────────────────────────────────────
  if (!skipPdf) {
    const printCSS = `
      <style>
        @media print {
          body { width: ${slideSize}px; overflow: visible; background: #000; }
          .slide { display: flex !important; page-break-after: always; break-after: page; }
          .slide-num { display: none; }
        }
      </style>`;

    const { readFileSync, writeFileSync, unlinkSync } = await import('fs');
    const html = readFileSync(templatePath, 'utf8');
    const printHtml = html.replace('</head>', printCSS + '</head>');
    const tmpPath = `${outDir}/_print.html`;
    writeFileSync(tmpPath, printHtml);

    await page.goto('file://' + resolve(tmpPath), { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));

    const pdfPath = `${outDir}/carousel-linkedin.pdf`;
    await page.pdf({
      path: pdfPath,
      width: `${slideSize}px`,
      height: `${slideSize}px`,
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    unlinkSync(tmpPath);

    const mb = (statSync(pdfPath).size / 1024 / 1024).toFixed(2);
    console.log(`\n   📄 PDF: carousel-linkedin.pdf (${mb} MB)`);
  }

  await browser.close();

  // ── ZIP all PNGs ────────────────────────────────────────────────────────
  if (!skipZip && !pdfOnly && pngPaths.length > 0) {
    const zipPath = `${outDir}/carousel-slides.zip`;
    await new Promise((res, rej) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } });
      output.on('close', res);
      archive.on('error', rej);
      archive.pipe(output);
      pngPaths.forEach(p => archive.file(p, { name: basename(p) }));
      archive.finalize();
    });
    const mb = (statSync(zipPath).size / 1024 / 1024).toFixed(2);
    console.log(`   🗜  ZIP: carousel-slides.zip (${mb} MB)`);
  }

  console.log(`\n✅ Done — files in ./${outDir}/\n`);
})();
