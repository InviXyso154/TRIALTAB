# TabDungeon cleanup plan

This document records the approved cleanup direction for the extension.

## Main goals

- Keep the extension focused on flashcard study and active-page relevance.
- Keep pure scoring and scheduling code separate from Chrome and DOM code.
- Keep the old classifier only as an evaluation baseline.
- Remove unused gameplay code, stale assets, and obsolete terminology.
- Organize the code into small feature-oriented folders without changing behavior.

## Current structure

- `core/`: pure relevance, optional model, scheduler, and parameters
- `state/`: study-state storage and seed data
- `background/`: MV3 service-worker entry point
- `sidepanel/`: side-panel document, panels, and styles
- `deck-manager/`: full-size deck editor
- `scripts/`: evaluation tooling and sample data
- `tests/`: Node tests
- `DOCS/`: project documentation and presentation material
- `archive/assets/`: unused visual assets retained for reference

## Deliberately deferred

The following existing issues remain recorded in
[POST_CLEANUP_FIXES.md](./POST_CLEANUP_FIXES.md): service-worker dwell persistence,
AI API-key handling, and the due-card statistic source of truth.

The Google Fonts import and product wording were intentionally left unchanged.
