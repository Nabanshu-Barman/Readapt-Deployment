// popup.js
// Enforce Overlay for:
//  - Any source === 'custom'
//  - Low Vision preset >= 2 (needs settings.preset provided by contentScript persistence)
// Disable inline radio with a notice. Revert click attempts.

const dom = {
  lastUpdated: document.getElementById("lastUpdated"),
  settingsDump: document.getElementById("settingsDump"),
  noSettingsMsg: document.getElementById("noSettingsMsg"),
  modeBadge: document.getElementById("modeBadge"),
  toggleDisable: document.getElementById("toggleDisable"),
  overlayRadio: document.getElementById("overlayMode"),
  inlineRadio: document.getElementById("inlineMode"),
  inlineModeLabel: document.getElementById("inlineModeLabel"),
  modeSection: document.getElementById("modeSection")
};

let forceOverlay = false;
let forceReason = "";

function fmtTime(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function loadConfig(cb) {
  chrome.runtime.sendMessage({ type: "READAPT_GET_SETTINGS" }, data => {
    cb(data || {});
  });
}

function ensureNotice() {
  let notice = document.getElementById("readapt-inline-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "readapt-inline-notice";
    notice.style.marginTop = "6px";
    notice.style.fontSize = "11px";
    notice.style.lineHeight = "1.35";
    notice.style.color = "var(--text-dim)";
    notice.style.background = "var(--bg)";
    notice.style.border = "1px dashed var(--border)";
    notice.style.padding = "6px 8px";
    notice.style.borderRadius = "6px";
    dom.modeSection.appendChild(notice);
  }
  notice.textContent = forceOverlay
    ? forceReason
    : "Select Overlay or Inline to choose how adaptation applies.";
  notice.style.display = "block";
}

function hideNoticeIfAllowed() {
  const notice = document.getElementById("readapt-inline-notice");
  if (notice && !forceOverlay) {
    notice.textContent =
      "Select Overlay or Inline to choose how adaptation applies.";
  }
}

function render(data) {
  const settings = data.readaptSettings;
  const cfg = data.readaptConfig || { mode: "overlay", disabledHosts: [] };

  forceOverlay = false;
  forceReason = "";

  dom.overlayRadio.checked = cfg.mode === "overlay";
  dom.inlineRadio.checked = cfg.mode === "inline";

  if (!settings) {
    dom.settingsDump.style.display = "none";
    dom.noSettingsMsg.style.display = "block";
    dom.modeBadge.style.display = "none";
    dom.inlineModeLabel.dataset.visible = "false";
    dom.lastUpdated.textContent = "—";
    updateDisableLabel(cfg);
    ensureNotice();
    return;
  }

  const modeUpper = settings.mode?.toUpperCase() || "UNKNOWN";

  // Force overlay conditions
  if (settings.source === "custom") {
    forceOverlay = true;
    forceReason = "Inline disabled for custom adaptation; Overlay enforced.";
  } else if (
    settings.mode === "lowvision" &&
    settings.source === "preset" &&
    typeof settings.preset === "number" &&
    settings.preset >= 2
  ) {
    forceOverlay = true;
    forceReason = "Inline not available for Low Vision preset ≥ 2; Overlay enforced.";
  }

  if (forceOverlay) {
    // Always reflect overlay in UI
    dom.overlayRadio.checked = true;
    dom.inlineRadio.checked = false;
    dom.inlineRadio.disabled = true;
  } else {
    dom.inlineRadio.disabled = false;
  }

  dom.settingsDump.style.display = "block";
  dom.noSettingsMsg.style.display = "none";

  dom.modeBadge.style.display = "inline-flex";
  dom.modeBadge.textContent = modeUpper;

  dom.inlineModeLabel.textContent = modeUpper;
  dom.inlineModeLabel.dataset.visible = "true";

  dom.lastUpdated.textContent = fmtTime(settings.timestamp);

  dom.settingsDump.textContent = JSON.stringify({
    mode: settings.mode,
    source: settings.source,
    preset: settings.preset,          // may be undefined for custom or older saves
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    letterSpacing: settings.letterSpacing,
    wordSpacing: settings.wordSpacing,
    lineSpacing: settings.lineSpacing,
    contrast: { fg: settings.fontColor, bg: settings.backgroundColor },
    dyslexiaHighlights: settings.dyslexiaHighlights,
    adhdHighlightEvery: settings.adhdHighlightEvery,
    adhdHighlightOpacity: settings.adhdHighlightOpacity
  }, null, 2);

  ensureNotice();
  updateDisableLabel(cfg);
}

async function getActiveHost() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const url = tabs[0]?.url;
      try {
        const host = new URL(url).host;
        resolve(host);
      } catch {
        resolve(null);
      }
    });
  });
}

function updateDisableLabel(cfg) {
  getActiveHost().then(host => {
    if (!host) {
      dom.toggleDisable.disabled = true;
      dom.toggleDisable.textContent = "Unavailable";
      return;
    }
    const disabled = cfg.disabledHosts?.includes(host);
    dom.toggleDisable.textContent = disabled ? "Enable on this site" : "Disable on this site";
    dom.toggleDisable.classList.toggle("warning", !disabled);
    dom.toggleDisable.classList.toggle("primary", disabled);
  });
}

function saveMode(mode) {
  // If forced overlay, never store inline
  if (forceOverlay) {
    chrome.runtime.sendMessage({
      type: "READAPT_SET_CONFIG",
      config: { mode: "overlay" }
    });
    dom.overlayRadio.checked = true;
    dom.inlineRadio.checked = false;
    ensureNotice();
    return;
  }

  chrome.runtime.sendMessage({
    type: "READAPT_SET_CONFIG",
    config: { mode }
  });
}

function toggleDisableSite() {
  getActiveHost().then(host => {
    if (!host) return;
    chrome.storage.sync.get(["readaptConfig"], store => {
      const cfg = store.readaptConfig || { mode: dom.overlayRadio.checked ? "overlay" : "inline", disabledHosts: [] };
      cfg.disabledHosts = cfg.disabledHosts || [];
      const i = cfg.disabledHosts.indexOf(host);
      if (i >= 0) cfg.disabledHosts.splice(i, 1);
      else cfg.disabledHosts.push(host);
      chrome.runtime.sendMessage({ type: "READAPT_SET_CONFIG", config: cfg }, () => {
        updateDisableLabel(cfg);
      });
    });
  });
}

function wireEvents() {
  dom.overlayRadio.addEventListener("change", () => {
    if (dom.overlayRadio.checked) saveMode("overlay");
  });
  dom.inlineRadio.addEventListener("change", () => {
    if (dom.inlineRadio.checked) {
      if (forceOverlay) {
        // Immediately revert and show notice
        dom.inlineRadio.checked = false;
        dom.overlayRadio.checked = true;
        ensureNotice();
        return;
      }
      saveMode("inline");
    }
  });
  dom.toggleDisable.addEventListener("click", toggleDisableSite);
}

function init() {
  wireEvents();
  loadConfig(render);
}

init();