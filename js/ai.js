/**
 * ZenTree Tabs - AI auto-grouping (worker, capture/restore state, undo).
 */
export class AI {
  constructor(deps) {
    this.refresh = deps.refresh;
    this.aiWorker = null;
    this.preGroupingState = null;
  }

  setupAI() {
    const organizeBtn = document.getElementById('ai-organize-btn');
    const undoBtn = document.getElementById('undo-ai-grouping-btn');
    const statusEl = document.getElementById('ai-status');
    const aiToggle = document.getElementById('ai-enabled-toggle');

    if (!organizeBtn) return;

    chrome.storage.local.get({ aiEnabled: true }, (res) => {
      const enabled = res.aiEnabled;
      if (aiToggle) aiToggle.checked = enabled;
      this.updateAIButtonState(enabled);
    });

    if (aiToggle) {
      aiToggle.addEventListener('change', () => {
        const enabled = aiToggle.checked;
        chrome.storage.local.set({ aiEnabled: enabled });
        this.updateAIButtonState(enabled);
      });
    }

    if (undoBtn) {
      undoBtn.addEventListener('click', async () => {
        if (!this.preGroupingState) return;

        try {
          statusEl.classList.remove('hidden');
          statusEl.classList.add('fade-out');
          requestAnimationFrame(() => {
            statusEl.classList.remove('fade-out');
          });
          statusEl.textContent = 'Undoing AI grouping...';
          statusEl.style.color = '';

          await this.restoreTabState(this.preGroupingState);

          statusEl.textContent = 'Grouping undone!';
          statusEl.style.color = 'green';

          undoBtn.classList.add('hidden');
          this.preGroupingState = null;

          setTimeout(() => {
            statusEl.classList.add('fade-out');
            setTimeout(() => {
              statusEl.classList.add('hidden');
              statusEl.classList.remove('fade-out');
              statusEl.textContent = 'Ready';
              statusEl.style.color = '';
            }, 400);
          }, 2000);

          this.refresh();
        } catch (err) {
          console.error('Undo failed', err);
          statusEl.textContent = 'Undo failed: ' + err.message;
          statusEl.style.color = 'red';
        }
      });
    }

    organizeBtn.addEventListener('click', async () => {
      const { aiEnabled } = await chrome.storage.local.get({ aiEnabled: true });
      if (!aiEnabled) {
        statusEl.classList.remove('hidden');
        statusEl.classList.add('fade-out');
        requestAnimationFrame(() => {
          statusEl.classList.remove('fade-out');
        });
        statusEl.textContent = 'AI features are disabled. Enable in settings.';
        statusEl.style.color = 'orange';
        setTimeout(() => {
          statusEl.classList.add('fade-out');
          setTimeout(() => {
            statusEl.classList.add('hidden');
            statusEl.classList.remove('fade-out');
            statusEl.textContent = 'Ready';
            statusEl.style.color = '';
          }, 400);
        }, 3000);
        return;
      }

      if (!this.aiWorker) {
        this.aiWorker = new Worker('worker/ai-worker.js', { type: 'module' });

        this.aiWorker.onmessage = async (e) => {
          const { type, groups, error } = e.data;

          if (type === 'GROUPS_GENERATED') {
            statusEl.textContent = `Found ${Object.keys(groups).length} groups. Applying...`;

            try {
              for (const [groupName, tabIds] of Object.entries(groups)) {
                if (tabIds.length < 2) continue;

                const groupId = await chrome.tabs.group({ tabIds });
                await chrome.tabGroups.update(groupId, {
                  title: groupName,
                  collapsed: true,
                });
              }

              statusEl.textContent = 'Done!';
              statusEl.style.color = 'green';

              if (undoBtn) undoBtn.classList.remove('hidden');

              setTimeout(() => {
                statusEl.classList.add('fade-out');
                setTimeout(() => {
                  statusEl.classList.add('hidden');
                  statusEl.classList.remove('fade-out');
                  statusEl.textContent = 'Ready';
                  statusEl.style.color = '';
                }, 400);
              }, 3000);

              this.refresh();
            } catch (err) {
              console.error('Grouping failed', err);
              statusEl.textContent = 'Error applying groups.';
              statusEl.style.color = 'red';
            }
          } else if (type === 'ERROR') {
            console.error('AI Worker Error:', error);
            statusEl.textContent = 'AI Error: ' + error;
            statusEl.style.color = 'red';
          }
        };

        this.aiWorker.onerror = (err) => {
          console.error('Worker connection failed', err);
          statusEl.textContent = 'Worker failed to start.';
          statusEl.style.color = 'red';
        };
      }

      statusEl.classList.remove('hidden');
      statusEl.classList.add('fade-out');
      requestAnimationFrame(() => {
        statusEl.classList.remove('fade-out');
      });
      statusEl.textContent = 'Analyzing tabs... (loading model)';
      statusEl.style.color = '';

      const tabs = await chrome.tabs.query({ currentWindow: true });

      this.preGroupingState = await this.captureTabState(tabs);

      const eligibleTabs = tabs.filter((t) => !t.pinned).map((t) => {
        let url = t.url;
        if (url.startsWith('chrome-extension://') && url.includes('suspended.html')) {
          try {
            const urlObj = new URL(url);
            const uri = urlObj.searchParams.get('uri') || urlObj.searchParams.get('url');
            if (uri) {
              url = uri;
            } else {
              const hash = urlObj.hash;
              if (hash.includes('uri=')) {
                const match = hash.match(/uri=([^&]+)/);
                if (match) url = match[1];
              }
            }
          } catch (e) {
            console.warn('Failed to parse suspended URL', url);
          }
        }

        return {
          id: t.id,
          title: t.title,
          url: url,
          favIconUrl: t.favIconUrl,
        };
      });

      if (eligibleTabs.length === 0) {
        statusEl.textContent = 'No eligible tabs to sort.';
        return;
      }

      const { groupingThreshold } = await chrome.storage.local.get({ groupingThreshold: 2 });

      this.aiWorker.postMessage({
        type: 'SORT_TABS',
        tabs: eligibleTabs,
        mode: 'hybrid',
        groupingThreshold,
      });
    });
  }

  updateAIButtonState(enabled) {
    const organizeBtn = document.getElementById('ai-organize-btn');
    if (!organizeBtn) return;

    if (enabled) {
      organizeBtn.classList.remove('hidden');
    } else {
      organizeBtn.classList.add('hidden');
    }
  }

  async captureTabState(tabs) {
    const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

    return {
      tabs: tabs.map((t) => ({
        id: t.id,
        groupId: t.groupId,
        index: t.index,
      })),
      groups: groups.map((g) => ({
        id: g.id,
        title: g.title,
        color: g.color,
        collapsed: g.collapsed,
      })),
    };
  }

  async restoreTabState(state) {
    if (!state) return;

    const currentTabs = await chrome.tabs.query({ currentWindow: true });

    for (const tab of currentTabs) {
      const originalTab = state.tabs.find((t) => t.id === tab.id);
      if (originalTab && originalTab.groupId === -1 && tab.groupId !== -1) {
        await chrome.tabs.ungroup(tab.id);
      }
    }

    const currentGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    const originalGroupIds = new Set(state.groups.map((g) => g.id));

    for (const group of currentGroups) {
      if (!originalGroupIds.has(group.id)) {
        const groupTabs = await chrome.tabs.query({ groupId: group.id });
        if (groupTabs.length > 0) {
          await chrome.tabs.ungroup(groupTabs.map((t) => t.id));
        }
      }
    }
  }
}
