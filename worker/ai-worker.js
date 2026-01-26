// ai-worker.js - Handles AI inference for tab grouping

// Debugging imports
import * as Transformers from '/lib/transformers.js';
console.log('AI Worker: Transformers imported:', Transformers);

// Try to get pipeline from various possible export locations
const pipeline = Transformers.pipeline || (Transformers.default && Transformers.default.pipeline) || (self.transformers && self.transformers.pipeline);
const env = Transformers.env || (Transformers.default && Transformers.default.env) || (self.transformers && self.transformers.env);

// Suppress specific transformers.js warning about content-length
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Unable to determine content-length')) {
    return;
  }
  originalWarn.apply(console, args);
};

// Configuration

// Configure environment to use local WASM files
if (env && env.backends && env.backends.onnx) {
  env.backends.onnx.wasm.wasmPaths = {
    'ort-wasm.wasm': self.location.origin + '/lib/ort-wasm.wasm',
    'ort-wasm-simd.wasm': self.location.origin + '/lib/ort-wasm-simd.wasm'
  };
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
  env.allowLocalModels = false; // Fetch models from Hugging Face Hub
} else {
  console.warn('Transformers environment (env) not found, skipping configuration.');
}

let pipe = null;

self.addEventListener('message', async (event) => {
  const { type, tabs } = event.data;

  if (type === 'SORT_TABS') {
    if (!pipe) {
      if (!pipeline) {
        console.error('Transformers pipeline function not available.');
        self.postMessage({ type: 'ERROR', error: 'AI Library Failed to Load or Initialize.' });
        return;
      }
      try {
        pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L12-v2', {
          progress_callback: (data) => {
            // Only send serializable, necessary data to detailed logs
            if (data.status === 'progress') {
              self.postMessage({
                type: 'MODEL_DOWNLOAD_PROGRESS',
                data: {
                  status: data.status,
                  file: data.file,
                  progress: data.progress, // percentage
                  loaded: data.loaded,
                  total: data.total
                }
              });
            }
          }
        });
      } catch (err) {
        console.error("Failed to load model:", err);
        self.postMessage({ type: 'ERROR', error: "Failed to load AI model: " + err.message });
        return;
      }
    }

    const mode = event.data.mode || 'domain';
    let step = 'init';
    try {
      // Helper to remove branding from title to focus on content
      const cleanTitle = (title) => {
        return title.replace(/\b(Google|GitHub|YouTube|Amazon|Stack Overflow|Reddit|Facebook|Twitter|LinkedIn|ChatGPT|OpenAI|Search)\b/gi, '').trim();
      };

      if (mode === 'hybrid') {
        step = 'hybrid_setup';
        // 1. Calculate embeddings for tabs + anchors
        const anchors = ['Coding', 'Social Media', 'News', 'Shopping', 'Entertainment', 'Finance', 'Travel', 'Cooking', 'Education'];
        const tabInputs = tabs.map(t => cleanTitle(t.title).substring(0, 100));
        const allInputs = [...anchors, ...tabInputs];

        step = 'hybrid_inference';
        const output = await pipe(allInputs, { pooling: 'mean', normalize: true });

        step = 'hybrid_split';
        // Split embeddings
        let anchorEmbeddings = [];
        let tabEmbeddings = [];

        // Manually extract embeddings to avoid potential Tensor.slice/reduce issues
        if (output && output.data && output.dims && output.dims.length === 2) {
          const [numInputs, embeddingDim] = output.dims;
          const flatData = output.data; // Float32Array

          // Helper to get embedding at index i
          const getEmbedding = (index) => {
            const start = index * embeddingDim;
            const end = start + embeddingDim;
            // Array.from or spread to convert subarray to regular array
            return Array.from(flatData.subarray(start, end));
          };

          // Extract Anchor Embeddings
          for (let i = 0; i < anchors.length; i++) {
            anchorEmbeddings.push(getEmbedding(i));
          }

          // Extract Tab Embeddings
          for (let i = 0; i < tabInputs.length; i++) {
            // Tab inputs start after anchors
            tabEmbeddings.push(getEmbedding(anchors.length + i));
          }

        } else if (Array.isArray(output)) {
          // Fallback for array output
          const list = output;
          anchorEmbeddings = list.slice(0, anchors.length);
          tabEmbeddings = list.slice(anchors.length);
        } else {
          throw new Error(`Unexpected output format: type=${typeof output}, dims=${output?.dims}`);
        }

        step = 'hybrid_clustering';
        // 2. Cluster
        const groups = clusterHybrid(tabs, tabEmbeddings, anchors, anchorEmbeddings);
        self.postMessage({ type: 'GROUPS_GENERATED', groups });

      } else if (mode === 'domain') {
        step = 'domain_clustering';
        // Fast path: Cluster by domain logic ONLY
        const groups = clusterByDomain(tabs);
        self.postMessage({ type: 'GROUPS_GENERATED', groups });
      } else {
        step = 'topic_setup';
        // ... existing topic logic ...
        const inputs = tabs.map(t => cleanTitle(t.title).substring(0, 100));

        step = 'topic_inference';
        const output = await pipe(inputs, { pooling: 'mean', normalize: true });

        step = 'topic_clustering';
        const groups = clusterBySemantic(tabs, output.tolist());
        self.postMessage({ type: 'GROUPS_GENERATED', groups });
      }

    } catch (err) {
      console.error(`AI Worker Error at ${step}:`, err);
      self.postMessage({ type: 'ERROR', error: `(${step}) ${err.message}` });
    }
  }
});

function clusterByDomain(tabs) {
  const groups = {};
  for (const tab of tabs) {
    let name = "Other";
    try {
      const url = new URL(tab.url);
      name = url.hostname.replace('www.', '').split('.')[0];
      name = name.charAt(0).toUpperCase() + name.slice(1);
    } catch (e) { }

    if (!groups[name]) groups[name] = [];
    groups[name].push(tab.id);
  }
  return groups;
}

function clusterByTopic(tabs, embeddings) {
  // Redirect to new semantic clustering
  return clusterBySemantic(tabs, embeddings);
}

function clusterBySemantic(tabs, embeddings) {
  const groups = {};
  const threshold = 0.55; // Slightly lower threshold for semantic matching
  const assigned = new Set();

  const similarity = (a, b) => {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  };

  for (let i = 0; i < tabs.length; i++) {
    if (assigned.has(tabs[i].id)) continue;

    const cluster = [tabs[i]]; // Store tab object for naming
    assigned.add(tabs[i].id);
    const center = embeddings[i];

    for (let j = i + 1; j < tabs.length; j++) {
      if (assigned.has(tabs[j].id)) continue;

      if (similarity(center, embeddings[j]) >= threshold) {
        cluster.push(tabs[j]);
        assigned.add(tabs[j].id);
      }
    }

    if (cluster.length > 0) {
      // Find a semantic name
      let name = findSemanticName(cluster);

      // Fallback unique name if needed
      if (groups[name]) {
        name = `${name} (${Object.keys(groups).length + 1})`;
      }

      groups[name] = cluster.map(t => t.id);
    }
  }
  return groups;
}

function clusterHybrid(tabs, tabEmbeddings, anchors, anchorEmbeddings) {
  const groups = {};
  const assigned = new Set();
  const thresholdAnchor = 0.45; // Similarity to assign to anchor
  const thresholdSemantic = 0.55;

  const similarity = (a, b) => a.reduce((sum, val, i) => sum + val * b[i], 0);

  // 1. Assign to Anchors
  for (let i = 0; i < tabs.length; i++) {
    let bestAnchorIdx = -1;
    let bestScore = -1;

    for (let j = 0; j < anchors.length; j++) {
      const score = similarity(tabEmbeddings[i], anchorEmbeddings[j]);
      if (score > bestScore) {
        bestScore = score;
        bestAnchorIdx = j;
      }
    }

    if (bestScore > thresholdAnchor) {
      const anchorName = anchors[bestAnchorIdx];
      if (!groups[anchorName]) groups[anchorName] = [];
      groups[anchorName].push(tabs[i].id);
      assigned.add(tabs[i].id);
    }
  }

  // 2. Cluster remaining tabs Semantically
  const remainingTabs = [];
  const remainingEmbeddings = [];
  for (let i = 0; i < tabs.length; i++) {
    if (!assigned.has(tabs[i].id)) {
      remainingTabs.push(tabs[i]);
      remainingEmbeddings.push(tabEmbeddings[i]);
    }
  }

  // Run semantic clustering on leftovers
  if (remainingTabs.length > 0) {
    // We use a modified semantic cluster that returns detailed Structure to merge
    // Re-implement simplified version here for direct merge
    const tempAssigned = new Set(); // Local to this loop
    for (let i = 0; i < remainingTabs.length; i++) {
      if (tempAssigned.has(remainingTabs[i].id)) continue;

      const cluster = [remainingTabs[i]];
      tempAssigned.add(remainingTabs[i].id);
      const center = remainingEmbeddings[i];

      for (let j = i + 1; j < remainingTabs.length; j++) {
        if (tempAssigned.has(remainingTabs[j].id)) continue;
        if (similarity(center, remainingEmbeddings[j]) >= thresholdSemantic) {
          cluster.push(remainingTabs[j]);
          tempAssigned.add(remainingTabs[j].id);
        }
      }

      if (cluster.length > 1) { // Only form group if > 1 item, otherwise fallback to domain
        const name = findSemanticName(cluster);
        let finalName = name;
        if (groups[finalName]) finalName = `${name} (Ext)`;
        groups[finalName] = cluster.map(t => t.id);
        cluster.forEach(t => assigned.add(t.id));
      }
    }
  }

  // 3. Fallback to Domain for the rest
  const finalLeftovers = tabs.filter(t => !assigned.has(t.id));
  if (finalLeftovers.length > 0) {
    const domainGroups = clusterByDomain(finalLeftovers);
    // Merge domain groups
    for (const [name, ids] of Object.entries(domainGroups)) {
      // If domain group has < 2 items, maybe just leave it ungrouped? 
      // Logic: "for the rest... sorted by website"
      if (ids.length > 1) {
        let finalName = name;
        if (groups[finalName]) finalName = `${name} (Web)`;
        groups[finalName] = ids;
      }
      // If singles, we ignore them (they stay in tab list unguarded)
    }
  }

  return groups;
}

function findSemanticName(clusterTabs) {
  if (clusterTabs.length === 0) return "Group";

  // Stop words to ignore
  const stopWords = new Set([
    'the', 'and', 'or', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'up', 'about', 'into', 'over', 'after',
    'new', 'tab', 'page', 'home', 'index', 'welcome',
    // Platforms/Brands to ignore for topic naming (prefer content words)
    'google', 'search', 'github', 'youtube', 'amazon', 'stackoverflow', 'reddit', 'facebook', 'twitter', 'linkedin', 'chatgpt', 'openai', 'video', 'watch'
  ]);

  const wordCounts = {};

  clusterTabs.forEach(tab => {
    // Normalize title: lowercase, remove special chars
    const words = tab.title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/);
    words.forEach(w => {
      if (w.length > 2 && !stopWords.has(w)) {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      }
    });
  });

  // Convert to array and sort
  const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);

  if (sortedWords.length > 0) {
    // Capitalize the most frequent word
    const bestWord = sortedWords[0][0];
    return bestWord.charAt(0).toUpperCase() + bestWord.slice(1);
  }

  // Fallback if no common words? Use domain of first item
  try {
    const url = new URL(clusterTabs[0].url);
    const domain = url.hostname.replace('www.', '').split('.')[0];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch (e) { return "Group"; }
}
