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
  const selectedLanguage = form.language.value === "custom" ? form.languageCustom.value.trim() : form.language.value;
  return {
    mode: form.mode.value,
    rotation: Number(form.rotation.value),
    language: selectedLanguage || "en",
    foregroundColor: form.foregroundColor.value,
    backgroundColor: form.backgroundTransparent.checked ? "transparent" : form.backgroundColor.value,
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
    textScale: Number(form.textScale.value) || 100,
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
  setLanguageField(config.language);
  form.foregroundColor.value = config.foregroundColor;
  const isTransparentBackground = config.backgroundColor.trim().toLowerCase() === "transparent";
  form.backgroundTransparent.checked = isTransparentBackground;
  if (!isTransparentBackground) {
    form.backgroundColor.value = config.backgroundColor;
  }
  updateBackgroundTransparencyVisibility();
  form.fontFamily.value = config.fontFamily;
  form.backgroundStretch.checked = config.backgroundStretch;
  form.safeTextX.value = String(config.safeTextRegion.x);
  form.safeTextY.value = String(config.safeTextRegion.y);
  form.safeTextWidth.value = String(config.safeTextRegion.width);
  form.safeTextHeight.value = String(config.safeTextRegion.height);
  form.textScale.value = String(config.textScale);
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

// Selects the dropdown option matching `language` if one exists, otherwise
// falls back to "custom" and puts the raw value in the free-text field -
// covers any BCP-47 code not in the curated list (e.g. from an import).
function setLanguageField(language) {
  const form = document.getElementById("configurator-form");
  const hasMatchingOption = Array.from(form.language.options).some(
    (opt) => opt.value === language && opt.value !== "custom"
  );
  if (hasMatchingOption) {
    form.language.value = language;
    form.languageCustom.value = "";
  } else {
    form.language.value = "custom";
    form.languageCustom.value = language;
  }
  updateLanguageVisibility();
}

function updateBackgroundTransparencyVisibility() {
  const form = document.getElementById("configurator-form");
  form.backgroundColor.disabled = form.backgroundTransparent.checked;
}

// Preview-only: makes the preview iframe's own aspect ratio match the
// BrightSign zone it'll actually be deployed into (the roRectangle in
// autorun.brs), since safeTextRegion and the auto-fit sizing are both
// percentage-based and their real-world proportions depend on that ratio.
// Not part of clockConfig - the zone size is determined by the BrightScript
// launcher, not by this widget.
function updateZoneSize() {
  const form = document.getElementById("configurator-form");
  const width = Number(form.zoneWidth.value);
  const height = Number(form.zoneHeight.value);
  if (width > 0 && height > 0) {
    document.getElementById("preview-frame").style.aspectRatio = width + " / " + height;
  }
}

function updateLanguageVisibility() {
  const form = document.getElementById("configurator-form");
  document.getElementById("languageCustomField").hidden = form.language.value !== "custom";
}

function refreshPreview() {
  const previewFrame = document.getElementById("preview-frame");
  if (!previewFrame.contentWindow || !previewFrame.contentWindow.updatePreview) {
    return;
  }
  try {
    const config = readFormConfig();
    console.log("[clock-font] refreshPreview: fontFamily=", JSON.stringify(config.fontFamily), "fontUrl override=", state.fontObjectUrl);
    previewFrame.contentWindow.updatePreview(config, {
      fontUrl: state.fontObjectUrl,
      backgroundImageUrl: state.backgroundObjectUrl,
      onFontError: (err) => {
        console.error("[clock-font] onFontError fired:", err && err.name, err && err.message, err);
        showError(err.message);
      }
    });
    clearError();
  } catch (err) {
    showError("Could not render the preview: " + err.message);
  }
}

function clearInertFilename(fileInputEl) {
  const label = fileInputEl.parentElement.querySelector(".inert-filename");
  if (label) {
    label.remove();
  }
}

function setFontFile(file) {
  console.log("[clock-font] setFontFile called with", file ? { name: file.name, size: file.size, type: file.type } : null);

  if (state.fontObjectUrl) {
    console.log("[clock-font] revoking previous object URL", state.fontObjectUrl);
    URL.revokeObjectURL(state.fontObjectUrl);
  }
  state.fontFile = file;
  state.fontObjectUrl = file ? URL.createObjectURL(file) : null;
  console.log("[clock-font] new object URL:", state.fontObjectUrl);
  clearInertFilename(document.getElementById("fontFile"));

  // @font-face silently no-ops when bound to a generic name like the default
  // "sans-serif", so an uploaded font would never actually render. Only
  // auto-fill when the field is still at its default/generic value, so an
  // intentionally-chosen custom name is never overwritten.
  if (file) {
    const form = document.getElementById("configurator-form");
    const currentName = form.fontFamily.value;
    const currentNameIsGeneric = currentName.trim() === "" || isGenericFontFamilyName(currentName);
    console.log("[clock-font] current Font Family field value:", JSON.stringify(currentName), "- generic/empty:", currentNameIsGeneric);
    if (currentNameIsGeneric) {
      const derived = deriveFontFamilyName(file.name);
      console.log("[clock-font] auto-filling Font Family field with derived name:", derived);
      form.fontFamily.value = derived;
    } else {
      console.log("[clock-font] leaving Font Family field as-is (already a custom, non-generic name)");
    }
  } else {
    // No file means no @font-face is bound to whatever name is in the field,
    // so an auto-derived/custom name left over from a previous upload is
    // stale and would just resolve to some arbitrary system font. Reset to
    // the default so the field matches what will actually render.
    const form = document.getElementById("configurator-form");
    console.log("[clock-font] clearing font file - resetting Font Family field to default:", DEFAULT_CONFIG.fontFamily);
    form.fontFamily.value = DEFAULT_CONFIG.fontFamily;
  }

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
  const runtimeResponse = await fetch("clock-runtime.js");
  if (!runtimeResponse.ok) {
    throw new Error("Could not load clock-runtime.js (" + runtimeResponse.status + ")");
  }
  const runtimeSource = await runtimeResponse.text();

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
  label.textContent = " (previously: " + filename + " — re-upload it to keep it in the export)";
  fileInputEl.parentElement.appendChild(label);
}

function restoreAssetFromImport(filename, zipEntries, setter, fileInputEl) {
  if (!filename) {
    return;
  }
  if (zipEntries && zipEntries[filename]) {
    const file = new File([zipEntries[filename]], filename);
    // Assigning a File to state alone doesn't touch the <input type="file">
    // itself, so its native "No file chosen" label stays stale even though
    // the asset is actually active. DataTransfer is the standard way to set
    // a real FileList on the input so the browser's own label updates too.
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInputEl.files = dataTransfer.files;
    setter(file);
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

    applyConfigToForm({ ...DEFAULT_CONFIG, ...config });

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

const FIT_HEIGHT_MARGIN = 1.3;

function fitHeightToText() {
  const form = document.getElementById("configurator-form");
  const previewFrame = document.getElementById("preview-frame");
  const previewDoc = previewFrame.contentWindow.document;
  const container = previewDoc.getElementById("clock-container");
  const textEl = previewDoc.getElementById("clock-text");

  // Measure in the unrotated frame, since safeTextRegion's y/height percentages
  // are defined pre-transform even though rotation changes the visual box.
  const previousTransform = container.style.transform;
  container.style.transform = "none";
  const viewportHeightPx = previewDoc.documentElement.clientHeight;
  const textHeightPx = textEl.getBoundingClientRect().height;
  container.style.transform = previousTransform;

  const fitted = computeFitHeightRegion(
    Number(form.safeTextY.value),
    Number(form.safeTextHeight.value),
    textHeightPx,
    viewportHeightPx,
    FIT_HEIGHT_MARGIN
  );

  form.safeTextY.value = String(Math.round(fitted.y * 10) / 10);
  form.safeTextHeight.value = String(Math.round(fitted.height * 10) / 10);
  refreshPreview();
}

function initFitHeightButton() {
  document.getElementById("fitHeightButton").addEventListener("click", fitHeightToText);
}

function initForm() {
  const form = document.getElementById("configurator-form");
  form.zoneWidth.value = "1920";
  form.zoneHeight.value = "1080";
  updateZoneSize();
  applyConfigToForm(DEFAULT_CONFIG);
  initFileInputs();
  initExport();
  initImport();
  initFitHeightButton();
  form.addEventListener("input", () => {
    updateModeVisibility();
    updateLanguageVisibility();
    updateBackgroundTransparencyVisibility();
    updateZoneSize();
    refreshPreview();
  });
  form.addEventListener("change", () => {
    updateModeVisibility();
    updateLanguageVisibility();
    updateBackgroundTransparencyVisibility();
    updateZoneSize();
    refreshPreview();
  });
  document.getElementById("preview-frame").addEventListener("load", refreshPreview);
}

document.addEventListener("DOMContentLoaded", initForm);
