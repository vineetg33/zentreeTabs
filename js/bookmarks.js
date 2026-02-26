/**
 * ZenTree Tabs - Bookmarks list (fetch and render).
 */
import { getFaviconUrl } from './utils.js';

export class Bookmarks {
  constructor(listEl) {
    this.listEl = listEl;
  }

  async fetchAndRenderBookmarks() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';

    try {
      const tree = await chrome.bookmarks.getTree();
      if (tree[0].children) {
        tree[0].children.forEach((node) => {
          this.listEl.appendChild(this.createBookmarkNode(node));
        });
      }
    } catch (err) {
      console.error('Failed to load bookmarks', err);
      this.listEl.innerHTML = `<div style="padding:10px; color:var(--text-secondary);">Error loading bookmarks.</div>`;
    }
  }

  createBookmarkNode(node) {
    const isFolder = !node.url;
    const container = document.createElement('div');
    container.className = 'bookmark-node';

    const item = document.createElement('div');
    item.className = `bookmark-item ${isFolder ? 'bookmark-folder' : ''}`;

    if (isFolder) {
      const arrow = document.createElement('div');
      arrow.className = 'folder-arrow';
      arrow.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      item.appendChild(arrow);

      const icon = document.createElement('div');
      icon.className = 'folder-icon';
      icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
      item.appendChild(icon);
    } else {
      const favicon = document.createElement('img');
      favicon.className = 'bookmark-favicon';
      favicon.src = getFaviconUrl({ url: node.url });
      favicon.onerror = () => {
        favicon.src =
          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="%23ccc"><circle cx="7" cy="7" r="7"/></svg>';
      };
      item.appendChild(favicon);
    }

    const title = document.createElement('span');
    title.className = 'bookmark-title';
    title.textContent = node.title || (isFolder ? 'Untitled Folder' : 'Untitled');
    title.style.overflow = 'hidden';
    item.appendChild(title);

    container.appendChild(item);

    if (isFolder) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'bookmark-children';
      if (node.children) {
        node.children.forEach((child) => {
          childrenContainer.appendChild(this.createBookmarkNode(child));
        });
      }
      container.appendChild(childrenContainer);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = childrenContainer.classList.contains('expanded');
        if (isExpanded) {
          childrenContainer.classList.remove('expanded');
          item.querySelector('.folder-arrow').classList.remove('rotated');
        } else {
          childrenContainer.classList.add('expanded');
          item.querySelector('.folder-arrow').classList.add('rotated');
        }
      });
    } else {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const active = e.ctrlKey || e.metaKey ? false : true;
        chrome.tabs.create({ url: node.url, active });
      });

      item.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.stopPropagation();
          e.preventDefault();
          chrome.tabs.create({ url: node.url, active: false });
        }
      });
    }

    return container;
  }
}
