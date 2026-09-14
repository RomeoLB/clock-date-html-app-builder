# Clock Configurator

A browser-based tool for building a self-contained clock/date widget for
BrightSign digital signage. Configure everything visually - layout, colors,
font, background - watch a live preview update as you go, and download a
ready-to-deploy zip when you're done.

**➡️ [Open the configurator](https://romeolb.github.io/clock-date-html-app-builder/)**

## Features

- Live preview that matches your actual presentation zone's aspect ratio
- Time or date mode, with locale-aware formatting (12/24-hour, weekday,
  date order) for a curated list of languages, or any custom BCP-47 code
- Upload a custom font or background image, or link straight to Google
  Fonts to find one
- Auto-sized text that fills the configured safe area without overflowing
- Re-import a previously generated file to keep editing it later
- Runs entirely in the browser - no server, no build step, no install

## Documentation

- [Using the Configurator](docs/using-the-configurator.md) - a full guide
  to every section of the tool
- [Choosing a Font](docs/choosing-a-font.md) - which fonts work well for a
  clock display, and which to avoid

## Development

This is a static site: `index.html`, `app.js`, and a handful of plain JS
modules, no build step. To run it locally, serve the folder over
`http://`/`https://` (opening `index.html` directly via `file://` works for
editing/previewing, but not for the Generate & Download step) and open
`index.html`.

Run the test suite with:

```bash
node --test
```
