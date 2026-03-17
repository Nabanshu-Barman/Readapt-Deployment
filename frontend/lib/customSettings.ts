export const FONT_FAMILIES = [
  "system-ui, sans-serif", // Default
  "'OpenDyslexic', Arial, sans-serif",
  "'Comic Sans MS', Comic Sans, cursive, sans-serif",
  "'Roboto', Arial, sans-serif",
  "'Georgia', serif",
  "'Courier New', monospace"
];

export const CONTRAST_PRESETS = [
  { fontColor: "#111", backgroundColor: "#fff" },    // Default
  { fontColor: "#fff", backgroundColor: "#222" },    // High contrast dark
  { fontColor: "#252525", backgroundColor: "#f5e900" }, // Yellow BG
  { fontColor: "#181818", backgroundColor: "#b5e2fa" }, // Blue BG
  { fontColor: "#000", backgroundColor: "#f1f1f1" },    // Soft gray
  { fontColor: "#fff", backgroundColor: "#191970" }     // Navy BG
];

export const defaultCustomSettings = {
  fontSize: 18,
  fontFamilyIndex: 0, // index into FONT_FAMILIES
  contrastIndex: 0,   // index into CONTRAST_PRESETS
  letterSpacing: 0,
  lineSpacing: 1.6,
  wordSpacing: 0,
  fontColor: CONTRAST_PRESETS[0].fontColor,
  backgroundColor: CONTRAST_PRESETS[0].backgroundColor,
};

export function saveCustomSettings(settings: any) {
  localStorage.setItem("readapt:customSettings", JSON.stringify(settings));
}
export function loadCustomSettings() {
  try {
    return JSON.parse(localStorage.getItem("readapt:customSettings") || "");
  } catch {
    return null;
  }
}
export function clearCustomSettings() {
  localStorage.removeItem("readapt:customSettings");
}