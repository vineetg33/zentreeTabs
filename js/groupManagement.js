/**
 * ZenTree Tabs - Tab groups management (list, rename, color, collapse).
 */
import { getFaviconUrl, mapColor } from './utils.js';

export class GroupManagement {
  constructor(state, deps) {
    this.state = state;
    this.listEl = document.getElementById('groups-list');
    this.fetchAndRenderGroups = this.fetchAndRenderGroups.bind(this);
    this.currentGroupForColorPicker = null;
  }

  async fetchAndRenderGroups() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';

    try {
      const groups = await chrome.tabGroups.query({
        windowId: chrome.windows.WINDOW_ID_CURRENT,
      });

      if (groups.length === 0) {
        this.listEl.innerHTML = `<div style="padding:10px; color:var(--text-secondary); text-align:center;">No tab groups</div>`;
        return;
      }

      const tabs = await chrome.tabs.query({ currentWindow: true });
      const tabsByGroup = new Map();

      tabs.forEach((tab) => {
        if (tab.groupId !== -1) {
          if (!tabsByGroup.has(tab.groupId)) {
            tabsByGroup.set(tab.groupId, []);
          }
          tabsByGroup.get(tab.groupId).push(tab);
        }
      });

      groups.forEach((group) => {
        const groupTabs = tabsByGroup.get(group.id) || [];
        this.listEl.appendChild(this.createGroupManagementNode(group, groupTabs));
      });
    } catch (err) {
      console.error('Failed to load tab groups', err);
      this.listEl.innerHTML = `<div style="padding:10px; color:var(--text-secondary);">Error loading tab groups.</div>`;
    }
  }

  createGroupManagementNode(group, tabs) {
    const container = document.createElement('div');
    container.className = 'group-management-item';

    const header = document.createElement('div');
    header.className = 'group-management-header';

    const colorDot = document.createElement('div');
    colorDot.className = 'group-color-dot';
    colorDot.style.backgroundColor = mapColor(group.color);
    header.appendChild(colorDot);

    const info = document.createElement('div');
    info.className = 'group-management-info';

    const title = document.createElement('div');
    title.className = 'group-management-title';
    title.textContent = group.title || 'Untitled Group';
    info.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'group-management-meta';
    meta.textContent = `${tabs.length} tab${tabs.length !== 1 ? 's' : ''} • ${group.collapsed ? 'Collapsed' : 'Expanded'}`;
    info.appendChild(meta);

    header.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'group-management-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'group-action-btn';
    toggleBtn.title = group.collapsed ? 'Expand Group' : 'Collapse Group';
    toggleBtn.innerHTML = group.collapsed
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    toggleBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await chrome.tabGroups.update(group.id, { collapsed: !group.collapsed });
        this.fetchAndRenderGroups();
      } catch (err) {
        console.error('Failed to toggle group', err);
      }
    });
    actions.appendChild(toggleBtn);

    const renameBtn = document.createElement('button');
    renameBtn.className = 'group-action-btn';
    renameBtn.title = 'Rename Group';
    renameBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>';
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showRenameDialog(group);
    });
    actions.appendChild(renameBtn);

    const colorBtn = document.createElement('button');
    colorBtn.className = 'group-action-btn';
    colorBtn.title = 'Change Color';
    colorBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"></path></svg>';
    colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showColorPicker(group);
    });
    actions.appendChild(colorBtn);

    const ungroupBtn = document.createElement('button');
    ungroupBtn.className = 'group-action-btn';
    ungroupBtn.title = 'Ungroup Tabs';
    ungroupBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    ungroupBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const tabIds = tabs.map((t) => t.id);
        await chrome.tabs.ungroup(tabIds);
        this.fetchAndRenderGroups();
      } catch (err) {
        console.error('Failed to ungroup', err);
      }
    });
    actions.appendChild(ungroupBtn);

    header.appendChild(actions);
    container.appendChild(header);

    header.addEventListener('click', () => {
      const existingList = container.querySelector('.group-tabs-list');
      if (existingList) {
        existingList.remove();
      } else {
        const tabsList = document.createElement('div');
        tabsList.className = 'group-tabs-list';
        tabs.forEach((tab) => {
          const tabItem = document.createElement('div');
          tabItem.className = 'group-tab-item';

          const favicon = document.createElement('img');
          favicon.className = 'tab-favicon';
          favicon.src = getFaviconUrl(tab);
          favicon.onerror = () => {
            favicon.src =
              'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%23ccc"><rect width="16" height="16" rx="2"/></svg>';
          };
          tabItem.appendChild(favicon);

          const tabTitle = document.createElement('span');
          tabTitle.className = 'group-tab-title';
          tabTitle.textContent = tab.title;
          tabItem.appendChild(tabTitle);

          tabItem.addEventListener('click', () => {
            chrome.tabs.update(tab.id, { active: true });
          });

          tabItem.addEventListener('mousedown', (e) => {
            if (e.button === 1) {
              e.stopPropagation();
              e.preventDefault();
              if (this.state.selectedTabs.has(tab.id) && this.state.selectedTabs.size > 1) {
                chrome.tabs.remove(Array.from(this.state.selectedTabs));
                this.state.selectedTabs.clear();
                if (typeof window.updateSelectionToolbar === 'function') window.updateSelectionToolbar();
              } else {
                chrome.tabs.remove(tab.id);
              }
              this.fetchAndRenderGroups();
            }
          });

          tabsList.appendChild(tabItem);
        });
        container.appendChild(tabsList);
      }
    });

    return container;
  }

  showRenameDialog(group) {
    const newTitle = prompt('Enter new group name:', group.title || '');
    if (newTitle !== null) {
      chrome.tabGroups
        .update(group.id, { title: newTitle })
        .then(() => this.fetchAndRenderGroups())
        .catch((err) => console.error('Failed to rename group', err));
    }
  }

  showColorPicker(group) {
    this.currentGroupForColorPicker = group;
    const modal = document.getElementById('color-picker-modal');
    const grid = document.getElementById('color-picker-grid');

    if (!modal || !grid) return;

    const colors = [
      { id: 'grey', name: 'Grey', color: '#bdc1c6' },
      { id: 'blue', name: 'Blue', color: '#8ab4f8' },
      { id: 'red', name: 'Red', color: '#f28b82' },
      { id: 'yellow', name: 'Yellow', color: '#fdd663' },
      { id: 'green', name: 'Green', color: '#81c995' },
      { id: 'pink', name: 'Pink', color: '#ff8bcb' },
      { id: 'purple', name: 'Purple', color: '#c58af9' },
      { id: 'cyan', name: 'Cyan', color: '#78d9ec' },
      { id: 'orange', name: 'Orange', color: '#fcad70' },
    ];

    grid.innerHTML = '';
    colors.forEach((color) => {
      const option = document.createElement('button');
      option.className = 'color-option';
      option.style.background = color.color;
      option.innerHTML = `<span class="color-option-name">${color.name}</span>`;
      option.addEventListener('click', () => {
        this.selectGroupColor(color.id);
      });
      grid.appendChild(option);
    });

    modal.classList.remove('hidden');
    modal.classList.add('fade-out');
    requestAnimationFrame(() => {
      modal.classList.remove('fade-out');
    });
  }

  selectGroupColor(colorId) {
    if (this.currentGroupForColorPicker) {
      chrome.tabGroups
        .update(this.currentGroupForColorPicker.id, { color: colorId })
        .then(() => {
          this.fetchAndRenderGroups();
          this.closeColorPicker();
        })
        .catch((err) => console.error('Failed to change color', err));
    }
  }

  closeColorPicker() {
    const modal = document.getElementById('color-picker-modal');
    if (modal) {
      modal.classList.add('fade-out');
      setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('fade-out');
        this.currentGroupForColorPicker = null;
      }, 250);
    }
  }
}
