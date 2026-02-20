const NODE_TYPE_ORDER = [
  "start",
  "process",
  "decision",
  "data",
  "subprocess",
  "end",
  "actor",
  "document"
];

export const NODE_TYPE_LABELS = {
  start: "Start",
  process: "Process",
  decision: "Decision",
  data: "Data",
  subprocess: "Subprocess",
  end: "End",
  actor: "Actor",
  document: "Document"
};

export const DEFAULT_PALETTE = {
  name: "Clean Blueprint",
  canvas: "#eef3ff",
  panel: "#ffffff",
  text: "#1e2b43",
  mutedText: "#5d6e90",
  edge: "#48658f",
  accent: "#0f8b8d",
  nodeColors: {
    start: "#2a9d8f",
    process: "#4f7cff",
    decision: "#f4a261",
    data: "#e76f51",
    subprocess: "#9b7de6",
    end: "#e63973",
    actor: "#22b8b0",
    document: "#e9c46a"
  }
};

const HEX_COLOR_REGEX = /^#([0-9a-f]{6})$/i;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(hex, fallback) {
  if (typeof hex !== "string") {
    return fallback;
  }
  const normalized = hex.trim();
  return HEX_COLOR_REGEX.test(normalized) ? normalized.toLowerCase() : fallback;
}

function hexToRgb(hex) {
  const safe = normalizeHex(hex, "#000000").slice(1);
  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixColors(colorA, colorB, weight = 0.5) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const safeWeight = clamp(weight, 0, 1);

  return rgbToHex({
    r: a.r + (b.r - a.r) * safeWeight,
    g: a.g + (b.g - a.g) * safeWeight,
    b: a.b + (b.b - a.b) * safeWeight
  });
}

function toRgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  const safeAlpha = clamp(alpha, 0, 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
}

function getContrastText(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "#1b2434" : "#f4f8ff";
}

export function normalizePalette(rawPalette) {
  const palette = rawPalette && typeof rawPalette === "object" ? rawPalette : {};
  const normalizedNodeColors = {};

  NODE_TYPE_ORDER.forEach((type) => {
    normalizedNodeColors[type] = normalizeHex(
      palette.nodeColors?.[type],
      DEFAULT_PALETTE.nodeColors[type]
    );
  });

  return {
    name: typeof palette.name === "string" && palette.name.trim() ? palette.name.trim() : DEFAULT_PALETTE.name,
    canvas: normalizeHex(palette.canvas, DEFAULT_PALETTE.canvas),
    panel: normalizeHex(palette.panel, DEFAULT_PALETTE.panel),
    text: normalizeHex(palette.text, DEFAULT_PALETTE.text),
    mutedText: normalizeHex(palette.mutedText, DEFAULT_PALETTE.mutedText),
    edge: normalizeHex(palette.edge, DEFAULT_PALETTE.edge),
    accent: normalizeHex(palette.accent, DEFAULT_PALETTE.accent),
    nodeColors: normalizedNodeColors
  };
}

function createNodeVisual(baseColor, mode) {
  if (mode === "dark") {
    const fill = mixColors(baseColor, "#0e182b", 0.7);
    const fillAlt = mixColors(baseColor, "#1d2c48", 0.62);
    const border = mixColors(baseColor, "#d6e6ff", 0.22);
    const badge = mixColors(baseColor, "#101a2d", 0.5);
    const text = mixColors(baseColor, "#e8f0ff", 0.5);
    return {
      fill,
      fillAlt,
      border,
      badge,
      badgeText: getContrastText(badge),
      text
    };
  }

  const fill = mixColors(baseColor, "#ffffff", 0.84);
  const fillAlt = mixColors(baseColor, "#ffffff", 0.94);
  const border = mixColors(baseColor, "#223655", 0.16);
  const badge = mixColors(baseColor, "#ffffff", 0.38);
  const text = mixColors(baseColor, "#1a2b44", 0.24);
  return {
    fill,
    fillAlt,
    border,
    badge,
    badgeText: getContrastText(badge),
    text
  };
}

export function createThemeVariables(rawPalette, mode = "light") {
  const palette = normalizePalette(rawPalette);
  const darkMode = mode === "dark";
  const canvas = darkMode ? mixColors(palette.canvas, "#081226", 0.78) : palette.canvas;
  const panelSolid = darkMode ? mixColors(palette.panel, "#0f1a2f", 0.7) : palette.panel;
  const textMain = darkMode ? mixColors(palette.text, "#edf3ff", 0.58) : palette.text;
  const textMuted = darkMode ? mixColors(palette.mutedText, "#d2def7", 0.45) : palette.mutedText;
  const edgeColor = darkMode ? mixColors(palette.edge, "#c9dcff", 0.38) : palette.edge;
  const panelBorder = darkMode
    ? mixColors(palette.edge, "#9db4de", 0.25)
    : mixColors(palette.edge, "#ffffff", 0.68);
  const primary = normalizeHex(palette.accent, DEFAULT_PALETTE.accent);

  const variables = {
    "--bg-base": canvas,
    "--bg-gradient-a": darkMode
      ? mixColors(primary, "#10213d", 0.78)
      : mixColors(primary, "#ffffff", 0.87),
    "--bg-gradient-b": darkMode
      ? mixColors(palette.nodeColors.decision, "#17233d", 0.78)
      : mixColors(palette.nodeColors.decision, "#ffffff", 0.88),
    "--panel-bg-solid": panelSolid,
    "--panel-bg": darkMode ? toRgba(panelSolid, 0.88) : toRgba(panelSolid, 0.82),
    "--panel-border": panelBorder,
    "--text-main": textMain,
    "--text-muted": textMuted,
    "--primary": primary,
    "--primary-strong": darkMode
      ? mixColors(primary, "#eff6ff", 0.16)
      : mixColors(primary, "#0f1e30", 0.2),
    "--secondary": darkMode
      ? mixColors(palette.nodeColors.decision, "#ffd7a6", 0.32)
      : mixColors(palette.nodeColors.decision, "#ff8c42", 0.4),
    "--danger": darkMode
      ? mixColors(palette.nodeColors.end, "#ffc7da", 0.28)
      : mixColors(palette.nodeColors.end, "#cf2f5b", 0.5),
    "--shadow": darkMode
      ? "0 16px 34px -24px rgba(2, 8, 20, 0.9)"
      : "0 16px 30px -22px rgba(15, 38, 85, 0.45)",
    "--edge-color": edgeColor
  };

  NODE_TYPE_ORDER.forEach((type) => {
    const base = palette.nodeColors[type];
    const visual = createNodeVisual(base, mode);
    variables[`--node-${type}-base`] = base;
    variables[`--node-${type}-fill`] = visual.fill;
    variables[`--node-${type}-fill-alt`] = visual.fillAlt;
    variables[`--node-${type}-border`] = visual.border;
    variables[`--node-${type}-badge-bg`] = visual.badge;
    variables[`--node-${type}-badge-text`] = visual.badgeText;
    variables[`--node-${type}-text`] = visual.text;
  });

  return variables;
}
