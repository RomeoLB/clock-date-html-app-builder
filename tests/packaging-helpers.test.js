const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeZipFilename,
  assetFilename,
  isGenericFontFamilyName,
  deriveFontFamilyName
} = require("../packaging-helpers.js");

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

test("isGenericFontFamilyName: recognizes CSS generic families case-insensitively, with surrounding whitespace", () => {
  assert.equal(isGenericFontFamilyName("sans-serif"), true);
  assert.equal(isGenericFontFamilyName("SANS-SERIF"), true);
  assert.equal(isGenericFontFamilyName("  serif  "), true);
  assert.equal(isGenericFontFamilyName("monospace"), true);
});

test("isGenericFontFamilyName: a real font name is not generic", () => {
  assert.equal(isGenericFontFamilyName("MyCoolFont"), false);
  assert.equal(isGenericFontFamilyName(""), false);
  assert.equal(isGenericFontFamilyName(undefined), false);
});

test("deriveFontFamilyName: strips the extension and keeps a readable name", () => {
  assert.equal(deriveFontFamilyName("MyCoolFont.woff2"), "MyCoolFont");
  assert.equal(deriveFontFamilyName("My Cool Font.ttf"), "My Cool Font");
});

test("deriveFontFamilyName: strips characters that aren't safe in a font-family value", () => {
  assert.equal(deriveFontFamilyName("weird!!!name###.otf"), "weird name");
});

test("deriveFontFamilyName: falls back to a default name when nothing usable is left", () => {
  assert.equal(deriveFontFamilyName(""), "CustomFont");
  assert.equal(deriveFontFamilyName("!!!.woff2"), "CustomFont");
});

test("deriveFontFamilyName: never produces a generic CSS keyword, even if that's literally the filename", () => {
  assert.equal(deriveFontFamilyName("sans-serif.woff2"), "sans-serif Custom");
  assert.equal(isGenericFontFamilyName(deriveFontFamilyName("sans-serif.woff2")), false);
});
