/**
 * ZenTree Tabs - Drag and drop for tab tree (reorder, nest).
 */
export class DragDrop {
  constructor(state, tree, storage, tabsListEl) {
    this.state = state;
    this.tree = tree;
    this.storage = storage;
    this.tabsListEl = tabsListEl;

    this.draggedTabId = null;
    this.draggedElement = null;
    this.dragGhost = null;
    this.lastDropTarget = null;
    this.dragStartY = 0;
    this.dragOffsetY = 0;
    this.hoverTimer = null;
    this.currentHoverTarget = null;
    this.lastNestTargetId = null;
    this.nestingMode = false;
    this.nestIndicator = null;
    this.rafId = null;

  }

  getDraggedTabId() {
    return this.draggedTabId;
  }

  handleDragStart(e) {
    const row = e.currentTarget;
    this.draggedTabId = Number(row.parentNode.dataset.tabId);
    this.draggedElement = row.parentNode;

    if (!this.state.selectedTabs.has(this.draggedTabId)) {
      this.state.selectedTabs.clear();
      this.state.selectedTabs.add(this.draggedTabId);
    }

    const rect = row.getBoundingClientRect();
    this.dragOffsetY = e.clientY - rect.top;
    this.dragStartY = e.clientY;

    this.dragGhost = row.cloneNode(true);
    this.dragGhost.classList.add('drag-ghost');
    this.dragGhost.style.position = 'fixed';
    this.dragGhost.style.left = rect.left + 'px';
    this.dragGhost.style.top = rect.top + 'px';
    this.dragGhost.style.width = rect.width + 'px';
    this.dragGhost.style.pointerEvents = 'none';
    this.dragGhost.style.zIndex = '10000';
    this.dragGhost.style.opacity = '0.9';
    document.body.appendChild(this.dragGhost);

    row.style.opacity = '0.3';
    this.draggedElement.classList.add('dragging');

    document.body.classList.add('dragging-in-progress');

    this.nestIndicator = document.createElement('div');
    this.nestIndicator.className = 'nest-indicator';
    this.nestIndicator.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"></polyline>
      <line x1="4" y1="12" x2="15" y2="12"></line>
    </svg>
    <span id="nest-indicator-text">Hold Shift for instant nest</span>
  `;
    this.nestIndicator.style.position = 'absolute';
    this.nestIndicator.style.pointerEvents = 'none';
    this.nestIndicator.style.zIndex = '101';
    this.nestIndicator.style.display = 'none';
    this.tabsListEl.appendChild(this.nestIndicator);

    e.dataTransfer.effectAllowed = 'move';
    const img = new Image();
    img.src =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);

    document.addEventListener('dragover', this.handleDragOver);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!this.draggedTabId) return;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    this.rafId = requestAnimationFrame(() => {
      if (this.dragGhost) {
        this.dragGhost.style.top = e.clientY - this.dragOffsetY + 'px';
      }

      const containerRect = this.tabsListEl.getBoundingClientRect();
      const cursorY = e.clientY - containerRect.top;

      const isWithinBounds =
        e.clientX >= containerRect.left &&
        e.clientX <= containerRect.right &&
        e.clientY >= containerRect.top &&
        e.clientY <= containerRect.bottom;

      if (!isWithinBounds) {
        if (this.nestIndicator) this.nestIndicator.style.display = 'none';
        this.clearHoverTimer();
        this.nestingMode = false;
        this.lastNestTargetId = null;
        this.currentHoverTarget = null;
        document
          .querySelectorAll(
            '.tab-item.hover-nest, .tab-item.nest-blocked, .tab-item.nest-ready'
          )
          .forEach((el) => {
            el.classList.remove('hover-nest', 'nest-blocked', 'nest-ready');
          });
        this.rafId = null;
        return;
      }

      const afterElement = this.getDragAfterElement(this.tabsListEl, e.clientY);
      const targetElement = afterElement ? afterElement.element : null;

      this.updateDropIndicator(e, targetElement, cursorY, containerRect);
      this.rafId = null;
    });
  }

  updateDropIndicator(e, targetElement, cursorY, containerRect) {
    document
      .querySelectorAll(
        '.tab-item.drop-above, .tab-item.drop-below, .tab-item.drop-inside, .tab-item.hover-nest, .tab-item.nest-blocked'
      )
      .forEach((el) => {
        el.classList.remove(
          'drop-above',
          'drop-below',
          'drop-inside',
          'hover-nest',
          'nest-blocked'
        );
      });

    if (!targetElement) {
      this.clearHoverTimer();
      this.nestingMode = false;
      return;
    }

    const targetTabId = Number(targetElement.dataset.tabId);
    if (targetTabId === this.draggedTabId) {
      this.clearHoverTimer();
      this.nestingMode = false;
      return;
    }

    const targetRow = targetElement.querySelector('.tab-item');
    if (!targetRow) return;

    const rect = targetElement.getBoundingClientRect();
    const elementTop = rect.top - containerRect.top;
    const elementBottom = rect.bottom - containerRect.top;
    const elementHeight = elementBottom - elementTop;
    const topZone = elementTop + elementHeight * 0.35;
    const bottomZone = elementTop + elementHeight * 0.65;

    const draggedSubtree = this.tree.getSubtree(this.draggedTabId);
    const canNest = !draggedSubtree.includes(targetTabId);

    if (cursorY < topZone) {
      this.clearHoverTimer();
      this.nestingMode = false;
      this.lastNestTargetId = null;
      this.currentHoverTarget = null;
      document.querySelectorAll('.tab-item.nest-ready').forEach((el) => {
        el.classList.remove('nest-ready');
      });
      if (this.nestIndicator) this.nestIndicator.style.display = 'none';
      targetRow.classList.add('drop-above');
    } else if (cursorY > bottomZone) {
      this.clearHoverTimer();
      this.nestingMode = false;
      this.lastNestTargetId = null;
      this.currentHoverTarget = null;
      document.querySelectorAll('.tab-item.nest-ready').forEach((el) => {
        el.classList.remove('nest-ready');
      });
      if (this.nestIndicator) this.nestIndicator.style.display = 'none';
      targetRow.classList.add('drop-below');
    } else {
      if (canNest) {
        targetRow.classList.add('hover-nest');
      } else {
        targetRow.classList.add('nest-blocked');
        this.clearHoverTimer();
        this.nestingMode = false;
        this.lastNestTargetId = null;
        if (this.nestIndicator) this.nestIndicator.style.display = 'none';
        return;
      }

      const instantNest = e.shiftKey;
      const nestIndicatorText = document.getElementById('nest-indicator-text');
      if (nestIndicatorText) {
        nestIndicatorText.textContent = instantNest
          ? 'Nest inside'
          : 'Hold Shift for instant nest';
      }

      if (instantNest && this.currentHoverTarget === targetTabId && !this.nestingMode) {
        this.clearHoverTimer();
        this.nestingMode = true;
        this.lastNestTargetId = targetTabId;
        targetRow.classList.add('nest-ready');
        targetRow.classList.add('drop-inside');
        if (this.nestIndicator) {
          const targetRect = targetRow.getBoundingClientRect();
          const cr = this.tabsListEl.getBoundingClientRect();
          this.nestIndicator.style.top =
            targetRect.top - cr.top + targetRect.height / 2 - 15 + 'px';
          this.nestIndicator.style.left =
            targetRect.left - cr.left + targetRect.width / 2 - 60 + 'px';
          this.nestIndicator.style.display = 'flex';
        }
      }

      if (this.currentHoverTarget !== targetTabId) {
        this.clearHoverTimer();
        this.currentHoverTarget = targetTabId;
        const nestDelay = instantNest ? 0 : 120;

        this.hoverTimer = setTimeout(() => {
          this.nestingMode = true;
          this.lastNestTargetId = targetTabId;
          targetRow.classList.add('nest-ready');
          targetRow.classList.add('drop-inside');
          if (this.nestIndicator) {
            const targetRect = targetRow.getBoundingClientRect();
            const cr = this.tabsListEl.getBoundingClientRect();
            this.nestIndicator.style.top =
              targetRect.top - cr.top + targetRect.height / 2 - 15 + 'px';
            this.nestIndicator.style.left =
              targetRect.left - cr.left + targetRect.width / 2 - 60 + 'px';
            this.nestIndicator.style.display = 'flex';
          }
        }, nestDelay);
      }

      if (this.nestingMode) {
        targetRow.classList.add('drop-inside');
        if (this.nestIndicator) {
          const targetRect = targetRow.getBoundingClientRect();
          const cr = this.tabsListEl.getBoundingClientRect();
          this.nestIndicator.style.top =
            targetRect.top - cr.top + targetRect.height / 2 - 15 + 'px';
          this.nestIndicator.style.left =
            targetRect.left - cr.left + targetRect.width / 2 - 60 + 'px';
          this.nestIndicator.style.display = 'flex';
        }
      }
    }
  }

  clearHoverTimer() {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    document
      .querySelectorAll(
        '.tab-item.hover-nest, .tab-item.nest-ready, .tab-item.nest-blocked'
      )
      .forEach((el) => {
        el.classList.remove('hover-nest', 'nest-ready', 'nest-blocked');
      });
    if (this.nestIndicator) {
      this.nestIndicator.style.display = 'none';
    }
  }

  getDragAfterElement(container, y) {
    const draggableElements = [
      ...container.querySelectorAll('.tab-tree-node:not(.dragging)'),
    ];

    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY }
    );
  }

  handleDragEnd(e) {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.clearHoverTimer();

    if (this.dragGhost) {
      this.dragGhost.remove();
      this.dragGhost = null;
    }

    if (this.nestIndicator) {
      this.nestIndicator.remove();
      this.nestIndicator = null;
    }

    if (this.draggedElement) {
      const draggedRow = this.draggedElement.querySelector('.tab-item');
      if (draggedRow) {
        draggedRow.style.opacity = '';
      }
      this.draggedElement.classList.remove('dragging');
      this.draggedElement = null;
    }

    document.querySelectorAll('.tab-item').forEach((el) => {
      el.classList.remove(
        'drag-over',
        'drop-above',
        'drop-inside',
        'drop-below',
        'hover-nest',
        'nest-ready',
        'nest-blocked'
      );
    });

    document.removeEventListener('dragover', this.handleDragOver);
    document.body.classList.remove('dragging-in-progress');

    this.draggedTabId = null;
    this.lastDropTarget = null;
    this.currentHoverTarget = null;
    this.lastNestTargetId = null;
    this.nestingMode = false;
  }

  async handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();

    if (!this.draggedTabId) {
      this.handleDragEnd(e);
      return;
    }

    const afterElement = this.getDragAfterElement(this.tabsListEl, e.clientY);
    const targetElement = afterElement ? afterElement.element : null;

    if (!targetElement) {
      try {
        const allTabs = await chrome.tabs.query({ currentWindow: true });
        const maxIndex = Math.max(...allTabs.map((t) => t.index));
        const draggedTab = this.state.tabsMap.get(this.draggedTabId);
        if (draggedTab && draggedTab.index < maxIndex) {
          await chrome.tabs.move(this.draggedTabId, { index: maxIndex });
          this.state.parentOverrides.set(this.draggedTabId, -1);
          await this.storage.saveParentOverrides(this.state);
        }
      } catch (err) {
        console.error('Move failed', err);
      }
      this.handleDragEnd(e);
      return;
    }

    const targetTabId = Number(targetElement.dataset.tabId);
    if (targetTabId === this.draggedTabId) {
      this.handleDragEnd(e);
      return;
    }

    const effectiveTargetId =
      this.nestingMode && this.lastNestTargetId != null
        ? this.lastNestTargetId
        : targetTabId;
    const effectiveTargetEl =
      this.lastNestTargetId != null && this.nestingMode
        ? this.tabsListEl.querySelector(
            `.tab-tree-node[data-tab-id="${this.lastNestTargetId}"]`
          )
        : targetElement;

    if (this.nestingMode && this.lastNestTargetId != null) {
      const draggedSubtree = this.tree.getSubtree(this.draggedTabId);
      if (!draggedSubtree.includes(effectiveTargetId)) {
        await this.tree.moveTabTree(this.draggedTabId, effectiveTargetId, 'nest');
      }
      this.handleDragEnd(e);
      return;
    }

    const rect = effectiveTargetEl
      ? effectiveTargetEl.getBoundingClientRect()
      : targetElement.getBoundingClientRect();
    const containerRect = this.tabsListEl.getBoundingClientRect();
    const y = e.clientY - containerRect.top;
    const elementTop = rect.top - containerRect.top;
    const elementBottom = rect.bottom - containerRect.top;
    const elementHeight = elementBottom - elementTop;
    const topZone = elementTop + elementHeight * 0.35;
    const bottomZone = elementTop + elementHeight * 0.65;

    let action;
    if (y < topZone) {
      action = 'before';
    } else if (y > bottomZone) {
      action = 'after';
    } else {
      action = 'nest';
    }

    await this.tree.moveTabTree(this.draggedTabId, effectiveTargetId, action);
    this.handleDragEnd(e);
  }
}
