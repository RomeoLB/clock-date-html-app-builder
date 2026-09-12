# Clock Configurator — Design Spec

Date: 2026-09-12

## Purpose

Today, the BrightSign clock widget (`clock.html`, from the
`Bacon-date-time-clock` project) is configured by hand-editing a `clockConfig`
JS object literal inside the file. This project builds a standalone,
browser-based configurator: a form-driven UI that lets a non-technical user
pick every clock parameter, preview the result live, and export a ready-to-
upload BrightSign zip package — without touching code.

The configurator is a separate, self-contained static site (its own repo),
intended to be hosted on GitHub Pages. It does not change the runtime
behavior of the clock widget itself, only how its config is produced.

## Scope

In scope:
- A single-page form covering the full `clockConfig` schema (mode, rotation,
  language, colors, font, background image, safe-text-region, hour12,
  showSeconds, showWeekday, dateOrder)
- Live preview that re-renders as the user changes settings
- Uploading a custom font file and/or background image, bundled into the
  output
- Generating a downloadable `.zip`, named by the user, containing
  `clock.html`, the shared runtime script, and any uploaded assets
- Re-importing a previously generated `.zip` or standalone `.html` file to
  resume editing
- A git repo for this project, ready to push to GitHub and serve via GitHub
  Pages

Out of scope (v1):
- Draggable/visual editing of the safe-text-region (numeric inputs only)
- Any server-side component — the whole thing is static, client-side JS
- Actually creating the GitHub repo / pushing / enabling Pages (stops at a
  local git repo with a first commit)
- Bringing over the unrelated files from the original project folder
  (BrightScript autoruns, docs, the old `to-be-uploaded-clock/` folder) — this
  is a clean, new repo containing only the clock widget and the configurator

## Architecture

Three static files (plus the vendored library), all served together:

- **`index.html`** — the configurator page. A form grouped into sections
  (Mode & Time/Date, Colors, Font, Background, Layout / Safe Text Region),
  an output zip filename field, a live preview pane, an "Import existing
  config" file input, and a "Generate & Download" button.
- **`clock-runtime.js`** — the rendering logic extracted verbatim from the
  current `clock.html`'s inline `<script>` (`buildIntlOptions`,
  `reorderDateParts`, `formatClockString`, `applyRotation`,
  `applyBackgroundImage`, `applySafeTextRegion`, `applyColors`, `applyFont`,
  `render`, and the `setInterval` tick). This file is loaded by **both** the
  live preview and the generated output `clock.html`, so there is exactly one
  implementation of "how a clockConfig renders" — preview and final output
  can never drift apart.
- **`vendor/fflate.min.js`** — a vendored copy of the fflate library, used for
  both zipping (on export) and unzipping (on import). Committed into the
  repo so the page has no runtime dependency on a third-party CDN.

## Config format

`clockConfig` is generated as **strict JSON** (quoted keys, no inline
comments, no trailing commas) rather than the hand-commented JS object
literal used today. This lets import parse it back with `JSON.parse` —
never `eval`/`Function`, even though the source is the user's own prior
export, as a matter of not normalizing unsafe parsing habits.

Per-field documentation moves from inline comments (tied to specific values)
to a single static doc-comment block above the object in the generated file,
explaining the schema once, generically. Field names and semantics are
unchanged from the current schema.

## Data flow

**Editing / preview:**
1. Form inputs write into an in-memory `clockConfig` object.
2. Uploaded font/background files are held as `File` objects; the live
   preview references them via `URL.createObjectURL()`.
3. The preview pane (an iframe loading a minimal HTML shell that includes
   `clock-runtime.js`) receives the current config and object URLs, and
   re-renders on every form change.

**Export:**
1. On "Generate & Download", build the output `clock.html` text: same
   structure as today's file, `clockConfig` inlined as strict JSON, a
   `<script src="clock-runtime.js">` tag instead of inline logic.
2. Uploaded assets are renamed to fixed relative filenames (e.g.
   `font.woff2`, `background.jpg`); `fontUrl`/`backgroundImageUrl` in the
   generated config point to those filenames.
3. `fflate.zipSync` packages `clock.html` + `clock-runtime.js` + any asset
   files into a single `.zip`, downloaded via a Blob/anchor using the
   filename from the output filename field (defaulting to e.g. `clock.zip`
   if left blank; a `.zip` extension is appended if the user didn't include
   one). The contained `clock.html` itself is always named `clock.html`
   regardless of the zip's name, since that's the filename BrightSign
   expects inside the package.

**Import (either a previously generated `.zip` or a standalone `.html`):**
1. File input accepts `.zip` or `.html`.
2. If `.zip`: `fflate.unzipSync` extracts all contained files in-memory.
   `clock.html`'s text is decoded and its `clockConfig` block is located and
   `JSON.parse`d to populate every form field. Because `clockConfig` contains
   a nested object (`safeTextRegion`), extraction cannot be a naive
   lazy-regex match on `\{[\s\S]*?\}` — that would stop at
   `safeTextRegion`'s own closing brace. Instead, find the index of the
   `const clockConfig = ` marker and scan forward tracking brace depth to
   locate the matching closing `}` for the outer object. For
   `fontUrl`/`backgroundImageUrl`, if that filename is present among the
   zip's other files, its bytes are decoded back into a `File`, populating
   the corresponding file input (full round-trip, including live preview and
   re-export).
3. If `.html`: the file is read directly as text; the same brace-depth
   extraction/parse populates all non-file fields.
   `fontUrl`/`backgroundImageUrl`, if set, are shown as read-only filename
   text (no asset bytes available) — the user re-uploads those manually if
   they want to change other settings while keeping them.
4. If a config value references a filename not found among the available
   files (zip case) or at all (html-only case), it's shown as inert text and
   the corresponding file input is left empty — never a crash.
5. Any malformed/unrecognized input (not a zip or html, no `clockConfig`
   block found, unparsable JSON) shows an inline error message and leaves
   the current form state untouched.

## Error handling / validation

Entirely client-side, no server to defend:
- `safeTextRegion.x/y/width/height` are bounded 0–100 via numeric input
  constraints.
- Colors use `<input type="color">`, guaranteeing valid CSS color values.
- Mode-specific fields (`showSeconds` for `mode:"time"`;
  `showWeekday`/`dateOrder` for `mode:"date"`) are disabled/hidden based on
  the current `mode` selection.
- Import failures (see above) are surfaced as an inline message; they never
  throw uncaught or corrupt the in-progress form.

## Testing

Manual, exploratory — this is a static, form-driven UI with no business
logic beyond string templating and zip packaging:
1. Walk every field, confirm the live preview matches expectations for each
   (12/24hr, seconds toggle, weekday toggle, dateOrder reordering, `en`/
   `fr`/`ja` locales, rotation, colors, uploaded font, uploaded background,
   safe-text-region bounds).
2. Generate a zip, unzip it manually, and open the resulting `clock.html`
   standalone in a browser — confirm it renders identically to the preview.
3. Re-import that same zip and confirm every field (including the uploaded
   font/background) restores correctly.
4. Re-import a standalone `clock.html` (no zip) and confirm non-file fields
   restore, with font/background shown as inert filenames.
5. Feed a bogus/unrelated file into import and confirm a clean inline error,
   not a crash.

## Repo setup

- New directory: `clock-configurator/` (sibling to `Bacon-date-time-clock/`
  under `HTML_JS/`), containing only this project's files.
- `git init` + `.gitignore` (`.DS_Store`, etc.) + first commit, done locally.
- Creating the GitHub repo, pushing, and enabling GitHub Pages are left to
  the user — not performed as part of this work.
