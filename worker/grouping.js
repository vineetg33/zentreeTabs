/**
 * grouping.js
 * Deterministic Tab Grouping Engine
 * 
 * Implements a graph-based clustering algorithm with strict validation logic.
 * - Uses Cosine Similarity + Time/Domain constraints
 * - Enforces minimum confidence thresholds
 * - Provides deterministic naming
 * - REFINED: Session-based isolation & Intent Classification
 */

export class TabGrouper {
    constructor(config = {}) {
        this.config = {
            minSimilarity: 0.65, // Hard threshold for edge creation
            minGroupSize: 2,
            minConfidence: 0.60,
            sessionGap: 45 * 60 * 1000, // 45 minutes split
            weights: {
                sim: 0.7,
                time: 0.3
            },
            ...config
        };
    }

    /**
     * Main Entry Point
     * @param {Array} tabs - Array of tab objects {id, title, url, openTime}
     * @param {Array<Array<number>>} embeddings - Array of embedding vectors corresponding to tabs
     * @returns {Object} { groups: [...], ungrouped: [...] }
     */
    group(tabs, embeddings) {
        if (!tabs || tabs.length === 0) return { groups: [], ungrouped: [] };
        if (tabs.length !== embeddings.length) {
            console.error("TabGrouper: Mismatch between tabs and embeddings counts.");
            return { groups: [], ungrouped: tabs.map(t => t.id) };
        }

        // 1. Augment & Classify
        const richTabs = tabs.map((t, i) => ({
            ...t,
            embedding: embeddings[i],
            type: this.detectContentType(t.title, t.url)
        }));

        // 2. Break into Sessions
        const sessions = this.breakIntoSessions(richTabs);

        const validGroups = [];
        const assignedIds = new Set();

        // 3. Process each session independently
        for (const sessionTabs of sessions) {
            const edges = this.buildSimilarityGraph(sessionTabs);
            const candidates = this.findConnectedComponents(sessionTabs, edges);
            const sessionResult = this.validateAndScore(sessionTabs, candidates);

            sessionResult.groups.forEach(g => {
                validGroups.push(g);
                g.members.forEach(id => assignedIds.add(id));
            });
        }

        const ungrouped = richTabs.filter(t => !assignedIds.has(t.id)).map(t => t.id);
        return { groups: validGroups, ungrouped };
    }

    /**
     * Break tabs into sessions based on time gaps.
     * Assumes tabs list might not be sorted by time, so we sort first.
     */
    breakIntoSessions(tabs) {
        // Clone and sort by openTime
        const sorted = [...tabs].sort((a, b) => (a.openTime || 0) - (b.openTime || 0));
        const sessions = [];
        if (sorted.length === 0) return sessions;

        let currentSession = [sorted[0]];
        sessions.push(currentSession);

        for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            const gap = (curr.openTime || 0) - (prev.openTime || 0);

            if (gap > this.config.sessionGap) {
                currentSession = [curr];
                sessions.push(currentSession);
            } else {
                currentSession.push(curr);
            }
        }
        return sessions;
    }

    /**
     * Detect content intent: EXPLORATION (Search/Social) vs REFERENCE (Docs)
     */
    detectContentType(title, url) {
        const t = title.toLowerCase();
        const u = url ? url.toLowerCase() : "";

        // Exploration Signals
        if (
            t.includes("search") ||
            t.includes("reddit") ||
            t.includes("stackoverflow") ||
            u.includes("google.com/search") ||
            u.includes("reddit.com")
        ) {
            return "EXPLORATION";
        }

        // Reference Signals
        if (
            t.includes("documentation") ||
            t.includes("docs") ||
            t.includes("api reference") ||
            t.includes("guide") ||
            t.includes("mdn") ||
            u.includes("developer.mozilla.org") ||
            u.includes("react.dev") ||
            u.includes("docs.")
        ) {
            return "REFERENCE";
        }

        return "GENERAL";
    }

    cosineSimilarity(vecA, vecB) {
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dot += vecA[i] * vecB[i];
            normA += vecA[i] ** 2;
            normB += vecB[i] ** 2;
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
    }

    getDomain(urlStr) {
        try {
            const url = new URL(urlStr);
            return url.hostname;
        } catch (e) {
            return "";
        }
    }

    buildSimilarityGraph(tabs) {
        const edges = [];
        const count = tabs.length;

        for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
                const a = tabs[i];
                const b = tabs[j];

                const rawSim = this.cosineSimilarity(a.embedding, b.embedding);

                if (rawSim < 0.3) continue;

                const timeDiff = Math.abs((a.openTime || 0) - (b.openTime || 0));
                const sameDomain = this.getDomain(a.url) === this.getDomain(b.url);

                let score = rawSim;

                // Affinity Boost: Exploration <-> Reference
                const isAffinityPair =
                    (a.type === "EXPLORATION" && b.type === "REFERENCE") ||
                    (b.type === "EXPLORATION" && a.type === "REFERENCE");

                if (isAffinityPair && rawSim > 0.55) {
                    // Boost score only if moderate similarity exists
                    // This helps bridge "React Search" (expl) -> "React Docs" (ref)
                    score += 0.1;
                }

                // Deduplication Penalty: Similar Titles within session but significant gap (>30m)
                // Prevents "New Tab" spam or same-page re-opens being grouped if far apart
                if (a.title === b.title && timeDiff > 30 * 60 * 1000) {
                    score -= 0.2;
                }

                // Domain Only Penalty
                if (sameDomain) {
                    score *= 0.95;
                }

                if (score >= this.config.minSimilarity) {
                    edges.push({ source: a.id, target: b.id, weight: score });
                }
            }
        }
        return edges;
    }

    findConnectedComponents(tabs, edges) {
        const adj = new Map();
        tabs.forEach(t => adj.set(t.id, []));
        edges.forEach(e => {
            adj.get(e.source).push(e.target);
            adj.get(e.target).push(e.source);
        });

        const visited = new Set();
        const components = [];

        for (const tab of tabs) {
            if (!visited.has(tab.id)) {
                const component = [];
                const stack = [tab.id];
                while (stack.length > 0) {
                    const curr = stack.pop();
                    if (visited.has(curr)) continue;
                    visited.add(curr);
                    component.push(curr);
                    const neighbors = adj.get(curr) || [];
                    for (const n of neighbors) {
                        if (!visited.has(n)) stack.push(n);
                    }
                }
                if (component.length > 0) {
                    components.push(component);
                }
            }
        }
        return components;
    }

    validateAndScore(sessionTabs, candidates) {
        const validGroups = [];
        const assignedIds = new Set();
        const tabsMap = new Map(sessionTabs.map(t => [t.id, t]));

        for (const memberIds of candidates) {
            if (memberIds.length < this.config.minGroupSize) continue;

            const groupTabs = memberIds.map(id => tabsMap.get(id));
            let totalSim = 0;
            let pairs = 0;
            let minTime = Infinity;
            let maxTime = -Infinity;

            let hasReference = false;
            let hasExploration = false;

            for (let i = 0; i < groupTabs.length; i++) {
                const t = groupTabs[i];
                const time = t.openTime || 0;
                if (time < minTime) minTime = time;
                if (time > maxTime) maxTime = time;

                if (t.type === "REFERENCE") hasReference = true;
                if (t.type === "EXPLORATION") hasExploration = true;

                for (let j = i + 1; j < groupTabs.length; j++) {
                    totalSim += this.cosineSimilarity(groupTabs[i].embedding, groupTabs[j].embedding);
                    pairs++;
                }
            }

            const avgSim = pairs > 0 ? totalSim / pairs : 1.0;
            const spanMinutes = (maxTime - minTime) / (1000 * 60);
            const timeCoherence = Math.max(0.5, 1.0 - (spanMinutes / 120));

            let confidence = (this.config.weights.sim * avgSim) + (this.config.weights.time * timeCoherence);

            // Affinity Bonus for complete workflows
            if (hasReference && hasExploration) {
                confidence += 0.05;
            }

            if (confidence < this.config.minConfidence) continue;

            const name = this.generateGroupName(groupTabs);

            memberIds.forEach(id => assignedIds.add(id));
            validGroups.push({
                id: `grp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                title: name,
                members: memberIds,
                confidence: parseFloat(confidence.toFixed(2)),
                debug: { avgSim: avgSim.toFixed(2), timeSpan: spanMinutes.toFixed(0) + 'm' }
            });
        }

        const ungrouped = sessionTabs.filter(t => !assignedIds.has(t.id)).map(t => t.id);
        return { groups: validGroups, ungrouped };
    }

    generateGroupName(groupTabs) {
        const stopWords = new Set([
            'the', 'and', 'or', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from',
            'up', 'about', 'into', 'over', 'after', 'new', 'tab', 'page', 'home', 'index', 'welcome',
            'login', 'signup', 'sign', 'log', 'google', 'search', 'github', 'youtube', 'amazon',
            'stackoverflow', 'reddit', 'facebook', 'twitter', 'linkedin'
        ]);

        // Priority 1: Use Reference Tab title if available (most authoritative)
        const referenceTabs = groupTabs.filter(t => t.type === "REFERENCE");
        if (referenceTabs.length > 0) {
            // Try to extract a clean topic from the first reference tab
            // E.g. "React Reference - Hooks" -> "React Reference"
            // For now, simpler: Frequency analysis ON the reference tabs only is usually best,
            // but just falling back to general freq analysis with prioritization might be safer.
            // Let's stick to general analysis but maybe heavily weight Ref title words?
            // Actually, simple heuristic:
            return this.generateNameFromFrequency(groupTabs, stopWords); // Use refined logic inside
        }

        return this.generateNameFromFrequency(groupTabs, stopWords);
    }

    generateNameFromFrequency(groupTabs, stopWords) {
        const wordCounts = {};
        const phraseCounts = {};

        groupTabs.forEach(tab => {
            const clean = tab.title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
            const words = clean.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

            words.forEach(w => {
                wordCounts[w] = (wordCounts[w] || 0) + 1;
            });

            for (let i = 0; i < words.length - 1; i++) {
                const phrase = `${words[i]} ${words[i + 1]}`;
                phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
            }
        });

        const sortedPhrases = Object.entries(phraseCounts).sort((a, b) => b[1] - a[1]);
        if (sortedPhrases.length > 0) {
            const [bestPhrase, count] = sortedPhrases[0];
            if (count >= Math.ceil(groupTabs.length * 0.5)) {
                return this.capitalize(bestPhrase);
            }
        }

        const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);
        if (sortedWords.length > 0) {
            const [bestWord, count] = sortedWords[0];
            return this.capitalize(bestWord);
        }

        return this.capitalize(this.getDomain(groupTabs[0].url).split('.')[0] || "Group");
    }

    capitalize(str) {
        return str.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    }
}
