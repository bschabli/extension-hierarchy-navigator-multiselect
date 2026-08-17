(function registerExtensionStartupDiagnostics() {
    'use strict';

    var errorShown = false;

    function describeError(error) {
        if (error && typeof error.message === 'string') { return error.message; }
        if (typeof error === 'string') { return error; }
        try { return JSON.stringify(error); }
        catch (_error) { return String(error); }
    }

    function showStartupError(error) {
        window.setTimeout(function renderStartupError() {
            if (errorShown) { return; }

            var container = document.getElementById('app');
            if (!container) { return; }

            errorShown = true;
            var panel = document.createElement('div');
            panel.setAttribute('role', 'alert');
            panel.style.cssText = 'background:#fff;border:1px solid #d4d4d4;margin:18px;padding:18px;font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.4';

            var heading = document.createElement('strong');
            heading.textContent = 'Hierarchy Navigator could not start';
            panel.appendChild(heading);

            var details = document.createElement('p');
            details.style.marginBottom = '0';
            details.textContent = describeError(error) || 'An unknown startup error occurred.';
            panel.appendChild(details);

            container.replaceChildren(panel);
        }, 0);
    }

    window.addEventListener('error', function handleStartupError(event) {
        showStartupError(event.error || event.message);
    });
    window.addEventListener('unhandledrejection', function handleStartupRejection(event) {
        showStartupError(event.reason);
    });
}());
