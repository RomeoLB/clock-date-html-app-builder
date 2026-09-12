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

if (typeof module !== "undefined" && module.exports) {
  module.exports = { normalizeZipFilename, assetFilename };
}
