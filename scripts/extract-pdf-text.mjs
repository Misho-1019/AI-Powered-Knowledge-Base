import path from "node:path";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);

const filePath = process.argv[2];
if (!filePath) {
  console.error("Missing file path argument");
  process.exit(1);
}

const buffer = await fs.readFile(filePath);

// Resolve the actual worker file path from pdfjs-dist
const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

const loadingTask = pdfjsLib.getDocument({
  data: new Uint8Array(buffer),
  // do NOT set disableWorker here; let it use the real worker
});

const pdf = await loadingTask.promise;

let fullText = "";
for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  const pageText = content.items.map((it) => it.str || "").join(" ");
  fullText += pageText + "\n\n";
}

await pdf.destroy();
process.stdout.write(fullText.trim());