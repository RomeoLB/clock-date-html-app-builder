# Clock Configurator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, browser-based configurator app that lets a user set every BrightSign clock-widget parameter through a form with a live preview, and export a ready-to-upload `clock.html` zip (or re-import a previous one to keep editing).

**Architecture:** Three isomorphic (Node-testable + browser-loadable) logic modules — `clock-runtime.js` (rendering), `config-codec.js` (build/parse the config+HTML), `packaging-helpers.js` (filename rules) — plus a plain HTML/JS front end (`index.html` + `app.js`) that wires forms to a live preview `<iframe>` (`preview-shell.html`) and to export/import using a vendored zip library (`vendor/fflate.min.js`).

**Tech Stack:** Plain HTML/CSS/JS, no build step, no framework. Node's built-in test runner (`node --test`) for the three logic modules — no test framework dependency. fflate (vendored) for zip/unzip.

**Spec:** `docs/superpowers/specs/2026-09-12-clock-configurator-design.md`

## Global Constraints

- Entirely static, client-side JS — no server-side component of any kind.
- `clockConfig` is emitted as strict JSON (quoted keys, no comments, no trailing commas) and parsed back only with `JSON.parse` — never `eval`/`Function`.
- The zip library is vendored into the repo at `vendor/fflate.min.js` — no runtime dependency on a third-party CDN.
- Inside every generated zip, the widget file is always named exactly `clock.html`, regardless of the zip's own filename — BrightSign expects that name.
- `safeTextRegion.x/y/width/height` are bounded 0–100.
- This repo (`clock-configurator/`) contains only the clock widget and the configurator — none of the original project's unrelated files (BrightScript autoruns, `docs/` from the old project, `to-be-uploaded-clock/`).
- Work stops at a local git commit per task — no GitHub repo creation, push, or Pages setup is performed as part of this plan.
- `app.js` fetches `clock-runtime.js`'s source at export time, so the app must be served over http(s) (a local static server, or GitHub Pages) during testing — opening `index.html` directly via `file://` will not support the export step.

---

## Task 1: Shared clock rendering logic (`clock-runtime.js`)

**Files:**
- Create: `clock-runtime.js`
- Test: `tests/clock-runtime.test.js`

**Interfaces:**
- Produces (used by every later task): `buildIntlOptions(config)`, `reorderDateParts(parts, dateOrder)`, `formatClockString(config, now?)`, `applyRotation(config, container)`, `applyBackgroundImage(config, body, imageUrl?)`, `applySafeTextRegion(config, container)`, `applyColors(config, body, textEl)`, `applyFont(config, textEl, doc, fontUrl?)`, `render(config, textEl, now?)`, `bootClock(config, overrides?)` → returns an interval id. All are attached as top-level globals when loaded via `<script>`, and exported via `module.exports` when loaded via `require()` in Node.
- `config` shape (matches the existing hand-written `clock.html`): `{ mode, rotation, language, foregroundColor, backgroundColor, fontFamily, fontUrl, backgroundImageUrl, backgroundStretch, safeTextRegion: {x,y,width,height}, hour12, showSeconds, showWeekday, dateOrder }`.
- `overrides` (only used by `bootClock`, for the live preview): `{ fontUrl, backgroundImageUrl }` — object-URL substitutes for the config's own `fontUrl`/`backgroundImageUrl`, used because uploaded files aren't reachable at their eventual zip-relative path until export.

- [ ] **Step 1: Write the failing tests**

Create `tests/clock-runtime.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildIntlOptions,
  reorderDateParts,
  formatClockString,
  applyRotation,
  applyBackgroundImage,
  applySafeTextRegion,
  applyColors,
  applyFont,
  render
} = require("../clock-runtime.js");

const FIXED_DATE = new Date(2026, 8, 12, 14, 6, 53); // Saturday, September 12, 2026, 14:06:53

test("buildIntlOptions: time mode includes seconds and hour12 only when requested", () => {
  assert.deepEqual(
    buildIntlOptions({ mode: "time", showSeconds: true, hour12: true }),
    { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }
  );
  assert.deepEqual(
    buildIntlOptions({ mode: "time", showSeconds: false, hour12: null }),
    { hour: "2-digit", minute: "2-digit" }
  );
});

test("buildIntlOptions: date mode includes weekday only when requested", () => {
  assert.deepEqual(
    buildIntlOptions({ mode: "date", showWeekday: true }),
    { year: "numeric", month: "long", day: "numeric", weekday: "long" }
  );
  assert.deepEqual(
    buildIntlOptions({ mode: "date", showWeekday: false }),
    { year: "numeric", month: "long", day: "numeric" }
  );
});

test("reorderDateParts: DMY with weekday prefixes the weekday", () => {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric", month: "long", day: "numeric", weekday: "long"
  }).formatToParts(FIXED_DATE);
  assert.equal(reorderDateParts(parts, "DMY"), "Saturday, 12/September/2026");
});

test("formatClockString: time, en, 12-hour with seconds", () => {
  const result = formatClockString(
    { mode: "time", language: "en", hour12: true, showSeconds: true },
    FIXED_DATE
  );
  assert.match(result, /^02:06:53\s*PM$/);
});

test("formatClockString: time, en, 24-hour without seconds", () => {
  const result = formatClockString(
    { mode: "time", language: "en", hour12: false, showSeconds: false },
    FIXED_DATE
  );
  assert.equal(result, "14:06");
});

test("formatClockString: date, en, natural order with weekday", () => {
  const result = formatClockString(
    { mode: "date", language: "en", showWeekday: true, dateOrder: null },
    FIXED_DATE
  );
  assert.equal(result, "Saturday, September 12, 2026");
});

test("formatClockString: date, en, forced DMY order without weekday", () => {
  const result = formatClockString(
    { mode: "date", language: "en", showWeekday: false, dateOrder: "DMY" },
    FIXED_DATE
  );
  assert.equal(result, "12/September/2026");
});

test("formatClockString: date, fr locale, natural order", () => {
  const result = formatClockString(
    { mode: "date", language: "fr", showWeekday: true, dateOrder: null },
    FIXED_DATE
  );
  assert.equal(result, "samedi 12 septembre 2026");
});

test("formatClockString: date, ja locale, natural order", () => {
  const result = formatClockString(
    { mode: "date", language: "ja", showWeekday: true, dateOrder: null },
    FIXED_DATE
  );
  assert.equal(result, "2026年9月12日土曜日");
});

test("formatClockString: time, ja locale, 12-hour with seconds", () => {
  const result = formatClockString(
    { mode: "time", language: "ja", hour12: true, showSeconds: true },
    FIXED_DATE
  );
  assert.equal(result, "午後02:06:53");
});

test("applyRotation sets a CSS rotate transform", () => {
  const container = { style: {} };
  applyRotation({ rotation: 180 }, container);
  assert.equal(container.style.transform, "rotate(180deg)");
});

test("applyBackgroundImage: no-op when no url and no override", () => {
  const body = { style: {} };
  applyBackgroundImage({ backgroundImageUrl: null, backgroundStretch: false }, body);
  assert.deepEqual(body.style, {});
});

test("applyBackgroundImage: uses config url, cover when stretched", () => {
  const body = { style: {} };
  applyBackgroundImage({ backgroundImageUrl: "bg.jpg", backgroundStretch: true }, body);
  assert.equal(body.style.backgroundImage, 'url("bg.jpg")');
  assert.equal(body.style.backgroundSize, "cover");
});

test("applyBackgroundImage: an explicit override url wins over the config url", () => {
  const body = { style: {} };
  applyBackgroundImage(
    { backgroundImageUrl: null, backgroundStretch: false },
    body,
    "blob:override"
  );
  assert.equal(body.style.backgroundImage, 'url("blob:override")');
  assert.equal(body.style.backgroundSize, "contain");
});

test("applySafeTextRegion sets left/top/width/height as percentages", () => {
  const container = { style: {} };
  applySafeTextRegion({ safeTextRegion: { x: 25, y: 10, width: 50, height: 80 } }, container);
  assert.deepEqual(container.style, {
    left: "25%", top: "10%", width: "50%", height: "80%"
  });
});

test("applyColors sets background and text color", () => {
  const body = { style: {} };
  const textEl = { style: {} };
  applyColors({ backgroundColor: "#111111", foregroundColor: "#eeeeee" }, body, textEl);
  assert.equal(body.style.backgroundColor, "#111111");
  assert.equal(textEl.style.color, "#eeeeee");
});

test("applyFont: sets font-family, and injects an @font-face rule only when a url is given", () => {
  const textEl = { style: {} };
  const appended = [];
  const doc = {
    createElement: () => ({ textContent: "" }),
    head: { appendChild: (el) => appended.push(el) }
  };

  applyFont({ fontFamily: "Sans", fontUrl: null }, textEl, doc);
  assert.equal(textEl.style.fontFamily, "Sans");
  assert.equal(appended.length, 0);

  applyFont({ fontFamily: "MyFont", fontUrl: "f.woff2" }, textEl, doc);
  assert.equal(textEl.style.fontFamily, "MyFont");
  assert.equal(appended.length, 1);
  assert.match(appended[0].textContent, /font-family: "MyFont"/);
  assert.match(appended[0].textContent, /src: url\("f\.woff2"\)/);
});

test("render writes the formatted string into the text element", () => {
  const textEl = { style: {} };
  render({ mode: "time", language: "en", hour12: false, showSeconds: false }, textEl, FIXED_DATE);
  assert.equal(textEl.textContent, "14:06");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/clock-runtime.test.js`
Expected: fails with a `MODULE_NOT_FOUND` error (`clock-runtime.js` doesn't exist yet).

- [ ] **Step 3: Implement `clock-runtime.js`**

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/clock-runtime.test.js`
Expected: all tests pass (18 pass, 0 fail).

- [ ] **Step 5: Commit**

```bash
git add clock-runtime.js tests/clock-runtime.test.js
git commit -m "Add shared clock rendering logic with Node test coverage"
```

---

## Task 2: Config build/parse (`config-codec.js`)

**Files:**
- Create: `config-codec.js`
- Test: `tests/config-codec.test.js`

**Interfaces:**
- Consumes: none (pure string/object logic; does not depend on Task 1).
- Produces: `DEFAULT_CONFIG` (object, matches the schema in Task 1), `SCHEMA_DOC_COMMENT` (string), `configToJSONText(config)` → string, `buildClockHtml(config)` → full HTML document text (embeds `<script src="clock-runtime.js">` and inlines `clockConfig` as strict JSON), `extractConfigFromHtml(htmlText)` → config object, throws `Error` with a human-readable message if no `clockConfig` block is found or it fails to parse.

- [ ] **Step 1: Write the failing tests**

Create `tests/config-codec.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/config-codec.test.js`
Expected: fails with `MODULE_NOT_FOUND` (`config-codec.js` doesn't exist yet).

- [ ] **Step 3: Implement `config-codec.js`**

```js
const DEFAULT_CONFIG = {
  mode: "time",
  rotation: 0,
  language: "en",
  foregroundColor: "#ffffff",
  backgroundColor: "#000000",
  fontFamily: "sans-serif",
  fontUrl: null,
  backgroundImageUrl: null,
  backgroundStretch: false,
  safeTextRegion: { x: 0, y: 0, width: 100, height: 100 },
  hour12: null,
  showSeconds: true,
  showWeekday: true,
  dateOrder: null
};

const SCHEMA_DOC_COMMENT = [
  "/*",
  " * clockConfig schema",
  " * -------------------",
  " * mode: \"time\" or \"date\" - mutually exclusive, shows one or the other, never both.",
  " * rotation: 0, 90, 180, or 270 - rotates the whole clock clockwise.",
  " * language: BCP-47 locale code (e.g. \"en\", \"en-GB\", \"fr\", \"ja\"). Drives Intl.DateTimeFormat",
  " *   month/weekday names and the default hour12/date-order conventions when not overridden below.",
  " * foregroundColor / backgroundColor: any CSS color value.",
  " * fontFamily: CSS font-family name, bound to fontUrl via @font-face when fontUrl is set.",
  " * fontUrl / backgroundImageUrl: relative paths bundled alongside this file, or null for none.",
  " * backgroundStretch: true = background image covers the viewport (cropping); false = contain.",
  " * safeTextRegion: {x, y, width, height} as percentages of the viewport the clock text may use.",
  " * hour12: true = force 12-hour, false = force 24-hour, null = use the language's default.",
  " * showSeconds: mode:\"time\" only. showWeekday / dateOrder (\"MDY\"/\"DMY\"/\"YMD\"/null): mode:\"date\" only.",
  " */"
].join("\n");

const CLOCK_CONFIG_MARKER = "const clockConfig = ";

function configToJSONText(config) {
  return JSON.stringify(config, null, 2);
}

function buildClockHtml(config) {
  return "<!DOCTYPE html>\n" +
    "<html>\n" +
    "<head>\n" +
    "<meta charset=\"utf-8\">\n" +
    "<title>Clock Widget</title>\n" +
    "<style>\n" +
    "  html, body {\n" +
    "    margin: 0;\n" +
    "    padding: 0;\n" +
    "    width: 100%;\n" +
    "    height: 100%;\n" +
    "    overflow: hidden;\n" +
    "    background: #000000;\n" +
    "    position: relative;\n" +
    "  }\n" +
    "  #clock-container {\n" +
    "    position: absolute;\n" +
    "    display: flex;\n" +
    "    align-items: center;\n" +
    "    justify-content: center;\n" +
    "  }\n" +
    "  #clock-text {\n" +
    "    font-family: sans-serif;\n" +
    "    font-size: 10vw;\n" +
    "    color: #ffffff;\n" +
    "    white-space: nowrap;\n" +
    "  }\n" +
    "</style>\n" +
    "</head>\n" +
    "<body>\n" +
    "<div id=\"clock-container\">\n" +
    "  <div id=\"clock-text\"></div>\n" +
    "</div>\n" +
    "<script src=\"clock-runtime.js\"></script>\n" +
    "<script>\n" +
    SCHEMA_DOC_COMMENT + "\n" +
    CLOCK_CONFIG_MARKER + configToJSONText(config) + ";\n" +
    "bootClock(clockConfig);\n" +
    "</script>\n" +
    "</body>\n" +
    "</html>\n";
}

function extractConfigFromHtml(htmlText) {
  const markerIndex = htmlText.indexOf(CLOCK_CONFIG_MARKER);
  if (markerIndex === -1) {
    throw new Error("No clockConfig block found in the provided file.");
  }
  const braceStart = htmlText.indexOf("{", markerIndex);
  if (braceStart === -1) {
    throw new Error("No clockConfig block found in the provided file.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (let i = braceStart; i < htmlText.length; i++) {
    const ch = htmlText[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") {
      inString = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error("Could not find the end of the clockConfig block (unbalanced braces).");
  }

  const jsonText = htmlText.slice(braceStart, end + 1);
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    throw new Error("Could not parse clock configuration: " + e.message);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DEFAULT_CONFIG,
    SCHEMA_DOC_COMMENT,
    configToJSONText,
    buildClockHtml,
    extractConfigFromHtml
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/config-codec.test.js`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add config-codec.js tests/config-codec.test.js
git commit -m "Add config build/parse module with round-trip test coverage"
```

---

## Task 3: Filename helpers (`packaging-helpers.js`)

**Files:**
- Create: `packaging-helpers.js`
- Test: `tests/packaging-helpers.test.js`

**Interfaces:**
- Consumes: none.
- Produces: `normalizeZipFilename(name)` → string (defaults to `"clock.zip"` when blank; appends `.zip` if missing, case-insensitively), `assetFilename(kind, originalFileName)` → string (e.g. `assetFilename("font", "MyFont.WOFF2")` → `"font.woff2"`; falls back to just `kind` when the original filename has no extension).

- [ ] **Step 1: Write the failing tests**

Create `tests/packaging-helpers.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/packaging-helpers.test.js`
Expected: fails with `MODULE_NOT_FOUND` (`packaging-helpers.js` doesn't exist yet).

- [ ] **Step 3: Implement `packaging-helpers.js`**

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/packaging-helpers.test.js`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packaging-helpers.js tests/packaging-helpers.test.js
git commit -m "Add zip/asset filename helpers with test coverage"
```

---

## Task 4: Live preview shell (`preview-shell.html`)

**Files:**
- Create: `preview-shell.html`

**Interfaces:**
- Consumes: `clock-runtime.js`'s `bootClock(config, overrides)` (Task 1).
- Produces: a page exposing `window.updatePreview(config, overrides)`, meant to be loaded in an `<iframe>` by `index.html` (Task 5) and driven from the parent page. Calling it re-renders the clock with the given config/overrides, replacing any previous ticking interval.

This task has no Node-testable logic (it's DOM wiring); verification is manual in a browser.

- [ ] **Step 1: Implement `preview-shell.html`**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
  }
  #clock-container {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #clock-text {
    font-family: sans-serif;
    font-size: 10vw;
    color: #ffffff;
    white-space: nowrap;
  }
</style>
</head>
<body>
<div id="clock-container">
  <div id="clock-text"></div>
</div>
<script src="clock-runtime.js"></script>
<script>
  let currentInterval = null;
  window.updatePreview = function (config, overrides) {
    if (currentInterval) {
      clearInterval(currentInterval);
    }
    currentInterval = bootClock(config, overrides || {});
  };
</script>
</body>
</html>
```

- [ ] **Step 2: Manually verify in a browser**

Run: `python3 -m http.server 8000` from the `clock-configurator/` directory, then open `http://localhost:8000/preview-shell.html`.

Open the browser devtools console and run:

```js
updatePreview({
  mode: "time", rotation: 0, language: "en", foregroundColor: "#ffffff",
  backgroundColor: "#000000", fontFamily: "sans-serif", fontUrl: null,
  backgroundImageUrl: null, backgroundStretch: false,
  safeTextRegion: { x: 0, y: 0, width: 100, height: 100 },
  hour12: null, showSeconds: true, showWeekday: true, dateOrder: null
});
```

Expected: the current time appears centered on screen and updates every second. Run `updatePreview({...same but rotation: 180})` and confirm the display flips upside down with no leftover duplicate ticking (only one clean update per second).

- [ ] **Step 3: Commit**

```bash
git add preview-shell.html
git commit -m "Add live preview shell driven by the shared clock runtime"
```

---

## Task 5: Configurator form skeleton + live preview wiring

**Files:**
- Create: `index.html`
- Create: `app.js`

**Interfaces:**
- Consumes: `config-codec.js`'s `DEFAULT_CONFIG` (Task 2); `preview-shell.html`'s `window.updatePreview` (Task 4).
- Produces: a global `state` object (`{ fontFile, backgroundFile, fontObjectUrl, backgroundObjectUrl }`, all initially `null` — populated by Task 6); `readFormConfig()` → config object read from the form; `applyConfigToForm(config)` → writes a config into the form fields; `updateModeVisibility()`; `refreshPreview()`; `initForm()`. These are relied on by Tasks 6–8.

This task has no Node-testable logic; verification is manual in a browser.

- [ ] **Step 1: Implement `index.html`**

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Clock Configurator</title>
<style>
  body { font-family: sans-serif; margin: 0; padding: 16px; }
  #app { display: flex; flex-wrap: wrap; gap: 24px; }
  fieldset { margin-bottom: 12px; }
  label { display: block; margin: 6px 0; }
  #preview-pane { flex: 1 1 320px; min-width: 280px; }
  #preview-frame { width: 100%; aspect-ratio: 16 / 9; border: 1px solid #ccc; background: #000; }
  #error-banner { background: #fdd; color: #900; padding: 8px 12px; margin-bottom: 12px; }
  #error-banner[hidden] { display: none; }
</style>
</head>
<body>
  <div id="error-banner" role="alert" hidden></div>
  <div id="app">
    <form id="configurator-form">
      <fieldset>
        <legend>Mode &amp; Time/Date</legend>
        <label>Mode
          <select name="mode">
            <option value="time">Time</option>
            <option value="date">Date</option>
          </select>
        </label>
        <label>Rotation
          <select name="rotation">
            <option value="0">0°</option>
            <option value="90">90°</option>
            <option value="180">180°</option>
            <option value="270">270°</option>
          </select>
        </label>
        <label>Language (BCP-47) <input type="text" name="language"></label>
        <div id="time-only-fields">
          <label>12-hour format
            <select name="hour12">
              <option value="">Locale default</option>
              <option value="true">12-hour (AM/PM)</option>
              <option value="false">24-hour</option>
            </select>
          </label>
          <label><input type="checkbox" name="showSeconds"> Show seconds</label>
        </div>
        <div id="date-only-fields">
          <label><input type="checkbox" name="showWeekday"> Show weekday</label>
          <label>Date order
            <select name="dateOrder">
              <option value="">Locale default</option>
              <option value="MDY">MDY</option>
              <option value="DMY">DMY</option>
              <option value="YMD">YMD</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Colors</legend>
        <label>Text color <input type="color" name="foregroundColor"></label>
        <label>Background color <input type="color" name="backgroundColor"></label>
      </fieldset>

      <fieldset>
        <legend>Font</legend>
        <label>Font family <input type="text" name="fontFamily"></label>
      </fieldset>

      <fieldset>
        <legend>Background</legend>
        <label><input type="checkbox" name="backgroundStretch"> Stretch to fill (crop)</label>
      </fieldset>

      <fieldset>
        <legend>Layout / Safe Text Region (%)</legend>
        <label>X <input type="number" name="safeTextX" min="0" max="100"></label>
        <label>Y <input type="number" name="safeTextY" min="0" max="100"></label>
        <label>Width <input type="number" name="safeTextWidth" min="0" max="100"></label>
        <label>Height <input type="number" name="safeTextHeight" min="0" max="100"></label>
      </fieldset>
    </form>

    <div id="preview-pane">
      <iframe id="preview-frame" src="preview-shell.html" title="Clock preview"></iframe>
    </div>
  </div>

  <script src="clock-runtime.js"></script>
  <script src="config-codec.js"></script>
  <script src="packaging-helpers.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Implement `app.js`**

```js
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

function initForm() {
  const form = document.getElementById("configurator-form");
  applyConfigToForm(DEFAULT_CONFIG);
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
```

- [ ] **Step 3: Manually verify in a browser**

Run: `python3 -m http.server 8000` from `clock-configurator/`, open `http://localhost:8000/index.html`.

Expected:
- The preview pane shows the current time immediately and ticks every second.
- Changing Mode to "Date" hides the time-only fields, shows the date-only fields, and the preview switches to showing the date.
- Changing Rotation, colors, font family, and safe-text-region X/Y/Width/Height each visibly update the preview without needing a page reload.
- Toggling "Show seconds" (time mode) and "Show weekday" / Date order (date mode) changes the preview text accordingly.

- [ ] **Step 4: Commit**

```bash
git add index.html app.js
git commit -m "Add configurator form skeleton with live preview wiring"
```

---

## Task 6: Custom font & background image upload

**Files:**
- Modify: `index.html` (add a file input inside the "Font" fieldset and inside the "Background" fieldset, each with a "Clear" button)
- Modify: `app.js` (add file-handling functions)

**Interfaces:**
- Consumes: `state` and `refreshPreview()` from Task 5.
- Produces: `setFontFile(file)`, `setBackgroundFile(file)`, `initFileInputs()` — populate/clear `state.fontFile` / `state.backgroundFile` and their object URLs, and trigger a preview refresh.

This task has no Node-testable logic; verification is manual in a browser.

- [ ] **Step 1: Modify `index.html`**

Inside the `Font` fieldset, after the `fontFamily` label, add:

```html
        <label>Custom font file
          <input type="file" name="fontFile" id="fontFile" accept=".woff,.woff2,.ttf,.otf">
        </label>
        <button type="button" id="clearFontFile">Clear font file</button>
```

Inside the `Background` fieldset, after the `backgroundStretch` label, add:

```html
        <label>Background image
          <input type="file" name="backgroundFile" id="backgroundFile" accept="image/*">
        </label>
        <button type="button" id="clearBackgroundFile">Clear background image</button>
```

- [ ] **Step 2: Modify `app.js`**

Add these functions, and call `initFileInputs()` from inside `initForm()` (add the call right after `applyConfigToForm(DEFAULT_CONFIG);`):

```js
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
```

- [ ] **Step 3: Manually verify in a browser**

Reload `http://localhost:8000/index.html`.

Expected:
- Uploading a `.woff2`/`.ttf` font file changes the preview's rendered font immediately.
- Uploading an image as the background shows it behind the clock in the preview, respecting the "Stretch to fill" checkbox (cover vs. contain).
- Clicking "Clear font file" / "Clear background image" reverts the preview to no custom font / no background image, and the file input visibly empties.

- [ ] **Step 4: Commit**

```bash
git add index.html app.js
git commit -m "Add custom font and background image upload with live preview"
```

---

## Task 7: Vendor fflate + zip export

**Files:**
- Create: `vendor/fflate.min.js` (downloaded, not hand-written)
- Modify: `index.html` (add an "Export" fieldset with the zip filename field and Generate button)
- Modify: `app.js` (add export logic)

**Interfaces:**
- Consumes: `config-codec.js`'s `buildClockHtml` (Task 2), `packaging-helpers.js`'s `assetFilename`/`normalizeZipFilename` (Task 3), the global `fflate` object from the vendored library (`fflate.strToU8`, `fflate.zipSync`), `readFormConfig()`/`state`/`showError()` from Tasks 5–6.
- Produces: `buildFinalConfig()`, `downloadBlob(blob, filename)`, `generateAndDownload()`, `initExport()`.

This task has no Node-testable logic (it's zip/DOM wiring); verification is manual in a browser.

- [ ] **Step 1: Vendor fflate**

```bash
mkdir -p vendor
curl -L https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js -o vendor/fflate.min.js
```

Verify it downloaded and defines the expected global:

```bash
grep -o "fflate" vendor/fflate.min.js | head -1
wc -l vendor/fflate.min.js
```

Expected: prints `fflate` and a non-zero line count.

- [ ] **Step 2: Modify `index.html`**

Add a new fieldset just before the closing `</form>` tag:

```html
      <fieldset>
        <legend>Export</legend>
        <label>Output zip filename <input type="text" name="zipFilename" id="zipFilename" placeholder="clock.zip"></label>
        <button type="button" id="generateButton">Generate &amp; Download</button>
      </fieldset>
```

Add the vendored library script tag before `app.js`'s `<script>` tag:

```html
  <script src="vendor/fflate.min.js"></script>
```

- [ ] **Step 3: Modify `app.js`**

Add these functions:

```js
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
```

Call `initExport();` from inside `initForm()`, alongside the existing `initFileInputs();` call.

- [ ] **Step 4: Manually verify in a browser**

Reload `http://localhost:8000/index.html`. Set a few non-default options, upload a font and a background image, type `my-clock` into the zip filename field, click "Generate & Download".

Expected:
- A file named `my-clock.zip` downloads.
- Unzipping it shows `clock.html`, `clock-runtime.js`, and the uploaded font/background files (named `font.<ext>` / `background.<ext>`).
- Opening the unzipped `clock.html` directly in a browser (via the same local server, e.g. `python3 -m http.server 8000` from the unzip destination) renders identically to what the configurator's preview showed.
- Leaving the zip filename field blank and generating again downloads `clock.zip`.

- [ ] **Step 5: Commit**

```bash
git add vendor/fflate.min.js index.html app.js
git commit -m "Add vendored fflate and zip export with user-set filename"
```

---

## Task 8: Re-import a previously generated zip or HTML file

**Files:**
- Modify: `index.html` (add an "Import" fieldset)
- Modify: `app.js` (add import logic)

**Interfaces:**
- Consumes: `fflate.unzipSync`/`fflate.strFromU8` (Task 7's vendored library), `extractConfigFromHtml` (Task 2), `applyConfigToForm`/`setFontFile`/`setBackgroundFile`/`showError`/`clearError` (Tasks 5–7).
- Produces: `handleImportFile(file)`, `restoreAssetFromImport(filename, zipEntries, setter, fileInputEl)`, `showInertFilename(fileInputEl, filename)`, `initImport()`.

This task has no Node-testable logic (it's file/DOM wiring); verification is manual in a browser.

- [ ] **Step 1: Modify `index.html`**

Add a new fieldset at the top of the form, before the "Mode & Time/Date" fieldset:

```html
      <fieldset>
        <legend>Import existing config</legend>
        <label>Load a previously generated .zip or .html file
          <input type="file" id="importFile" accept=".zip,.html">
        </label>
      </fieldset>
```

- [ ] **Step 2: Modify `app.js`**

Add these functions:

```js
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
```

Call `initImport();` from inside `initForm()`, alongside `initFileInputs();` and `initExport();`.

- [ ] **Step 3: Manually verify in a browser**

Reload `http://localhost:8000/index.html`.

1. Generate a zip with a custom font, background image, and several non-default settings (per Task 7's test). Reload the page (to reset the form to defaults), then use "Import existing config" to load that zip.
   Expected: every field restores to what was set, the preview shows the uploaded font and background again (confirm by re-generating and diffing, or visually), and no error banner appears.
2. Take just the `clock.html` extracted from that same zip (not the zip itself) and import it standalone.
   Expected: all non-file fields restore correctly; the font/background file inputs show inert "(previously: font.woff2, re-upload to change)" text instead of a restored file; no error banner appears.
3. Import an unrelated file (e.g. a plain text file, or an image).
   Expected: the error banner shows a clear message ("Could not import that file: ..."), and the form's current values are untouched.

- [ ] **Step 4: Commit**

```bash
git add index.html app.js
git commit -m "Add re-import of a previously generated zip or HTML file"
```

---

## Self-Review Notes

- **Spec coverage:** full `clockConfig` schema (Task 5/6 form fields) ✓; live preview (Task 4/5) ✓; font/background upload bundled into output (Task 6/7) ✓; downloadable zip (Task 7) ✓; user-set zip filename (Task 7) ✓; re-import of `.zip` or `.html` (Task 8) ✓; strict-JSON config format, no `eval` (Task 2) ✓; vendored zip library, no CDN at runtime (Task 7) ✓; safe-text-region bounds (Task 5's `min`/`max`) ✓; clean repo excluding unrelated files (this whole plan only touches `clock-configurator/`) ✓; local git commit only, no push (every task's commit step is local) ✓.
- **Nested-brace edge case** called out in the spec's self-review is directly covered by a dedicated test in Task 2.
- **Type/name consistency** checked across tasks: `config` shape is identical in `clock-runtime.js`, `config-codec.js`'s `DEFAULT_CONFIG`, and `app.js`'s `readFormConfig()`/`applyConfigToForm()`; `state` fields (`fontFile`, `backgroundFile`, `fontObjectUrl`, `backgroundObjectUrl`) are declared once in Task 5 and used identically in Tasks 6–8; `showError`/`clearError` (Task 5) are reused as-is in Tasks 7–8 without renaming.
