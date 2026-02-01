# AI Grouping Engine - Quick Reference

## 🚀 Quick Start

### Basic Usage

```javascript
// In your extension code
const tabs = await chrome.tabs.query({ currentWindow: true });

// Send to AI worker
aiWorker.postMessage({
    type: 'SORT_TABS',
    tabs: tabs.map(t => ({
        id: t.id,
        title: t.title,
        url: t.url,
        index: t.index,
        openTime: Date.now() // or track actual open time
    }))
});

// Listen for results
aiWorker.addEventListener('message', (event) => {
    if (event.data.type === 'GROUPS_GENERATED') {
        const { groups, ungrouped, debug } = event.data;
        
        // Create Chrome tab groups
        for (const [groupName, tabIds] of Object.entries(groups)) {
            const groupId = await chrome.tabs.group({ tabIds });
            await chrome.tabGroups.update(groupId, { 
                title: groupName,
                color: assignColor(groupName)
            });
        }
    }
});
```

---

## 📊 Configuration Options

### Default Config

```javascript
const grouper = new TabGrouper({
    // Semantic thresholds
    minSimilarity: 0.65,        // Base edge threshold
    cookieThreshold: 0.8,       // High confidence threshold
    minGroupSize: 2,            // Min tabs per group
    minConfidence: 0.60,        // Min group confidence
    
    // Time-based
    sessionGap: 45 * 60 * 1000, // 45 min session split
    proximityWindow: 10,         // Max tab distance
    
    // Weights
    weights: {
        semantic: 0.7,           // 70% semantic
        proximity: 0.3,          // 30% proximity
        time: 0.2                // 20% time
    },
    
    // Domain-first
    domainGrouping: {
        enabled: true,
        minAdjacentTabs: 3,      // Min for domain group
        maxGap: 2                // Max gap between domain tabs
    }
});
```

### Custom Config Examples

```javascript
// More aggressive grouping
const aggressive = new TabGrouper({
    minSimilarity: 0.55,         // Lower threshold
    minGroupSize: 2,
    weights: {
        semantic: 0.8,           // Prioritize semantic
        proximity: 0.2
    }
});

// Conservative grouping
const conservative = new TabGrouper({
    minSimilarity: 0.75,         // Higher threshold
    minGroupSize: 3,             // Larger groups only
    cookieThreshold: 0.85,
    weights: {
        semantic: 0.6,
        proximity: 0.4           // Prioritize proximity
    }
});

// Domain-only grouping
const domainOnly = new TabGrouper({
    domainGrouping: {
        enabled: true,
        minAdjacentTabs: 2,      // More lenient
        maxGap: 3
    },
    minSimilarity: 0.9           // Very high semantic threshold
});
```

---

## 🎯 Key Algorithms

### 1. Cosine Similarity

```javascript
function cosineSimilarity(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] ** 2;
        normB += vecB[i] ** 2;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}
```

### 2. Proximity Score

```javascript
function calculateProximityScore(indexA, indexB) {
    const distance = Math.abs(indexA - indexB);
    if (distance === 0) return 1.0;
    if (distance > 10) return 0.0;
    return Math.exp(-distance / 3); // Exponential decay
}
```

### 3. Combined Score

```javascript
const totalScore = 
    (semanticSim * 0.7) + 
    (proximitySim * 0.3) +
    affinityBoost +
    cookieBoost -
    domainPenalty -
    timePenalty;
```

---

## 🔧 Troubleshooting

### Issue: Groups too large

**Solution:** Increase `minSimilarity` threshold

```javascript
const grouper = new TabGrouper({
    minSimilarity: 0.75  // Was 0.65
});
```

### Issue: Groups too small/fragmented

**Solution:** Decrease `minSimilarity`, increase proximity weight

```javascript
const grouper = new TabGrouper({
    minSimilarity: 0.55,  // Was 0.65
    weights: {
        semantic: 0.6,
        proximity: 0.4     // Was 0.3
    }
});
```

### Issue: Distant tabs grouping together

**Solution:** Increase proximity weight, decrease window

```javascript
const grouper = new TabGrouper({
    proximityWindow: 5,    // Was 10
    weights: {
        semantic: 0.5,
        proximity: 0.5     // Was 0.3
    }
});
```

### Issue: Domain groups not forming

**Solution:** Adjust domain grouping settings

```javascript
const grouper = new TabGrouper({
    domainGrouping: {
        enabled: true,
        minAdjacentTabs: 2,  // Was 3
        maxGap: 3            // Was 2
    }
});
```

---

## 📈 Performance Tips

### 1. Cache Embeddings

```javascript
const embeddingCache = new Map();

function getEmbedding(tab) {
    const key = `${tab.id}-${tab.title}`;
    if (embeddingCache.has(key)) {
        return embeddingCache.get(key);
    }
    const embedding = await computeEmbedding(tab.title);
    embeddingCache.set(key, embedding);
    return embedding;
}
```

### 2. Debounce Grouping

```javascript
let groupingTimeout;
function scheduleGrouping() {
    clearTimeout(groupingTimeout);
    groupingTimeout = setTimeout(() => {
        runAIGrouping();
    }, 1000); // Wait 1s after last tab change
}

chrome.tabs.onCreated.addListener(scheduleGrouping);
chrome.tabs.onUpdated.addListener(scheduleGrouping);
```

### 3. Batch Processing

```javascript
// Process in batches of 50
const BATCH_SIZE = 50;
for (let i = 0; i < tabs.length; i += BATCH_SIZE) {
    const batch = tabs.slice(i, i + BATCH_SIZE);
    const embeddings = await computeEmbeddings(batch);
    // Process batch...
}
```

---

## 🎨 Color Assignment

```javascript
function assignColor(group) {
    // Domain groups
    if (group.type === 'domain') return 'grey';
    
    // By confidence
    if (group.confidence >= 0.85) return 'blue';
    if (group.confidence >= 0.75) return 'green';
    if (group.confidence >= 0.65) return 'yellow';
    
    // By content type
    if (group.debug?.hasReference) return 'purple';
    if (group.debug?.hasExploration) return 'orange';
    
    return 'cyan'; // Default
}
```

---

## 🧪 Testing

### Unit Test Example

```javascript
import { TabGrouper } from './grouping.js';

describe('TabGrouper', () => {
    it('should group similar tabs', () => {
        const tabs = [
            { id: 1, title: 'Chocolate Chip Cookie Recipe', url: 'allrecipes.com', index: 0 },
            { id: 2, title: 'Best Cookie Recipe', url: 'foodnetwork.com', index: 1 },
            { id: 3, title: 'Perfect Cookies', url: 'bakingmad.com', index: 2 }
        ];
        
        const embeddings = [
            [0.1, 0.2, ...], // Similar to tab 2 & 3
            [0.11, 0.21, ...],
            [0.09, 0.19, ...]
        ];
        
        const grouper = new TabGrouper();
        const result = grouper.group(tabs, embeddings);
        
        expect(result.groups.length).toBe(1);
        expect(result.groups[0].members).toEqual([1, 2, 3]);
        expect(result.groups[0].title).toContain('Cookie');
    });
});
```

---

## 📚 API Reference

### `TabGrouper.group(tabs, embeddings)`

**Parameters:**
- `tabs`: Array of tab objects with `{id, title, url, index, openTime}`
- `embeddings`: Array of 384-dim vectors (from all-MiniLM-L6-v2)

**Returns:**
```javascript
{
    groups: [
        {
            id: "grp_123_abc",
            title: "Baking Cookies",
            members: [1, 2, 3],
            confidence: 0.92,
            type: "semantic" | "domain",
            debug: { avgSim, timeSpan, indexSpan, proximity }
        }
    ],
    ungrouped: [4, 5, 6]
}
```

### `TabGrouper.findDomainGroups(tabs)`

**Parameters:**
- `tabs`: Array of enriched tab objects

**Returns:**
- Array of domain-based groups

### `TabGrouper.buildSimilarityGraph(tabs)`

**Parameters:**
- `tabs`: Array of tabs with embeddings

**Returns:**
- Array of edges with `{source, target, weight, debug}`

---

## 🔗 Integration Example

```javascript
// Complete integration
class TabManager {
    constructor() {
        this.worker = new Worker('/worker/ai-worker.js', { type: 'module' });
        this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));
    }
    
    async organizeTabsWithAI() {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        
        this.worker.postMessage({
            type: 'SORT_TABS',
            tabs: tabs.map(t => ({
                id: t.id,
                title: t.title,
                url: t.url,
                index: t.index,
                openTime: t.openTime || Date.now()
            }))
        });
    }
    
    async handleWorkerMessage(event) {
        if (event.data.type === 'GROUPS_GENERATED') {
            const { groups, debug } = event.data;
            
            console.log(`🧠 Created ${debug.totalGroups} groups`);
            
            for (const [name, tabIds] of Object.entries(groups)) {
                const groupId = await chrome.tabs.group({ tabIds });
                await chrome.tabGroups.update(groupId, {
                    title: name,
                    color: this.assignColor(name)
                });
            }
        }
    }
    
    assignColor(groupName) {
        // Your color logic here
        return 'blue';
    }
}

// Usage
const manager = new TabManager();
document.getElementById('ai-organize-btn').addEventListener('click', () => {
    manager.organizeTabsWithAI();
});
```

---

**For full documentation, see [AI_GROUPING_ENGINE.md](./AI_GROUPING_ENGINE.md)**

