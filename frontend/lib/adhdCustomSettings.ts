// ADHD custom settings reusing the exact Dyslexia font & contrast sets provided.

export const FONT_FAMILIES = [
  "system-ui, sans-serif", // Default
  "'OpenDyslexic', Arial, sans-serif",
  "'Comic Sans MS', Comic Sans, cursive, sans-serif",
  "'Roboto', Arial, sans-serif",
  "'Georgia', serif",
  "'Courier New', monospace"
];

export const CONTRAST_PRESETS = [
  { fontColor: "#111", backgroundColor: "#fff" },       // Default
  { fontColor: "#fff", backgroundColor: "#222" },       // High contrast dark
  { fontColor: "#252525", backgroundColor: "#f5e900" }, // Yellow BG
  { fontColor: "#181818", backgroundColor: "#b5e2fa" }, // Blue BG
  { fontColor: "#000", backgroundColor: "#f1f1f1" },    // Soft gray
  { fontColor: "#fff", backgroundColor: "#191970" }     // Navy BG
];

export interface ADHDCustomSettings {
  fontSize: number;
  fontFamilyIndex: number;
  contrastIndex: number;
  letterSpacing: number;
  lineSpacing: number;
  wordSpacing: number;
  fontColor: string;
  backgroundColor: string;
  highlightEnabled: boolean;
  highlightEvery: number;   // every Nth word (2..8 active; >8 disables)
  highlightOpacity: number; // 0..1
}

export const defaultADHDCustomSettings: ADHDCustomSettings = {
  fontSize: 18,
  fontFamilyIndex: 0,
  contrastIndex: 0,
  letterSpacing: 0,
  lineSpacing: 1.6,
  wordSpacing: 0,
  fontColor: CONTRAST_PRESETS[0].fontColor,
  backgroundColor: CONTRAST_PRESETS[0].backgroundColor,
  highlightEnabled: true,
  highlightEvery: 3,
  highlightOpacity: 0.35
};

const KEY = "readapt:adhdCustomSettings";

export function saveADHDCustomSettings(settings: ADHDCustomSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export function loadADHDCustomSettings(): ADHDCustomSettings | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const merged: ADHDCustomSettings = {
      ...defaultADHDCustomSettings,
      ...parsed
    };

    // Clamp & sanitize
    const clamp = (v: any, min: number, max: number, fb: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
    };

    merged.fontFamilyIndex = clamp(merged.fontFamilyIndex, 0, FONT_FAMILIES.length - 1, 0);
    merged.contrastIndex = clamp(merged.contrastIndex, 0, CONTRAST_PRESETS.length - 1, 0);
    merged.fontSize = clamp(merged.fontSize, 10, 72, 18);
    merged.lineSpacing = clamp(merged.lineSpacing, 1, 4, 1.6);
    merged.letterSpacing = clamp(merged.letterSpacing, 0, 1.2, 0);
    merged.wordSpacing = clamp(merged.wordSpacing, 0, 3, 0);
    merged.highlightEvery = clamp(merged.highlightEvery, 2, 20, 3);
    merged.highlightOpacity = clamp(merged.highlightOpacity, 0, 1, 0.35);
    merged.highlightEnabled = Boolean(merged.highlightEnabled);

    // Apply font & contrast
    merged.fontColor = CONTRAST_PRESETS[merged.contrastIndex].fontColor;
    merged.backgroundColor = CONTRAST_PRESETS[merged.contrastIndex].backgroundColor;

    return merged;
  } catch {
    return null;
  }
}

export function clearADHDCustomSettings() {
  localStorage.removeItem(KEY);
}