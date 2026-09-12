function buildIntlOptions(config) {
  if (config.mode === "time") {
    const options = { hour: "2-digit", minute: "2-digit" };
    if (config.showSeconds) {
      options.second = "2-digit";
    }
    if (config.hour12 !== null) {
      options.hour12 = config.hour12;
    }
    return options;
  }
  const options = { year: "numeric", month: "long", day: "numeric" };
  if (config.showWeekday) {
    options.weekday = "long";
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

function applyFont(config, textEl, doc, fontUrl) {
  const url = fontUrl !== undefined ? fontUrl : config.fontUrl;
  if (url) {
    const styleEl = doc.createElement("style");
    styleEl.textContent = '@font-face { font-family: "' + config.fontFamily + '"; src: url("' + url + '"); }';
    doc.head.appendChild(styleEl);
  }
  textEl.style.fontFamily = config.fontFamily;
}

function render(config, textEl, now) {
  textEl.textContent = formatClockString(config, now);
}

function bootClock(config, overrides) {
  overrides = overrides || {};
  const container = document.getElementById("clock-container");
  const textEl = document.getElementById("clock-text");
  applyRotation(config, container);
  applyBackgroundImage(config, document.body, overrides.backgroundImageUrl);
  applySafeTextRegion(config, container);
  applyColors(config, document.body, textEl);
  applyFont(config, textEl, document, overrides.fontUrl);
  render(config, textEl);
  return setInterval(function () {
    render(config, textEl);
  }, 1000);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildIntlOptions,
    reorderDateParts,
    formatClockString,
    applyRotation,
    applyBackgroundImage,
    applySafeTextRegion,
    applyColors,
    applyFont,
    render,
    bootClock
  };
}
