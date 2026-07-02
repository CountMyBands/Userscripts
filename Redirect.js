(function() {
    'use strict';

    console.log("Redirect started.");

    // Function to update href of /charts links
    function updateLinks(links) {
        links.forEach(link => {
            if (link.getAttribute('href') === '/charts') {
                link.setAttribute('href', '/charts#/?device=all&country=all');
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
