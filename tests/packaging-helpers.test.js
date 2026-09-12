const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeZipFilename, assetFilename } = require("../packaging-helpers.js");

test("normalizeZipFilename: blank or whitespace-only defaults to clock.zip", () => {
  assert.equal(normalizeZipFilename(""), "clock.zip");
  assert.equal(normalizeZipFilename("   "), "clock.zip");
  assert.equal(normalizeZipFilename(undefined), "clock.zip");
});

test("normalizeZipFilename: appends .zip when missing", () => {
  assert.equal(normalizeZipFilename("myclock"), "myclock.zip");
});

test("normalizeZipFilename: leaves an existing .zip extension alone, case-insensitively", () => {
  assert.equal(normalizeZipFilename("myclock.zip"), "myclock.zip");
  assert.equal(normalizeZipFilename("MyClock.ZIP"), "MyClock.ZIP");
});

test("normalizeZipFilename: a dot elsewhere in the name doesn't count as the .zip extension", () => {
  assert.equal(normalizeZipFilename("my.thing"), "my.thing.zip");
});

test("assetFilename: lowercases the extension from the original filename", () => {
  assert.equal(assetFilename("font", "MyFont.WOFF2"), "font.woff2");
  assert.equal(assetFilename("background", "photo.jpg"), "background.jpg");
});

test("assetFilename: falls back to the bare kind name when there's no extension", () => {
  assert.equal(assetFilename("font", "noext"), "font");
  assert.equal(assetFilename("font", "trailing."), "font");
});
