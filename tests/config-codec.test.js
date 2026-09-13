const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_CONFIG,
  buildClockHtml,
  extractConfigFromHtml,
  computeFitHeightRegion
} = require("../config-codec.js");

test("buildClockHtml embeds the shared runtime script and the config as JSON", () => {
  const html = buildClockHtml(DEFAULT_CONFIG);
  assert.match(html, /<script src="clock-runtime\.js"><\/script>/);
  assert.match(html, /const clockConfig = \{/);
  assert.match(html, /bootClock\(clockConfig\);/);
});

test("round-trips the default config exactly", () => {
  const html = buildClockHtml(DEFAULT_CONFIG);
  const restored = extractConfigFromHtml(html);
  assert.deepEqual(restored, DEFAULT_CONFIG);
});

test("round-trips a config whose nested safeTextRegion has its own braces, without stopping early", () => {
  const config = {
    ...DEFAULT_CONFIG,
    mode: "date",
    dateOrder: "DMY",
    safeTextRegion: { x: 25, y: 25, width: 50, height: 50 }
  };
  const html = buildClockHtml(config);
  const restored = extractConfigFromHtml(html);
  assert.deepEqual(restored, config);
  assert.equal(restored.safeTextRegion.width, 50);
});

test("round-trips a config whose string value itself contains brace characters", () => {
  const config = { ...DEFAULT_CONFIG, fontUrl: "font{weird}.woff2" };
  const html = buildClockHtml(config);
  const restored = extractConfigFromHtml(html);
  assert.equal(restored.fontUrl, "font{weird}.woff2");
});

test("throws a clear error when no clockConfig block is present", () => {
  assert.throws(
    () => extractConfigFromHtml("<html><body>nothing here</body></html>"),
    /No clockConfig block found/
  );
});

test("throws a clear error when the clockConfig block is malformed JSON", () => {
  assert.throws(
    () => extractConfigFromHtml("const clockConfig = {not: json,};"),
    /Could not parse clock configuration/
  );
});

test("computeFitHeightRegion: shrinks a full-height box to snugly wrap the text, keeping its center fixed", () => {
  const result = computeFitHeightRegion(0, 100, 100, 1000, 1.3);
  assert.deepEqual(result, { y: 43.5, height: 13 });
});

test("computeFitHeightRegion: preserves the center of an already off-center box", () => {
  const result = computeFitHeightRegion(60, 20, 50, 500, 1.2);
  assert.deepEqual(result, { y: 64, height: 12 });
});

test("computeFitHeightRegion: clamps height to 100 when the text is taller than the viewport", () => {
  const result = computeFitHeightRegion(0, 100, 2000, 1000, 1);
  assert.deepEqual(result, { y: 0, height: 100 });
});

test("computeFitHeightRegion: clamps y to 0 rather than going negative near the top edge", () => {
  const result = computeFitHeightRegion(0, 2, 200, 1000, 1);
  assert.deepEqual(result, { y: 0, height: 20 });
});

test("computeFitHeightRegion: leaves the region unchanged when the viewport or text height is not usable", () => {
  assert.deepEqual(computeFitHeightRegion(10, 40, 100, 0, 1.3), { y: 10, height: 40 });
  assert.deepEqual(computeFitHeightRegion(10, 40, 0, 1000, 1.3), { y: 10, height: 40 });
});
