// ==UserScript==
// @name         Roblox Charts Redirect
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Rewrites /charts links to open the all-device, all-country view
// @author       CountMyBands
// @homepageURL  https://github.com/countmybands/Userscripts
// @icon         https://www.roblox.com/favicon.ico
// @match        https://www.roblox.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/countmybands/Userscripts/main/redirect.user.js
// @updateURL    https://raw.githubusercontent.com/countmybands/Userscripts/main/redirect.user.js
// ==/UserScript==

(function() {
    'use strict';

    console.log("Redirect started.");

    // Function to update href of /charts links
    function updateLinks(links) {
        links.forEach(link => {
            if (link.getAttribute('href') === '/charts') {
                link.setAttribute('href', '/charts/?device=all&country=all');
            }
        });
    }

    // Select all <a> elements on the page
    const links = document.querySelectorAll('a');
    updateLinks(links);

    // Create a MutationObserver to listen for new <a> elements being added
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Ensure it's an element node
                    if (node.nodeName === 'A') {
                        updateLinks([node]);
                    } else if (node.querySelectorAll) {
                        updateLinks(node.querySelectorAll('a'));
                    }
                }
            });
        });
    });

    // Start observing the document for added nodes
    observer.observe(document.body, { childList: true, subtree: true });
})();
