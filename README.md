# ZenTree Tabs

<div align="center">
  <img src="icons/logo.svg" alt="ZenTree Tabs Logo" width="128" />
  <h3>Vertical Tree-Style Tab Manager for Chrome</h3>
  <p>Minimalist. Tree-Style. Native.</p>
</div>

<br />


No one has time to switch browsers, because they're too reliant on them *cough Chrome. 

But even those browsers that feature vertical tabs, they don't present them properly. They should be in a tree-style tab, knowing from which main tab other tabs have came from. It becomes so much easier to track that way. 

Which is why I build this: tabs in a vertical layout, nested like branches in a tree. All without switching web browers. 


**ZenTree Tabs**

**ZenTree Tabs** brings vertical, tree-style browsing to the Chrome Side Panel. 

I built this because I wanted the organizational flow and aesthetic of browsers like Arc, but without leaving the Chrome ecosystem. It features automatic nesting, full support for native Tab Groups, and a clean, glassmorphic UI.

## Demo

<div align="center">
  <img src="demo.gif" alt="ZenTree Tabs Demo" width="100%" />
</div>

## Features

- **Tree Layout**: Tabs automatically nest under the tab they were opened from, keeping your research context linked naturally.
  <div align="center">
    <img src="public/nested tabs.png" alt="Nested Tabs Example" width="80%" />
  </div>
- **Native Group Sync**: Chrome Tab Groups show up as folders. Collapsing a folder in the sidebar collapses the actual group in the top strip (and vice versa).
- **Drag & Drop**: Smooth HTML5 drag-and-drop to reorder tabs or change the nesting hierarchy. You can also drag tabs directly into Group Headers.
- **Multi-Select**: Use `Ctrl/Cmd + Click` or `Shift + Click` to select multiple tabs for batch closing or grouping.

- **Utilities**:
  - **Renaming**: Double-click any tab to give it a custom alias (saved locally).
  - **Bookmarks & Downloads**: Manage your bookmarks and track active downloads directly within the panel.
- **Theming**:
  - Comes with 8 themes: Cream (Default), Mist, Sage, Blush, Sand, Lavendar, Seaform, and Stone
  - Toggles for "Background Mesh" and "Glassy Tabs" to tweak the look.
  <div align="center">
    <img src="public/colors.png" alt="Theming Options" width="40%" />
  </div>
- **Smart Icons**: Handles system icons (Settings, History) and Extension pages correctly, so you don't get broken favicons.

## Installation

This extension is currently installed via Developer Mode:

1.  Clone or download this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Toggle **Developer mode** on (top right corner).
4.  Click **Load unpacked**.
5.  Select the folder containing `manifest.json`.
6.  Open the Chrome Side Panel and switch to **ZenTree Tabs**.

Publication to Chrome Web Store is coming soon.

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
