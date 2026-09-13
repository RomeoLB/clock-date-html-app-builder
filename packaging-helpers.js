function normalizeZipFilename(name) {
  const trimmed = (name || "").trim();
  const base = trimmed === "" ? "clock" : trimmed;
  return /\.zip$/i.test(base) ? base : base + ".zip";
}

function assetFilename(kind, originalFileName) {
  const dotIndex = originalFileName.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === originalFileName.length - 1) {
    return kind;
  }
  const ext = originalFileName.slice(dotIndex + 1).toLowerCase();
  return kind + "." + ext;
}

// CSS generic font-family keywords (and CSS-wide keywords) that @font-face
// silently ignores when used as the font-family value - a font bound to one
// of these names will never actually be applied by the browser.
const GENERIC_FONT_FAMILY_NAMES = [
  "serif", "sans-serif", "cursive", "fantasy", "monospace",
  "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded",
  "math", "emoji", "fangsong",
  "inherit", "initial", "unset", "revert", "revert-layer", "default"
];

function isGenericFontFamilyName(name) {
  return GENERIC_FONT_FAMILY_NAMES.indexOf((name || "").trim().toLowerCase()) !== -1;
}

function deriveFontFamilyName(originalFileName) {
  const dotIndex = originalFileName.lastIndexOf(".");
  const base = dotIndex > 0 ? originalFileName.slice(0, dotIndex) : originalFileName;
  const sanitized = base.replace(/[^A-Za-z0-9 _-]/g, " ").trim().replace(/\s+/g, " ");
  const name = sanitized === "" ? "CustomFont" : sanitized;
  return isGenericFontFamilyName(name) ? name + " Custom" : name;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizeZipFilename,
    assetFilename,
    isGenericFontFamilyName,
    deriveFontFamilyName
  };
}
