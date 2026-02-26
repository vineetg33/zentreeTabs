/**
 * ZenTree Tabs - Tab context menu and rename mode.
 */
export class ContextMenu {
  constructor(state, storage, tree, tabsListEl, deps) {
    this.state = state;
    this.storage = storage;
    this.tree = tree;
    this.tabsListEl = tabsListEl;
    this.refresh = deps.refresh;
    this.runSearch = deps.runSearch;
    this.searchInput = deps.searchInput || null;

    this.contextMenuTabId = null;
  }

  initContextMenu() {
    const contextMenu = document.getElementById('tab-context-menu');
    if (!contextMenu) return;

    document.addEventListener('click', (e) => {
      if (!contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    document.addEventListener('scroll', () => this.hideContextMenu(), true);

    document.getElementById('ctx-new-child')?.addEventListener('click', async () => {
      if (this.contextMenuTabId) {
        try {
          const newTab = await chrome.tabs.create({ openerTabId: this.contextMenuTabId });
          this.state.parentOverrides.set(newTab.id, this.contextMenuTabId);
          await this.storage.saveParentOverrides(this.state);
          if (this.searchInput?.value?.trim()) this.runSearch();
          else this.refresh();
        } catch (err) {
          console.error('New child failed', err);
        }
        this.hideContextMenu();
      }
    });

    document.getElementById('ctx-move-next-to-current')?.addEventListener('click', async () => {
      if (!this.contextMenuTabId) return;
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || activeTab.id === this.contextMenuTabId) return;
      try {
        await chrome.tabs.move(this.contextMenuTabId, {
          windowId: activeTab.windowId,
          index: activeTab.index + 1,
        });
        if (this.searchInput?.value?.trim()) this.runSearch();
        else this.refresh();
      } catch (err) {
        console.error('Move next to current failed', err);
      }
      this.hideContextMenu();
    });

    document.getElementById('ctx-make-child-of-current')?.addEventListener('click', async () => {
      if (!this.contextMenuTabId) return;
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || activeTab.id === this.contextMenuTabId) return;
      try {
        const tab = await chrome.tabs.get(this.contextMenuTabId).catch(() => null);
        if (tab && tab.windowId !== activeTab.windowId) {
          await chrome.tabs.move(this.contextMenuTabId, { windowId: activeTab.windowId });
          await this.refresh();
        }
        await this.tree.moveTabTree(this.contextMenuTabId, activeTab.id, 'nest');
        if (this.searchInput?.value?.trim()) this.runSearch();
        else this.refresh();
      } catch (err) {
        console.error('Make child of current failed', err);
      }
      this.hideContextMenu();
    });

    document.getElementById('ctx-move-to-current-window')?.addEventListener('click', async () => {
      if (!this.contextMenuTabId) return;
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!currentTab) return;
      try {
        await chrome.tabs.move(this.contextMenuTabId, { windowId: currentTab.windowId });
        if (this.searchInput?.value?.trim()) this.runSearch();
        else this.refresh();
      } catch (err) {
        console.error('Move to current window failed', err);
      }
      this.hideContextMenu();
    });

    document.getElementById('ctx-duplicate')?.addEventListener('click', async () => {
      if (this.contextMenuTabId) {
        await chrome.tabs.duplicate(this.contextMenuTabId);
        this.hideContextMenu();
      }
    });

    document.getElementById('ctx-reload')?.addEventListener('click', async () => {
      if (this.contextMenuTabId) {
        await chrome.tabs.reload(this.contextMenuTabId);
        this.hideContextMenu();
      }
    });

    document.getElementById('ctx-mute')?.addEventListener('click', async () => {
      if (!this.contextMenuTabId) return;
      try {
        const tab = this.state.tabsMap.get(this.contextMenuTabId) ?? await chrome.tabs.get(this.contextMenuTabId);
        const shouldMute = !tab.mutedInfo?.muted;
        await chrome.tabs.update(this.contextMenuTabId, { muted: shouldMute });
      } catch (err) {
        console.error('Mute failed', err);
      }
      this.hideContextMenu();
    });

    document.getElementById('ctx-rename')?.addEventListener('click', () => {
      if (this.contextMenuTabId) {
        this.activateRenameMode(this.contextMenuTabId);
        this.hideContextMenu();
      }
    });

    document.getElementById('ctx-promote')?.addEventListener('click', async () => {
      if (this.contextMenuTabId) {
        this.state.parentOverrides.set(this.contextMenuTabId, -1);
        await this.storage.saveParentOverrides(this.state);
        this.refresh();
        this.hideContextMenu();
      }
    });

    document.getElementById('ctx-close')?.addEventListener('click', () => {
      if (this.contextMenuTabId) {
        if (this.state.selectedTabs.has(this.contextMenuTabId) && this.state.selectedTabs.size > 1) {
          chrome.tabs.remove(Array.from(this.state.selectedTabs));
          this.state.selectedTabs.clear();
          if (typeof window.updateSelectionToolbar === 'function') window.updateSelectionToolbar();
        } else {
          chrome.tabs.remove(this.contextMenuTabId);
        }
        this.hideContextMenu();
      }
    });
  }

  showContextMenu(e, tabId) {
    e.preventDefault();
    e.stopPropagation();

    const contextMenu = document.getElementById('tab-context-menu');
    if (!contextMenu) return;

    this.contextMenuTabId = tabId;

    const closeBtn = document.getElementById('ctx-close');
    if (this.state.selectedTabs.size > 1 && this.state.selectedTabs.has(tabId)) {
      closeBtn.textContent = `Close ${this.state.selectedTabs.size} Tabs`;
    } else {
      closeBtn.textContent = 'Close Tab';
    }

    const inSearchMode = this.tabsListEl.classList.contains('is-search-results');
    const tab = this.state.tabsMap.get(tabId);
    const muteText = document.getElementById('ctx-mute-text');
    if (muteText) {
      if (tab) {
        muteText.textContent = tab.mutedInfo?.muted ? 'Unmute Tab' : 'Mute Tab';
      } else if (inSearchMode) {
        chrome.tabs.get(tabId).then(
          (t) => {
            if (muteText) muteText.textContent = t.mutedInfo?.muted ? 'Unmute Tab' : 'Mute Tab';
          },
          () => {}
        );
      }
    }

    const promoteBtn = document.getElementById('ctx-promote');
    const node = document.querySelector(`.tab-tree-node[data-tab-id="${tabId}"]`);
    if (node && node.dataset.depth && parseInt(node.dataset.depth, 10) > 0) {
      promoteBtn.style.display = 'flex';
    } else {
      promoteBtn.style.display = 'none';
    }

    const moveNextBtn = document.getElementById('ctx-move-next-to-current');
    const makeChildBtn = document.getElementById('ctx-make-child-of-current');
    if (inSearchMode) {
      if (moveNextBtn) moveNextBtn.style.display = 'flex';
      if (makeChildBtn) makeChildBtn.style.display = 'flex';
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const active = tabs[0];
      const hide = active && active.id === tabId;
      if (moveNextBtn) moveNextBtn.style.display = hide ? 'none' : 'flex';
      if (makeChildBtn) makeChildBtn.style.display = hide ? 'none' : 'flex';
    });

    const moveToWindowBtn = document.getElementById('ctx-move-to-current-window');
    if (moveToWindowBtn) {
      const inSearch = this.tabsListEl.classList.contains('is-search-results');
      if (!inSearch) {
        moveToWindowBtn.style.display = 'none';
      } else {
        chrome.tabs.get(tabId).then(
          (tab) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              const currentWindowId = tabs[0]?.windowId;
              const show = currentWindowId != null && tab.windowId !== currentWindowId;
              moveToWindowBtn.style.display = show ? 'flex' : 'none';
            });
          },
          () => {
            moveToWindowBtn.style.display = 'none';
          }
        );
      }
    }

    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.classList.remove('hidden');
    contextMenu.classList.add('visible');

    requestAnimationFrame(() => {
      const rect = contextMenu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      if (rect.right > viewportWidth) {
        contextMenu.style.left = e.clientX - rect.width + 'px';
      }
      if (rect.bottom > viewportHeight) {
        contextMenu.style.top = e.clientY - rect.height + 'px';
      }
    });
  }

  getContextMenuTabId() {
    return this.contextMenuTabId;
  }

  setMuteTextForMenu(muted) {
    const muteText = document.getElementById('ctx-mute-text');
    if (muteText) {
      muteText.textContent = muted ? 'Unmute Tab' : 'Mute Tab';
    }
  }

  hideContextMenu() {
    const contextMenu = document.getElementById('tab-context-menu');
    if (!contextMenu) return;

    contextMenu.classList.remove('visible');
    setTimeout(() => {
      if (!contextMenu.classList.contains('visible')) {
        contextMenu.classList.add('hidden');
      }
    }, 100);
  }

  activateRenameMode(tabId) {
    const container = document.querySelector(`.tab-tree-node[data-tab-id="${tabId}"]`);
    if (!container) return;

    const title = container.querySelector('.tab-title');
    if (!title) return;

    const tab = this.state.tabsMap.get(tabId);
    if (!tab) return;

    const currentName = title.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'rename-input';

    const commit = async () => {
      if (input.value && input.value !== tab.title) {
        this.state.customTitles.set(tabId, input.value);
      } else {
        this.state.customTitles.delete(tabId);
      }
      await this.storage.saveCustomTitles(this.state);
      this.refresh();
    };

    input.onblur = commit;
    input.onkeydown = (ev) => {
      if (ev.key === 'Enter') {
        input.blur();
      }
      if (ev.key === 'Escape') {
        this.refresh();
      }
    };

    title.replaceWith(input);
    input.focus();
    input.select();
  }
}
