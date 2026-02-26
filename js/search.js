/**
 * ZenTree Tabs - Search
 * Unified search (tabs + bookmarks), filtered list, all-windows search.
 */
import { getFaviconUrl } from './utils.js';

export class Search {
  constructor(state, tree, tabsListEl, searchInput, deps) {
    this.state = state;
    this.tree = tree;
    this.tabsListEl = tabsListEl;
    this.searchInput = searchInput;
    this.refresh = deps.refresh;
    this.showContextMenu = deps.showContextMenu;
  }

  runSearch() {
    const val = this.searchInput ? this.searchInput.value : '';
    if (!val) {
      this.refresh();
      return;
    }
    if (this.state.searchBookmarksToo && chrome.bookmarks) {
      this.fetchAndRenderUnifiedSearch(val);
    } else if (this.state.searchAllWindows) {
      this.fetchAndRenderFilteredAllWindows(val);
    } else {
      this.renderFilteredList(val, this.tabsListEl.scrollTop);
    }
  }

  renderFilteredList(text, savedScrollTop) {
    this.tabsListEl.classList.add('is-search-results');
    const term = text.toLowerCase();
    for (const [id, tab] of this.state.tabsMap) {
      if (
        tab.title.toLowerCase().includes(term) ||
        tab.url.toLowerCase().includes(term)
      ) {
        this.tabsListEl.appendChild(this.tree.createTabNode(id));
      }
    }
    this.tabsListEl.scrollTop = savedScrollTop;
  }

  async fetchAndRenderFilteredAllWindows(term) {
    const allTabs = await chrome.tabs.query({});
    const t = term.toLowerCase();
    const filtered = allTabs.filter(
      (tab) =>
        (tab.title && tab.title.toLowerCase().includes(t)) ||
        (tab.url && tab.url.toLowerCase().includes(t))
    );
    const windows = await chrome.windows.getAll({ populate: false });
    const windowIndexMap = new Map();
    windows.forEach((w, i) => windowIndexMap.set(w.id, i + 1));
    this.renderFilteredListAllWindows(filtered, windowIndexMap);
  }

  renderFilteredListAllWindows(tabs, windowIndexMap) {
    const savedScrollTop = this.tabsListEl.scrollTop;
    this.tabsListEl.innerHTML = '';
    this.tabsListEl.classList.add('is-search-results');

    tabs.forEach((tab) => {
      const windowLabel = windowIndexMap ? `Window ${windowIndexMap.get(tab.windowId) || '?'}` : '';
      const container = document.createElement('div');
      container.className = 'tab-tree-node tab-tree-node-search-all';
      container.dataset.tabId = tab.id;
      container.dataset.windowId = String(tab.windowId);

      const row = document.createElement('div');
      row.className = 'tab-item tab-item-search-all';
      row.setAttribute('tabindex', '-1');

      const favicon = document.createElement('img');
      favicon.className = 'tab-favicon';
      favicon.src = getFaviconUrl(tab);
      favicon.onerror = () => {
        favicon.src =
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%23ccc"><rect width="16" height="16" rx="2"/></svg>';
      };
      row.appendChild(favicon);

      const titleWrap = document.createElement('div');
      titleWrap.className = 'tab-title-wrap';
      const titleEl = document.createElement('span');
      titleEl.className = 'tab-title';
      titleEl.textContent = tab.title || tab.url || '(No title)';
      titleWrap.appendChild(titleEl);
      if (windowLabel) {
        const winBadge = document.createElement('span');
        winBadge.className = 'tab-window-badge';
        winBadge.textContent = windowLabel;
        titleWrap.appendChild(winBadge);
      }
      row.appendChild(titleWrap);

      const closeBtn = document.createElement('div');
      closeBtn.className = 'close-btn';
      closeBtn.title = 'Close tab';
      closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.tabs.remove(tab.id);
      });
      row.appendChild(closeBtn);

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, tab.id);
      });
      row.addEventListener('click', () => {
        chrome.windows.update(tab.windowId, { focused: true }).then(() => {
          chrome.tabs.update(tab.id, { active: true });
        });
      });

      container.appendChild(row);
      this.tabsListEl.appendChild(container);
    });
    this.tabsListEl.scrollTop = savedScrollTop;
  }

  /** Single substring match: query appears in str (case-insensitive). */
  substringMatch(query, str) {
    if (!str || !query) return false;
    return str.toLowerCase().includes(query.toLowerCase().trim());
  }

  /**
   * Bookmark matches when every word in the query appears as a substring
   * in title, url, or path, in any order.
   */
  bookmarkMatchesAllWords(words, b) {
    const haystack = [b.title, b.url, b.path].filter(Boolean).join(' ').toLowerCase();
    return words.every((word) => word && haystack.includes(word));
  }

  flattenBookmarksWithPath(nodes, pathSoFar = []) {
    const results = [];
    if (!nodes || !Array.isArray(nodes)) return results;
    for (const node of nodes) {
      const segment = node.title || (node.url ? 'Untitled' : 'Unnamed folder');
      const path = pathSoFar.concat([segment]);
      if (node.url) {
        results.push({ id: node.id, title: node.title || 'Untitled', url: node.url, path: path.join(' › ') });
      }
      if (node.children && node.children.length) {
        results.push(...this.flattenBookmarksWithPath(node.children, path));
      }
    }
    return results;
  }

  async searchBookmarksBySubstring(query) {
    const tree = await chrome.bookmarks.getTree();
    const root = tree[0];
    const nodes = root.children || [];
    const flat = [];
    for (const node of nodes) {
      flat.push(...this.flattenBookmarksWithPath([node], []));
    }
    const q = query.trim();
    if (q.length < 2) return [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return flat.filter((b) => this.bookmarkMatchesAllWords(words, b));
  }

  async fetchAndRenderUnifiedSearch(term) {
    const query = term.trim();
    if (!query) {
      this.refresh();
      return;
    }
    const q = query.toLowerCase();

    try {
      const tabQuery = this.state.searchAllWindows ? {} : { currentWindow: true };
      const allTabs = await chrome.tabs.query(tabQuery);
      const matchingTabs = allTabs.filter(
        (tab) =>
          (tab.title && tab.title.toLowerCase().includes(q)) ||
          (tab.url && tab.url.toLowerCase().includes(q))
      );

      let matchingBookmarks = [];
      if (chrome.bookmarks) {
        try {
          matchingBookmarks = await this.searchBookmarksBySubstring(query);
        } catch (err) {
          console.warn('Bookmark search failed:', err);
        }
      }

      const tabUrls = new Set(matchingTabs.map((t) => t.url));
      const bookmarksToShow = matchingBookmarks.filter((b) => !tabUrls.has(b.url));

      const windowIndexMap = new Map();
      if (this.state.searchAllWindows && matchingTabs.length) {
        const windows = await chrome.windows.getAll({ populate: false });
        windows.forEach((w, i) => windowIndexMap.set(w.id, i + 1));
      }

      this.renderUnifiedSearchResults(matchingTabs, bookmarksToShow, windowIndexMap);
    } catch (err) {
      console.error('Unified search failed:', err);
      this.refresh();
    }
  }

  renderUnifiedSearchResults(tabResults, bookmarkResults, windowIndexMap) {
    const savedScrollTop = this.tabsListEl.scrollTop;
    this.tabsListEl.innerHTML = '';
    this.tabsListEl.classList.add('is-search-results');

    const addTabRow = (tab) => {
      const windowLabel = this.state.searchAllWindows && windowIndexMap.size ? `Window ${windowIndexMap.get(tab.windowId) || '?'}` : '';
      const container = document.createElement('div');
      container.className = 'search-result-tab-row';
      container.dataset.tabId = String(tab.id);
      container.dataset.windowId = String(tab.windowId);

      const row = document.createElement('div');
      row.className = 'search-result-tab-row-inner';
      row.setAttribute('tabindex', '-1');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;margin:3px 0;cursor:pointer;border-radius:10px;min-height:40px;';
      row.style.backgroundColor = 'var(--hover-bg)';
      row.style.border = '1px solid transparent';

      const favicon = document.createElement('img');
      favicon.setAttribute('width', '16');
      favicon.setAttribute('height', '16');
      favicon.style.flexShrink = '0';
      favicon.src = getFaviconUrl(tab);
      favicon.onerror = () => {
        favicon.src =
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%23666"><rect width="16" height="16" rx="2"/></svg>';
      };
      row.appendChild(favicon);

      const textBlock = document.createElement('div');
      textBlock.style.cssText = 'min-width:0;flex:1;overflow:hidden;display:flex;align-items:center;gap:6px;flex-wrap:wrap;';

      const titleEl = document.createElement('span');
      titleEl.textContent = tab.title || tab.url || '(No title)';
      titleEl.style.cssText = 'font-size:13px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      titleEl.style.color = 'var(--text-primary)';
      textBlock.appendChild(titleEl);
      if (windowLabel) {
        const winBadge = document.createElement('span');
        winBadge.textContent = windowLabel;
        winBadge.style.cssText = 'font-size:10px;padding:2px 6px;border-radius:4px;flex-shrink:0;';
        winBadge.style.backgroundColor = 'rgba(128,128,128,0.15)';
        winBadge.style.color = 'var(--text-secondary)';
        textBlock.appendChild(winBadge);
      }
      row.appendChild(textBlock);

      const closeBtn = document.createElement('div');
      closeBtn.className = 'close-btn';
      closeBtn.title = 'Close tab';
      closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.tabs.remove(tab.id);
      });
      row.appendChild(closeBtn);

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showContextMenu(e, tab.id);
      });
      row.addEventListener('click', () => {
        chrome.windows.update(tab.windowId, { focused: true }).then(() => {
          chrome.tabs.update(tab.id, { active: true });
        });
      });
      row.addEventListener('mouseenter', () => {
        row.style.backgroundColor = 'var(--active-bg)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.backgroundColor = 'var(--hover-bg)';
      });

      container.appendChild(row);
      this.tabsListEl.appendChild(container);
    };

    const addBookmarkRow = (bookmark) => {
      const container = document.createElement('div');
      container.className = 'search-result-bookmark-row';

      const row = document.createElement('div');
      row.className = 'search-result-bookmark-row-inner';
      row.style.cssText = 'display:flex;align-items:flex-start;gap:8px;padding:8px 10px;margin:3px 0;cursor:pointer;border-radius:10px;min-height:44px;';
      row.style.backgroundColor = 'var(--hover-bg)';
      row.style.border = '1px solid transparent';

      const favicon = document.createElement('img');
      favicon.setAttribute('width', '16');
      favicon.setAttribute('height', '16');
      favicon.style.flexShrink = '0';
      favicon.style.marginTop = '2px';
      favicon.src = getFaviconUrl({ url: bookmark.url });
      favicon.onerror = () => {
        favicon.src =
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%23666"><rect width="16" height="16" rx="2"/></svg>';
      };
      row.appendChild(favicon);

      const textBlock = document.createElement('div');
      textBlock.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;overflow:hidden;';

      const titleEl = document.createElement('span');
      titleEl.textContent = bookmark.title || bookmark.url || '(No title)';
      titleEl.style.cssText = 'font-size:13px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      titleEl.style.color = 'var(--text-primary)';
      textBlock.appendChild(titleEl);

      const metaRow = document.createElement('div');
      metaRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10px;';

      const bookmarkBadge = document.createElement('span');
      bookmarkBadge.textContent = 'Bookmark';
      bookmarkBadge.style.cssText = 'padding:2px 6px;border-radius:4px;font-weight:600;';
      bookmarkBadge.style.backgroundColor = 'rgba(var(--accent-rgb, 59, 130, 253), 0.2)';
      bookmarkBadge.style.color = 'var(--accent-color)';
      metaRow.appendChild(bookmarkBadge);

      if (bookmark.path) {
        const pathSpan = document.createElement('span');
        pathSpan.textContent = bookmark.path;
        pathSpan.title = bookmark.path;
        pathSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;';
        pathSpan.style.color = 'var(--text-secondary)';
        metaRow.appendChild(pathSpan);
      }
      textBlock.appendChild(metaRow);
      row.appendChild(textBlock);

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: bookmark.url, active: !e.ctrlKey && !e.metaKey }).then(() => {
          if (this.searchInput) this.searchInput.value = '';
          if (typeof window.updateSearchClearVisibility === 'function') window.updateSearchClearVisibility();
          this.refresh();
        });
      });
      row.addEventListener('mouseenter', () => {
        row.style.backgroundColor = 'var(--active-bg)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.backgroundColor = 'var(--hover-bg)';
      });

      container.appendChild(row);
      this.tabsListEl.appendChild(container);
    };

    tabResults.forEach(addTabRow);
    bookmarkResults.forEach(addBookmarkRow);
    this.tabsListEl.scrollTop = savedScrollTop;
  }
}
