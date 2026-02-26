/**
 * ZenTree Tabs - Keyboard navigation and selection (slash, Tab, Ctrl+A, arrows, selection toolbar).
 */
export class KeyboardNav {
  constructor(state, tabsListEl, searchInput, deps) {
    this.state = state;
    this.tabsListEl = tabsListEl;
    this.searchInput = searchInput;
    this.refresh = deps.refresh;
  }

  getFocusableTabRows() {
    const searchRows = this.tabsListEl.querySelectorAll('.search-result-tab-row-inner');
    if (searchRows.length) return Array.from(searchRows);
    const nodes = this.tabsListEl.querySelectorAll('.tab-tree-node');
    return Array.from(nodes)
      .map((n) => n.querySelector('.tab-item'))
      .filter(Boolean);
  }

  getTabIdFromRow(row) {
    const node = row.closest('[data-tab-id]');
    return node ? Number(node.dataset.tabId) : NaN;
  }

  activateRowTab(row) {
    const tabId = this.getTabIdFromRow(row);
    if (isNaN(tabId)) return;
    const node = row.closest('[data-tab-id]');
    const windowId = node ? parseInt(node.dataset.windowId, 10) : NaN;
    if (!isNaN(windowId)) {
      chrome.windows.update(windowId, { focused: true }).then(() => {
        chrome.tabs.update(tabId, { active: true });
      });
    } else {
      chrome.tabs.update(tabId, { active: true });
    }
  }

  updateSelectionToolbar() {
    const selectionToolbar = document.getElementById('selection-toolbar');
    const selectionCount = document.getElementById('selection-count');
    if (!selectionToolbar || !selectionCount) return;

    if (this.state.selectedTabs.size > 0) {
      if (selectionToolbar.classList.contains('hidden')) {
        selectionToolbar.classList.remove('hidden');
        selectionToolbar.classList.add('fade-out');
        requestAnimationFrame(() => {
          selectionToolbar.classList.remove('fade-out');
        });
      }
      selectionCount.textContent = `${this.state.selectedTabs.size} selected`;
    } else {
      if (!selectionToolbar.classList.contains('hidden')) {
        selectionToolbar.classList.add('fade-out');
        setTimeout(() => {
          selectionToolbar.classList.add('hidden');
          selectionToolbar.classList.remove('fade-out');
        }, 300);
      }
    }
  }

  setup() {
    const selectionToolbar = document.getElementById('selection-toolbar');
    const closeSelectedBtn = document.getElementById('close-selected-btn');
    const groupSelectedBtn = document.getElementById('group-selected-btn');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');

    if (closeSelectedBtn) {
      closeSelectedBtn.addEventListener('click', () => {
        if (this.state.selectedTabs.size > 0) {
          chrome.tabs.remove(Array.from(this.state.selectedTabs));
          this.state.selectedTabs.clear();
          this.updateSelectionToolbar();
        }
      });
    }

    if (groupSelectedBtn) {
      groupSelectedBtn.addEventListener('click', async () => {
        if (this.state.selectedTabs.size > 0) {
          const tabIds = Array.from(this.state.selectedTabs);
          try {
            const group = await chrome.tabs.group({ tabIds });
            const groupTitle = prompt('Enter group name (optional):');
            if (groupTitle) {
              await chrome.tabGroups.update(group, { title: groupTitle });
            }
            this.state.selectedTabs.clear();
            this.updateSelectionToolbar();
            this.refresh();
          } catch (error) {
            console.error('Failed to group tabs:', error);
          }
        }
      });
    }

    if (clearSelectionBtn) {
      clearSelectionBtn.addEventListener('click', () => {
        this.state.selectedTabs.clear();
        document.querySelectorAll('.tab-tree-node.selected').forEach((el) => {
          el.classList.remove('selected');
        });
        this.updateSelectionToolbar();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        document.body.classList.add('shift-selecting');
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        document.body.classList.remove('shift-selecting');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const inInput = document.activeElement.closest('input, textarea, [contenteditable=true]');
        if (!inInput && this.searchInput) {
          e.preventDefault();
          this.searchInput.focus();
          this.searchInput.select();
        }
      }

      if (e.key === 'Tab' && !e.shiftKey && document.activeElement === this.searchInput) {
        const rows = this.getFocusableTabRows();
        if (rows.length) {
          e.preventDefault();
          const activeRow = this.tabsListEl.querySelector('.tab-item.active');
          const idx = activeRow ? rows.indexOf(activeRow) : 0;
          const targetIndex = idx >= 0 ? idx : 0;
          rows.forEach((r, i) => r.setAttribute('tabindex', i === targetIndex ? '0' : '-1'));
          rows[targetIndex].focus();
          rows[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const allTabNodes = document.querySelectorAll('.tab-tree-node');
        allTabNodes.forEach((node) => {
          const tabId = Number(node.dataset.tabId);
          if (!isNaN(tabId)) {
            this.state.selectedTabs.add(tabId);
            node.classList.add('selected');
          }
        });
        this.updateSelectionToolbar();
      }

      if (e.key === 'Escape' && this.state.selectedTabs.size > 0) {
        this.state.selectedTabs.clear();
        document.querySelectorAll('.tab-tree-node.selected').forEach((el) => {
          el.classList.remove('selected');
        });
        this.updateSelectionToolbar();
      }

      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        this.state.selectedTabs.size > 0
      ) {
        e.preventDefault();
        chrome.tabs.remove(Array.from(this.state.selectedTabs));
        this.state.selectedTabs.clear();
        this.updateSelectionToolbar();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement;
      if (active.closest('input, textarea, [contenteditable=true], .context-menu')) return;

      const rows = this.getFocusableTabRows();
      if (!rows.length) return;

      const key = e.key;
      if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Enter' && key !== 'Home' && key !== 'End') return;

      const currentIndex = rows.indexOf(active);
      let targetIndex = currentIndex;

      if (key === 'ArrowDown') {
        targetIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, rows.length - 1);
      } else if (key === 'ArrowUp') {
        targetIndex = currentIndex <= 0 ? rows.length - 1 : currentIndex - 1;
      } else if (key === 'Home') {
        targetIndex = 0;
      } else if (key === 'End') {
        targetIndex = rows.length - 1;
      } else if (key === 'Enter') {
        if (currentIndex >= 0 && rows[currentIndex]) {
          e.preventDefault();
          this.activateRowTab(rows[currentIndex]);
        }
        return;
      }

      if (targetIndex !== currentIndex || currentIndex < 0) {
        e.preventDefault();
        rows.forEach((r, i) => r.setAttribute('tabindex', i === targetIndex ? '0' : '-1'));
        const target = rows[targetIndex];
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    this.tabsListEl.setAttribute('tabindex', '0');
    this.tabsListEl.addEventListener('focus', () => {
      const rows = this.getFocusableTabRows();
      if (rows.length && !rows.includes(document.activeElement)) {
        const activeRow = this.tabsListEl.querySelector('.tab-item.active, .search-result-tab-row-inner');
        const idx = activeRow ? rows.indexOf(activeRow) : 0;
        const targetIndex = idx >= 0 ? idx : 0;
        rows.forEach((r, i) => r.setAttribute('tabindex', i === targetIndex ? '0' : '-1'));
        rows[targetIndex].focus();
      }
    });

    if (typeof window !== 'undefined') {
      window.updateSelectionToolbar = () => this.updateSelectionToolbar();
    }
  }
}
