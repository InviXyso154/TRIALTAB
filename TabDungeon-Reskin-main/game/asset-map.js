const GRID_SHEET = {
  type: 'grid',
  cols: 10,
  rows: 8,
  cell: { w: 96, h: 96 },
  crop: { x: 24, y: 28, w: 56, h: 36 },
  facing: 'left',
  fps: 10
};

const hero = {
  ...GRID_SHEET,
  name: 'hero_soldier',
  sheet: 'assets/game/hero_soldier.png',
  tags: {
    idle: { row: 0, frames: 6 },
    walk: { row: 1, frames: 8 },
    jump: { row: 2, frames: 6 },
    block: { row: 3, frames: 6 },
    attack1: { row: 4, frames: 8 },
    attack2: { row: 5, frames: 8 },
    hurt: { row: 6, frames: 4 },
    death: { row: 7, frames: 10 }
  }
};

const monsterSlime = {
  ...GRID_SHEET,
  name: 'monster_slime',
  sheet: 'assets/game/monster_slime.png',
  tags: {
    idle: { row: 0, frames: 6 },
    move: { row: 1, frames: 8 },
    jump: { row: 2, frames: 6 },
    guard: { row: 3, frames: 6 },
    attack: { row: 4, frames: 8 },
    dash: { row: 5, frames: 8 },
    hurt: { row: 6, frames: 4 },
    death: { row: 7, frames: 10 }
  }
};

const tinySwordsHero = {
  type: 'aseprite',
  name: 'Warrior_Blue',
  sheet: 'assets/game/Warrior_Blue.png',
  jsonUrl: 'assets/game/Warrior_Blue.json',
  displayScale: 0.5,
  timeScale: 1.2,
  facing: 'right',
  tags: {
    idle: { from: 0, to: 5 },
    run: { from: 6, to: 11 },
    attack_1: { from: 12, to: 17 },
    attack_2: { from: 18, to: 23 }
  }
};

const tinySwordsMonster = {
  type: 'aseprite',
  name: 'Torch_Red',
  sheet: 'assets/game/Torch_Red.png',
  jsonUrl: 'assets/game/Torch_Red.json',
  displayScale: 0.5,
  timeScale: 1.2,
  facing: 'right',
  tags: {
    idle: { from: 0, to: 6 },
    run: { from: 7, to: 12 },
    attack_right: { from: 13, to: 18 },
    attack_down: { from: 19, to: 24 },
    attack_up: { from: 25, to: 30 }
  }
};

const tinySwordsDefeat = {
  type: 'aseprite',
  name: 'Dead',
  sheet: 'assets/game/Dead.png',
  jsonUrl: 'assets/game/Dead.json',
  displayScale: 0.5,
  facing: 'none',
  timeScale: 1.5,
  maxFrameMs: 100,
  tags: {
    dead: { from: 0, to: 6 },
    buried: { from: 7, to: 13 }
  }
};

const pixelDuo = {
  hero,
  monster_t1: [monsterSlime],
  monster_t2: [monsterSlime],
  monster_t3: [monsterSlime],
  monster_boss: [monsterSlime],
  arena_bg: []
};

const tinySwords = {
  hero: tinySwordsHero,
  monster_t1: [tinySwordsMonster],
  monster_t2: [tinySwordsMonster],
  monster_t3: [tinySwordsMonster],
  monster_boss: [tinySwordsMonster],
  defeat: tinySwordsDefeat,
  arena_bg: ['assets/game/Water.png'],
  terrain: {
    water: 'assets/game/Water.png',
    flat: 'assets/game/Tilemap_Flat.png',
    elevation: 'assets/game/Tilemap_Elevation.png',
    foam: 'assets/game/Foam.png',
    rocks: [
      'assets/game/Rocks_01.png',
      'assets/game/Rocks_02.png',
      'assets/game/Rocks_03.png',
      'assets/game/Rocks_04.png'
    ]
  }
};

export const ACTIVE_THEME = 'tiny_swords';

export const THEMES = Object.freeze({
  tiny_swords: Object.freeze(tinySwords),
  pixel_duo: Object.freeze(pixelDuo)
});

export function getTheme(name = ACTIVE_THEME) {
  return THEMES[name] || THEMES[ACTIVE_THEME];
}

export const ASSET_MAP = Object.freeze({
  ...THEMES[ACTIVE_THEME],
  themes: THEMES,
  icons: {
    xp: null,
    streak: null,
    level: null,
    door: null
  }
});

export const TIER_STYLES = Object.freeze({
  t1: Object.freeze({ filter: 'none', scale: 1 }),
  t2: Object.freeze({ filter: 'hue-rotate(160deg)', scale: 1 }),
  t3: Object.freeze({ filter: 'hue-rotate(260deg)', scale: 1 }),
  boss: Object.freeze({ filter: 'hue-rotate(320deg) saturate(1.4)', scale: 1 })
});

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickAsset(assets, cardId, deckId) {
  if (!assets?.length) return null;
  return assets[stableHash(`${deckId}:${cardId}`) % assets.length];
}

export function getMonsterAsset(tier, cardId, deckId, theme = ACTIVE_THEME) {
  const assets = getTheme(theme);
  return pickAsset(assets[`monster_${tier}`] || assets.monster_t1, cardId, deckId);
}

export function getArenaBackground(cardId, deckId, theme = ACTIVE_THEME) {
  return pickAsset(getTheme(theme).arena_bg, cardId, deckId);
}
