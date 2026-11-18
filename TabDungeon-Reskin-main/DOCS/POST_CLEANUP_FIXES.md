# Post-cleanup fixes

These existing issues were identified during the cleanup audit and intentionally remain
unfixed because they are outside the approved behavior-preserving cleanup scope.

1. The active-tab dwell session and related module-level tracking state in the background
   service worker can be interrupted when the service worker is suspended. Verify and
   redesign persistence if continuous dwell accounting is required.
2. The AI API key is stored in `chrome.storage.local` and sent as a URL query parameter.
   Review the security and secret-handling model before changing this behavior.
3. The displayed due-card statistic reads `studyStats.dueCards`, but the inspected
   background paths do not update that field. Confirm the intended source of truth before
   changing the statistic.
