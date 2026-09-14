# Choosing a font for the clock

When the clock ticks, the digits in the time (or day-of-month, in date mode)
change every second. Most fonts render every digit `0`-`9` at the **same
width** ("tabular" or "monospaced" figures), so the overall text stays put as
it counts. Some fonts don't - their digits are proportionally spaced, so a
narrow character like `1` and a wide one like `0` occupy different amounts of
space. Because the clock text is centered, this makes the whole clock visibly
shift left/right as the seconds change.

This was confirmed directly: **Zen Dots** (`zen-dots-v14-latin-regular.woff2`)
renders digit `1` at ~27px and digit `0` at ~62px at the same font-size - more
than double - which is why it visibly wobbles.

There is currently no automatic fix for this in the configurator, so the
reliable way to avoid it is to pick a font that doesn't have the problem
in the first place.

## How to pick a safe font

**Best: a true monospace font.** Every character - not just digits - is the
same width by definition, so this can't happen. Good options: Roboto Mono,
JetBrains Mono, IBM Plex Mono, Space Mono, Courier.

**Also safe: a professional UI/text sans-serif.** Fonts built for real
interfaces (prices, timers, tables) are almost always designed with tabular
digits. Reliable picks: Roboto, Inter, IBM Plex Sans, Source Sans 3, Work
Sans, Noto Sans, Open Sans, DM Sans.

**Avoid: Display and Handwriting fonts.** On Google Fonts, categories are
Serif / Sans-serif / Display / Handwriting / Monospace. Display and
Handwriting fonts are built for short decorative headlines, not functional
number display, and very often skip tabular-figure support entirely. Zen
Dots is a Display font.

## How to check a specific font before committing to it

Compare the rendered width of `1` and `0` at the same font-size. If they're
identical, the font has tabular digits and is safe to use. If they differ
(sometimes substantially), expect the wobble described above.

The [Google Webfonts Helper](https://gwfh.mranftl.com/fonts) link in the
configurator's Font section is a good place to find and download font files
in the safe categories above.

## Fonts that look good at large scale

This is a separate concern from the digit-wobble issue above - that one is
about width *stability*, this one is about visual *quality* at large sizes.
The clock auto-scales to fill whatever safe-region box is configured, which
is often quite large on a sign viewed from a distance.

**Technical note first:** all font formats this tool accepts (`.woff`,
`.woff2`, `.ttf`, `.otf`) are vector outline fonts, so they scale up without
pixelation or blurring - that part is never a problem. What varies is
whether the *letterform design* still looks good and reads well once it's
blown up large.

**What scales/reads well:**
- **Geometric or grotesque sans-serifs** (Helvetica-style, Roboto, Inter,
  DIN, Futura-style) - clean, simple shapes that hold up at both small and
  huge sizes, and read at a glance from a distance.
- **Medium-to-bold weights** - solid strokes stay clearly visible when
  scaled up large on a display.

**What tends to scale/read poorly for a large-format digital clock:**
- **Hairline/thin/light weights** - look elegant in print or small UI text,
  but the thin strokes can look weak, washed-out, or nearly disappear once
  scaled up huge on a bright or distant display.
- **High-contrast serif fonts** (thin hairlines + thick stems, e.g.
  Bodoni/Didone-style) - the thin parts become inconsistent or hard to see
  at large sizes and at typical signage viewing distances, even though the
  shapes are technically crisp.
- **A "Text"/"Caption" optical-size cut used at a huge display size** - some
  type families ship different cuts optimized for small vs. large sizes
  (tighter spacing, thinner strokes for "Display" cuts meant to be big; more
  open, heavier strokes for "Text" cuts meant to be small). Using a
  small-size-optimized cut blown up large can look chunky or imprecise. If a
  family offers a "Display" or "Headline" variant, that's the one to pick
  for a clock.

In short: for a legibility-first display like this, a **medium/bold-weight
geometric sans-serif** is the safest bet on both counts - it scales well
visually, and typically has tabular digits too.
