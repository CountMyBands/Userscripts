(function() {
    'use strict';
    
    console.log("Search started.");
    
    function initialize() {
        if (!window.location.href.includes('/charts')) {
            console.log("Not on charts page. Script will not run.");
            return;
        }

        waitForElements();
    }


    // ===========================
    // 1. Inject Custom CSS for Search Bar
    // ===========================

    const style = document.createElement('style');
    style.innerHTML = `
    .roblox-top-earning-search-container {
        margin: 10px 0; /* Space above and below the search bar */
        padding-left: 10px;
        text-align: left; /* Align contents to the left */
        width: 100%; /* Ensure the container spans the full width */
        box-sizing: border-box; /* Include padding in the element's total width */
    }

    .roblox-top-earning-search-input {
        width: 300px;
        max-width: 80%;
        padding: 8px 12px;
        font-size: 16px;
        border: 2px solid #ccc;
        border-radius: 4px;
        outline: none;
        transition: border-color 0.3s;
    }

    .roblox-top-earning-search-input:focus {
        border-color: white; /* Highlight border on focus */
    }
    `;
    document.head.appendChild(style);

    // ===========================
    // 2. Create and Insert Search Bar
    // ===========================

    function createSearchBar() {
        // Check if search bar already exists
        if (document.querySelector('.roblox-top-earning-search-container')) {
            console.log("Search bar already exists. Skipping creation.");
            return;
        }

        // Create container
        const searchContainer = document.createElement('div');
        searchContainer.className = 'roblox-top-earning-search-container';

        // Create input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search games...';
        searchInput.className = 'roblox-top-earning-search-input';

        // Append input to container
        searchContainer.appendChild(searchInput);

        // Insert the search container below the <h1>Top Earning</h1>
        const heading = document.querySelector('h1');
        if (heading && heading.parentNode) {
            heading.parentNode.insertBefore(searchContainer, heading.nextSibling);
            console.log("Search bar inserted successfully.");
        } else {
            console.log("Heading not found. Retrying to insert search bar.");
            setTimeout(createSearchBar, 1000); // Retry after a short delay if the heading isn't found yet
            return;
        }

        // Add event listener for search input with debouncing
        let debounceTimeout;

        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                const query = this.value.trim().toLowerCase();
                filterGameCards(query);
            }, 300); // 300ms delay
        });
    }

    // ===========================
    // 3. Function to Filter Game Cards
    // ===========================

    function filterGameCards(query) {
        const gameGrid = document.querySelector('div[data-testid="game-grid"]');
        if (!gameGrid) {
            console.log("Game grid not found for filtering.");
            return;
        }

        const gameCards = gameGrid.querySelectorAll('div[data-testid="game-tile"]');

        gameCards.forEach(card => {
            const gameTitleElem = card.querySelector('.game-card-name.game-name-title');
            if (gameTitleElem) {
                const title = gameTitleElem.textContent.toLowerCase();
                if (title.includes(query)) {
                    card.style.display = ''; // Show the card
                } else {
                    card.style.display = 'none'; // Hide the card
                }
            }
        });
    }

    // ===========================
    // 4. Observe Game Grid for Dynamic Changes
    // ===========================

    function observeGameGrid() {
        const gameGrid = document.querySelector('div[data-testid="game-grid"]');
        if (!gameGrid) {
            console.log("Game grid not found for observation.");
            return;
        }

        const observer = new MutationObserver(() => {
            console.log("Detected changes in the game grid. Reapplying filters.");
            const searchInput = document.querySelector('.roblox-top-earning-search-input');
            if (searchInput) {
                const query = searchInput.value.trim().toLowerCase();
                filterGameCards(query);
            }
        });

        observer.observe(gameGrid, { childList: true, subtree: false });
        console.log("MutationObserver set up on game grid.");
    }

    // ===========================
    // 5. Initialize Search Bar
    // ===========================

    function initialize() {
        console.log("Initializing Search script...");
        const observer = new MutationObserver(() => {
            if (window.location.href.includes('/charts')) {
                const heading = document.querySelector('h1');
                const gameGrid = document.querySelector('div[data-testid="game-grid"]');
                
                // Check if search bar is already there
                const existingSearchBar = document.querySelector('.roblox-top-earning-search-container');

                if (heading && gameGrid && !existingSearchBar) {
                    console.log("Required elements found. Inserting search bar.");
                    createSearchBar();
                    observeGameGrid();
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Initial check
        if (window.location.href.includes('/charts')) {
            const heading = document.querySelector('h1');
            const gameGrid = document.querySelector('div[data-testid="game-grid"]');
            const existingSearchBar = document.querySelector('.roblox-top-earning-search-container');

            if (heading && gameGrid && !existingSearchBar) {
                console.log("Required elements found immediately.");
                createSearchBar();
                observeGameGrid();
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
