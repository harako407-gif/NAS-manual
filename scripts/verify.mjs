import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateStaticHtml } from "../lib/static-export.mjs";

const manual = JSON.parse(await readFile(new URL("../data/manual.json", import.meta.url), "utf8"));

const ids = new Set(manual.sections.map((section) => section.id));
for (const id of ["pc-install", "pc-setup", "folders", "password", "mobile-install", "mobile-use", "web-use", "admin-folders"]) {
  assert.ok(ids.has(id), `missing section: ${id}`);
}
assert.ok(manual.sections.length >= 10, "at least ten manual sections are required");
assert.ok(manual.sections.flatMap((section) => section.steps).filter((step) => step.media).length >= 15, "media placeholders are required");
assert.ok(manual.sections.flatMap((section) => section.steps).filter((step) => step.media?.src).length >= 41, "numbered desktop and mobile photos must be connected");

const html = generateStaticHtml(manual, []);
assert.match(html, /시놀로지 NAS 사용자 매뉴얼/);
assert.match(html, /사내 Synology NAS 매뉴얼/);
assert.match(html, /추가 동기화 작업 만들기/);
assert.match(html, /비밀번호를 변경/);
assert.match(html, /휴대전화에 Synology Drive/);
assert.match(html, /브라우저에서 Synology Drive/);
assert.match(html, /id="manualSearch"/);
assert.match(html, /aria-label="매뉴얼 목차"/);
assert.doesNotMatch(html, /contenteditable/i);
assert.doesNotMatch(html, /localStorage|indexedDB|JSON 복원|사진·GIF 넣기|편집 시작/i);
assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel=["']stylesheet/i);

const injected = structuredClone(manual);
injected.settings.title = '<img src=x onerror="alert(1)">';
const escapedHtml = generateStaticHtml(injected, []);
assert.doesNotMatch(escapedHtml, /<img src=x onerror=/);
assert.match(escapedHtml, /&lt;img src=x onerror=/);

const releaseHtml = await readFile(new URL("../release/index.html", import.meta.url), "utf8");
assert.match(releaseHtml, /^<!doctype html>/i);
assert.match(releaseHtml, /<style>/);
assert.match(releaseHtml, /<script>/);
assert.doesNotMatch(releaseHtml, /<script[^>]+src=|<img[^>]+src=["']https?:/i);
assert.ok((releaseHtml.match(/src="data:image\//g) || []).length >= 42, "static export must embed the logo and numbered photos");

const editorSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
for (const feature of ["사진 주석 편집", "편집본 제거·원본 복원", "주의·참고 박스 삭제", "사진 영역 삭제", "JSON 자동 저장 설정", "showSaveFilePicker", "writeBackupToHandle", "reorderSections", "reorderQuickLinks", "reorderSteps", "activeSectionId", "IntersectionObserver", "titleFontSize", "baseAssetId", "fontScale", "showHero", "sources-editor"]) {
  assert.match(editorSource, new RegExp(feature), `missing editor customization feature: ${feature}`);
}
const [editorCss, staticCss] = await Promise.all([
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../lib/static-style.mjs", import.meta.url), "utf8"),
]);
const smallFontRule = /font-size:\s*(10|11|12|13|14)px|calc\((10|11|12|13|14)px\s*\*\s*var\(--font-scale\)\)/;
assert.doesNotMatch(editorCss, smallFontRule, "editor UI should not ship 10-14px font rules");
assert.doesNotMatch(staticCss, smallFontRule, "static UI should not ship 10-14px font rules");
assert.match(releaseHtml, /setActiveSection/);
assert.match(releaseHtml, /updateLocation/);
assert.match(releaseHtml, /sidebar\.scrollTo/);
assert.match(releaseHtml, /document\.addEventListener\("scroll"/);
assert.match(releaseHtml, /motion-ready/);

console.log("Verification passed: content, export isolation, escaping, and offline artifact.");
