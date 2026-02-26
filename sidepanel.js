/**
 * ZenTree Tabs - Side Panel
 * Composes state, storage, tree, search, visitNav, dragDrop, contextMenu,
 * tabEvents, bookmarks, downloads, groupManagement, theme, ai, keyboard.
 */
import { TabTree } from './js/tabTree.js';
import { Search } from './js/search.js';
import { VisitNav } from './js/visitNav.js';
import { DragDrop } from './js/dragDrop.js';
import { ContextMenu } from './js/contextMenu.js';
import { TabEvents } from './js/tabEvents.js';
import { Bookmarks } from './js/bookmarks.js';
import { Downloads } from './js/downloads.js';
import { GroupManagement } from './js/groupManagement.js';
import { Theme } from './js/theme.js';
import { AI } from './js/ai.js';
import { KeyboardNav } from './js/keyboard.js';
import { getFaviconUrl, mapColor } from './js/utils.js';

const tabsListEl = document.getElementById('tabs-list');
const searchInput = document.getElementById('tab-search');

export async function init(state, storage) {
  let refresh;
  const searchDeps = { refresh: () => {}, showContextMenu: () => {} };

  const search = new Search(state, null, tabsListEl, searchInput, searchDeps);

  const treeDeps = {
    getFaviconUrl,
    mapColor,
    searchInput,
    renderFilteredList: search.renderFilteredList.bind(search),
    handleDragStart: null,
    handleDragOver: null,
    handleDrop: null,
    handleDragEnd: null,
    getDraggedTabId: () => null,
    toggleCollapse: null,
    showContextMenu: () => {},
    activateRenameMode: null,
    refresh: () => {},
  };

  const tree = new TabTree(state, storage, tabsListEl, treeDeps);
  search.tree = tree;

  const dragDrop = new DragDrop(state, tree, storage, tabsListEl);

  refresh = () => {
    if (searchInput && searchInput.value.trim()) {
      search.runSearch();
    } else {
      tree.fetchAndRenderTabs();
    }
  };

  treeDeps.refresh = refresh;
  treeDeps.handleDragStart = dragDrop.handleDragStart.bind(dragDrop);
  treeDeps.handleDragOver = dragDrop.handleDragOver.bind(dragDrop);
  treeDeps.handleDrop = dragDrop.handleDrop.bind(dragDrop);
  treeDeps.handleDragEnd = dragDrop.handleDragEnd.bind(dragDrop);
  treeDeps.getDraggedTabId = () => dragDrop.getDraggedTabId();

  async function toggleCollapse(tabId) {
    if (state.collapsedState.has(tabId)) {
      state.collapsedState.delete(tabId);
    } else {
      state.collapsedState.add(tabId);
    }
    await storage.saveCollapsedState(state);
    refresh();
  }
  treeDeps.toggleCollapse = toggleCollapse;

  const contextMenu = new ContextMenu(state, storage, tree, tabsListEl, {
    refresh,
    runSearch: search.runSearch.bind(search),
    searchInput,
  });
  treeDeps.showContextMenu = contextMenu.showContextMenu.bind(contextMenu);
  treeDeps.activateRenameMode = contextMenu.activateRenameMode.bind(contextMenu);
  searchDeps.refresh = refresh;
  searchDeps.showContextMenu = contextMenu.showContextMenu.bind(contextMenu);

  const visitNav = new VisitNav(state, storage, { refresh: () => refresh() });
  visitNav.setup();

  const tabEvents = new TabEvents(state, storage, {
    refresh,
    runSearch: search.runSearch.bind(search),
    searchInput,
    updateVisitNavButtons: visitNav.updateVisitNavButtons,
    contextMenu,
  });

  try {
    await storage.loadVisitHistory(state);
    await storage.loadCollapsedState(state);
    await storage.loadParentOverrides(state);
    await storage.loadCustomTitles(state);
    await tree.fetchAndRenderTabs();
  } catch (err) {
    console.error('ZenTree Init Error:', err);
    document.body.innerHTML = `<div style="padding:20px; color:red;">Error loading tabs:<br>${err.message}</div>`;
    return;
  }

  chrome.tabs.onCreated.addListener((tab) => tabEvents.onTabCreated(tab));
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => tabEvents.onTabUpdated(tabId, changeInfo, tab));
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => tabEvents.onTabRemoved(tabId, removeInfo));
  chrome.tabs.onActivated.addListener((activeInfo) => tabEvents.onTabActivated(activeInfo));
  chrome.tabs.onMoved.addListener(() => tabEvents.onTabMoved());

  chrome.tabGroups.onUpdated.addListener(() => tabEvents.scheduleRender());
  chrome.tabGroups.onCreated.addListener(() => tabEvents.scheduleRender());
  chrome.tabGroups.onRemoved.addListener(() => tabEvents.scheduleRender());
  chrome.tabGroups.onMoved.addListener(() => tabEvents.scheduleRender());

  searchInput.addEventListener('input', () => search.runSearch());

  const searchClearBtn = document.getElementById('search-clear-btn');
  function updateSearchClearVisibility() {
    if (searchClearBtn) {
      if (searchInput && searchInput.value.trim()) {
        searchClearBtn.classList.remove('hidden');
      } else {
        searchClearBtn.classList.add('hidden');
      }
    }
  }
  searchInput.addEventListener('input', updateSearchClearVisibility);
  searchInput.addEventListener('change', updateSearchClearVisibility);
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
        updateSearchClearVisibility();
        search.runSearch();
      }
    });
  }
  updateSearchClearVisibility();
  window.updateSearchClearVisibility = updateSearchClearVisibility;

  chrome.storage.local.get(
    { searchAllWindows: false, searchBookmarksToo: false, visitOrderAcrossWindows: false },
    (res) => {
      state.searchAllWindows = res.searchAllWindows;
      state.searchBookmarksToo = res.searchBookmarksToo ?? false;
      state.visitOrderAcrossWindows = res.visitOrderAcrossWindows === true;

      const searchAllWindowsCheckbox = document.getElementById('search-all-windows');
      if (searchAllWindowsCheckbox) {
        searchAllWindowsCheckbox.checked = state.searchAllWindows;
        searchAllWindowsCheckbox.addEventListener('change', () => {
          state.searchAllWindows = searchAllWindowsCheckbox.checked;
          chrome.storage.local.set({ searchAllWindows: state.searchAllWindows });
          search.runSearch();
        });
      }

      const searchBookmarksCheckbox = document.getElementById('search-bookmarks');
      if (searchBookmarksCheckbox) {
        searchBookmarksCheckbox.checked = state.searchBookmarksToo;
        searchBookmarksCheckbox.addEventListener('change', () => {
          state.searchBookmarksToo = searchBookmarksCheckbox.checked;
          chrome.storage.local.set({ searchBookmarksToo: state.searchBookmarksToo });
          search.runSearch();
        });
      }

      const visitAcrossCheckbox = document.getElementById('visit-across-windows');
      if (visitAcrossCheckbox) {
        visitAcrossCheckbox.checked = state.visitOrderAcrossWindows;
        visitAcrossCheckbox.addEventListener('change', () => {
          state.visitOrderAcrossWindows = visitAcrossCheckbox.checked;
          chrome.storage.local.set({ visitOrderAcrossWindows: state.visitOrderAcrossWindows });
          if (state.visitOrderAcrossWindows) {
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
              if (tab) {
                state.visitOrderGlobal = { order: [tab.id], index: 0 };
                storage.saveVisitHistory(state);
                visitNav.updateVisitNavButtons();
              }
            });
          } else {
            visitNav.updateVisitNavButtons();
          }
        });
      }
    }
  );

  const theme = new Theme();
  const themeSwatches = document.querySelectorAll('.theme-swatch');
  const updateActiveSwatch = (activeTheme) => {
    themeSwatches.forEach((swatch) => {
      if (swatch.dataset.theme === activeTheme) {
        swatch.classList.add('active');
      } else {
        swatch.classList.remove('active');
      }
    });
  };

  if (themeSwatches.length > 0) {
    themeSwatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        const themeName = swatch.dataset.theme;
        updateActiveSwatch(themeName);
        theme.updateThemeSettings({ themeColor: themeName });
      });
    });
  }

  const settingsModal = document.getElementById('settings-modal');
  const settingsBtn = document.getElementById('settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings');
  const settingsVersionEl = document.getElementById('settings-version');

  if (settingsVersionEl) {
    const extensionVersion = chrome?.runtime?.getManifest?.()?.version;
    if (extensionVersion) {
      const versionParts = extensionVersion.split('.');
      while (versionParts.length < 3) versionParts.push('0');
      settingsVersionEl.textContent = `v${versionParts.join('.')}`;
    } else {
      settingsVersionEl.textContent = '';
    }
  }

  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
      chrome.storage.local.get(
        {
          themeSettings: {
            themeColor: 'minimal-blue',
            colorScheme: 'system',
          },
        },
        (res) => {
          const settings = res.themeSettings;
          updateActiveSwatch(settings.themeColor);
          const colorSchemeSelect = document.getElementById('color-scheme-select');
          if (colorSchemeSelect) colorSchemeSelect.value = settings.colorScheme || 'system';
          settingsModal.classList.remove('hidden');
          settingsModal.classList.add('fade-out');
          requestAnimationFrame(() => settingsModal.classList.remove('fade-out'));
        }
      );
    });
  }

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.classList.add('fade-out');
      setTimeout(() => {
        settingsModal.classList.add('hidden');
        settingsModal.classList.remove('fade-out');
      }, 250);
    });
  }

  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.add('fade-out');
        setTimeout(() => {
          settingsModal.classList.add('hidden');
          settingsModal.classList.remove('fade-out');
        }, 250);
      }
    });
  }

  const colorSchemeSelect = document.getElementById('color-scheme-select');
  if (colorSchemeSelect) {
    colorSchemeSelect.addEventListener('change', () => {
      theme.updateThemeSettings({ colorScheme: colorSchemeSelect.value });
    });
  }

  const groupingThresholdSelect = document.getElementById('grouping-threshold-select');
  if (groupingThresholdSelect) {
    chrome.storage.local.get({ groupingThreshold: 2 }, (res) => {
      groupingThresholdSelect.value = res.groupingThreshold;
    });
    groupingThresholdSelect.addEventListener('change', async () => {
      const threshold = parseInt(groupingThresholdSelect.value, 10);
      await chrome.storage.local.set({ groupingThreshold: threshold });
    });
  }

  await theme.applyTheme();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.themeSettings) {
      theme.applyTheme();
    }
  });

  const bookmarks = new Bookmarks(document.getElementById('bookmarks-list'));
  const downloadsSection = document.getElementById('downloads-section');
  const downloads = new Downloads(
    document.getElementById('downloads-list'),
    downloadsSection
  );
  const groupManagement = new GroupManagement(state);

  if (chrome.bookmarks) {
    await bookmarks.fetchAndRenderBookmarks();
  }

  const toggleBookmarksBtn = document.getElementById('toggle-bookmarks-btn');
  const toggleDownloadsBtn = document.getElementById('toggle-downloads-btn');
  const toggleGroupsBtn = document.getElementById('toggle-groups-btn');
  const bookmarksSection = document.getElementById('bookmarks-section');
  const groupsSection = document.getElementById('groups-section');
  const divider = document.querySelector('.section-divider');

  if (bookmarksSection) bookmarksSection.classList.add('hidden');
  if (downloadsSection) downloadsSection.classList.add('hidden');
  if (groupsSection) groupsSection.classList.add('hidden');
  if (divider) divider.classList.add('hidden');

  const sections = {
    bookmarks: { section: bookmarksSection, btn: toggleBookmarksBtn, fetch: () => bookmarks.fetchAndRenderBookmarks() },
    downloads: { section: downloadsSection, btn: toggleDownloadsBtn, fetch: () => downloads.fetchAndRenderDownloads() },
    groups: { section: groupsSection, btn: toggleGroupsBtn, fetch: () => groupManagement.fetchAndRenderGroups() },
  };

  function toggleSection(sectionName) {
    const target = sections[sectionName];
    if (!target || !target.section) return;
    const isCurrentlyHidden = target.section.classList.contains('hidden');

    if (isCurrentlyHidden) {
      Object.values(sections).forEach((s) => {
        if (s.section && !s.section.classList.contains('hidden')) {
          s.section.classList.add('hidden');
        }
        if (s.btn) s.btn.style.color = '';
      });
      target.section.classList.remove('hidden');
      target.section.classList.add('fade-out');
      if (divider) divider.classList.remove('hidden');
      target.btn.style.color = 'var(--accent-color)';
      requestAnimationFrame(() => target.section.classList.remove('fade-out'));
      target.fetch();
    } else {
      target.section.classList.add('fade-out');
      target.btn.style.color = '';
      setTimeout(() => {
        target.section.classList.add('hidden');
        target.section.classList.remove('fade-out');
        const anyVisible = Object.values(sections).some((s) => s.section && !s.section.classList.contains('hidden'));
        if (!anyVisible && divider) divider.classList.add('hidden');
      }, 250);
    }
  }

  if (toggleBookmarksBtn) toggleBookmarksBtn.addEventListener('click', () => toggleSection('bookmarks'));
  if (toggleDownloadsBtn) toggleDownloadsBtn.addEventListener('click', () => toggleSection('downloads'));
  if (toggleGroupsBtn) toggleGroupsBtn.addEventListener('click', () => toggleSection('groups'));

  const closeBookmarksBtn = document.getElementById('close-bookmarks');
  const closeDownloadsBtn = document.getElementById('close-downloads');
  const closeGroupsBtn = document.getElementById('close-groups');
  if (closeBookmarksBtn) closeBookmarksBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSection('bookmarks'); });
  if (closeDownloadsBtn) closeDownloadsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSection('downloads'); });
  if (closeGroupsBtn) closeGroupsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSection('groups'); });

  const refreshDlBtn = document.getElementById('refresh-downloads');
  if (refreshDlBtn) refreshDlBtn.addEventListener('click', () => downloads.fetchAndRenderDownloads());

  const refreshGroupsBtn = document.getElementById('refresh-groups');
  if (refreshGroupsBtn) refreshGroupsBtn.addEventListener('click', () => groupManagement.fetchAndRenderGroups());

  const refreshBookmarksBtn = document.getElementById('refresh-bookmarks');
  if (refreshBookmarksBtn) refreshBookmarksBtn.addEventListener('click', () => bookmarks.fetchAndRenderBookmarks());

  if (chrome.bookmarks) {
    chrome.bookmarks.onCreated.addListener(() => bookmarks.fetchAndRenderBookmarks());
    chrome.bookmarks.onRemoved.addListener(() => bookmarks.fetchAndRenderBookmarks());
    chrome.bookmarks.onChanged.addListener(() => bookmarks.fetchAndRenderBookmarks());
    chrome.bookmarks.onMoved.addListener(() => bookmarks.fetchAndRenderBookmarks());
  }

  if (chrome.downloads) {
    downloads.updateDownloadsBadge();
    chrome.downloads.onChanged.addListener((delta) => downloads.handleDownloadChange(delta));
    chrome.downloads.onCreated.addListener(() => {
      downloads.updateDownloadsBadge();
      if (downloadsSection && !downloadsSection.classList.contains('hidden')) {
        downloads.fetchAndRenderDownloads();
      }
    });
  }

  const dlSearchInput = document.getElementById('downloads-search');
  if (dlSearchInput) {
    dlSearchInput.addEventListener('input', (e) => {
      downloads.fetchAndRenderDownloads(e.target.value);
    });
  }

  const closeColorPickerBtn = document.getElementById('close-color-picker');
  const colorPickerModal = document.getElementById('color-picker-modal');
  if (closeColorPickerBtn) {
    closeColorPickerBtn.addEventListener('click', () => groupManagement.closeColorPicker());
  }
  if (colorPickerModal) {
    colorPickerModal.addEventListener('click', (e) => {
      if (e.target === colorPickerModal) {
        groupManagement.closeColorPicker();
      }
    });
  }

  const keyboard = new KeyboardNav(state, tabsListEl, searchInput, { refresh });
  keyboard.setup();

  const ai = new AI({ refresh });
  ai.setupAI();

  contextMenu.initContextMenu();
}
