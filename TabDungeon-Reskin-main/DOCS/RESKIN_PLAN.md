# TabDungeon Reskin Plan

Phase 0 inventory and compatibility report. No runtime code was changed for this report.

## 1. Inventory

### Side panel

- HTML: `sidepanel/sidepanel.html`
- CSS: `sidepanel/styles.css`
- Panel bootstrap/navigation: `sidepanel/main.js`
- Dashboard/session statistics: `sidepanel/stats.js`
- Review flow and deck summaries: `sidepanel/flashcards.js`
- Guide chat: `sidepanel/chat.js`
- Settings: `sidepanel/settings.js`
- Runtime message adapter: `sidepanel/runtime.js`

### Game modules

- Pure rules: `game/game-rules.js`
- Storage adapter: `game/game-state.js`
- Sprite loading/animation: `game/sprite-engine.js`
- Registered art: `game/asset-map.js`
- Arena rendering/effects: `game/arena.js`
- Review-event controller/HUD visibility: `game/controller.js`
- Constants: `game/game-params.js`

### Assets

The following requested UI assets exist:

- `assets/ui/ui-names.json`
- `assets/ui/README.md`
- `assets/ui/_preview_core.png`
- `assets/ui/_preview_icons.png`
- `assets/ui/buttons/`
- `assets/ui/frames/`
- `assets/ui/icons/`
- `assets/ui/bars/`
- `assets/ui/sliders/`
- `assets/ui/rings/`
- `assets/ui/extras/`

The requested game assets also exist:

- `assets/game/Warrior_Blue.png` and `.json`
- `assets/game/Torch_Red.png` and `.json`
- `assets/game/Dead.png` and `.json`
- `assets/game/Tilemap_Flat.png`
- `assets/game/Tilemap_Elevation.png`
- `assets/game/Water.png`
- `assets/game/Foam.png`
- `assets/game/Rocks_01.png` through `Rocks_04.png`
- Existing `hero_soldier.png` and `monster_slime.png`

The existing `assets/ui/ui-names.json` contains curated aliases and dimensions. Its README
states that icon aliases are visual estimates and should be checked against the previews.

### Settings and storage keys

The settings module reads or writes:

- `guiScale`
- `aiEnabled`
- `apiKey`
- `devMode`
- `gameEffects`
- `reduceMotion`

The game layer separately stores `gameState`. Study data and statistics use `studyState`,
`studyStats`, `exposureVisits`, and relevance model cache keys. The UI reskin must not alter
these formats.

## 2. JavaScript-bound selectors

### Required IDs

The following IDs are read or written by panel/game JavaScript and must remain present:

`content-panel`, `stats-panel`, `guide-panel`, `cards-panel`, `settings-panel`,
`classification-status`, `status-message`, `study-exposure`, `due-cards`, `session-time`,
`tab-count`, `tabs-list`, `game-header-strip`, `game-level`, `game-xp`,
`game-xp-bar`, `game-streak`, `review-arena`, `review-status`, `empty-card-state`,
`show-test-options`, `test-card-controls`, `test-deck-select`, `start-deck-test`,
`due-card-state`, `due-deck-select`, `show-due-card`, `answer-card`, `card-question`,
`card-response`, `submit-card-answer`, `card-answer`, `review-actions`, `exit-test`,
`deck-list`, `open-deck-manager`, `new-deck-name`, `add-deck`, `deck-editor-status`,
`adventure-log`, `adventure-defeated`, `adventure-bosses`, `adventure-best-streak`,
`chat-messages`, `chat-input`, `chat-send`, `scale-dec`, `scale-value`, `scale-inc`,
`ai-toggle`, `game-effects`, `reduce-motion`, `api-key`, `save-key`, `test-key`,
`key-status`, `developer-mode`, `developer-output`, `developer-tools`, and
`open-simulation`.

### Required classes and data attributes

- `.panel` — panel collection used by navigation.
- `.footer-nav-link` — navigation collection and click target.
- `.quality-button` — review rating buttons; each requires `data-quality`.
- `.sidepanel` — target for GUI scale changes.
- `.active` — navigation/panel state class.
- `.footer-nav-link[data-panel]` — panel routing value.
- `.game-arena`, `.game-arena-scene`, `.game-arena-hero`,
  `.game-arena-monster`, `.game-arena-hero-sprite`, and
  `.game-arena-monster-sprite` — arena styling hooks.

Generated deck rows may use `.deck-row`, `.deck-name`, `.deck-details`, and
`.deck-due-input`; these are currently created by `flashcards.js` and should remain
style-compatible.

## 3. Current review UI flow

`sidepanel/flashcards.js` loads `studyState`, computes due cards with the scheduler, and
renders deck summaries into `#deck-list`.

When cards are due:

1. Due decks populate `#due-deck-select`.
2. The user chooses a deck and presses `#show-due-card`.
3. The selected card appears in `#answer-card`.
4. The user enters an answer and presses `#submit-card-answer`.
5. The answer is revealed and `#review-actions` becomes visible.
6. One of `.quality-button` elements submits quality 1, 3, 4, or 5.
7. The scheduler result is saved to `studyState`.
8. The game controller receives the review event through guarded calls.

When no cards are due, `#empty-card-state` provides `#show-test-options`; the user can
choose a deck in `#test-deck-select` and start a multi-card practice test with
`#start-deck-test`. `#exit-test` ends the practice session.

There is currently no `Start review` element. The existing due-review entry point is the
deck selector plus `#show-due-card`, so a future dashboard button must call that existing
flow or be wired explicitly without changing scheduling behavior.

## 4. Current arena rendering

`game/controller.js` creates the arena through `renderArena()` and hides the HUD, arena,
and adventure log when Game effects are disabled. The controller passes review card/deck
context and the current `effectsEnabled` and `reduceMotion` options.

`game/arena.js` currently:

- Creates one hero and one tier-selected monster.
- Loads both through `loadGridAtlas()`.
- Uses the existing 96px grid sheets with cropped 56x36 bodies.
- Places the monster on the left and hero on the right.
- Plays idle loops.
- Maps recalled outcomes to hero attack, monster hurt, then death.
- Maps Again to hero block, monster dash, then fade-out.
- Queues a replacement monster for the next card without waiting for the effect.
- Uses the existing CSS arena scene rather than a terrain tile-map.

`game/asset-map.js` currently has no `ACTIVE_THEME`; it registers only the soldier/slime
grid theme. Boss styling still has a provisional scale value of `1.4`, which conflicts
with the new requirement that Tiny Swords bosses must not be scaled up.

`game/sprite-engine.js` supports grid sheets and basic Aseprite JSON frames/tags, but it
does not yet support the requested custom metadata, anchors, multi-row tags,
`timeScale`, `maxFrameMs`, or the requested Tiny Swords missing-tag/facing behavior.

## 5. Background relevance result

The background computes relevance locally in `background/index.js`. Existing messages
include `tabsChanged`, and the side panel can request `getAllTabs`; that response exposes
tab title and `bestDeck` only.

There is no existing message exposing the latest page title, matching deck, relevance score,
or relevance label as a dedicated “current reading” result. The optional Reading now card
should therefore be skipped unless a new message is intentionally added later, for example:

```text
{ action: "activePageRelevance", title, deckId, deckName, score, label }
```

Adding that message is outside Phase 0 and should not be inferred as part of a visual-only
reskin.

## 6. Missing assets and conflicts

- All runtime paths listed in the prompt currently exist.
- The current `asset-map.js` does not register `Warrior_Blue`, `Torch_Red`, `Dead`, terrain,
  rocks, foam, or a Tiny Swords theme.
- The current sprite engine does not resolve `meta.image` relative to a JSON file and does
  not read the proposed custom `meta.tabdungeon` block.
- The current JSON parser normalizes lowercase/default tag names, while the proposed
  Tiny Swords tags use names such as `Idle`, `Attack_1`, and `Dead`; tag fallback and
  case handling need an explicit implementation decision.
- There is no Ambient animation setting or storage key in the current HTML/settings module.
- `settings.js` reads `gameEffects` and `reduceMotion` values but does not include them in
  its initial `storage.get()` key list; this is an existing settings persistence issue
  that is adjacent to, but not part of, a visual-only change.
- `assets/ui/ui-names.json` warns that several icon aliases may be visually incorrect.
- The existing `styles.css` contains a remote Google Fonts import:
  `https://fonts.googleapis.com/css2?family=Pixelify+Sans&display=swap`.
  It is not changed in Phase 0 and must be reported if the reskin proceeds.
- No license or credit wording was found in the Phase 0 asset inventory. The requested
  README credit/license placeholders should be filled only after the pack license is
  confirmed.

## Phase 0 status

Inventory complete. No UI, game, scheduler, relevance, storage, or asset files were edited.
Stop here for review before implementing Phase 1.
