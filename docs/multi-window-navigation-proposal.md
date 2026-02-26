# Multi-Window Navigation: UI Proposal

## Goal

Allow users to **see and manage tabs from all windows** in the side panel (not only when searching). Today we have “Search all windows” and “Move to current window” in search; this is about a **main list view** that can show every window’s tabs at once.

---

## Option A: Sticky named window sections (recommended)

**Layout:** One scrollable list, grouped by window. Each group has a **sticky section header** (e.g. “Window 1”, “Window 2”) that stays at the top while you scroll through that window’s tabs, then the next section’s header pushes it away.

**UI sketch:**

```
┌─────────────────────────────────┐
│ [search] [▼] [≡]                │
│ ☐ Nav across  ☐ All windows  …  │
├─────────────────────────────────┤
│ ▾ Window 1 (current)        [5] │  ← sticky header
│   ├ Tab A                      × │
│   ├ Tab B                      × │
│   └ Tab C                      × │
│ ▾ Window 2                  [3] │  ← next sticky header
│   ├ Tab D                      × │
│   └ …                           │
│ ▾ Window 3                  [2] │
│   └ …                           │
└─────────────────────────────────┘
```

**Details:**

- **Naming:** Chrome doesn’t expose window titles. Use **“Window 1”, “Window 2”** by a stable order (e.g. creation/focus order). Optionally mark **(current)** or a dot for the window that owns the side panel.
- **Sticky behavior:** Section header uses `position: sticky; top: 0` so while you scroll within that window’s block, the header stays visible. When the next window’s header reaches the top, it replaces the previous one.
- **Collapse:** Each section header can be **collapsible** (▾/▸). Collapsed state: show a single row “Window 2 (3 tabs)” and hide the tab rows. Persist collapse state per window (e.g. in `storage.local`).
- **Density:** Optional “compact sections” (smaller header, less padding) for users with many windows.

**Pros:** Clear context (“which window is this?”), good for scanning, sticky headers reduce getting lost in long lists, collapse keeps the list manageable.  
**Cons:** More vertical space per window; we only have generic names unless we add heuristics (e.g. “Window with Gmail”).

---

## Option B: Window tabs + single-window body

**Layout:** A **horizontal strip of window pills** at the top (one pill per window). The main area shows **only the selected window’s tree** (same as today’s single-window view).

**UI sketch:**

```
┌─────────────────────────────────┐
│ [search] [▼] [≡]                │
│ [W1] [W2] [W3]  ← window pills  │
├─────────────────────────────────┤
│   Tree for selected window only │
│   ├ Tab A                       │
│   ├ Tab B                       │
└─────────────────────────────────┘
```

**Pros:** Simple, no mixed list, reuse existing tree logic; quick “switch window” without leaving the panel.  
**Cons:** You don’t see other windows’ tabs at once; extra click to switch window.

---

## Option C: Flat list with window badge (no sections)

**Layout:** Single list of all tabs (or one tree per window, stacked). Each row has a small **“Window 2”** (or “W2”) badge. No sticky headers.

**Pros:** Compact, one continuous scroll.  
**Cons:** Harder to scan by window, no collapse, no strong “section” feel.

---

## Recommendation: **Keep sticky named window sections (Option A)**

- **Sticky named window sections** give clear “where am I?” and “which window does this tab belong to?” without reading every badge.
- **Named** (“Window 1”, “Window 2”) is good enough; we can later add heuristics (e.g. “Window 2 (gmail.com)”) if we want.
- **Sticky** keeps the current window label in view while scrolling long lists.
- **Collapsible** sections keep many windows manageable and preserve vertical space when you don’t care about a window.

So: **yes, keep sticky named window sections** as the main multi-window layout, with optional collapse and a clear “current” indicator.

---

## Suggested UI changes (for Option A)

1. **Toggle “Show all windows”**
   - In the same row as “All windows” (search) and “Nav across windows”: add **“Show all windows”** (or “List: current | all windows”).
   - When **off**: current behavior (single-window tree).
   - When **on**: main list becomes “all windows” with sticky section headers.

2. **Section header component**
   - One row per window: left = label “Window N” (+ optional “(current)” or icon), right = tab count; optional collapse chevron.
   - `position: sticky; top: 0; z-index` above tab rows; background so it doesn’t overlap content.
   - Click header: optional “Focus this window” (same as existing “Move to current window” idea but for the whole window).

3. **Per-window tree**
   - Under each header, render that window’s tab tree (same `createTabNode` / nesting logic we use today, but only for that window’s tabs).
   - Existing actions (close, move to current window, nest, etc.) stay; “current window” = window that owns the side panel.

4. **Order of windows**
   - Put **current window first** (the one showing the panel). Then others by a stable order (e.g. `chrome.windows.getAll` order or last-focused).

5. **Persistence**
   - Save “Show all windows” in `storage.local` (like other toggles).
   - Optionally save “collapsed window IDs” so collapse state survives reload.

---

## Summary

| Question | Answer |
|----------|--------|
| How to implement multi-window navigation? | Add a “Show all windows” toggle; when on, main list = sticky **Window 1 / Window 2 / …** sections, each with that window’s tree below. |
| Should we keep sticky named window sections? | **Yes.** Use sticky named window sections (with optional collapse) as the primary multi-window UI for clarity and scannability. |

If you want to proceed, the next step is to implement the “Show all windows” toggle and the sticky section layout (without collapse first), then add collapse and any extra polish.
