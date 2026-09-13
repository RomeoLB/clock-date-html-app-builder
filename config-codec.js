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
  return JSON.stringify(config, null, 2).replace(/</g, "\\u003C");
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
    "    font-variant-numeric: tabular-nums;\n" +
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
