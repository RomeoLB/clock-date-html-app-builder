# AM/PM Superscript and Leading-Zero Options — Design

## Intent

Let users style 12-hour clocks the way many signage designs do: "9:30" with a
small, raised AM/PM beside it (e.g. "11:35 ᴬᴹ"), instead of "09:30 AM" with
AM/PM at full size on the baseline.

## Goals

- **Remove leading zero** option: 12-hour clocks show "9:30" instead of "09:30".
  Off by default, so existing packages look unchanged.
- **AM/PM superscript** option, with two simple controls:
  - Size: Small / Medium / Large
  - Height: Top (aligned with the top of the digits, as in the reference image) / Middle
- Both options update the live preview immediately, are saved in the generated
  package, and are restored when a package is re-imported.

## Non-goals

- 24-hour clocks keep their leading zero; the option has no effect there.
- No free-form sliders for AM/PM size/position; presets only.
- No change to date mode.

## Anti-goals

- Text must never overflow the safe text region, at any time of day.
- Existing packages and imported files without these settings must look exactly as before.

## Approaches considered

- **A. Split AM/PM out and style it separately (chosen).** Format with
  `Intl.DateTimeFormat#formatToParts`, wrap the `dayPeriod` part in its own
  `<span>` sized/raised relative to the main text in `em`. The existing auto-fit
  measures the whole `#clock-text` element, so it includes the span with no
  extra work. Works for languages that put AM/PM first (ja, ko).
- B. Browser default `<sup>`: least code, but size/position are fixed and vary
  by font — doesn't meet the "adjustable" requirement.
- C. AM/PM as a separately positioned element: most freedom, but the fit logic
  would have to handle two boxes; highest risk of overlap/clipping.

## Design

**Config** (new fields, defaults in `DEFAULT_CONFIG` and documented in the schema comment):

```
hourLeadingZero: true            // false = "9:30" (12-hour only)
dayPeriodStyle: {
  superscript: false,
  size: "medium",                // "small" | "medium" | "large"
  position: "top"                // "top" | "middle"
}
```

Missing fields (older packages/imports) fall back to these defaults.

**Formatting** (`clock-runtime.js`):
- When `hourLeadingZero` is false, use `hour: "numeric"` — but only if the
  resolved clock is 12-hour (`resolvedOptions().hourCycle` is `h11`/`h12`).
  This covers "Locale default" languages that are 12-hour (e.g. en-US).
  24-hour clocks keep `"2-digit"`.
- When `superscript` is on and the output has a `dayPeriod` part, render via
  DOM: text nodes for the other parts, a `<span class="day-period">` for AM/PM.
  Use `textContent` for every piece (no `innerHTML`). The whitespace part
  between time and AM/PM is dropped so it sits snugly, as in the reference.
- Otherwise render as today (`textEl.textContent = …`).

**Styling** of the span (relative to the main text size):
- Size: Small 0.35em / Medium 0.45em / Large 0.55em.
- Top: aligned with the top of the digits (`vertical-align: top` or an equivalent
  offset that holds across fonts); Middle: centered on the digits.
- Exact values are the builder's call, tuned visually in the preview.

**Sizing:** fitting happens once at startup (and after font load / zone read),
not every tick. Without a leading zero, the hour width changes at 10:00, so the
fit must measure a two-digit hour (e.g. render a sample like "10:00" with the
current settings, fit, then render the real time) so the text never overflows.

**Configurator UI** (`index.html`, `app.js`), inside the time-only fields:

```
☐ Remove leading zero (9:30 instead of 09:30)
☑ Show AM/PM as superscript
    AM/PM size     [ Medium ▾ ]   Small / Medium / Large
    AM/PM height   [ Top ▾ ]      Top / Middle
```

Size/height selects are shown only when superscript is ticked. All controls
feed the live preview like the existing settings.

**Docs:** add the new options to `docs/using-the-configurator.md`.

**Tests:** unit tests for formatting (leading zero on/off in 12h, untouched in
24h, ja/ko AM/PM-first ordering), config defaults/back-compat in the codec, and
the two-digit sizing sample.

## Left to the builder

Exact em sizes and vertical offsets, the CSS technique for "Top" alignment,
and how the two-digit sample string is produced.
