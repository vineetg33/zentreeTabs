# ZenTree Tabs

<div align="center">
  <img src="icons/logo.svg" alt="ZenTree Tabs Logo" width="128" />
  <h3>Vertical Tab Manager for Chrome</h3>
  <p>Minimalist. Tree-Style. Native.</p>
</div>

<br />

**ZenTree Tabs** brings vertical, tree-style browsing to the Chrome Side Panel. I built this because I wanted the organizational flow and aesthetic of browsers like Arc, but without leaving the Chrome ecosystem. It features automatic nesting, full support for native Tab Groups, and a clean, glassmorphic UI.

## Demo

<div align="center">
  <img src="demo.gif" alt="ZenTree Tabs Demo" width="100%" />
</div>

## Features

- **Tree Layout**: Tabs automatically nest under the tab they were opened from, keeping your research context linked naturally.
- **Native Group Sync**: Chrome Tab Groups show up as folders. Collapsing a folder in the sidebar collapses the actual group in the top strip (and vice versa).
- **Modern UI**: Designed with a "vibe coding" aesthetic—glassmorphism, smooth hover effects, and full Dark Mode support.
- **Drag & Drop**: Smooth HTML5 drag-and-drop to reorder tabs or change the nesting hierarchy. You can also drag tabs directly into Group Headers.
- **Multi-Select**: Use `Ctrl/Cmd + Click` or `Shift + Click` to select multiple tabs for batch closing or grouping.
- **Utilities**:
  - **Renaming**: Double-click any tab to give it a custom alias (saved locally).
  - **Bookmarks & Downloads**: Manage your bookmarks and track active downloads directly within the panel.
- **Theming**:
  - Comes with 5 themes: Ocean (Default), Sunset, Forest, Berry, and Monochrome.
  - Toggles for "Background Mesh" and "Glassy Tabs" to tweak the look.
- **Smart Icons**: Handles system icons (Settings, History) and Extension pages correctly, so you don't get broken favicons.

## Installation

This extension is currently installed via Developer Mode:

1.  Clone or download this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Toggle **Developer mode** on (top right corner).
4.  Click **Load unpacked**.
5.  Select the folder containing `manifest.json`.
6.  Open the Chrome Side Panel and switch to **ZenTree Tabs**.

## Good to Know

- **New Tabs**: Manually opening a new tab (`Cmd/Ctrl + T`) will always start at the root level to prevent accidental nesting chains.
- **Renaming**: Custom names are stored in local storage, so they won't mess with the actual page title or SEO.
- **Selection**: `Ctrl/Cmd + A` works to select all tabs if you need to clear your workspace quickly.

## Tech Stack

Built with **Vanilla JavaScript**, **CSS3**, and **HTML5**.
- No heavy frameworks or dependencies.
- **Manifest V3** compliant.
- Uses `storage` API to persist collapsed states and custom names.

## License

[MIT](LICENSE)
