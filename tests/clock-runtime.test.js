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
  render,
  renderText,
  computeFitFontSize,
  resolveTextScale
} = require("../clock-runtime.js");

function makeFakeTextEl() {
  const nodes = [];
  return {
    textContent: "",
    get firstChild() {
      return nodes.length ? nodes[0] : null;
    },
    get childNodes() {
      return nodes.slice();
    },
    appendChild(node) {
      nodes.push(node);
    },
    removeChild(node) {
      const index = nodes.indexOf(node);
      if (index !== -1) {
        nodes.splice(index, 1);
      }
    }
  };
}

function makeFakeDoc() {
  return {
    createElement: (tag) => ({ tagName: tag, style: {}, textContent: "" }),
    createTextNode: (text) => ({ nodeType: 3, textContent: text })
  };
}

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

test("applyFont: reports onFontError when doc.fonts.load resolves with no matches (load failed)", async () => {
  const textEl = { style: {} };
  const doc = {
    createElement: () => ({ textContent: "" }),
    head: { appendChild: () => {} },
    fonts: { load: () => Promise.resolve([]) }
  };
  let reportedError = null;

  applyFont({ fontFamily: "BrokenFont", fontUrl: "broken.ttf" }, textEl, doc, undefined, (err) => {
    reportedError = err;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(reportedError instanceof Error);
  assert.match(reportedError.message, /BrokenFont/);
});

test("applyFont: reports onFontError when doc.fonts.load rejects", async () => {
  const textEl = { style: {} };
  const doc = {
    createElement: () => ({ textContent: "" }),
    head: { appendChild: () => {} },
    fonts: { load: () => Promise.reject(new Error("network error")) }
  };
  let reportedError = null;

  applyFont({ fontFamily: "MyFont", fontUrl: "f.woff2" }, textEl, doc, undefined, (err) => {
    reportedError = err;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(reportedError instanceof Error);
  assert.equal(reportedError.message, "network error");
});

test("applyFont: does not call onFontError when doc.fonts.load resolves with a match", async () => {
  const textEl = { style: {} };
  const doc = {
    createElement: () => ({ textContent: "" }),
    head: { appendChild: () => {} },
    fonts: { load: () => Promise.resolve([{}]) }
  };
  let called = false;

  applyFont({ fontFamily: "GoodFont", fontUrl: "good.ttf" }, textEl, doc, undefined, () => {
    called = true;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(called, false);
});

test("applyFont: calls onFontLoaded when doc.fonts.load resolves with a match", async () => {
  const textEl = { style: {} };
  const doc = {
    createElement: () => ({ textContent: "" }),
    head: { appendChild: () => {} },
    fonts: { load: () => Promise.resolve([{}]) }
  };
  let loadedCalled = false;
  let errorCalled = false;

  applyFont(
    { fontFamily: "GoodFont", fontUrl: "good.ttf" },
    textEl,
    doc,
    undefined,
    () => { errorCalled = true; },
    () => { loadedCalled = true; }
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(loadedCalled, true);
  assert.equal(errorCalled, false);
});

test("applyFont: does not call onFontLoaded when doc.fonts.load resolves with no matches", async () => {
  const textEl = { style: {} };
  const doc = {
    createElement: () => ({ textContent: "" }),
    head: { appendChild: () => {} },
    fonts: { load: () => Promise.resolve([]) }
  };
  let loadedCalled = false;

  applyFont(
    { fontFamily: "BrokenFont", fontUrl: "broken.ttf" },
    textEl,
    doc,
    undefined,
    () => {},
    () => { loadedCalled = true; }
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(loadedCalled, false);
});

test("applyFont: replaces a previously injected @font-face block instead of accumulating", () => {
  const textEl = { style: {} };
  const headChildren = [];
  const head = {
    appendChild(el) {
      headChildren.push(el);
    },
    querySelector(selector) {
      assert.equal(selector, "[data-clock-font-face]");
      return headChildren.find((el) => el.getAttribute("data-clock-font-face") === "true") || null;
    },
    removeChild(el) {
      const index = headChildren.indexOf(el);
      if (index !== -1) {
        headChildren.splice(index, 1);
      }
    }
  };
  const doc = {
    createElement: () => {
      const attributes = {};
      return {
        textContent: "",
        setAttribute(name, value) {
          attributes[name] = value;
        },
        getAttribute(name) {
          return attributes[name];
        }
      };
    },
    head
  };

  applyFont({ fontFamily: "FontA", fontUrl: "a.woff2" }, textEl, doc);
  assert.equal(headChildren.length, 1);

  applyFont({ fontFamily: "FontB", fontUrl: "b.woff2" }, textEl, doc);
  assert.equal(headChildren.length, 1);
  assert.match(headChildren[0].textContent, /FontB/);

  applyFont({ fontFamily: "FontB", fontUrl: null }, textEl, doc);
  assert.equal(headChildren.length, 0);
});

test("render writes the formatted string into the text element", () => {
  const textEl = { style: {} };
  render({ mode: "time", language: "en", hour12: false, showSeconds: false }, textEl, FIXED_DATE);
  assert.equal(textEl.textContent, "14:06");
});

test("renderText: with no digitCellWidth, falls back to a plain textContent assignment", () => {
  const textEl = makeFakeTextEl();
  const doc = makeFakeDoc();
  renderText(textEl, doc, "14:06", null);
  assert.equal(textEl.textContent, "14:06");
  assert.equal(textEl.childNodes.length, 0);
});

test("renderText: with a digitCellWidth, wraps each digit in its own fixed-width centered span", () => {
  const textEl = makeFakeTextEl();
  const doc = makeFakeDoc();
  renderText(textEl, doc, "1:2", 20);

  const nodes = textEl.childNodes;
  assert.equal(nodes.length, 3);

  assert.equal(nodes[0].tagName, "span");
  assert.equal(nodes[0].textContent, "1");
  assert.equal(nodes[0].style.width, "20px");
  assert.equal(nodes[0].style.display, "inline-block");
  assert.equal(nodes[0].style.textAlign, "center");

  assert.equal(nodes[1].nodeType, 3);
  assert.equal(nodes[1].textContent, ":");

  assert.equal(nodes[2].tagName, "span");
  assert.equal(nodes[2].textContent, "2");
  assert.equal(nodes[2].style.width, "20px");
});

test("renderText: leaves non-digit characters (letters, spaces) as plain text even with a digitCellWidth", () => {
  const textEl = makeFakeTextEl();
  const doc = makeFakeDoc();
  renderText(textEl, doc, "9 AM", 20);

  const nodes = textEl.childNodes;
  assert.equal(nodes.length, 4);
  assert.equal(nodes[0].tagName, "span");
  assert.equal(nodes[0].textContent, "9");
  assert.equal(nodes[1].nodeType, 3);
  assert.equal(nodes[1].textContent, " ");
  assert.equal(nodes[2].nodeType, 3);
  assert.equal(nodes[2].textContent, "A");
  assert.equal(nodes[3].nodeType, 3);
  assert.equal(nodes[3].textContent, "M");
});

test("renderText: clears previous children instead of accumulating on repeated calls", () => {
  const textEl = makeFakeTextEl();
  const doc = makeFakeDoc();
  renderText(textEl, doc, "11:11:11", 20);
  assert.equal(textEl.childNodes.length, 8);
  renderText(textEl, doc, "22:22:22", 20);
  assert.equal(textEl.childNodes.length, 8);
  assert.equal(textEl.childNodes[0].textContent, "2");
});

test("computeFitFontSize: scales up to fill a container wider and taller than the text", () => {
  // text measured at 100px is 200x50; container is 800x100 -> width-limited scale is 4x, height-limited is 2x
  const result = computeFitFontSize(800, 100, 200, 50, 100, 1);
  assert.equal(result, 200); // min(4, 2) * 100
});

test("computeFitFontSize: shrinks when the container is smaller than the text", () => {
  // container 100x100, text 200x50 at 100px -> width-limited scale 0.5, height-limited scale 2
  const result = computeFitFontSize(100, 100, 200, 50, 100, 1);
  assert.equal(result, 50); // min(0.5, 2) * 100
});

test("computeFitFontSize: applies the fill ratio as a margin", () => {
  const result = computeFitFontSize(800, 100, 200, 50, 100, 0.9);
  assert.equal(result, 180); // 200 * 0.9
});

test("computeFitFontSize: falls back to baseFontSize for a zero-sized container or text", () => {
  assert.equal(computeFitFontSize(0, 100, 200, 50, 100, 1), 100);
  assert.equal(computeFitFontSize(800, 0, 200, 50, 100, 1), 100);
  assert.equal(computeFitFontSize(800, 100, 0, 50, 100, 1), 100);
  assert.equal(computeFitFontSize(800, 100, 200, 0, 100, 1), 100);
});

test("resolveTextScale: converts a 10-100 percentage into a 0-1 fraction", () => {
  assert.equal(resolveTextScale(100), 1);
  assert.equal(resolveTextScale(50), 0.5);
  assert.equal(resolveTextScale(10), 0.1);
});

test("resolveTextScale: defaults to 1 (no scaling) for missing or invalid values", () => {
  assert.equal(resolveTextScale(undefined), 1);
  assert.equal(resolveTextScale(null), 1);
  assert.equal(resolveTextScale(0), 1);
  assert.equal(resolveTextScale(-20), 1);
  assert.equal(resolveTextScale(NaN), 1);
  assert.equal(resolveTextScale("50"), 1);
});

test("resolveTextScale: clamps values above 100 down to 1 (never enlarges past the auto-fit size)", () => {
  assert.equal(resolveTextScale(150), 1);
});
