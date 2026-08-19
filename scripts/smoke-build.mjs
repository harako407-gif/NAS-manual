import assert from "node:assert/strict";

const workerUrl = new URL(`../dist/server/index.js?smoke=${Date.now()}`, import.meta.url);
const { default: worker } = await import(workerUrl.href);
const response = await worker.fetch(
  new Request("http://localhost/", { headers: { accept: "text/html" } }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);

assert.equal(response.status, 200);
assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
const html = await response.text();
assert.match(html, /시놀로지 NAS 사용자 매뉴얼/);
assert.match(html, /편집 시작/);
assert.match(html, /폴더 추가 과정/);
assert.match(html, /\/manual-images\/desktop\/05\.png/);
assert.match(html, /사내 Synology NAS 매뉴얼/);
assert.match(html, /\/brand\/tempchain-logo\.png/);
assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/);

console.log(`Production smoke passed: ${response.status}, ${html.length} bytes.`);
