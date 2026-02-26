/**
 * ZenTree Tabs - Tab State
 * Single source of truth for tab/tree/selection and visit state.
 */
export class TabState {
  constructor() {
    this.tabsMap = new Map();
    this.rootTabs = [];
    this.groupBuckets = new Map();
    this.collapsedState = new Set();
    this.parentOverrides = new Map();
    this.customTitles = new Map();
    this.pendingScrollTabId = null;
    this.selectedTabs = new Set();
    this.lastClickedTabId = null;
    this.isInitialRender = true;

    this.visitHistoryByWindow = Object.create(null);
    this.visitOrderGlobal = { order: [], index: -1 };
    this.navigatingByArrows = false;
    this.visitOrderAcrossWindows = false;

    this.searchAllWindows = false;
    this.searchBookmarksToo = false;
  }
}
