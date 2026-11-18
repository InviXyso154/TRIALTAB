import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultGameState, createGameStorage } from '../game/game-state.js';
import { loadGridAtlas, parseAsepriteAtlas, tagFrameIndices } from '../game/sprite-engine.js';
import { ACTIVE_THEME, THEMES, TIER_STYLES } from '../game/asset-map.js';

test('game storage uses a separate versioned key and merges defaults', async () => {
  const values = {};
  const storage = {
    async get(key) {
      return { [key]: { version: 0, xp: 20, stats: { cardsDefeated: 2 } } };
    },
    async set(value) {
      Object.assign(values, value);
    }
  };
  const adapter = createGameStorage(storage);
  const state = await adapter.load();
  assert.equal(state.version, 1);
  assert.equal(state.xp, 20);
  assert.equal(state.stats.cardsDefeated, 2);
  assert.equal(state.streak.current, 0);
  await adapter.save(state);
  assert.deepEqual(Object.keys(values), ['gameState']);
});

test('Aseprite parser resolves forward, reverse, and pingpong tags', () => {
  const atlas = parseAsepriteAtlas({
    frames: [{ frame: { x: 0, y: 0, w: 1, h: 1 } }, { frame: { x: 1, y: 0, w: 1, h: 1 } }, { frame: { x: 2, y: 0, w: 1, h: 1 } }],
    meta: { frameTags: [
      { name: 'forward', from: 0, to: 2, direction: 'forward' },
      { name: 'reverse', from: 0, to: 2, direction: 'reverse' },
      { name: 'pingpong', from: 0, to: 2, direction: 'pingpong' }
    ] }
  }, 'sheet.png');
  assert.deepEqual(tagFrameIndices(atlas, 'forward'), [0, 1, 2]);
  assert.deepEqual(tagFrameIndices(atlas, 'reverse'), [2, 1, 0]);
  assert.deepEqual(tagFrameIndices(atlas, 'pingpong'), [0, 1, 2, 1]);
  assert.deepEqual(tagFrameIndices(atlas, 'missing'), [0]);
});

test('Aseprite parser preserves metadata, case-insensitive tags, and timing overrides', () => {
  const atlas = parseAsepriteAtlas({
    frames: [
      { frame: { x: 0, y: 0, w: 192, h: 192 }, duration: 500 },
      { frame: { x: 192, y: 0, w: 192, h: 192 }, duration: 100 }
    ],
    meta: {
      size: { w: 384, h: 192 },
      frameTags: [{ name: 'Idle', from: 0, to: 1 }],
      tabdungeon: {
        facing: 'right',
        anchor: { x: 101, y: 135 },
        bodyBBox: { x: 62, y: 45, w: 80, h: 91 },
        timeScale: 2,
        maxFrameMs: 120
      }
    }
  }, 'assets/game/Warrior_Blue.png');
  assert.equal(atlas.imageSize.w, 384);
  assert.equal(atlas.facing, 'right');
  assert.deepEqual(atlas.anchor, { x: 101, y: 135 });
  assert.deepEqual(atlas.bodyBBox, { x: 62, y: 45, w: 80, h: 91 });
  assert.equal(atlas.timeScale, 2);
  assert.equal(atlas.maxFrameMs, 120);
  assert.deepEqual(tagFrameIndices(atlas, 'idle'), [0, 1]);
  assert.deepEqual(tagFrameIndices(atlas, 'Idle'), [0, 1]);
});

test('grid atlas preserves cells, crops, and tags', () => {
  const atlas = loadGridAtlas({
    type: 'grid',
    cell: { w: 96, h: 96 },
    crop: { x: 24, y: 28, w: 56, h: 36 },
    tags: { idle: { row: 0, frames: 6 } }
  });
  assert.equal(atlas.type, 'grid');
  assert.deepEqual(atlas.crop, { x: 24, y: 28, w: 56, h: 36 });
  assert.equal(atlas.tags.idle.frames, 6);
});

test('Tiny Swords is the active theme and keeps pixel-duo as a selectable fallback', () => {
  assert.equal(ACTIVE_THEME, 'tiny_swords');
  assert.ok(THEMES.tiny_swords.hero.jsonUrl);
  assert.equal(THEMES.tiny_swords.monster_t1[0].jsonUrl, 'assets/game/Torch_Red.json');
  assert.equal(THEMES.pixel_duo.hero.type, 'grid');
  assert.equal(TIER_STYLES.boss.scale, 1);
});
