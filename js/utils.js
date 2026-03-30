// utils.js — Helpers, ID generation, localStorage management

const Utils = {
  generateId() {
    return 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  },

  // localStorage keys
  STORAGE_KEYS: {
    DRAFT: 'ffxiv_adventure_draft',
    UI_PREFS: 'ffxiv_adventure_ui_prefs',
    LAST_SYNC: 'ffxiv_adventure_last_sync',
  },

  saveDraft(state) {
    try {
      localStorage.setItem(this.STORAGE_KEYS.DRAFT, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  },

  loadDraft() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.DRAFT);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to load draft:', e);
      return null;
    }
  },

  clearDraft() {
    localStorage.removeItem(this.STORAGE_KEYS.DRAFT);
  },

  saveUIPrefs(prefs) {
    try {
      localStorage.setItem(this.STORAGE_KEYS.UI_PREFS, JSON.stringify(prefs));
    } catch (e) {
      console.error('Failed to save UI prefs:', e);
    }
  },

  loadUIPrefs() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.UI_PREFS);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  setLastSync(timestamp) {
    localStorage.setItem(this.STORAGE_KEYS.LAST_SYNC, timestamp.toString());
  },

  getLastSync() {
    const ts = localStorage.getItem(this.STORAGE_KEYS.LAST_SYNC);
    return ts ? parseInt(ts, 10) : null;
  },

  // Escape a value for TSV export. If it contains tabs, newlines, or quotes,
  // wrap in quotes and double any internal quotes.
  escapeForTSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes('\t') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  },

  // Format a timestamp for display
  formatTimestamp(ts) {
    if (!ts) return 'Never';
    const d = new Date(ts);
    return d.toLocaleString();
  },

  // Deep clone an object
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // Debounce helper
  debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  },
};
