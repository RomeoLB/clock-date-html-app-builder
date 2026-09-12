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
