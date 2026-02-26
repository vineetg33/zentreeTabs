/**
 * ZenTree Tabs - Visit-order navigation (back/forward by viewing order).
 */
export class VisitNav {
  constructor(state, storage, deps) {
    this.state = state;
    this.storage = storage;
    this.refresh = deps.refresh;
    this.updateVisitNavButtons = this.updateVisitNavButtons.bind(this);
  }

  updateVisitNavButtons() {
    const prevBtn = document.getElementById('visit-prev-btn');
    const nextBtn = document.getElementById('visit-next-btn');
    if (!prevBtn || !nextBtn) return;
    if (this.state.visitOrderAcrossWindows) {
      prevBtn.disabled = this.state.visitOrderGlobal.order.length <= 1 || this.state.visitOrderGlobal.index <= 0;
      nextBtn.disabled = this.state.visitOrderGlobal.order.length <= 1 || this.state.visitOrderGlobal.index >= this.state.visitOrderGlobal.order.length - 1;
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
      }
      const winState = this.state.visitHistoryByWindow[tab.windowId];
      if (!winState || winState.order.length <= 1) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
      }
      prevBtn.disabled = winState.index <= 0;
      nextBtn.disabled = winState.index >= winState.order.length - 1;
    });
  }

  setup() {
    document.getElementById('visit-prev-btn')?.addEventListener('click', async () => {
      if (this.state.visitOrderAcrossWindows) {
        if (this.state.visitOrderGlobal.order.length <= 1 || this.state.visitOrderGlobal.index <= 0) return;
        this.state.navigatingByArrows = true;
        this.state.visitOrderGlobal.index--;
        const tabId = this.state.visitOrderGlobal.order[this.state.visitOrderGlobal.index];
        try {
          const tab = await chrome.tabs.get(tabId);
          await chrome.windows.update(tab.windowId, { focused: true });
          await chrome.tabs.update(tabId, { active: true });
        } catch (e) {
          console.warn('Visit prev failed', e);
        }
        this.storage.saveVisitHistory(this.state);
        this.updateVisitNavButtons();
        return;
      }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      const winState = this.state.visitHistoryByWindow[tab.windowId];
      if (!winState || winState.index <= 0) return;
      this.state.navigatingByArrows = true;
      winState.index--;
      await chrome.tabs.update(winState.order[winState.index], { active: true });
      this.updateVisitNavButtons();
    });

    document.getElementById('visit-next-btn')?.addEventListener('click', async () => {
      if (this.state.visitOrderAcrossWindows) {
        if (this.state.visitOrderGlobal.order.length <= 1 || this.state.visitOrderGlobal.index >= this.state.visitOrderGlobal.order.length - 1) return;
        this.state.navigatingByArrows = true;
        this.state.visitOrderGlobal.index++;
        const tabId = this.state.visitOrderGlobal.order[this.state.visitOrderGlobal.index];
        try {
          const tab = await chrome.tabs.get(tabId);
          await chrome.windows.update(tab.windowId, { focused: true });
          await chrome.tabs.update(tabId, { active: true });
        } catch (e) {
          console.warn('Visit next failed', e);
        }
        this.storage.saveVisitHistory(this.state);
        this.updateVisitNavButtons();
        return;
      }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      const winState = this.state.visitHistoryByWindow[tab.windowId];
      if (!winState || winState.index >= winState.order.length - 1) return;
      this.state.navigatingByArrows = true;
      winState.index++;
      await chrome.tabs.update(winState.order[winState.index], { active: true });
      this.updateVisitNavButtons();
    });

    // Seed or sync visit history on panel open
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) return;
      if (this.state.visitOrderAcrossWindows) {
        const i = this.state.visitOrderGlobal.order.indexOf(tab.id);
        if (i !== -1) {
          this.state.visitOrderGlobal.index = i;
        } else {
          this.state.visitOrderGlobal.order.push(tab.id);
          this.state.visitOrderGlobal.index = this.state.visitOrderGlobal.order.length - 1;
          this.storage.saveVisitHistory(this.state);
        }
        this.updateVisitNavButtons();
        return;
      }
      let winState = this.state.visitHistoryByWindow[tab.windowId];
      if (winState && winState.order.length > 0) {
        const i = winState.order.indexOf(tab.id);
        if (i !== -1) winState.index = i;
        else {
          winState.order.push(tab.id);
          winState.index = winState.order.length - 1;
          this.storage.saveVisitHistory(this.state);
        }
      } else {
        winState = { order: [tab.id], index: 0 };
        this.state.visitHistoryByWindow[tab.windowId] = winState;
        this.storage.saveVisitHistory(this.state);
      }
      this.updateVisitNavButtons();
    });

    if (typeof window !== 'undefined') {
      window.updateVisitNavButtons = this.updateVisitNavButtons;
    }
  }
}
