const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_CONFIG,
  buildClockHtml,
  extractConfigFromHtml
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
