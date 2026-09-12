const state = {
  fontFile: null,
  backgroundFile: null,
  fontObjectUrl: null,
  backgroundObjectUrl: null
};

function showError(message) {
  const banner = document.getElementById("error-banner");
  banner.textContent = message;
  banner.hidden = false;
}

function clearError() {
  const banner = document.getElementById("error-banner");
  banner.hidden = true;
  banner.textContent = "";
}

function readFormConfig() {
  const form = document.getElementById("configurator-form");
  return {
    mode: form.mode.value,
    rotation: Number(form.rotation.value),
    language: form.language.value.trim() || "en",
    foregroundColor: form.foregroundColor.value,
    backgroundColor: form.backgroundColor.value,
    fontFamily: form.fontFamily.value.trim() || "sans-serif",
    fontUrl: null,
    backgroundImageUrl: null,
    backgroundStretch: form.backgroundStretch.checked,
    safeTextRegion: {
      x: Number(form.safeTextX.value),
      y: Number(form.safeTextY.value),
      width: Number(form.safeTextWidth.value),
      height: Number(form.safeTextHeight.value)
    },
    hour12: form.hour12.value === "" ? null : form.hour12.value === "true",
    showSeconds: form.showSeconds.checked,
    showWeekday: form.showWeekday.checked,
    dateOrder: form.dateOrder.value === "" ? null : form.dateOrder.value
  };
}

function applyConfigToForm(config) {
  const form = document.getElementById("configurator-form");
  form.mode.value = config.mode;
  form.rotation.value = String(config.rotation);
  form.language.value = config.language;
  form.foregroundColor.value = config.foregroundColor;
  form.backgroundColor.value = config.backgroundColor;
  form.fontFamily.value = config.fontFamily;
  form.backgroundStretch.checked = config.backgroundStretch;
  form.safeTextX.value = String(config.safeTextRegion.x);
  form.safeTextY.value = String(config.safeTextRegion.y);
  form.safeTextWidth.value = String(config.safeTextRegion.width);
  form.safeTextHeight.value = String(config.safeTextRegion.height);
  form.hour12.value = config.hour12 === null ? "" : String(config.hour12);
  form.showSeconds.checked = config.showSeconds;
  form.showWeekday.checked = config.showWeekday;
  form.dateOrder.value = config.dateOrder === null ? "" : config.dateOrder;
  updateModeVisibility();
  refreshPreview();
}

function updateModeVisibility() {
  const form = document.getElementById("configurator-form");
  const isTime = form.mode.value === "time";
  document.getElementById("time-only-fields").hidden = !isTime;
  document.getElementById("date-only-fields").hidden = isTime;
}

function refreshPreview() {
  const previewFrame = document.getElementById("preview-frame");
  if (!previewFrame.contentWindow || !previewFrame.contentWindow.updatePreview) {
    return;
  }
  const config = readFormConfig();
  previewFrame.contentWindow.updatePreview(config, {
    fontUrl: state.fontObjectUrl,
    backgroundImageUrl: state.backgroundObjectUrl
  });
}

function clearInertFilename(fileInputEl) {
  const label = fileInputEl.parentElement.querySelector(".inert-filename");
  if (label) {
    label.remove();
  }
}

function setFontFile(file) {
  if (state.fontObjectUrl) {
    URL.revokeObjectURL(state.fontObjectUrl);
  }
  state.fontFile = file;
  state.fontObjectUrl = file ? URL.createObjectURL(file) : null;
  clearInertFilename(document.getElementById("fontFile"));
  refreshPreview();
}

function setBackgroundFile(file) {
  if (state.backgroundObjectUrl) {
    URL.revokeObjectURL(state.backgroundObjectUrl);
  }
  state.backgroundFile = file;
  state.backgroundObjectUrl = file ? URL.createObjectURL(file) : null;
  clearInertFilename(document.getElementById("backgroundFile"));
  refreshPreview();
}

function initFileInputs() {
  document.getElementById("fontFile").addEventListener("change", (e) => {
    setFontFile(e.target.files[0] || null);
  });
  document.getElementById("clearFontFile").addEventListener("click", () => {
    document.getElementById("fontFile").value = "";
    setFontFile(null);
  });
  document.getElementById("backgroundFile").addEventListener("change", (e) => {
    setBackgroundFile(e.target.files[0] || null);
  });
  document.getElementById("clearBackgroundFile").addEventListener("click", () => {
    document.getElementById("backgroundFile").value = "";
    setBackgroundFile(null);
  });
}

function buildFinalConfig() {
  const config = readFormConfig();
  if (state.fontFile) {
    config.fontUrl = assetFilename("font", state.fontFile.name);
  }
  if (state.backgroundFile) {
    config.backgroundImageUrl = assetFilename("background", state.backgroundFile.name);
  }
  return config;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function generateAndDownload() {
  const config = buildFinalConfig();
  const html = buildClockHtml(config);
  const runtimeSource = await fetch("clock-runtime.js").then((r) => r.text());

  const files = {
    "clock.html": fflate.strToU8(html),
    "clock-runtime.js": fflate.strToU8(runtimeSource)
  };

  if (state.fontFile) {
    files[config.fontUrl] = new Uint8Array(await state.fontFile.arrayBuffer());
  }
  if (state.backgroundFile) {
    files[config.backgroundImageUrl] = new Uint8Array(await state.backgroundFile.arrayBuffer());
  }

  const zipped = fflate.zipSync(files);
  const filename = normalizeZipFilename(document.getElementById("zipFilename").value);
  downloadBlob(new Blob([zipped], { type: "application/zip" }), filename);
}

function initExport() {
  document.getElementById("generateButton").addEventListener("click", () => {
    clearError();
    generateAndDownload().catch((err) => {
      showError("Could not generate the zip: " + err.message);
    });
  });
}

function looksLikeZip(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function showInertFilename(fileInputEl, filename) {
  clearInertFilename(fileInputEl);
  const label = document.createElement("span");
  label.className = "inert-filename";
  label.textContent = " (previously: " + filename + ", re-upload to change)";
  fileInputEl.parentElement.appendChild(label);
}

function restoreAssetFromImport(filename, zipEntries, setter, fileInputEl) {
  if (!filename) {
    return;
  }
  if (zipEntries && zipEntries[filename]) {
    setter(new File([zipEntries[filename]], filename));
  } else {
    showInertFilename(fileInputEl, filename);
  }
}

function isValidImportedConfig(config) {
  if (!config || typeof config !== "object") {
    return false;
  }
  const region = config.safeTextRegion;
  if (!region || typeof region !== "object") {
    return false;
  }
  return (
    typeof region.x === "number" &&
    typeof region.y === "number" &&
    typeof region.width === "number" &&
    typeof region.height === "number"
  );
}

async function handleImportFile(file) {
  clearError();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let htmlText;
    let zipEntries = null;

    if (looksLikeZip(bytes)) {
      zipEntries = fflate.unzipSync(bytes);
      if (!zipEntries["clock.html"]) {
        throw new Error("This zip doesn't contain a clock.html file.");
      }
      htmlText = fflate.strFromU8(zipEntries["clock.html"]);
    } else {
      htmlText = fflate.strFromU8(bytes);
    }

    const config = extractConfigFromHtml(htmlText);

    if (!isValidImportedConfig(config)) {
      throw new Error("The imported file's config is missing required fields (e.g. safeTextRegion).");
    }

    setFontFile(null);
    document.getElementById("fontFile").value = "";
    setBackgroundFile(null);
    document.getElementById("backgroundFile").value = "";

    applyConfigToForm(config);

    restoreAssetFromImport(config.fontUrl, zipEntries, setFontFile, document.getElementById("fontFile"));
    restoreAssetFromImport(config.backgroundImageUrl, zipEntries, setBackgroundFile, document.getElementById("backgroundFile"));
  } catch (err) {
    showError("Could not import that file: " + err.message);
  }
}

function initImport() {
  document.getElementById("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      handleImportFile(file);
    }
  });
}

function initForm() {
  const form = document.getElementById("configurator-form");
  applyConfigToForm(DEFAULT_CONFIG);
  initFileInputs();
  initExport();
  initImport();
  form.addEventListener("input", () => {
    updateModeVisibility();
    refreshPreview();
  });
  form.addEventListener("change", () => {
    updateModeVisibility();
    refreshPreview();
  });
  document.getElementById("preview-frame").addEventListener("load", refreshPreview);
}

document.addEventListener("DOMContentLoaded", initForm);
