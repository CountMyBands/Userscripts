// ==UserScript==
// @name         Roblox Charts Revenue
// @namespace    https://github.com/CountMyBands/Userscripts
// @version      2.2
// @description  Adds estimated revenue under each game title on the Roblox charts page
// @author       CountMyBands
// @homepageURL  https://github.com/CountMyBands/Userscripts
// @icon         https://www.roblox.com/favicon.ico
// @match        https://www.roblox.com/charts*
// @match        https://www.roblox.com/discover*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      *
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/CountMyBands/Userscripts/main/revenue.user.js
// @updateURL    https://raw.githubusercontent.com/CountMyBands/Userscripts/main/revenue.user.js
// ==/UserScript==

(function() {
    'use strict';

    console.log("Revenue started.");

    const API_PROVIDER_STORAGE_KEY = "revenueProviderUrl";
    const API_KEY_STORAGE_KEY = "revenueApiKey";
    const SS_PREFIX = "cmb_rev_usd_";       // sessionStorage cache key prefix
    const SS_TTL_MS = 30 * 60 * 1000; // 30 minutes
    const MAX_CONCURRENT = 2;          // max simultaneous API requests
    const CHUNK = 100;                 // universe IDs per request; Worker default max is 100

    function storageGet(key, fallback = "") {
        if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
        try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
    }

    function storageSet(key, value) {
        if (typeof GM_setValue === 'function') { GM_setValue(key, value); return; }
        try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    }

    function normalizeApiKey(value) {
        return typeof value === 'string' ? value.trim() : "";
    }

    function normalizeProviderUrl(value) {
        const raw = typeof value === 'string' ? value.trim() : "";
        if (!raw) return "";

        const withProtocol = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
        try {
            const url = new URL(withProtocol);
            if (url.protocol !== "https:" && url.protocol !== "http:") return "";
            if (!url.pathname || url.pathname === "/") url.pathname = "/metrics/revenue";
            url.search = "";
            url.hash = "";
            return url.toString();
        } catch (e) {
            return "";
        }
    }

    function promptForProvider(existingProvider = "") {
        const value = prompt("Enter revenue API provider URL:", existingProvider);
        const providerUrl = normalizeProviderUrl(value);
        if (!providerUrl) return "";

        storageSet(API_PROVIDER_STORAGE_KEY, providerUrl);
        return providerUrl;
    }

    function promptForApiKey(existingKey = "") {
        const value = prompt("Enter revenue API key:", existingKey);
        const key = normalizeApiKey(value);
        if (!key) return "";

        storageSet(API_KEY_STORAGE_KEY, key);
        return key;
    }

    function getProviderSettings() {
        let providerUrl = normalizeProviderUrl(storageGet(API_PROVIDER_STORAGE_KEY, ""));
        if (!providerUrl) providerUrl = promptForProvider();
        if (!providerUrl) return null;

        let apiKey = normalizeApiKey(storageGet(API_KEY_STORAGE_KEY, ""));
        if (!apiKey) apiKey = promptForApiKey();
        if (!apiKey) return null;

        return { providerUrl, apiKey };
    }

    function registerSettingsMenu() {
        const registerMenu = typeof GM_registerMenuCommand === 'function'
            ? GM_registerMenuCommand
            : (typeof GM !== 'undefined' && GM && typeof GM.registerMenuCommand === 'function') ? GM.registerMenuCommand.bind(GM)
            : null;

        if (!registerMenu) return;

        registerMenu("Set Revenue Provider and API Key", () => {
            const currentProvider = normalizeProviderUrl(storageGet(API_PROVIDER_STORAGE_KEY, ""));
            const currentKey = normalizeApiKey(storageGet(API_KEY_STORAGE_KEY, ""));
            const nextProvider = promptForProvider(currentProvider);
            if (!nextProvider) return;
            const nextKey = promptForApiKey(currentKey);
            if (!nextKey) return;

            revCache.clear();
            pending.clear();
            lastFetchErrorAt = 0;
            document.querySelectorAll('.revenue-overlay').forEach((el) => { el.textContent = '--'; });
            updateRevenueOverlays();
        });
    }

    function revenueApiRequest(universeIds) {
        const settings = getProviderSettings();
        if (!settings) {
            throw new Error('Revenue provider URL and API key are required');
        }

        // The key travels in the x-api-key header, never the URL: keys in
        // URLs leak into history/logs and the provider rejects them.
        const url = new URL(settings.providerUrl);
        url.searchParams.set("universeIds", universeIds.join(','));
        return { url: url.toString(), apiKey: settings.apiKey };
    }

    /*
     * Provider contract:
     *
     * Request:
     *   GET <provider-url>?universeIds=123,456
     *   with header: x-api-key: <key>
     *
     * Response:
     *   {
     *     "ok": true,
     *     "metric": "revenue",
     *     "lastUpdated": "2026-07-02T13:00:00.000Z",
     *     "sourceDate": "2026-07-02",
     *     "count": 1,
     *     "data": [
     *       { "universeId": "123", "revenue": 12345.67 }
     *     ],
     *     "missingUniverseIds": ["456"]
     *   }
     *
     * Only ok, data[].universeId, data[].revenue, and optional
     * missingUniverseIds are required by this script.
     */

    // ===========================
    // 1. Inject Custom CSS
    // ===========================
    const style = document.createElement('style');
    style.innerHTML = `
    /* Ensure thumbnail container is positioned relative (also set by Ranks.js) */
    .game-card-thumb-container {
        position: relative !important;
    }

    /* Revenue overlay - same badge style as the rank overlay, bottom-left corner */
    .revenue-overlay {
        position: absolute;
        bottom: 5px;
        left: 5px;
        background-color: rgba(0, 0, 0, 0.75);
        color: #00e08a;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 4px;
        z-index: 10;
        font-size: 14px;
        box-shadow: 0 0 2px rgba(0,0,0,0.5);
        pointer-events: none; /* let clicks pass through to the game */
        white-space: nowrap;
    }

    .revenue-control-bar {
        margin: 10px 0;
        padding-left: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        box-sizing: border-box;
    }

    .revenue-refresh-button {
        padding: 7px 12px;
        border: 1px solid #777;
        border-radius: 4px;
        background: #191b1f;
        color: #f2f4f5;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.2;
        cursor: pointer;
    }

    .revenue-refresh-button:hover:not(:disabled) {
        background: #24272d;
        border-color: #999;
    }

    .revenue-refresh-button:disabled {
        cursor: default;
        opacity: 0.65;
    }

    `;
    document.head.appendChild(style);
    console.log("Revenue CSS injected.");

    // ===========================
    // 2. Networking (must use GM_xmlhttpRequest - see note below)
    // ===========================
    // The revenue provider is NOT in Roblox's CSP `connect-src` allowlist, so a normal
    // page-context fetch/XHR is blocked by the browser. GM_xmlhttpRequest is performed
    // by the userscript manager (extension), which is exempt from the page's CSP - so
    // this ONLY works when the script runs as a real Tampermonkey/Violentmonkey
    // userscript (with @grant GM_xmlhttpRequest + @connect *), NOT via
    // a page-context injector. If GM is absent we bail loudly instead of spamming CSP
    // errors with a doomed fetch fallback.
    const GM_REQUEST = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest
                     : (typeof GM !== 'undefined' && GM && GM.xmlHttpRequest) ? GM.xmlHttpRequest
                     : null;

    let warnedNoGM = false;
    function warnNoGM() {
        if (warnedNoGM) return;
        warnedNoGM = true;
        console.warn(
            "[Revenue] GM_xmlhttpRequest is unavailable, so requests to the configured revenue provider are " +
            "blocked by Roblox's Content Security Policy. Install this file as a Tampermonkey/" +
            "Violentmonkey userscript (keep the ==UserScript== header with `@grant GM_xmlhttpRequest` " +
            "and `@connect *`) - it cannot work when injected into the page context."
        );
    }

    function gmGet(request) {
        return new Promise((resolve, reject) => {
            GM_REQUEST({
                method: 'GET',
                url: request.url,
                headers: {
                    'Accept': 'application/json',
                    'x-api-key': request.apiKey,
                },
                timeout: 20000,
                onload: (res) => {
                    if (res.status < 200 || res.status >= 300) {
                        reject(new Error('HTTP ' + res.status + ': ' + res.responseText));
                        return;
                    }
                    try { resolve(JSON.parse(res.responseText)); }
                    catch (e) { reject(e); }
                },
                onerror: reject,
                ontimeout: () => reject(new Error('timeout')),
            });
        });
    }

    async function fetchGet(request) {
        const res = await fetch(request.url, {
            method: 'GET',
            headers: { 'Accept': 'application/json', 'x-api-key': request.apiKey },
            credentials: 'omit',
        });

        if (!res.ok) {
            throw new Error('HTTP ' + res.status + ': ' + await res.text());
        }

        return res.json();
    }

    async function apiGet(request) {
        let gmError = null;
        if (GM_REQUEST) {
            try {
                return await gmGet(request);
            } catch (err) {
                gmError = err;
                console.warn('[Revenue] GM request failed, trying fetch fallback:', err);
            }
        } else {
            warnNoGM();
        }

        try {
            return await fetchGet(request);
        } catch (fetchError) {
            if (gmError) {
                throw new Error('Tampermonkey @connect permission needs refresh for the configured revenue provider');
            }
            throw fetchError;
        }
    }

    // Concurrency limiter so batch (and any split) requests don't all fire at once.
    let active = 0;
    const queue = [];
    function pump() {
        while (active < MAX_CONCURRENT && queue.length) {
            const { taskFn, resolve, reject } = queue.shift();
            active++;
            Promise.resolve().then(taskFn).then(resolve, reject)
                .finally(() => { active--; pump(); });
        }
    }
    function limited(taskFn) {
        return new Promise((resolve, reject) => {
            queue.push({ taskFn, resolve, reject });
            pump();
        });
    }

    // ===========================
    // 3. Revenue fetching + caching
    // ===========================
    // The configured provider serves an hourly cached revenue snapshot for games on
    // Roblox's top-earning chart. IDs outside the cached snapshot do not show a badge.
    const revCache = new Map(); // universeId -> number|null (resolved value)
    const pending = new Map();  // universeId -> in-flight Promise
    let updateScheduled = false;
    let attachObserver = null;
    let lastFetchErrorAt = 0;

    function scheduleUpdateRevenueOverlays() {
        if (updateScheduled) return;
        updateScheduled = true;
        requestAnimationFrame(() => {
            updateScheduled = false;
            updateRevenueOverlays();
        });
    }
    function isRevenueUiNode(node) {
        if (!node || node.nodeType !== 1) return false;
        return !!(
            node.matches &&
            (node.matches('.revenue-overlay') ||
             node.closest('.revenue-overlay'))
        );
    }
    function isRevenueUiMutation(mutation) {
        const target = mutation.target && mutation.target.nodeType === 1
            ? mutation.target
            : mutation.target && mutation.target.parentElement;
        if (target && isRevenueUiNode(target)) return true;

        const changedNodes = Array.from(mutation.addedNodes).concat(Array.from(mutation.removedNodes));
        return changedNodes.length > 0 && changedNodes.every(isRevenueUiNode);
    }
    function readSession(universeId) {
        try {
            const raw = sessionStorage.getItem(SS_PREFIX + universeId);
            if (!raw) return undefined;
            const obj = JSON.parse(raw);
            if (!obj || (Date.now() - obj.t) > SS_TTL_MS) return undefined;
            return obj.v; // may be null (known "no revenue")
        } catch (e) { return undefined; }
    }
    function writeSession(universeId, value) {
        try {
            sessionStorage.setItem(SS_PREFIX + universeId, JSON.stringify({ v: value, t: Date.now() }));
        } catch (e) { /* storage full / blocked - ignore */ }
    }

    function removeSession(universeId) {
        try {
            sessionStorage.removeItem(SS_PREFIX + universeId);
        } catch (e) { /* ignore */ }
    }

    function revenueOf(entry) {
        return (entry && typeof entry.revenue === 'number') ? entry.revenue : null;
    }

    function store(id, value) {
        revCache.set(id, value);
        writeSession(id, value);
    }

    // Resolve a chunk of IDs into revCache. The provider returns universeId on
    // each row, so map by ID instead of relying on response order or row count.
    async function resolveStatsRange(ids) {
        if (ids.length === 0) return;

        const uniqueIds = Array.from(new Set(ids));
        const data = await limited(() => apiGet(revenueApiRequest(uniqueIds)));

        if (!data || data.ok !== true || !Array.isArray(data.data)) {
            throw new Error('bad stats response');
        }

        const unresolved = new Set(uniqueIds);

        data.data.forEach((entry) => {
            const id = entry && String(entry.universeId || '');
            if (!unresolved.has(id)) return;

            store(id, revenueOf(entry));
            unresolved.delete(id);
        });

        if (Array.isArray(data.missingUniverseIds)) {
            data.missingUniverseIds.forEach((id) => {
                id = String(id || '');
                if (!unresolved.has(id)) return;

                store(id, null);
                unresolved.delete(id);
            });
        }

        unresolved.forEach((id) => store(id, null));
    }

    // Make sure revenue is known (cache/session/network) for every id in the list.
    // Resolves to true if a network fetch actually happened. `onChunk` fires after
    // each batch of CHUNK completes, so the UI can fill in 10 at a time, in order.
    function ensureRevenue(idList, onChunk) {
        if (!GM_REQUEST) warnNoGM();
        if (Date.now() - lastFetchErrorAt < 30000) {
            return Promise.reject(new Error('recent fetch failure'));
        }

        const need = [];
        for (const id of idList) {
            if (revCache.has(id) || pending.has(id)) continue;
            const ss = readSession(id);
            if (ss !== undefined) { revCache.set(id, ss); continue; }
            need.push(id); // keep card order (top earning first)
        }
        if (!need.length) return Promise.resolve(false);

        const chunks = [];
        for (let i = 0; i < need.length; i += CHUNK) {
            chunks.push(need.slice(i, i + CHUNK));
        }

        const run = (async () => {
            for (const chunk of chunks) {
                try { await resolveStatsRange(chunk); }
                catch (e) {
                    console.error('[Revenue] fetch failed:', e);
                    lastFetchErrorAt = Date.now();
                    throw e;
                }
                if (onChunk) onChunk(); // paint this batch before fetching the next
            }
            return true;
        })();

        need.forEach(id => pending.set(id, run));
        run.catch(() => {}).then(() => need.forEach(id => pending.delete(id)));
        return run;
    }

    function formatRevenue(v) {
        if (v == null || isNaN(v)) return null;
        const abs = Math.abs(v);
        let s;
        if (abs >= 1e9)      s = (v / 1e9).toFixed(1) + 'B';
        else if (abs >= 1e6) s = (v / 1e6).toFixed(1) + 'M';
        else if (abs >= 1e3) s = (v / 1e3).toFixed(1) + 'K';
        else                 s = Math.round(v).toString();
        return '$' + s;
    }

    // ===========================
    // 4. DOM: add/update revenue badge on each thumbnail
    // ===========================
    function paint(pairs) {
        // pairs: array of { revElem, id }. Writes from cache; leaves "..." if unknown.
        pairs.forEach(({ revElem, id }) => {
            if (revElem.dataset.universeId !== id) return; // tile reused meanwhile
            if (!revCache.has(id)) return;
            const f = formatRevenue(revCache.get(id));
            if (f) {
                revElem.style.display = '';
                revElem.textContent = f + ' USD';
            } else {
                revElem.textContent = '';
                revElem.style.display = 'none';
            }
        });
    }

    function updateRevenueOverlays() {
        const gameGrid = document.querySelector('div[data-testid="game-grid"]');
        if (!gameGrid) return Promise.resolve(false);

        const gameCards = gameGrid.querySelectorAll('div[data-testid="game-tile"]');
        const pairs = [];
        const ids = [];

        gameCards.forEach((card) => {
            const gameLink = card.querySelector('a.game-card-link');
            const universeId = gameLink ? gameLink.id : null; // <a> id is the universeId
            const thumbContainer = card.querySelector('.game-card-thumb-container');
            if (!universeId || !thumbContainer) return;

            let revElem = thumbContainer.querySelector('.revenue-overlay');
            if (!revElem) {
                revElem = document.createElement('div');
                revElem.className = 'revenue-overlay';
                thumbContainer.appendChild(revElem);
            }

            // Tiles get recycled as you scroll; reset only when the game changes.
            if (revElem.dataset.universeId !== universeId) {
                revElem.dataset.universeId = universeId;
                revElem.style.display = '';
                revElem.textContent = '--';
            }

            // Hydrate from sessionStorage cache (no network) so reloads show values.
            if (!revCache.has(universeId)) {
                const ss = readSession(universeId);
                if (ss !== undefined) revCache.set(universeId, ss);
            }

            pairs.push({ revElem, id: universeId });
            ids.push(universeId);
        });

        paint(pairs); // show anything cached right away

        if (!GM_REQUEST) warnNoGM();

        // Show a loading state on the ones we still need.
        let anyNeed = false;
        pairs.forEach(({ revElem, id }) => {
            if (revElem.dataset.universeId === id && !revCache.has(id)) {
                revElem.style.display = '';
                revElem.textContent = '...';
                anyNeed = true;
            }
        });
        if (!anyNeed) return Promise.resolve(false);

        // Paint after every batch so cards fill in as requests complete.
        return ensureRevenue(ids, () => paint(pairs))
            .then(() => { paint(pairs); })
            .catch((e) => {
                console.error('[Revenue] request failed:', e);
                pairs.forEach(({ revElem, id }) => {
                    if (revElem.dataset.universeId === id && !revCache.has(id)) {
                        revElem.textContent = 'error';
                    }
                });
            });
    }

    function visibleUniverseIds() {
        const gameGrid = document.querySelector('div[data-testid="game-grid"]');
        if (!gameGrid) return [];

        const ids = [];
        gameGrid.querySelectorAll('div[data-testid="game-tile"]').forEach((card) => {
            const gameLink = card.querySelector('a.game-card-link');
            const universeId = gameLink ? gameLink.id : null;
            if (universeId) ids.push(universeId);
        });

        return Array.from(new Set(ids));
    }

    async function refreshVisibleRevenue(button) {
        if (button.dataset.refreshing === 'true') return;

        button.dataset.refreshing = 'true';
        button.disabled = true;
        button.textContent = 'Refreshing...';

        const ids = visibleUniverseIds();
        lastFetchErrorAt = 0;
        pending.clear();

        ids.forEach((id) => {
            revCache.delete(id);
            removeSession(id);
        });

        document.querySelectorAll('.revenue-overlay').forEach((el) => {
            if (!el.dataset.universeId || ids.includes(el.dataset.universeId)) {
                el.style.display = '';
                el.textContent = '...';
            }
        });

        try {
            await updateRevenueOverlays();
        } finally {
            button.disabled = false;
            button.textContent = 'Refresh revenue';
            delete button.dataset.refreshing;
        }
    }

    function createControlBar() {
        if (document.querySelector('.revenue-control-bar')) return;

        const bar = document.createElement('div');
        bar.className = 'revenue-control-bar';

        const refreshButton = document.createElement('button');
        refreshButton.type = 'button';
        refreshButton.className = 'revenue-refresh-button';
        refreshButton.textContent = 'Refresh revenue';
        refreshButton.addEventListener('click', () => refreshVisibleRevenue(refreshButton));
        bar.appendChild(refreshButton);

        const searchBar = document.querySelector('.roblox-top-earning-search-container');
        if (searchBar && searchBar.parentNode) {
            searchBar.parentNode.insertBefore(bar, searchBar.nextSibling);
            return;
        }

        const heading = document.querySelector('h1');
        if (heading && heading.parentNode) {
            heading.parentNode.insertBefore(bar, heading.nextSibling);
        }
    }

    // ===========================
    // 5. Main Logic (mirrors Ranks.js)
    // ===========================
    function observeGameGrid(gameGrid) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && !isRevenueUiMutation(mutation)) {
                    scheduleUpdateRevenueOverlays();
                    break;
                }
            }
        });
        observer.observe(gameGrid, { childList: true, subtree: true });
    }

    function tryAttach() {
        if (!window.location.href.includes('/charts')) return;
        const gameGrid = document.querySelector('div[data-testid="game-grid"]');
        if (gameGrid && !gameGrid.hasAttribute('data-revenue-observed')) {
            gameGrid.setAttribute('data-revenue-observed', 'true');
            console.log("Revenue: game grid found and observed.");
            createControlBar();
            updateRevenueOverlays();
            observeGameGrid(gameGrid);
            if (attachObserver) {
                attachObserver.disconnect();
                attachObserver = null;
            }
        }
    }

    function initialize() {
        console.log("Initializing Revenue script...");
        registerSettingsMenu();
        attachObserver = new MutationObserver(tryAttach);
        attachObserver.observe(document.body, { childList: true, subtree: true });
        tryAttach(); // try once immediately
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
