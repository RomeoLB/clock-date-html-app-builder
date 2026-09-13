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

There is currently no automatic fix for this in the configurator (an
automatic fixed-width-per-digit approach was tried and reverted - see
below), so the reliable way to avoid it is to pick a font that doesn't have
the problem in the first place.

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

## Why this isn't just fixed automatically

A fix was implemented that measured the widest digit once and rendered every
digit in its own fixed-width cell, eliminating the wobble regardless of the
font. It worked in every desktop-browser test, but broke sizing badly on an
actual BrightSign player and was reverted (see the project's commit history
around "Eliminate horizontal text wobble" / its revert). The suspected cause
is a timing difference in how the BrightSign HTML widget's layout engine
reports element sizes compared to a desktop browser, but this couldn't be
confirmed without further on-device testing. Until that's resolved safely,
font choice is the dependable way to avoid the wobble.
