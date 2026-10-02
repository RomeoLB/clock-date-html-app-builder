function buildIntlOptions(config) {
  if (config.mode === "time") {
    const options = { hour: "2-digit", minute: "2-digit" };
    if (config.showSeconds) {
      options.second = "2-digit";
    }
    if (config.hour12 !== null) {
      options.hour12 = config.hour12;
    }
    if (config.timeZone) {
      options.timeZone = config.timeZone;
    }
    return options;
  }
  const options = { year: "numeric", month: "long", day: "numeric" };
  if (config.showWeekday) {
    options.weekday = "long";
  }
  if (config.timeZone) {
    options.timeZone = config.timeZone;
  }
  return options;
}

function reorderDateParts(parts, dateOrder) {
  const findPart = (type) => parts.find(function (p) { return p.type === type; });
  const day = findPart("day");
  const month = findPart("month");
  const year = findPart("year");
  const weekday = findPart("weekday");

  const partsByLetter = { D: day, M: month, Y: year };
  const ordered = dateOrder.split("").map(function (ch) { return partsByLetter[ch]; }).filter(Boolean);
  let result = ordered.map(function (p) { return p.value; }).join("/");

  if (weekday) {
    result = weekday.value + ", " + result;
  }
  return result;
}

function formatClockString(config, now) {
  now = now || new Date();
  const options = buildIntlOptions(config);
  const formatter = new Intl.DateTimeFormat(config.language, options);

  if (config.mode === "date" && config.dateOrder) {
    const parts = formatter.formatToParts(now);
    return reorderDateParts(parts, config.dateOrder);
  }

  return formatter.format(now);
}

function applyRotation(config, container) {
  container.style.transform = "rotate(" + config.rotation + "deg)";
}

function applyBackgroundImage(config, body, imageUrl) {
  const url = imageUrl !== undefined ? imageUrl : config.backgroundImageUrl;
  if (!url) {
    // Revoking a blob: URL only blocks future fetches of it - it doesn't
    // retroactively un-render an image the browser already decoded and
    // cached for this property's current value, so leaving the old
    // url(...) in place would keep showing the cleared image.
    body.style.backgroundImage = "";
    return;
  }
  body.style.backgroundImage = 'url("' + url + '")';
  body.style.backgroundRepeat = "no-repeat";
  body.style.backgroundPosition = "center";
  body.style.backgroundSize = config.backgroundStretch ? "cover" : "contain";
}

function applySafeTextRegion(config, container) {
  const region = config.safeTextRegion;
  container.style.left = region.x + "%";
  container.style.top = region.y + "%";
  container.style.width = region.width + "%";
  container.style.height = region.height + "%";
}

function applyColors(config, body, textEl) {
  body.style.backgroundColor = config.backgroundColor;
  textEl.style.color = config.foregroundColor;
}

function applyFont(config, textEl, doc, fontUrl, onFontError, onFontLoaded) {
  const url = fontUrl !== undefined ? fontUrl : config.fontUrl;

  // Every call (i.e. every preview refresh) would otherwise add another
  // @font-face block on top of the last, piling up stale rules - some
  // pointing at blob: URLs already revoked by a since-cleared/replaced
  // upload. document.fonts.load for a family fails if ANY same-family rule
  // can't load, so a stale rule can falsely report a perfectly good new
  // font as broken. Only ever keep the current one.
  if (doc.head.querySelector) {
    const existingFontFaceEl = doc.head.querySelector("[data-clock-font-face]");
    if (existingFontFaceEl) {
      doc.head.removeChild(existingFontFaceEl);
    }
  }

  if (url) {
    const styleEl = doc.createElement("style");
    if (styleEl.setAttribute) {
      styleEl.setAttribute("data-clock-font-face", "true");
    }
    styleEl.textContent = '@font-face { font-family: "' + config.fontFamily + '"; src: url("' + url + '"); }';
    doc.head.appendChild(styleEl);

    // The @font-face rule above loads lazily and silently on its own - the
    // browser just falls back to a default font with no signal if it fails
    // (corrupt file, unsupported format, etc.). doc.fonts.load actively
    // attempts the load and tells us whether it actually succeeded.
    if (doc.fonts && typeof doc.fonts.load === "function") {
      console.log("[clock-font] loading", config.fontFamily, "from", url);
      doc.fonts.load('1em "' + config.fontFamily + '"').then(function (matches) {
        console.log("[clock-font] doc.fonts.load resolved for", config.fontFamily, "with", matches.length, "matching face(s)", matches);
        if (matches.length === 0 && onFontError) {
          console.warn("[clock-font] load resolved with zero matches - treating as a failed load for", config.fontFamily);
          onFontError(new Error('The font "' + config.fontFamily + '" could not be loaded. The file may be corrupted or in an unsupported format.'));
        } else if (matches.length > 0 && onFontLoaded) {
          onFontLoaded();
        }
      }).catch(function (err) {
        console.error("[clock-font] doc.fonts.load rejected for", config.fontFamily, "-", err && err.name, err && err.message, err);
        if (onFontError) {
          onFontError(err);
        }
      });
    } else {
      console.log("[clock-font] doc.fonts.load is not available in this environment - skipping load-failure detection for", config.fontFamily);
    }
  }
  textEl.style.fontFamily = config.fontFamily;
}

function render(config, textEl, now) {
  textEl.textContent = formatClockString(config, now);
}

// Returns the font size (in the same unit as baseFontSize) that makes a box of
// textWidth x textHeight (as measured at baseFontSize) the largest it can be
// while still fitting within containerWidth x containerHeight, times fillRatio.
function computeFitFontSize(containerWidth, containerHeight, textWidth, textHeight, baseFontSize, fillRatio) {
  if (containerWidth <= 0 || containerHeight <= 0 || textWidth <= 0 || textHeight <= 0) {
    return baseFontSize;
  }
  const scale = Math.min(containerWidth / textWidth, containerHeight / textHeight);
  return baseFontSize * scale * fillRatio;
}

const FIT_BASE_FONT_SIZE = 100;
const FIT_FILL_RATIO = 0.92;

// Normalizes a textScale config value (a 10-100 percentage, or missing/invalid)
// into a 0-1 fraction. Some fonts' glyphs run closer to their own bounding box
// than others, so the auto-fit size can still look like it's touching the
// edges for a particular font - textScale lets the user dial it back.
function resolveTextScale(textScalePercent) {
  if (typeof textScalePercent !== "number" || !isFinite(textScalePercent) || textScalePercent <= 0) {
    return 1;
  }
  return Math.min(100, textScalePercent) / 100;
}

function fitTextToContainer(container, textEl, textScalePercent) {
  textEl.style.fontSize = FIT_BASE_FONT_SIZE + "px";
  const containerRect = container.getBoundingClientRect();
  const textRect = textEl.getBoundingClientRect();
  const fontSize = computeFitFontSize(
    containerRect.width,
    containerRect.height,
    textRect.width,
    textRect.height,
    FIT_BASE_FONT_SIZE,
    FIT_FILL_RATIO
  );
  textEl.style.fontSize = (fontSize * resolveTextScale(textScalePercent)) + "px";
}

// An HTML widget's own Intl/Date report UTC on a BrightSign player, so the
// zone the player is actually set to has to be read from its systemtime
// module. Its getTimeZone() returns a zone name, or "POSIX:<tz string>" if
// the player was given a POSIX-format zone. Returns an IANA name Intl accepts,
// or null if it can't be mapped (callers then keep the runtime default).
function toIntlTimeZone(playerZone) {
  if (typeof playerZone !== "string" || playerZone === "") {
    return null;
  }
  let candidate = playerZone;
  if (candidate.indexOf("POSIX:") === 0) {
    // Only the standard-time offset can be honoured (e.g. "EST5EDT,M3.2.0,..." ->
    // UTC-5); a POSIX string's own DST rules aren't evaluated.
    const match = candidate.slice(6).match(/^[A-Za-z]{3,}([+-]?)(\d{1,2})(?::(\d{2}))?/);
    if (!match || (match[3] && match[3] !== "00")) {
      return null;
    }
    const hours = parseInt(match[2], 10);
    if (hours === 0) {
      return "UTC";
    }
    // POSIX offsets are positive WEST of UTC; Etc/GMT zones use the same sign.
    candidate = "Etc/GMT" + (match[1] === "-" ? "-" : "+") + hours;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch (e) {
    return null;
  }
}

// loadModule is injected for testing; on a player it is the global require.
function readPlayerTimeZone(loadModule) {
  try {
    if (typeof loadModule !== "function") {
      return Promise.resolve(null);
    }
    const SystemTime = loadModule("@brightsign/systemtime");
    return Promise.resolve(new SystemTime().getTimeZone()).then(function (zone) {
      console.log("[clock-time] player reported time zone:", zone);
      const mapped = toIntlTimeZone(zone);
      if (!mapped) {
        console.warn("[clock-time] could not map player time zone", zone, "- using runtime default");
      }
      return mapped;
    }).catch(function (err) {
      console.warn("[clock-time] getTimeZone failed - using runtime default:", err && err.message);
      return null;
    });
  } catch (e) {
    // Not running on a player (e.g. the configurator preview): no such module.
    return Promise.resolve(null);
  }
}

function bootClock(config, overrides) {
  overrides = overrides || {};
  const container = document.getElementById("clock-container");
  const textEl = document.getElementById("clock-text");
  applyRotation(config, container);
  applyBackgroundImage(config, document.body, overrides.backgroundImageUrl);
  applySafeTextRegion(config, container);
  applyColors(config, document.body, textEl);

  // Sized once (below), not on every tick: with tabular-nums digit widths are
  // stable, so continuously re-fitting every second only produced visible
  // jitter as the exact rendered string varied (e.g. AM/PM, weekday length)
  // with no benefit. Re-fit once more if the custom font finishes loading
  // after this point, since its real metrics may differ from the fallback
  // used for the very first measurement.
  function refit() {
    fitTextToContainer(container, textEl, config.textScale);
  }

  applyFont(config, textEl, document, overrides.fontUrl, overrides.onFontError, refit);

  // Formatting uses its own copy so the player's zone, once read, can be
  // layered on without altering the caller's config.
  const displayConfig = Object.assign({}, config);

  render(displayConfig, textEl);
  refit();

  const readZone = overrides.readTimeZone || function () {
    return readPlayerTimeZone(typeof require === "function" ? require : null);
  };
  readZone().then(function (zone) {
    if (zone) {
      displayConfig.timeZone = zone;
      render(displayConfig, textEl);
      refit();
    }
  });

  return setInterval(function () {
    render(displayConfig, textEl);
  }, 1000);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildIntlOptions,
    toIntlTimeZone,
    readPlayerTimeZone,
    reorderDateParts,
    formatClockString,
    applyRotation,
    applyBackgroundImage,
    applySafeTextRegion,
    applyColors,
    applyFont,
    render,
    computeFitFontSize,
    resolveTextScale,
    fitTextToContainer,
    bootClock
  };
}
