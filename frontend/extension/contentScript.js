// contentScript.js (adds invalidation guard around adaptPage)

function onReady(cb) {
  if (document.readyState === "complete" || document.readyState === "interactive") cb();
  else document.addEventListener("DOMContentLoaded", cb, { once: true });
}

let readaptApplied = false;
let invalidated = false;

/* ---------------- Toast ---------------- */
function showReadaptNotice(msg, ms = 2600) {
  try {
    let box = document.getElementById("readapt-notice");
    if (!box) {
      box = document.createElement("div");
      box.id = "readapt-notice";
      Object.assign(box.style, {
        position: "fixed",
        bottom: "72px",
        right: "16px",
        zIndex: "2147483647",
        background: "rgba(25,30,38,0.88)",
        color: "#fff",
        padding: "10px 14px",
        font: "12px/1.35 system-ui,sans-serif",
        borderRadius: "8px",
        maxWidth: "280px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        backdropFilter: "blur(4px)",
        transition: "opacity .25s",
        opacity: "0"
      });
      document.body.appendChild(box);
      requestAnimationFrame(() => (box.style.opacity = "1"));
    }
    box.innerHTML = msg;
    clearTimeout(box._hideT);
    box._hideT = setTimeout(() => {
      box.style.opacity = "0";
      setTimeout(() => box.remove(), 300);
    }, ms);
  } catch(_) {}
}

/* ---------------- Runtime validity check ---------------- */
function isRuntimeAlive() {
  // In MV3 after reload chrome.runtime.id still exists, but sendMessage throws.
  // Quick heuristic: check presence then try a no-op message if needed (lazy).
  return !!(chrome && chrome.runtime && chrome.runtime.id);
}

function markInvalidated(reason) {
  if (invalidated) return;
  invalidated = true;
  const btn = document.getElementById("readapt-floating-btn");
  if (btn) {
    btn.disabled = true;
    btn.style.filter = "grayscale(1) opacity(.55)";
    btn.title = "Extension was reloaded. Refresh page.";
  }
  showReadaptNotice(
    `Extension context invalidated.<br/><br/>
     <button id="readapt-reload-btn" style="
       all:unset;cursor:pointer;background:#2563eb;color:#fff;
       padding:4px 10px;border-radius:6px;display:inline-block;
       font-weight:600;margin-top:6px;">Reload Page</button>`,
    10000
  );
  setTimeout(() => {
    const r = document.getElementById("readapt-reload-btn");
    if (r) r.onclick = () => window.location.reload();
  }, 50);
}

/* ---------------- Messaging from site pages ---------------- */
window.addEventListener("message", (e) => {
  const data = e.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "READAPT_TRIGGER_EXTENSION" && data.settings) {
    if (!isRuntimeAlive()) {
      markInvalidated("runtime dead");
      return;
    }
    try {
      const payload = { ...data.settings, timestamp: Date.now() };
      if (typeof data.preset !== "undefined") payload.preset = data.preset;
      chrome.runtime.sendMessage({ type: "READAPT_SAVE_SETTINGS", payload }, () => {
        if (chrome.runtime.lastError) {
          // If context invalidated mid-call
          if (/invalidated/i.test(chrome.runtime.lastError.message)) markInvalidated(chrome.runtime.lastError.message);
        }
      });
    } catch (err) {
      if (/invalidated/i.test(String(err.message))) markInvalidated(err.message);
    }
  }
  if (data.type === "READAPT_INLINE_CLEANUP") {
    cleanupHighlightsAndWrappers();
  }
});

/* ---------------- Floating Button ---------------- */
function injectFloatingButton() {
  let btn = document.getElementById("readapt-floating-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "readapt-floating-btn";
    btn.textContent = "Readapt";
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      zIndex: "2147483647",
      background: "#2563eb",
      color: "#fff",
      fontSize: "14px",
      fontFamily: "system-ui,sans-serif",
      padding: "10px 14px",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
      boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
      lineHeight: "1.15"
    });
    document.body.appendChild(btn);
  }
  // Re-bind safely
  btn.replaceWith(btn.cloneNode(true));
  btn = document.getElementById("readapt-floating-btn");
  btn.addEventListener("click", adaptPage, { passive: true });
}

function setButtonState(on) {
  const b = document.getElementById("readapt-floating-btn");
  if (b && !invalidated) b.textContent = on ? "Reset" : "Readapt";
}

/* ---------------- Adapt Logic (WRAPPED) ---------------- */
function adaptPage() {
  try {
    if (invalidated) {
      showReadaptNotice("Refresh this page to re-enable Readapt.");
      return;
    }

    // If runtime missing or soon invalid -> prompt refresh
    if (!isRuntimeAlive()) {
      markInvalidated("runtime missing");
      return;
    }

    if (readaptApplied) {
      // Toggle off
      removeOverlay();
      removeInline();
      readaptApplied = false;
      setButtonState(false);
      showReadaptNotice("Readapt reset.");
      return;
    }

    // Fetch settings
    chrome.runtime.sendMessage({ type: "READAPT_GET_SETTINGS" }, (res) => {
      if (chrome.runtime.lastError) {
        if (/invalidated/i.test(chrome.runtime.lastError.message)) {
          markInvalidated(chrome.runtime.lastError.message);
          return;
        }
        showReadaptNotice("Could not get settings. Sync again on site.");
        return;
      }
      if (!res || !res.readaptSettings) {
        showReadaptNotice("No settings saved. Click 'Adapt in real time' first.");
        return;
      }
      const settings = res.readaptSettings;
      const config = res.readaptConfig || { mode: "overlay" };
      const forceOverlay =
        settings.source === "custom" ||
        (settings.mode === "lowvision" &&
         settings.source === "preset" &&
         typeof settings.preset === "number" &&
         settings.preset >= 2);

      try {
        if (!forceOverlay && config.mode === "inline") {
          applyInline(settings);
          showReadaptNotice("Inline adaptation applied.");
        } else {
          applyOverlay(settings);
          showReadaptNotice(forceOverlay ? "Overlay forced." : "Overlay applied.");
        }
        readaptApplied = true;
        setButtonState(true);
      } catch (ex) {
        if (/invalidated/i.test(String(ex.message))) {
          markInvalidated(ex.message);
        } else {
          console.error("[Readapt] apply failed", ex);
          showReadaptNotice("Adaptation failed (see console).");
        }
      }
    });
  } catch (err) {
    // This is the actual throw you are seeing
    if (/invalidated/i.test(String(err.message))) {
      markInvalidated(err.message);
    } else {
      console.error("[Readapt] unexpected error in adaptPage", err);
      showReadaptNotice("Unexpected error (see console).");
    }
  }
}

/* ---------------- Inline Mode ---------------- */
function applyInline(s) {
  removeInline();
  cleanupHighlightsAndWrappers();
  const style = document.createElement("style");
  style.id = "readapt-inline-style";
  style.textContent = `
    html.readapt-inline body {
      background: ${s.backgroundColor} !important;
      color: ${s.fontColor} !important;
      line-height: ${s.lineSpacing};
      letter-spacing: ${s.letterSpacing}em;
      word-spacing: ${s.wordSpacing}em;
      font-size: ${s.fontSize}px;
      font-family: ${JSON.stringify(s.fontFamily || "inherit")} !important;
      transition: background .25s, color .25s;
    }
  `;
  document.head.appendChild(style);
  document.documentElement.classList.add("readapt-inline");

  if (s.mode === "adhd" && s.adhdHighlightEvery && s.adhdHighlightEvery >= 2 && s.adhdHighlightEvery <= 8) {
    highlightEveryNthWord(s.adhdHighlightEvery, s.adhdHighlightOpacity || 0.35);
  } else if (s.mode === "dyslexia" && s.dyslexiaHighlights) {
    dyslexiaLetterHints();
  }
}

function removeInline() {
  document.documentElement.classList.remove("readapt-inline");
  const st = document.getElementById("readapt-inline-style");
  if (st) st.remove();
  cleanupHighlightsAndWrappers();
}

/* ---------------- Overlay Mode ---------------- */
function applyOverlay(s) {
  removeOverlay();
  const overlay = document.createElement("div");
  overlay.id = "readapt-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(4px)",
    zIndex: "2147483646",
    display: "flex",
    flexDirection: "column",
  });

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    margin: "auto",
    width: "min(900px, 90%)",
    maxHeight: "85vh",
    overflow: "auto",
    background: s.backgroundColor,
    color: s.fontColor,
    padding: "32px",
    borderRadius: "16px",
    fontFamily: s.fontFamily || "system-ui, sans-serif",
    lineHeight: s.lineSpacing,
    letterSpacing: s.letterSpacing + "em",
    wordSpacing: s.wordSpacing + "em",
    fontSize: s.fontSize + "px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    position: "relative",
  });

  const close = document.createElement("button");
  close.textContent = "×";
  Object.assign(close.style, {
    position: "absolute",
    top: "8px",
    right: "12px",
    fontSize: "24px",
    background: "transparent",
    border: "none",
    color: s.fontColor,
    cursor: "pointer",
  });
  close.onclick = () => {
    removeOverlay();
    readaptApplied = false;
    setButtonState(false);
    showReadaptNotice("Overlay closed.");
  };

  panel.appendChild(close);

  const extracted = extractMainArticleText();
  extracted.forEach(p => {
    const para = document.createElement("p");
    para.textContent = p;
    para.style.margin = "0 0 1em";
    panel.appendChild(para);
  });

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  if (s.mode === "adhd" && s.adhdHighlightEvery && s.adhdHighlightEvery >= 2 && s.adhdHighlightEvery <= 8) {
    highlightInsideElement(panel, s.adhdHighlightEvery, s.adhdHighlightOpacity || 0.35, 20000);
  } else if (s.mode === "dyslexia" && s.dyslexiaHighlights) {
    dyslexiaLetterHints(panel);
  }
}

function removeOverlay() {
  const ov = document.getElementById("readapt-overlay");
  if (ov) ov.remove();
}

/* ---------------- Text Extraction ---------------- */
function extractMainArticleText() {
  const candidates = [];
  const main = document.querySelector("main");
  if (main) candidates.push(main);
  const article = document.querySelector("article");
  if (article) candidates.push(article);

  if (!candidates.length) {
    let maxLen = 0;
    let best = null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (!(el instanceof HTMLElement)) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const t = el.innerText;
      if (t && t.length > maxLen) {
        maxLen = t.length;
        best = el;
      }
    }
    if (best) candidates.push(best);
  }

  const picked = candidates[0] || document.body;
  const text = picked.innerText || "";
  return text
    .split(/\n+/)
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 1000);
}

/* ---------------- ADHD Highlight ---------------- */
function highlightEveryNthWord(n, opacity) {
  highlightInsideElement(document.body, n, opacity, 15000);
}

function highlightInsideElement(root, n, opacity, limit = 10000) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let processed = 0;
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement) continue;
    const text = node.textContent;
    if (!text || !text.trim()) continue;
    if (processed > limit) break;
    nodes.push(node);
    processed += text.length;
  }
  nodes.forEach(node => {
    const parent = node.parentElement;
    if (!parent) return;
    if (parent.closest("#readapt-overlay button")) return;
    const words = node.textContent.split(/(\s+)/);
    let ctr = 0;
    const frag = document.createDocumentFragment();
    words.forEach(part => {
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
      } else {
        ctr++;
        if (ctr % n === 0) {
          const span = document.createElement("span");
          span.dataset.readaptWordhi = "true";
          span.style.backgroundColor = `rgba(37,99,235,${Math.min(opacity, 0.55)})`;
          span.style.padding = "0 2px";
          span.style.borderRadius = "3px";
          span.textContent = part;
          frag.appendChild(span);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      }
    });
    parent.replaceChild(frag, node);
  });
}

/* ---------------- Dyslexia Hints ---------------- */
function dyslexiaLetterHints(rootEl = document.body) {
  const confusers = /[bdpqmnun]/i;
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.slice(0, 8000).forEach(node => {
    const text = node.textContent;
    if (!text || !confusers.test(text)) return;
    if (!node.parentElement) return;
    const spans = [];
    for (const ch of text) {
      if (/[bdpqmnun]/i.test(ch)) {
        spans.push(`<span data-readapt-letter="true" class="readapt-hint">${ch}</span>`);
      } else spans.push(ch);
    }
    const wrapper = document.createElement("span");
    wrapper.setAttribute("data-readapt-wrapper", "letters");
    wrapper.innerHTML = spans.join("");
    node.parentElement.replaceChild(wrapper, node);
  });

  if (!document.getElementById("readapt-dyslexia-style")) {
    const st = document.createElement("style");
    st.id = "readapt-dyslexia-style";
    st.textContent = `
      .readapt-hint {
        background: color-mix(in oklab, var(--primary, #2563eb) 60%, transparent);
        color: #fff;
        font-weight: 600;
        padding: 0 1px;
        border-radius: 2px;
      }
    `;
    document.head.appendChild(st);
  }
}

/* ---------------- Cleanup ---------------- */
function cleanupHighlightsAndWrappers() {
  document.querySelectorAll("span[data-readapt-wordhi]").forEach(span => {
    span.replaceWith(document.createTextNode(span.textContent || ""));
  });
  document.querySelectorAll("span[data-readapt-letter]").forEach(span => {
    span.replaceWith(document.createTextNode(span.textContent || ""));
  });
  document.querySelectorAll("span[data-readapt-wrapper='letters']").forEach(wrapper => {
    wrapper.replaceWith(document.createTextNode(wrapper.textContent || ""));
  });
  const style = document.getElementById("readapt-dyslexia-style");
  if (style) style.remove();
}

/* ---------------- Init ---------------- */
onReady(() => {
  injectFloatingButton();
});