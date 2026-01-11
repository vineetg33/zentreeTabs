# Changelog

All notable changes to this project will be documented in this file.

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