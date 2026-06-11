import assert from "node:assert/strict";
import test from "node:test";
import { parseSseBuffer } from "./sse.ts";

test("parses complete SSE frames and preserves the incomplete tail", () => {
  const parsed = parseSseBuffer(
    'event: progress\ndata: {"node":"fetch_jd","message":"Fetching"}\n\n' +
      'event: result\ndata: {"ok":true}\n\n' +
      'event: progress\ndata: {"node":"compose"'
  );

  assert.deepEqual(parsed.messages, [
    { event: "progress", data: { node: "fetch_jd", message: "Fetching" } },
    { event: "result", data: { ok: true } },
  ]);
  assert.equal(parsed.remainder, 'event: progress\ndata: {"node":"compose"');
});

test("supports multi-line JSON data frames", () => {
  const parsed = parseSseBuffer(
    'event: result\ndata: {\ndata: "report_markdown": "Line one\\nLine two"\ndata: }\n\n'
  );

  assert.deepEqual(parsed.messages, [
    { event: "result", data: { report_markdown: "Line one\nLine two" } },
  ]);
});
