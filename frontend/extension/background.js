// Background (service worker)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "READAPT_SAVE_SETTINGS") {
    chrome.storage.sync.set({ readaptSettings: msg.payload }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg?.type === "READAPT_GET_SETTINGS") {
    chrome.storage.sync.get(["readaptSettings", "readaptConfig"], data => {
      sendResponse(data);
    });
    return true;
  }

  if (msg?.type === "READAPT_SET_CONFIG") {
    chrome.storage.sync.set({ readaptConfig: msg.config }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});