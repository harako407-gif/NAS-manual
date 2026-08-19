import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generateStaticHtml } from "../lib/static-export.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const manualPath = new URL("../data/manual.json", import.meta.url);
const releaseDirectory = new URL("../release/", import.meta.url);
const outputPath = new URL("../release/index.html", import.meta.url);

const manual = JSON.parse(await readFile(manualPath, "utf8"));
const sources = new Set();
if (manual.settings?.brandLogo) sources.add(manual.settings.brandLogo);
for (const section of manual.sections) {
  for (const step of section.steps) {
    if (step.media?.src) sources.add(step.media.src);
  }
}

const mimeByExtension = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const bundledAssets = [];
for (const src of sources) {
  const assetPath = new URL(`../public${src}`, import.meta.url);
  const bytes = await readFile(assetPath);
  const extension = src.slice(src.lastIndexOf(".")).toLowerCase();
  const type = mimeByExtension[extension];
  if (!type) throw new Error(`Unsupported bundled image type: ${src}`);
  bundledAssets.push({
    id: src,
    name: src.split("/").pop(),
    type,
    size: bytes.length,
    dataUrl: `data:${type};base64,${bytes.toString("base64")}`,
    updatedAt: new Date().toISOString(),
  });
}

const html = generateStaticHtml(manual, bundledAssets);

await mkdir(releaseDirectory, { recursive: true });
await writeFile(outputPath, html, "utf8");

console.log(`Static manual exported: ${fileURLToPath(outputPath).replace(projectRoot, "")}`);
