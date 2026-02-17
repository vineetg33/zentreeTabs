# Plan: Custom Tab Context Menu Implementation

## 1. Context Menu UI & Styles
- [x] Add `#tab-context-menu` container to `sidepanel.html`.
- [x] Add glassmorphic styles for `.context-menu` and `.context-menu-item` to `style.css`.
- [x] Ensure styles use existing variables (`--glass-bg`, `--accent-glow`, etc.).

## 2. Core Context Menu Logic
- [x] Implement `initContextMenu()` in `sidepanel.js`.
- [x] Attach `contextmenu` listener to `.tab-item` in `createTabNode`.
- [x] Implement `showContextMenu(e, tabId)` with viewport clamping.
- [x] Implement `hideContextMenu()` on click/scroll.

## 3. "Change Name" Action
- [x] Implement `handleRenameAction(tabId)` that triggers the existing inline rename input.
- [x] Add "Change Name" item to the context menu.

## 4. "Remove from Nested Head" Action
- [x] Implement `handlePromoteAction(tabId)` to move tab to root (`parentOverrides = -1`).
- [x] Ensure children remain attached to the promoted tab.
- [x] Add "Remove from Nested Head" item (conditionally visible if depth > 0).

## 5. "Close Tab" Action
- [x] Implement `handleCloseAction(tabId)` with multi-select support.
- [x] Dynamically update menu text to "Close Tab" or "Close [N] Tabs".
- [x] Add "Close Tab" item to the context menu.

## 6. Final Verification
- [x] Verify all actions work as expected.
- [x] Check for UI regressions.
- [x] Run `lsp_diagnostics`.
