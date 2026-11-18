# AM/PM Superscript and Leading-Zero Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two 12-hour clock options: drop the hour's leading zero ("9:30"), and show AM/PM as a small raised superscript with Small/Medium/Large size and Top/Middle height.

**Architecture:** All formatting/rendering lives in `clock-runtime.js`, which both the configurator preview (`preview-shell.html`) and the generated package load, so the preview and the player stay identical. AM/PM is split out with `Intl.DateTimeFormat#formatToParts` and rendered as a `<span>` styled inline (em units). Auto-fit sizing measures two-digit-hour samples (10 AM and 10 PM) so the text never overflows later in the day.

**Tech Stack:** Plain browser JS (no build step, must run on older Chromium in BrightSign players — avoid `replaceChildren`, CSS `cap` units, and other recent APIs), `node --test` for tests.

**Spec:** `docs/superpowers/specs/2026-11-18-ampm-superscript-design.md`

## Global Constraints

- New config fields and defaults: `hourLeadingZero: true`; `dayPeriodStyle: { superscript: false, size: "medium", position: "top" }`.
- Defaults must leave existing packages/imports looking exactly as before.
- Leading-zero removal applies only when the resolved clock is 12-hour (`hourCycle` `h11`/`h12`), including "Locale default" languages that are 12-hour. 24-hour clocks always keep `"2-digit"`.
- Size presets: small `0.35em`, medium `0.45em`, large `0.55em` (of the main text).
- Never use `innerHTML` for clock text; build with `textContent` / text nodes.
- Each git command run for the user gets a one-line plain-English explanation (user is learning git).

## Review Focus

1. **Languages with AM/PM first (ja, ko)** — superscript must raise the AM/PM piece wherever it sits, with no stray space. Test in Task 2.
2. **24-hour locale with the option on (en-GB, "Locale default")** — must still show "09:05", not "9:05" (Intl's `hour: "numeric"` gives "9:05" for en-GB). Test in Task 1.
3. **Clock started at 9:xx with no leading zero** — must not overflow at 10:00. Test in Task 3.
4. **Languages whose AM and PM words differ in width** — sizing uses the wider of the two. Test in Task 3.
5. **Older imported file without the new fields, or with a partial `dayPeriodStyle`** — falls back to defaults, looks unchanged. Tests in Tasks 1–2.

---

### Task 1: Remove-leading-zero option in the runtime

**Files:**
- Modify: `clock-runtime.js` (`buildIntlOptions`, ~line 14; exports ~line 430)
- Modify: `config-codec.js` (`DEFAULT_CONFIG`, `SCHEMA_DOC_COMMENT`)
- Test: `tests/clock-runtime.test.js`

**Interfaces:**
- Produces: `usesTwelveHourClock(config) -> boolean` (exported). `buildIntlOptions(config)` returns `hour: "numeric"` when `config.hourLeadingZero === false` and `usesTwelveHourClock(config)`; otherwise `"2-digit"` as today.

- [ ] **Step 1: Write the failing tests**

```js
test("usesTwelveHourClock: honours forced hour12 and the language default", () => {
  assert.equal(usesTwelveHourClock({ language: "en-GB", hour12: true }), true);
  assert.equal(usesTwelveHourClock({ language: "en-US", hour12: false }), false);
  assert.equal(usesTwelveHourClock({ language: "en-US", hour12: null }), true);
  assert.equal(usesTwelveHourClock({ language: "en-GB", hour12: null }), false);
});

test("formatClockString: hourLeadingZero false drops the zero on a 12-hour clock", () => {
  const morning = new Date(2026, 8, 12, 9, 5, 0);
  const result = formatClockString(
    { mode: "time", language: "en", hour12: true, showSeconds: false, hourLeadingZero: false }, morning);
  assert.match(result, /^9:05\s*AM$/);
});

test("formatClockString: hourLeadingZero false keeps the zero on a 24-hour clock", () => {
  const morning = new Date(2026, 8, 12, 9, 5, 0);
  assert.equal(formatClockString(
    { mode: "time", language: "en-GB", hour12: null, showSeconds: false, hourLeadingZero: false }, morning), "09:05");
  assert.equal(formatClockString(
    { mode: "time", language: "en", hour12: false, showSeconds: false, hourLeadingZero: false }, morning), "09:05");
});

test("formatClockString: hourLeadingZero missing keeps today's 2-digit hour", () => {
  const morning = new Date(2026, 8, 12, 9, 5, 0);
  assert.match(formatClockString({ mode: "time", language: "en", hour12: true, showSeconds: false }, morning), /^09:05\s*AM$/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `usesTwelveHourClock is not a function`, and "9:05" assertion fails.

- [ ] **Step 3: Implement**

`usesTwelveHourClock(config)`: build `new Intl.DateTimeFormat(config.language, { hour: "numeric", hour12 })` (pass `hour12` only when not null) and return whether `resolvedOptions().hourCycle` is `"h11"` or `"h12"`. In `buildIntlOptions` time branch, set `options.hour` to `"numeric"` under the condition in Interfaces. Add `hourLeadingZero: true` to `DEFAULT_CONFIG` and a schema-comment line: `hourLeadingZero: false = drop the hour's leading zero ("9:30") on 12-hour clocks; 24-hour clocks always keep it.`

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: all pass (existing `buildIntlOptions` deepEqual tests still pass because they don't set `hourLeadingZero`).

- [ ] **Step 5: Commit**

```bash
git add clock-runtime.js config-codec.js tests/clock-runtime.test.js
git commit -m "Add option to drop the hour's leading zero on 12-hour clocks"
```

---

### Task 2: AM/PM superscript rendering

**Files:**
- Modify: `clock-runtime.js` (new functions near `formatClockString`; `render` ~line 204; exports)
- Modify: `config-codec.js` (`DEFAULT_CONFIG`, `SCHEMA_DOC_COMMENT`)
- Test: `tests/clock-runtime.test.js`

**Interfaces:**
- Consumes: `buildIntlOptions(config)` from Task 1.
- Produces (all exported):
  - `normalizeDayPeriodStyle(config) -> { superscript: boolean, size: "small"|"medium"|"large", position: "top"|"middle" }` — fills missing/invalid fields with defaults.
  - `formatClockSegments(config, now) -> Array<{ text: string, dayPeriod: boolean }>` — time mode only; non-dayPeriod parts are joined into runs; whitespace-only literals directly before/after the dayPeriod are dropped.
  - `dayPeriodCss(dayPeriodStyle) -> { fontSize: string, verticalAlign: string }`.
  - `render(config, textEl, now)` — unchanged signature; uses spans when superscript applies.

- [ ] **Step 1: Write the failing tests**

```js
function fakeTextEl() {
  const el = { style: {}, childNodes: [] };
  el.ownerDocument = {
    createElement: (tag) => ({ tagName: tag.toUpperCase(), style: {}, textContent: "" }),
    createTextNode: (text) => ({ textContent: text })
  };
  el.appendChild = (n) => el.childNodes.push(n);
  Object.defineProperty(el, "textContent", {
    get: () => el.childNodes.map((n) => n.textContent).join(""),
    set: (v) => { el.childNodes = v ? [{ textContent: v }] : []; }
  });
  return el;
}

test("normalizeDayPeriodStyle: defaults for missing or partial settings", () => {
  assert.deepEqual(normalizeDayPeriodStyle({}), { superscript: false, size: "medium", position: "top" });
  assert.deepEqual(normalizeDayPeriodStyle({ dayPeriodStyle: { superscript: true, size: "huge" } }),
    { superscript: true, size: "medium", position: "top" });
});

test("formatClockSegments: en splits off PM and drops the space before it", () => {
  assert.deepEqual(
    formatClockSegments({ mode: "time", language: "en", hour12: true, showSeconds: false, hourLeadingZero: false }, FIXED_DATE),
    [{ text: "2:06", dayPeriod: false }, { text: "PM", dayPeriod: true }]);
});

test("formatClockSegments: ko puts AM/PM first and drops the space after it", () => {
  assert.deepEqual(
    formatClockSegments({ mode: "time", language: "ko", hour12: true, showSeconds: false, hourLeadingZero: false }, FIXED_DATE),
    [{ text: "오후", dayPeriod: true }, { text: "2:06", dayPeriod: false }]);
});

test("dayPeriodCss: size presets and a higher raise for top than middle", () => {
  assert.equal(dayPeriodCss({ size: "small", position: "top" }).fontSize, "0.35em");
  assert.equal(dayPeriodCss({ size: "medium", position: "top" }).fontSize, "0.45em");
  assert.equal(dayPeriodCss({ size: "large", position: "top" }).fontSize, "0.55em");
  const top = parseFloat(dayPeriodCss({ size: "medium", position: "top" }).verticalAlign);
  const middle = parseFloat(dayPeriodCss({ size: "medium", position: "middle" }).verticalAlign);
  assert.ok(top > middle && middle > 0);
});

test("render: superscript wraps AM/PM in a styled span", () => {
  const textEl = fakeTextEl();
  render({ mode: "time", language: "en", hour12: true, showSeconds: false,
    dayPeriodStyle: { superscript: true, size: "small", position: "top" } }, textEl, FIXED_DATE);
  assert.equal(textEl.childNodes.length, 2);
  assert.equal(textEl.childNodes[0].textContent, "02:06");
  assert.equal(textEl.childNodes[1].tagName, "SPAN");
  assert.equal(textEl.childNodes[1].textContent, "PM");
  assert.equal(textEl.childNodes[1].style.fontSize, "0.35em");
});

test("render: superscript on a 24-hour clock is plain text", () => {
  const textEl = fakeTextEl();
  render({ mode: "time", language: "en", hour12: false, showSeconds: false,
    dayPeriodStyle: { superscript: true } }, textEl, FIXED_DATE);
  assert.equal(textEl.textContent, "14:06");
  assert.equal(textEl.childNodes.length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — new functions not defined.

- [ ] **Step 3: Implement**

`formatClockSegments` applies the same fixed-offset shift as `formatClockString` (factor the shift into a small shared helper rather than duplicating it). `dayPeriodCss`: `verticalAlign` is a positive em length on the span's own font size. With `CAP_HEIGHT = 0.7` (typical digit height as a fraction of em) and span size `s`, top raises by `CAP_HEIGHT * (1 - s) / s` em and middle by half that — rounded to 3 decimals. A small gap on the side facing the digits (e.g. `0.15em` margin) is the builder's call to tune in the preview. `render`: if mode is time, `normalizeDayPeriodStyle(config).superscript`, and the segments contain a dayPeriod, set `textEl.textContent = ""` then append a text node per plain segment and a `span` (with `dayPeriodCss` applied to `span.style`) for the dayPeriod; otherwise keep `textEl.textContent = formatClockString(config, now)`. Add `dayPeriodStyle` to `DEFAULT_CONFIG` and a schema-comment line: `dayPeriodStyle: 12-hour only. superscript: true = small raised AM/PM; size: "small"|"medium"|"large"; position: "top"|"middle".`

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: all pass, including the existing "render writes the formatted string" test.

- [ ] **Step 5: Commit**

```bash
git add clock-runtime.js config-codec.js tests/clock-runtime.test.js
git commit -m "Render AM/PM as a sized, raised superscript when enabled"
```

---

### Task 3: Size the clock for its widest time of day

**Files:**
- Modify: `clock-runtime.js` (`fitTextToContainer` ~line 233, `bootClock` `refit` ~line 390; exports)
- Test: `tests/clock-runtime.test.js`

**Interfaces:**
- Consumes: `render(config, textEl, now)` from Task 2.
- Produces: `fitTextToContainer(container, textEl, textScalePercent)` now also **returns** the font size (px number) it set. New exported `fitClockToContainer(container, textEl, config, now)`: in time mode renders two samples — `new Date(2000, 0, 1, 10, 0, 0)` and `new Date(2000, 0, 1, 22, 0, 0)`, formatted with `timeZone` removed so they show 10:00 AM / 10:00 PM — fits each, applies the smaller size, then renders `now` with the real config. Date mode: fit the current text as today. `bootClock`'s `refit` calls it with `displayConfig`.

- [ ] **Step 1: Write the failing tests**

Fake container/text elements whose `getBoundingClientRect()` reports a width proportional to the text length at the 100px base size (e.g. `width = textContent.length * 50`, `height = 100`), container `1000 x 300`.

```js
test("fitClockToContainer: sizes for a two-digit hour even when started at 9 o'clock", () => {
  const { container, textEl } = fakeFitElements();
  const config = { mode: "time", language: "en", hour12: true, showSeconds: false, hourLeadingZero: false, textScale: 100 };
  fitClockToContainer(container, textEl, config, new Date(2026, 8, 12, 9, 5, 0));
  const nine = parseFloat(textEl.style.fontSize);
  fitClockToContainer(container, textEl, config, new Date(2026, 8, 12, 10, 5, 0));
  assert.equal(parseFloat(textEl.style.fontSize), nine);
  assert.match(textEl.textContent, /^10:05/); // shows the real time afterwards
});

test("fitClockToContainer: uses the wider of the AM and PM samples", () => {
  // fake measures "PM" wider than "AM"; result must equal the size fitted to the PM sample
});
```

(The second test: make the fake's width add extra for text containing "PM", and assert the font size equals what `computeFitFontSize` gives for the PM sample's width.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `fitClockToContainer is not a function`.

- [ ] **Step 3: Implement** as described in Interfaces; update the comment above `refit` in `bootClock` to explain the two-sample sizing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add clock-runtime.js tests/clock-runtime.test.js
git commit -m "Size the clock for a two-digit hour and the wider of AM/PM"
```

---

### Task 4: Configurator controls and user guide

**Files:**
- Modify: `index.html` (inside `#time-only-fields`, after "Show seconds", ~line 113)
- Modify: `app.js` (`readFormConfig` ~line 20, `applyConfigToForm` ~line 136, visibility updates in `initForm` listeners ~line 522)
- Modify: `docs/using-the-configurator.md` (Mode & Time/Date section, after "Show seconds")

**Interfaces:**
- Consumes: `normalizeDayPeriodStyle(config)` from Task 2 (global in the page via `clock-runtime.js`).
- Produces: form fields `removeLeadingZero` (checkbox), `dayPeriodSuperscript` (checkbox), `dayPeriodSize` (select: small/medium/large), `dayPeriodPosition` (select: top/middle), wrapped so that:
  - `#twelve-hour-fields` (all four) is hidden when `hour12` is `"false"`;
  - `#day-period-options` (size + height) is hidden unless `dayPeriodSuperscript` is checked.

- [ ] **Step 1: Add the controls** — labels exactly:
  - "Remove leading zero (9:30 instead of 09:30)"
  - "Show AM/PM as superscript"
  - "AM/PM size" — options "Small", "Medium", "Large"
  - "AM/PM height" — options "Top", "Middle"

  Add a short hint under the block: "12-hour clocks only."

- [ ] **Step 2: Wire `app.js`** — `readFormConfig` adds `hourLeadingZero: !form.removeLeadingZero.checked` and `dayPeriodStyle: { superscript, size, position }`; `applyConfigToForm` sets the fields from `config.hourLeadingZero !== false` and `normalizeDayPeriodStyle(config)`; add `updateTwelveHourVisibility()` called from `applyConfigToForm` and both form listeners.

- [ ] **Step 3: Update the user guide** — add bullets for the two options under "Show seconds", noting they apply to 12-hour clocks only and that 24-hour clocks keep the leading zero.

- [ ] **Step 4: Verify** — `node --test` passes. Serve the folder (`python3 -m http.server`), open `index.html`, and check in the preview: en 12-hour with both options shows "9:30"-style time with a small raised AM/PM; changing size/height updates live; size/height hide when superscript is unticked; the block hides for 24-hour; ja/ko show the raised AM/PM before the time; Generate & Download then Import restores all four settings; importing a file made before this change shows defaults (zero kept, no superscript).

- [ ] **Step 5: Commit**

```bash
git add index.html app.js docs/using-the-configurator.md
git commit -m "Add leading-zero and AM/PM superscript controls to the configurator"
```
