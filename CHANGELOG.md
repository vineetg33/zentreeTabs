# Changelog

All notable changes to this project will be documented in this file.

---

## [3.1.0] - 2026-02-16

### 🎨 New Theme

- **AMOLED Theme**
  - Pure black (#000000) background optimized for OLED displays
  - Teal accent color (#6fb8ab) for UI elements
  - Automatically forces dark mode regardless of system preference
  - Reduces power consumption on OLED screens
  - Added as 9th theme option in theme selector (sidepanel.html:266)

### 🤖 AI Features Enhancement

- **Configurable Grouping Threshold**
  - Added user-configurable threshold for domain-based auto-grouping
  - Options: 2, 3, 4, or 5 tabs minimum before grouping same-domain tabs
  - Default changed from 3 to 2 (more aggressive grouping)
  - Auto-saves preference to chrome.storage.local
  - New help documentation system with question mark (?) icon
  - Help link opens comprehensive guide: `docs/help.html#grouping-threshold`

### 📋 Enhanced Context Menu

- **New Right-Click Actions**
  - **Duplicate Tab**: Creates a copy of the selected tab
  - **Reload Tab**: Refreshes the current tab
  - **Mute/Unmute Tab**: Toggles audio with dynamic text based on tab state
  
- **UX Improvements**
  - Edge detection: Menu flips position if it would appear off-screen
  - Dynamic mute button updates in real-time when tab audio state changes
  - Smooth transitions and improved visual feedback

### 📁 Files Modified

- `sidepanel.html` - Added AMOLED theme swatch, grouping threshold selector with help link, new context menu
- `style.css` - AMOLED theme CSS variables, context menu styling, help link styling
- `sidepanel.js` - Theme logic updates, threshold persistence (default: 2), context menu handlers, edge detection
- `worker/ai-worker.js` - Threshold integration with AI grouper (default: 2)
- `worker/grouping.js` - Configurable `minAdjacentTabs` parameter (default: 2)
- **NEW FILE**: `docs/help.html` - Comprehensive help documentation page

---

## [2.1.0] - 2024-06-XX

### 🎯 Enhanced Drag & Drop Experience

- **Instant Nesting with Shift Key**
  - Hold **Shift** while dragging for instant nesting (no wait time)
  - Smart detection: Press Shift while already hovering to immediately activate
  - Dynamic indicator shows "Hold Shift for instant nest" or "Nest inside" based on key state

- **Faster Default Nesting**
  - Reduced hover time from 800ms → 400ms (50% faster)
  - More responsive and natural feeling
  - Clearer visual feedback throughout the drag operation

### 🐛 Bug Fixes

- **Drop Indicators**
  - Drop-above and drop-below lines now appear correctly
  - Drop-inside (nesting) highlight now displays as intended

- **Tab Synchronization**
  - Chrome tab positions now sync immediately after drag operations
  - Visual tree structure stays perfectly aligned with actual tab order

### 🔄 Improvements

- Clearer zone detection (top 25% = before, middle 50% = nest, bottom 25% = after)
- Enhanced visual feedback with proper state management
- Smoother transitions between drag states

---

## [2.0.0] - 2024-05-XX

### 🎉 Major Update - Enhanced User Experience & Advanced Features

- Advanced theming system (blur intensity, group color picker, expanded presets, manual light/dark mode)
- Enhanced drag & drop (smooth drag ghost, hover-to-nest, improved drop indicators)
- Tab Groups Manager (dedicated UI, visual controls, enhanced group visualization)
- Download Manager enhancements (progress indicators, better tracking)
- UI/UX revamp (modern design, improved layout, better theme settings, improved feedback)
- Optimized performance, accessibility, and color palette
- Bug fixes for drag-and-drop, persistence, theme switching, and browser compatibility

---

## [1.0.0] - 2024-05-XX

### 🚀 Initial Release

- Vertical tree layout with automatic nesting
- Native Chrome tab group integration
- Intuitive drag & drop for reordering and nesting
- Five premium themes with customization
- Built-in bookmarks and downloads managers
- Robust persistence and smart tab logic

---

**Full changelog available in GitHub releases.**