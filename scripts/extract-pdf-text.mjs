import path from "node:path";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);

const DEFAULT_MAX_PAGES = 50;

const filePath = process.argv[2];
if (!filePath) {
  console.error("Missing file path argument");
  process.exit(1);
}

const maxPages = Number(process.argv[3]) || DEFAULT_MAX_PAGES;

const buffer = await fs.readFile(filePath);

// Resolve the actual worker file path from pdfjs-dist
const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

// Standard font data is needed to map glyphs for PDFs that use the base-14
// fonts. Without it pdfjs warns and some documents yield no text at all.
//
// NOTE: pdfjs requires the factory URL to end in a FORWARD slash, on every
// platform. Using path.sep here throws "must include trailing slash" on Windows.
const pdfjsRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
const standardFontsDir =
  path.join(pdfjsRoot, "standard_fonts").replace(/[\\/]+$/, "") + "/";

const documentOptions = {
  data: new Uint8Array(buffer),
};

try {
  await fs.access(standardFontsDir);
  documentOptions.standardFontDataUrl = standardFontsDir;
} catch {
  // Not fatal — extraction still works for embedded-font PDFs.
}

const loadingTask = pdfjsLib.getDocument(documentOptions);

const pdf = await loadingTask.promise;

// Refuse absurd documents rather than grinding through hundreds of pages on a
// request path. Large documents belong in a background queue.
if (pdf.numPages > maxPages) {
  await pdf.destroy();
  console.error(
    `PDF has ${pdf.numPages} pages, which exceeds the ${maxPages}-page limit.`,
  );
  process.exit(3);
}

let fullText = "";
for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  const pageText = content.items.map((it) => it.str || "").join(" ");
  fullText += pageText + "\n\n";
}

await pdf.destroy();
process.stdout.write(fullText.trim());
