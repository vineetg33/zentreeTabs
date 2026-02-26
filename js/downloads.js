/**
 * ZenTree Tabs - Downloads list (fetch, render, badge, handlers).
 */
export class Downloads {
  constructor(listEl, sectionEl, deps) {
    this.listEl = listEl;
    this.sectionEl = sectionEl;
    this.fetchAndRenderDownloads = this.fetchAndRenderDownloads.bind(this);
    this.handleDownloadChange = this.handleDownloadChange.bind(this);
  }

  formatBytes(bytes, decimals = 1) {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  groupDownloadsByDate(items) {
    const groups = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;

    items.forEach((item) => {
      const d = new Date(item.startTime);
      const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

      let label;
      if (itemDate === today) label = 'Today';
      else if (itemDate === yesterday) label = 'Yesterday';
      else label = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });

    return groups;
  }

  async fetchAndRenderDownloads(query = '') {
    if (typeof query !== 'string') {
      const searchInput = document.getElementById('downloads-search');
      query = searchInput ? searchInput.value : '';
    }

    if (!this.listEl) return;
    this.listEl.innerHTML = '';

    try {
      const searchOptions = {
        limit: 50,
        orderBy: ['-startTime'],
      };
      if (query && typeof query === 'string' && query.trim() !== '') {
        searchOptions.query = [query.trim()];
      }

      const items = await chrome.downloads.search(searchOptions);
      if (items.length === 0) {
        this.listEl.innerHTML = `<div style="padding:20px; color:var(--text-secondary); text-align:center;">${query ? 'No downloads match your search' : 'No recent downloads'}</div>`;
        return;
      }

      const groups = this.groupDownloadsByDate(items);

      for (const [dateLabel, groupItems] of Object.entries(groups)) {
        if (groupItems.length === 0) continue;

        const groupHeader = document.createElement('div');
        groupHeader.className = 'download-group-header';
        groupHeader.textContent = dateLabel;
        this.listEl.appendChild(groupHeader);

        for (const item of groupItems) {
          this.listEl.appendChild(await this.createDownloadNode(item));
        }
      }
    } catch (err) {
      console.error('Failed to load downloads', err);
      this.listEl.innerHTML = `<div style="padding:10px; color:var(--text-secondary);">Error loading downloads.</div>`;
    }
  }

  async createDownloadNode(item) {
    const container = document.createElement('div');
    container.className = 'download-item';
    container.dataset.downloadId = item.id;

    if (item.state === 'in_progress') container.classList.add('in-progress');
    if (item.state === 'interrupted') container.classList.add('interrupted');

    const iconWrap = document.createElement('div');
    iconWrap.className = 'download-icon';
    try {
      const iconUrl = await chrome.downloads.getFileIcon(item.id, { size: 32 });
      const img = document.createElement('img');
      img.src = iconUrl;
      iconWrap.appendChild(img);
    } catch (e) {
      iconWrap.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
    }
    container.appendChild(iconWrap);

    const info = document.createElement('div');
    info.className = 'download-info';

    const name = document.createElement('div');
    name.className = 'download-title';
    const filename = item.filename ? item.filename.split(/[/\\]/).pop() : (item.url ? item.url.split('/').pop() : 'Unknown File');
    name.textContent = filename || 'Download';
    name.title = item.filename || item.url;
    name.onclick = (e) => {
      e.stopPropagation();
      if (item.state === 'complete') chrome.downloads.open(item.id);
    };
    info.appendChild(name);

    const url = document.createElement('div');
    url.className = 'download-url';
    url.textContent = item.url;
    info.appendChild(url);

    const meta = document.createElement('div');
    meta.className = 'download-meta';

    let statusText = '';
    if (item.state === 'in_progress') {
      const received = this.formatBytes(item.bytesReceived || 0);
      const total = item.totalBytes ? this.formatBytes(item.totalBytes) : '?';
      statusText = `<span class="download-status-text in_progress">${received} / ${total}</span>`;
    } else if (item.state === 'complete') {
      const size = this.formatBytes(item.fileSize || item.totalBytes);
      statusText = `<span class="download-status-text complete">${size} • Complete</span>`;
    } else if (item.state === 'interrupted') {
      statusText = `<span class="download-status-text interrupted">Interrupted</span>`;
    }
    meta.innerHTML = statusText;
    info.appendChild(meta);

    if (item.state === 'in_progress' && item.totalBytes) {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'download-progress';
      const progressBar = document.createElement('div');
      progressBar.className = 'download-progress-bar';
      const percent = Math.round((item.bytesReceived / item.totalBytes) * 100);
      progressBar.style.width = `${percent}%`;
      progressContainer.appendChild(progressBar);
      info.appendChild(progressContainer);
    }

    container.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'download-actions';

    const folderBtn = document.createElement('button');
    folderBtn.className = 'download-action-btn';
    folderBtn.title = 'Show in Folder';
    folderBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
    folderBtn.onclick = (e) => {
      e.stopPropagation();
      chrome.downloads.show(item.id);
    };
    actions.appendChild(folderBtn);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'download-action-btn';
    copyBtn.title = 'Copy Download Link';
    copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(item.url);
      const original = copyBtn.innerHTML;
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="green" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => (copyBtn.innerHTML = original), 2000);
    };
    actions.appendChild(copyBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'download-action-btn remove-btn';
    removeBtn.title = 'Remove from List';
    removeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      chrome.downloads.erase({ id: item.id }, () => this.fetchAndRenderDownloads());
    };
    actions.appendChild(removeBtn);

    container.appendChild(actions);

    return container;
  }

  async updateDownloadsBadge() {
    try {
      const items = await chrome.downloads.search({ state: 'in_progress' });
      const badge = document.getElementById('downloads-badge');

      if (!badge) return;

      const count = items.length;
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    } catch (err) {
      console.error('Failed to update downloads badge', err);
    }
  }

  async handleDownloadChange(delta) {
    this.updateDownloadsBadge();

    try {
      const results = await chrome.downloads.search({ id: delta.id });
      if (results.length === 0) return;
      const item = results[0];

      if (!this.sectionEl || this.sectionEl.classList.contains('hidden')) return;

      const downloadItem = document.querySelector(`[data-download-id="${delta.id}"]`);
      if (!downloadItem) {
        this.fetchAndRenderDownloads();
        return;
      }

      const progressBar = downloadItem.querySelector('.download-progress-bar');
      if (progressBar && item.totalBytes && item.state === 'in_progress') {
        const percent = Math.round((item.bytesReceived / item.totalBytes) * 100);
        progressBar.style.width = `${percent}%`;
      }

      const meta = downloadItem.querySelector('.download-meta span');
      if (meta && item.state === 'in_progress') {
        const received = this.formatBytes(item.bytesReceived || 0);
        const total = item.totalBytes ? this.formatBytes(item.totalBytes) : '?';
        const percent = item.totalBytes
          ? Math.round((item.bytesReceived / item.totalBytes) * 100)
          : 0;
        meta.textContent = `${received} / ${total} (${percent}%)`;
      }

      if (
        delta.state &&
        (delta.state.current === 'complete' || delta.state.current === 'interrupted')
      ) {
        this.fetchAndRenderDownloads();
      }
    } catch (err) {
      console.error('Error handling download change:', err);
    }
  }
}
