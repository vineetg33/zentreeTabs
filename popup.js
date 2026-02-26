(function () {
  const allWindowsEl = document.getElementById("popup-search-all-windows");
  const bookmarksEl = document.getElementById("popup-search-bookmarks");
  const openBtn = document.getElementById("popup-open-side-panel");

  const acrossWindowsEl = document.getElementById("popup-visit-across-windows");

  // Load saved options (same keys as side panel)
  chrome.storage.local.get(
    { searchAllWindows: false, searchBookmarksToo: false, visitOrderAcrossWindows: false },
    (res) => {
      if (allWindowsEl) allWindowsEl.checked = res.searchAllWindows;
      if (bookmarksEl) bookmarksEl.checked = res.searchBookmarksToo;
      if (acrossWindowsEl) acrossWindowsEl.checked = res.visitOrderAcrossWindows === true;
    }
  );

  // Persist when changed
  if (allWindowsEl) {
    allWindowsEl.addEventListener("change", () => {
      chrome.storage.local.set({ searchAllWindows: allWindowsEl.checked });
    });
  }
  if (bookmarksEl) {
    bookmarksEl.addEventListener("change", () => {
      chrome.storage.local.set({ searchBookmarksToo: bookmarksEl.checked });
    });
  }
  if (acrossWindowsEl) {
    acrossWindowsEl.addEventListener("change", () => {
      chrome.storage.local.set({ visitOrderAcrossWindows: acrossWindowsEl.checked });
    });
  }

  // Open side panel (and close popup)
  if (openBtn) {
    openBtn.addEventListener("click", () => {
      chrome.windows.getCurrent((win) => {
        chrome.sidePanel.open({ windowId: win.id }).then(() => {
          window.close();
        }).catch(() => window.close());
      });
    });
  }
})();
