/**
 * ZenTree Tabs - Storage
 * Pure persistence for overrides, collapsed state, custom titles, visit history. No DOM.
 */
const VISIT_HISTORY_STORAGE_KEY = "ztVisitHistory";
const VISIT_HISTORY_GLOBAL_STORAGE_KEY = "ztVisitHistoryGlobal";

export class Storage {
  async loadParentOverrides(state) {
    const res = await chrome.storage.local.get("parentOverrides");
    if (res.parentOverrides) {
      state.parentOverrides = new Map(
        Object.entries(res.parentOverrides).map(([k, v]) => [Number(k), v]),
      );
    }
  }

  async saveParentOverrides(state) {
    await chrome.storage.local.set({
      parentOverrides: Object.fromEntries(state.parentOverrides),
    });
  }

  async loadCollapsedState(state) {
    const res = await chrome.storage.local.get("collapsedState");
    if (res.collapsedState) {
      state.collapsedState = new Set(res.collapsedState);
    }
  }

  async saveCollapsedState(state) {
    await chrome.storage.local.set({
      collapsedState: Array.from(state.collapsedState),
    });
  }

  async loadCustomTitles(state) {
    const res = await chrome.storage.local.get("customTitles");
    if (res.customTitles) {
      state.customTitles = new Map(
        Object.entries(res.customTitles).map(([k, v]) => [Number(k), v]),
      );
    }
  }

  async saveCustomTitles(state) {
    await chrome.storage.local.set({
      customTitles: Object.fromEntries(state.customTitles),
    });
  }

  async loadVisitHistory(state) {
    try {
      const [sessionRes, localRes] = await Promise.all([
        chrome.storage.session.get([VISIT_HISTORY_STORAGE_KEY, VISIT_HISTORY_GLOBAL_STORAGE_KEY]),
        chrome.storage.local.get({ visitOrderAcrossWindows: false }),
      ]);
      state.visitHistoryByWindow = sessionRes[VISIT_HISTORY_STORAGE_KEY] || Object.create(null);
      state.visitOrderGlobal = sessionRes[VISIT_HISTORY_GLOBAL_STORAGE_KEY] || { order: [], index: -1 };
      state.visitOrderAcrossWindows = localRes.visitOrderAcrossWindows === true;
    } catch (e) {
      state.visitHistoryByWindow = Object.create(null);
      state.visitOrderGlobal = { order: [], index: -1 };
    }
  }

  saveVisitHistory(state) {
    try {
      chrome.storage.session.set({ [VISIT_HISTORY_STORAGE_KEY]: state.visitHistoryByWindow });
      if (state.visitOrderAcrossWindows) {
        chrome.storage.session.set({ [VISIT_HISTORY_GLOBAL_STORAGE_KEY]: state.visitOrderGlobal });
      }
    } catch (e) {}
  }
}
