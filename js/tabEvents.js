/**
 * ZenTree Tabs - Tab and group event handlers (chrome.tabs.*, chrome.tabGroups.*).
 */
import { getFaviconUrl } from './utils.js';

export class TabEvents {
  constructor(state, storage, deps) {
    this.state = state;
    this.storage = storage;
    this.refresh = deps.refresh;
    this.runSearch = deps.runSearch;
    this.searchInput = deps.searchInput || null;
    this.updateVisitNavButtons = deps.updateVisitNavButtons || (() => {});
    this.contextMenu = deps.contextMenu || null;

    this.renderTimeout = null;
  }

  scheduleRender() {
    if (this.renderTimeout) clearTimeout(this.renderTimeout);
    this.renderTimeout = setTimeout(() => {
      const searchVal = this.searchInput ? this.searchInput.value : '';
      if (searchVal.trim()) {
        this.runSearch();
      } else {
        this.refresh();
      }
    }, 50);
  }

  onTabCreated(tab) {
    this.state.pendingScrollTabId = tab.id;
    this.scheduleRender();
  }

  async onTabRemoved(tabId, removeInfo) {
    if (this.state.visitOrderAcrossWindows) {
      const i = this.state.visitOrderGlobal.order.indexOf(tabId);
      if (i !== -1) {
        this.state.visitOrderGlobal.order.splice(i, 1);
        if (this.state.visitOrderGlobal.index >= this.state.visitOrderGlobal.order.length) {
          this.state.visitOrderGlobal.index = Math.max(0, this.state.visitOrderGlobal.order.length - 1);
        } else if (this.state.visitOrderGlobal.index >= i) {
          this.state.visitOrderGlobal.index = Math.max(0, this.state.visitOrderGlobal.index - 1);
        }
        this.storage.saveVisitHistory(this.state);
        this.updateVisitNavButtons();
      }
    } else {
      for (const wid of Object.keys(this.state.visitHistoryByWindow)) {
        const winState = this.state.visitHistoryByWindow[wid];
        const i = winState.order.indexOf(tabId);
        if (i !== -1) {
          winState.order.splice(i, 1);
          if (winState.index >= winState.order.length) {
            winState.index = Math.max(0, winState.order.length - 1);
          } else if (winState.index >= i) {
            winState.index = Math.max(0, winState.index - 1);
          }
          this.storage.saveVisitHistory(this.state);
          this.updateVisitNavButtons();
          break;
        }
      }
    }

    const node = this.state.tabsMap.get(tabId);
    if (node && node.children && node.children.length > 0) {
      let grandparent = this.state.parentOverrides.get(tabId);
      if (grandparent === undefined) grandparent = node.openerTabId;
      if (grandparent === -1) grandparent = null;

      const newParentVal =
        grandparent && this.state.tabsMap.has(grandparent) ? grandparent : -1;

      for (const childId of node.children) {
        this.state.parentOverrides.set(childId, newParentVal);
      }
      await this.storage.saveParentOverrides(this.state);
    }

    this.scheduleRender();
  }

  onTabMoved() {
    this.scheduleRender();
  }

  onTabActivated(activeInfo) {
    const { windowId, tabId } = activeInfo;

    if (this.state.visitOrderAcrossWindows) {
      if (this.state.navigatingByArrows) {
        this.state.navigatingByArrows = false;
        const i = this.state.visitOrderGlobal.order.indexOf(tabId);
        if (i !== -1) this.state.visitOrderGlobal.index = i;
        this.updateVisitNavButtons();
      } else {
        const i = this.state.visitOrderGlobal.order.indexOf(tabId);
        if (i !== -1) {
          this.state.visitOrderGlobal.index = i;
          this.state.visitOrderGlobal.order = this.state.visitOrderGlobal.order.slice(0, i + 1);
        } else {
          this.state.visitOrderGlobal.order.push(tabId);
          this.state.visitOrderGlobal.index = this.state.visitOrderGlobal.order.length - 1;
        }
        this.storage.saveVisitHistory(this.state);
        this.updateVisitNavButtons();
      }
    } else {
      let winState = this.state.visitHistoryByWindow[windowId];
      if (!winState) {
        winState = { order: [], index: -1 };
        this.state.visitHistoryByWindow[windowId] = winState;
      }
      if (this.state.navigatingByArrows) {
        this.state.navigatingByArrows = false;
        const i = winState.order.indexOf(tabId);
        if (i !== -1) winState.index = i;
        this.updateVisitNavButtons();
      } else {
        const i = winState.order.indexOf(tabId);
        if (i !== -1) {
          winState.index = i;
          winState.order = winState.order.slice(0, i + 1);
        } else {
          winState.order.push(tabId);
          winState.index = winState.order.length - 1;
        }
        this.storage.saveVisitHistory(this.state);
        this.updateVisitNavButtons();
      }
    }

    const prevActive = document.querySelector('.tab-item.active');
    if (prevActive) prevActive.classList.remove('active');

    const newActiveContainer = document.querySelector(
      `.tab-tree-node[data-tab-id="${tabId}"]`
    );
    if (newActiveContainer) {
      const newActive = newActiveContainer.querySelector('.tab-item');
      if (newActive) {
        newActive.classList.add('active');
        setTimeout(() => {
          newActive.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }, 10);
      }
    } else {
      this.scheduleRender();
    }
  }

  onTabUpdated(tabId, changeInfo, tab) {
    const container = document.querySelector(
      `.tab-tree-node[data-tab-id="${tabId}"]`
    );
    if (!container) {
      return this.scheduleRender();
    }

    if (changeInfo.title) {
      const titleEl = container.querySelector('.tab-title');
      if (titleEl && !this.state.customTitles.has(tabId)) {
        titleEl.textContent = changeInfo.title;
      }
    }

    if (changeInfo.favIconUrl) {
      const faviconEl = container.querySelector('.tab-favicon');
      if (faviconEl) {
        faviconEl.src = getFaviconUrl(tab);
      }
    }

    if (changeInfo.pinned !== undefined || changeInfo.groupId !== undefined) {
      this.scheduleRender();
    }

    if (changeInfo.mutedInfo !== undefined && this.contextMenu) {
      if (this.contextMenu.getContextMenuTabId() === tabId) {
        this.contextMenu.setMuteTextForMenu(changeInfo.mutedInfo.muted);
      }
    }
  }
}
