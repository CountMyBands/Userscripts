// ==UserScript==
// @name         Roblox Chart Ranks
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Adds rank overlays on Roblox Top Earning page
// @author       CountMyBands
// @match        https://www.roblox.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/countmybands/Userscripts/main/ranks.user.js
// @updateURL    https://raw.githubusercontent.com/countmybands/Userscripts/main/ranks.user.js
// ==/UserScript==

(function() {
    'use strict';

    console.log("Ranks started.");

    // ===========================
    // 1. Inject Custom CSS
    // ===========================

    const style = document.createElement('style');
    style.innerHTML = `
    /* Ensure thumbnail container is positioned relative */
    .game-card-thumb-container {
        position: relative !important;
    }

    /* Rank Overlay Style */
    .rank-overlay {
        position: absolute;
        top: 5px;
        right: 5px;
        background-color: rgba(0, 0, 0, 0.75); /* Gold color with slight transparency */
        color: white;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 4px;
        z-index: 10;
        font-size: 14px;
        box-shadow: 0 0 2px rgba(0,0,0,0.5);
        pointer-events: none; /* Allow clicks to pass through */
    }
    `;
    document.head.appendChild(style);
    console.log("Custom CSS injected.");

    // ===========================
    // 2. Function to Add/Update Ranks
    // ===========================

    function updateRankOverlays() {
        console.log("Updating rank overlays.");
        const gameGrid = document.querySelector('div[data-testid="game-grid"]');
        if (!gameGrid) {
            console.log("Game grid not found.");
            return;
        }

        const gameCards = gameGrid.querySelectorAll('div[data-testid="game-tile"]');

        console.log(`Found ${gameCards.length} game cards.`);

        // Update the rank overlays and values if data changed

        gameCards.forEach((card, index) => {
            const gameLink = card.querySelector('a.game-card-link');
            const gameId = gameLink ? gameLink.id : null; // Get the game ID from the <a> element
            const thumbContainer = card.querySelector('.game-card-thumb-container');

            console.log(gameId);

            if (thumbContainer && gameId) {
                // Check if a rank overlay already exists
                let rankElem = thumbContainer.querySelector('.rank-overlay');

                if (!rankElem) {
                    // Create a new rank overlay if it doesn't exist
                    rankElem = document.createElement('div');
                    rankElem.className = 'rank-overlay';
                    thumbContainer.appendChild(rankElem);
                    console.log(`Added rank overlay to card ${index + 1}.`);
                }

                // Update the rank number
                rankElem.textContent = "#" + (index + 1).toString();

            } else {
                console.log(`Thumbnail container or game ID not found for card ${index + 1}.`);
            }
        });

        console.log("Rank overlays updated.");
    }

    // ===========================
    // 3. Main Logic
    // ===========================

    function observeGameGrid(gameGrid) {
        console.log("Setting up MutationObserver on game grid.");
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    shouldUpdate = true;
                    break;
                }
            }
            if (shouldUpdate) {
                console.log("Detected changes in game grid. Updating ranks.");
                updateRankOverlays();
            }
        });
        observer.observe(gameGrid, { childList: true, subtree: false });
    }

    function initialize() {
        console.log("Initializing Ranks script...");
        const observer = new MutationObserver(() => {
            if (window.location.href.includes('/charts')) {
                const gameGrid = document.querySelector('div[data-testid="game-grid"]');
                if (gameGrid && !gameGrid.hasAttribute('data-ranks-observed')) {
                    gameGrid.setAttribute('data-ranks-observed', 'true');
                    console.log("Game grid found and observed.");
                    updateRankOverlays();
                    observeGameGrid(gameGrid);
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Trigger once immediately
        if (window.location.href.includes('/charts')) {
             const gameGrid = document.querySelector('div[data-testid="game-grid"]');
             if (gameGrid && !gameGrid.hasAttribute('data-ranks-observed')) {
                 gameGrid.setAttribute('data-ranks-observed', 'true');
                 console.log("Game grid found immediately.");
                 updateRankOverlays();
                 observeGameGrid(gameGrid);
             }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
