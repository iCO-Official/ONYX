// web-bridge.js
// Provides a single API to talk to native WKWebView bridge when present

window.ONYX = window.ONYX || {};

ONYX.sendNative = function(type, payload) {
  const msg = { type, payload };
  // WKWebView bridge
  try {
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.onyx) {
      window.webkit.messageHandlers.onyx.postMessage(msg);
      return;
    }
  } catch(e) { console.warn('webkit bridge failed', e); }
  // Fallback: emit event for native-like behavior or for testing
  window.dispatchEvent(new CustomEvent('onyx-message', { detail: msg }));
};

// Native -> Web callbacks expected by native wrapper
window.native = window.native || {};
window.native.theme = window.native.theme || {};
window.native.theme.apply = function(json) {
  // apply theme JSON to CSS variables
  try {
    const t = typeof json === 'string' ? JSON.parse(json) : json;
    if (t.colors) {
      const c = t.colors;
      if (c.background) {
        document.documentElement.style.setProperty('--background', c.background);
        document.documentElement.style.setProperty('--bg', c.background);
      }
      if (c.surface) {
        document.documentElement.style.setProperty('--surface', c.surface);
        document.documentElement.style.setProperty('--surface-strong', c.surface);
      }
      if (c.accent) document.documentElement.style.setProperty('--accent', c.accent);
      if (c.accent2) document.documentElement.style.setProperty('--accent-2', c.accent2);
      if (c.text) document.documentElement.style.setProperty('--text', c.text);
    }
  } catch(e){ console.warn('theme.apply error', e) }
};

window.native.player = window.native.player || {};
window.native.player.state = function(playing, track) {
  const evt = new CustomEvent('onyx-player-state', { detail: { playing, track } });
  window.dispatchEvent(evt);
};

// request native theme
ONYX.requestNativeTheme = function(){ ONYX.sendNative('theme.request', {}); }

