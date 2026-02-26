/**
 * ZenTree Tabs - Tab Tree
 * Builds and renders the tab tree; depends on state, storage, and injected callbacks.
 */
import { getFaviconUrl, mapColor } from './utils.js';

export class TabTree {
  constructor(state, storage, tabsListEl, deps) {
    this.state = state;
    this.storage = storage;
    this.tabsListEl = tabsListEl;
    this.deps = deps;
  }

  async fetchAndRenderTabs() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const groups = await chrome.tabGroups.query({
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    });
    const groupsMap = new Map();
    groups.forEach((g) => groupsMap.set(g.id, g));
    this.buildTree(tabs, groupsMap);
    this.renderTree(groupsMap);
  }

  buildTree(tabs, groupsMap) {
    const state = this.state;
    const storage = this.storage;
    state.tabsMap.clear();
    state.groupBuckets.clear();
    state.rootTabs = [];

    for (const groupId of groupsMap.keys()) {
      state.groupBuckets.set(groupId, []);
    }

    tabs.forEach((tab) => state.tabsMap.set(tab.id, { ...tab, children: [] }));

    let overridesChanged = false;

    tabs.forEach((tab) => {
      const inGroup = tab.groupId !== -1;
      const effectiveUrl = tab.pendingUrl || tab.url;
      const isNewTab =
        effectiveUrl === "chrome://newtab/" || effectiveUrl === "edge://newtab/";

      let parentId = state.parentOverrides.get(tab.id);

      if (parentId === undefined) {
        if (isNewTab) {
          state.parentOverrides.set(tab.id, -1);
          overridesChanged = true;
          parentId = -1;
        } else if (tab.openerTabId) {
          if (state.tabsMap.has(tab.openerTabId)) {
            parentId = tab.openerTabId;
            state.parentOverrides.set(tab.id, parentId);
            overridesChanged = true;
          }
        }
      }

      if (parentId === -1) parentId = null;

      let placed = false;

      if (parentId && state.tabsMap.has(parentId)) {
        const parent = state.tabsMap.get(parentId);
        if (parent.groupId === tab.groupId) {
          const parentsParentId =
            state.parentOverrides.get(parentId) || parent.openerTabId;
          if (parentsParentId !== tab.id) {
            parent.children.push(tab.id);
            placed = true;
          }
        }
      }

      if (!placed) {
        if (inGroup) {
          if (!state.groupBuckets.has(tab.groupId)) state.groupBuckets.set(tab.groupId, []);
          state.groupBuckets.get(tab.groupId).push(tab.id);
        } else {
          state.rootTabs.push(tab.id);
        }
      }
    });

    if (overridesChanged) {
      storage.saveParentOverrides(state);
    }

    const sortFn = (a, b) => state.tabsMap.get(a).index - state.tabsMap.get(b).index;
    state.rootTabs.sort(sortFn);
    for (const [, roots] of state.groupBuckets) {
      roots.sort(sortFn);
    }
  }

  renderTree(groupsMap) {
    const state = this.state;
    const tabsListEl = this.tabsListEl;
    const savedScrollTop = tabsListEl.scrollTop;
    tabsListEl.innerHTML = "";
    tabsListEl.classList.remove("is-search-results");

    const filterText = this.deps.searchInput ? this.deps.searchInput.value.trim() : "";
    if (filterText) {
      this.deps.renderFilteredList(filterText, savedScrollTop);
      return;
    }

    const elements = [];

    state.rootTabs.forEach((tabId) => {
      elements.push({
        type: "tab",
        index: state.tabsMap.get(tabId).index,
        id: tabId,
      });
    });

    if (groupsMap) {
      for (const [groupId, group] of groupsMap) {
        const bucket = state.groupBuckets.get(groupId);
        if (bucket && bucket.length > 0) {
          const firstTab = state.tabsMap.get(bucket[0]);
          elements.push({
            type: "group",
            index: firstTab ? firstTab.index : 9999,
            id: groupId,
            group: group,
            children: bucket,
          });
        }
      }
    }

    elements.sort((a, b) => a.index - b.index);

    elements.forEach((el) => {
      if (el.type === "tab") {
        tabsListEl.appendChild(this.createTabNode(el.id));
      } else {
        tabsListEl.appendChild(this.createGroupNode(el.group, el.children));
      }
    });

    if (state.pendingScrollTabId) {
      const newTabNode = tabsListEl.querySelector(
        `.tab-tree-node[data-tab-id="${state.pendingScrollTabId}"]`,
      );
      if (newTabNode) {
        const row = newTabNode.querySelector(".tab-item");
        if (row) {
          setTimeout(() => {
            row.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 10);
        }
      }
      state.pendingScrollTabId = null;
    } else if (state.isInitialRender) {
      const activeTabEl = tabsListEl.querySelector(".tab-item.active");
      if (activeTabEl) {
        setTimeout(() => {
          activeTabEl.scrollIntoView({ behavior: "auto", block: "nearest" });
        }, 10);
      }
      state.isInitialRender = false;
    } else {
      tabsListEl.scrollTop = savedScrollTop;
    }
  }

  createGroupNode(group, bucketTabIds) {
    const state = this.state;
    const tabsListEl = this.tabsListEl;
    const getDraggedTabId = this.deps.getDraggedTabId;

    const container = document.createElement("div");
    container.className = "group-node";

    const header = document.createElement("div");
    header.className = "group-header";
    header.style.setProperty("--group-color", mapColor(group.color));

    header.addEventListener("click", async () => {
      try {
        await chrome.tabGroups.update(group.id, { collapsed: !group.collapsed });
      } catch (e) {
        console.error("Failed to toggle group", e);
      }
    });

    header.addEventListener("dragover", (e) => {
      e.preventDefault();
      header.classList.add("drag-over");
      e.dataTransfer.dropEffect = "move";
    });

    header.addEventListener("dragleave", () => {
      header.classList.remove("drag-over");
    });

    header.addEventListener("drop", async (e) => {
      e.preventDefault();
      header.classList.remove("drag-over");
      const draggedTabId = getDraggedTabId ? getDraggedTabId() : null;
      if (draggedTabId) {
        try {
          await chrome.tabs.group({
            tabIds: [draggedTabId],
            groupId: group.id,
          });
        } catch (err) {
          console.error("Failed to add tab to group:", err);
        }
      }
    });

    const arrow = document.createElement("div");
    arrow.className = `expand-arrow ${group.collapsed ? "" : "rotated"}`;
    arrow.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    header.appendChild(arrow);

    const dot = document.createElement("div");
    dot.className = "group-dot";
    header.appendChild(dot);

    const title = document.createElement("span");
    title.className = "group-title";
    title.textContent = group.title || "Untitled Group";
    header.appendChild(title);

    container.appendChild(header);

    const body = document.createElement("div");
    body.className = `group-body ${group.collapsed ? "collapsed" : ""}`;

    if (!group.collapsed) {
      bucketTabIds.forEach((tabId) => {
        body.appendChild(this.createTabNode(tabId, 1));
      });
    }

    container.appendChild(body);
    return container;
  }

  createTabNode(tabId, depth = 0) {
    const state = this.state;
    const tabsListEl = this.tabsListEl;
    const { getFaviconUrl: faviconFn, handleDragStart, handleDragOver, handleDrop, handleDragEnd, toggleCollapse, showContextMenu, activateRenameMode } = this.deps;

    const tab = state.tabsMap.get(tabId);
    if (!tab) return document.createElement("div");

    const container = document.createElement("div");
    container.className = "tab-tree-node";
    container.dataset.tabId = tabId;
    container.dataset.depth = depth;

    const hasChildren = tab.children && tab.children.length > 0;
    const row = document.createElement("div");
    row.className = `tab-item ${tab.active ? "active" : ""} ${hasChildren ? "group-root" : ""}`;
    row.draggable = true;
    row.setAttribute("tabindex", "-1");

    row.style.paddingLeft = "8px";
    row.style.setProperty("--tab-depth", depth);
    if (depth > 0) {
      row.style.marginLeft = (depth * 28) + "px";
    }

    row.addEventListener("dragstart", handleDragStart);
    row.addEventListener("dragover", handleDragOver);
    row.addEventListener("drop", handleDrop);
    row.addEventListener("dragend", handleDragEnd);
    row.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        if (state.selectedTabs.has(tabId)) {
          state.selectedTabs.delete(tabId);
          container.classList.remove("selected");
        } else {
          state.selectedTabs.add(tabId);
          container.classList.add("selected");
        }
        state.lastClickedTabId = tabId;
        if (window.updateSelectionToolbar) window.updateSelectionToolbar();
        return;
      }

      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const allVisibleTabs = Array.from(tabsListEl.querySelectorAll(".tab-tree-node"))
          .map((node) => Number(node.dataset.tabId))
          .filter((id) => !isNaN(id));

        let lastSelectedId;
        if (state.lastClickedTabId && allVisibleTabs.includes(state.lastClickedTabId)) {
          lastSelectedId = state.lastClickedTabId;
        } else if (state.selectedTabs.size > 0) {
          lastSelectedId = Array.from(state.selectedTabs).pop();
        } else {
          const activeTab = Array.from(state.tabsMap.values()).find((t) => t.active);
          if (activeTab && allVisibleTabs.includes(activeTab.id)) {
            lastSelectedId = activeTab.id;
            state.selectedTabs.add(lastSelectedId);
          } else {
            lastSelectedId = allVisibleTabs[0];
          }
        }

        const currentIndex = allVisibleTabs.indexOf(tabId);
        const lastIndex = allVisibleTabs.indexOf(lastSelectedId);
        if (currentIndex !== -1 && lastIndex !== -1) {
          const start = Math.min(currentIndex, lastIndex);
          const end = Math.max(currentIndex, lastIndex);
          for (let i = start; i <= end; i++) {
            const id = allVisibleTabs[i];
            state.selectedTabs.add(id);
            const node = tabsListEl.querySelector(`[data-tab-id="${id}"]`);
            if (node) node.classList.add("selected");
          }
        }
        if (window.updateSelectionToolbar) window.updateSelectionToolbar();
        return;
      }

      state.selectedTabs.clear();
      state.lastClickedTabId = tabId;
      document.querySelectorAll(".tab-tree-node.selected").forEach((el) => el.classList.remove("selected"));
      if (window.updateSelectionToolbar) window.updateSelectionToolbar();
      chrome.tabs.update(tabId, { active: true });
    });

    row.addEventListener("mousedown", (e) => {
      if (e.button === 1) {
        e.stopPropagation();
        e.preventDefault();
        if (state.selectedTabs.has(tabId) && state.selectedTabs.size > 1) {
          chrome.tabs.remove(Array.from(state.selectedTabs));
          state.selectedTabs.clear();
          if (window.updateSelectionToolbar) window.updateSelectionToolbar();
        } else {
          chrome.tabs.remove(tabId);
        }
      }
    });

    const isCollapsed = state.collapsedState.has(tabId);
    const arrow = document.createElement("div");
    arrow.className = `expand-arrow ${hasChildren ? "" : "hidden"}`;
    if (!isCollapsed && hasChildren) {
      arrow.classList.add("rotated");
    }
    arrow.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    arrow.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCollapse(tabId);
    });
    row.appendChild(arrow);

    const favicon = document.createElement("img");
    favicon.className = "tab-favicon";
    favicon.src = faviconFn(tab);
    favicon.onerror = () => {
      favicon.src =
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%23ccc"><rect width="16" height="16" rx="2"/></svg>';
    };
    row.appendChild(favicon);

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = state.customTitles.get(tabId) || tab.title;
    title.title = "Double-click to rename";
    title.ondblclick = (e) => {
      e.stopPropagation();
      activateRenameMode(tabId);
    };
    row.appendChild(title);

    row.addEventListener("contextmenu", (e) => {
      showContextMenu(e, tabId);
    });

    const closeBtn = document.createElement("div");
    closeBtn.className = "close-btn";
    closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (tabsListEl.classList.contains("is-search-results")) {
        chrome.tabs.remove(tabId);
        return;
      }
      if (state.selectedTabs.has(tabId) && state.selectedTabs.size > 1) {
        chrome.tabs.remove(Array.from(state.selectedTabs));
        state.selectedTabs.clear();
        if (window.updateSelectionToolbar) window.updateSelectionToolbar();
      } else {
        chrome.tabs.remove(tabId);
      }
    });
    row.appendChild(closeBtn);

    container.appendChild(row);

    if (state.selectedTabs.has(tabId)) {
      container.classList.add("selected");
    }

    if (hasChildren) {
      const childrenContainer = document.createElement("div");
      childrenContainer.className = `tab-children ${isCollapsed ? "collapsed" : ""}`;
      tab.children.forEach((childId) => {
        childrenContainer.appendChild(this.createTabNode(childId, depth + 1));
      });
      container.appendChild(childrenContainer);
    }

    return container;
  }

  getSubtree(rootId) {
    const state = this.state;
    const results = [rootId];
    const tab = state.tabsMap.get(rootId);
    if (tab && tab.children) {
      for (const childId of tab.children) {
        results.push(...this.getSubtree(childId));
      }
    }
    return results;
  }

  async moveTabTree(sourceId, targetId, action) {
    const state = this.state;
    const storage = this.storage;
    const movingIds = this.getSubtree(sourceId);

    if (movingIds.includes(targetId)) {
      console.warn("Cannot move parent into its own child");
      return;
    }

    await storage.loadParentOverrides(state);

    let newParentId = null;
    let targetIndex = -1;

    const targetTab = state.tabsMap.get(targetId);
    if (!targetTab) return;

    if (action === "nest") {
      newParentId = targetId;
      const targetSubtree = this.getSubtree(targetId);
      const lastDescendantId = targetSubtree[targetSubtree.length - 1];
      const lastDescendant = state.tabsMap.get(lastDescendantId);
      targetIndex = lastDescendant.index + 1;
    } else if (action === "before") {
      newParentId = state.parentOverrides.get(targetId);
      if (newParentId === undefined) {
        if (state.rootTabs.includes(targetId)) {
          newParentId = -1;
        } else {
          const targetNode = document.querySelector(
            `.tab-tree-node[data-tab-id="${targetId}"]`,
          );
          const parentNode = targetNode?.parentElement?.closest(".tab-tree-node");
          newParentId = parentNode ? Number(parentNode.dataset.tabId) : -1;
        }
      }
      targetIndex = targetTab.index;
    } else if (action === "after") {
      const targetNode = document.querySelector(
        `.tab-tree-node[data-tab-id="${targetId}"]`,
      );
      const parentNode = targetNode?.parentElement?.closest(".tab-tree-node");
      newParentId = parentNode ? Number(parentNode.dataset.tabId) : -1;

      const targetSubtree = this.getSubtree(targetId);
      const lastDescendantId = targetSubtree[targetSubtree.length - 1];
      const lastDescendant = state.tabsMap.get(lastDescendantId);
      targetIndex = lastDescendant.index + 1;
    }

    if (newParentId === -1) {
      state.parentOverrides.set(sourceId, -1);
    } else if (newParentId) {
      state.parentOverrides.set(sourceId, newParentId);
    }

    await storage.saveParentOverrides(state);

    try {
      await chrome.tabs.move(movingIds, { index: targetIndex });
      if (this.deps.refresh) this.deps.refresh();
      else await this.fetchAndRenderTabs();
    } catch (err) {
      console.error("Move failed", err);
      if (this.deps.refresh) this.deps.refresh();
      else await this.fetchAndRenderTabs();
    }
  }
}
