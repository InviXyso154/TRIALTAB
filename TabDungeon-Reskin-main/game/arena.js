import { getMonsterAsset, getTheme, ACTIVE_THEME, TIER_STYLES } from './asset-map.js';
import { createSprite, loadAtlas, loadGridAtlas } from './sprite-engine.js';

const EFFECT_DURATION_SCALE = 1;

function spriteOptions(effectsEnabled, reduceMotion) {
  return { effectsEnabled, reducedMotion: reduceMotion };
}

function placeholderAtlas(definition) {
  return {
    type: 'aseprite',
    name: definition.name,
    sheet: definition.sheet,
    frames: [],
    tags: {},
    loadError: 'loading'
  };
}

function createThemeSprite(container, definition, options) {
  if (!definition?.jsonUrl) {
    return createSprite(container, loadGridAtlas(definition), options);
  }

  let sprite = createSprite(container, placeholderAtlas(definition), options);
  let destroyed = false;
  let ready = false;
  let requested = { tag: 'idle', playOptions: { loop: true } };
  let requestedFacing = definition.facing || 'none';
  const proxy = {
    get element() {
      return sprite.element;
    },
    play(tag, playOptions = {}) {
      requested = { tag, playOptions };
      if (ready) sprite.play(tag, playOptions);
    },
    setFacing(direction) {
      requestedFacing = direction || 'none';
      sprite.setFacing(direction);
    },
    stop() {
      sprite.stop();
    },
    destroy() {
      destroyed = true;
      sprite.destroy();
    }
  };

  loadAtlas(definition.sheet, definition.jsonUrl, definition).then(atlas => {
    if (destroyed || atlas.loadError) return;
    const previousStyle = sprite.element.style.cssText;
    sprite.destroy();
    sprite = createSprite(container, atlas, options);
    sprite.element.style.cssText = previousStyle;
    ready = true;
    sprite.setFacing(requestedFacing);
    sprite.play(requested.tag, requested.playOptions);
  });
  return proxy;
}

export function renderArena(container, {
  card,
  deck,
  gameState,
  effectsEnabled = true,
  reduceMotion = false,
  ambientEnabled = true,
  theme = ACTIVE_THEME
} = {}) {
  const assets = getTheme(theme);
  container.textContent = '';
  container.className = 'game-arena';
  const isTinySwords = Boolean(assets.terrain);
  container.dataset.theme = isTinySwords ? 'tiny_swords' : 'pixel_duo';

  const scene = document.createElement('div');
  scene.className = 'game-arena-scene';
  scene.dataset.ambient = ambientEnabled && effectsEnabled && !reduceMotion ? 'on' : 'off';
  const heroSlot = document.createElement('div');
  heroSlot.className = 'game-arena-hero';
  const monsterSlot = document.createElement('div');
  monsterSlot.className = 'game-arena-monster';
  scene.append(heroSlot, monsterSlot);
  container.appendChild(scene);

  const hero = createThemeSprite(
    heroSlot,
    assets.hero,
    { ...spriteOptions(effectsEnabled, reduceMotion), scale: assets.hero.displayScale }
  );
  if (!isTinySwords) heroSlot.classList.add('game-arena-hero-sprite');
  let currentCard = card;
  let currentDeck = deck;
  let pendingContext = null;
  let monster = null;

  function createMonster(animateEntry = true) {
    const tier = currentCard?.tier || 't1';
    const monsterAsset = currentCard
      ? getMonsterAsset(tier, currentCard.id, currentDeck?.id, theme)
      : null;
    if (!monsterAsset) return null;
    const monsterStyle = TIER_STYLES[tier] || TIER_STYLES.t1;
    const sprite = createThemeSprite(
      monsterSlot,
      monsterAsset,
      { ...spriteOptions(effectsEnabled, reduceMotion), scale: monsterAsset.displayScale }
    );
    if (!isTinySwords) monsterSlot.classList.add('game-arena-monster-sprite');
    sprite.element.style.filter = monsterStyle.filter;
    sprite.element.style.setProperty('--monster-scale', monsterStyle.scale);
    if (monsterAsset.jsonUrl) sprite.setFacing('left');
    if (isTinySwords) {
      if (animateEntry) {
        monsterSlot.style.transform = 'translateX(34px)';
        monsterSlot.style.transition = 'none';
        requestAnimationFrame(() => {
          monsterSlot.style.transition = 'transform 900ms ease-out';
          monsterSlot.style.transform = 'translateX(0)';
        });
        sprite.play('Run', {
          onDone: () => sprite.play('idle', { loop: true })
        });
      } else {
        monsterSlot.style.transition = 'none';
        monsterSlot.style.transform = 'translateX(0)';
        sprite.play('idle', { loop: true });
      }
    } else {
      sprite.play('idle', { loop: true });
    }
    return sprite;
  }

  monster = createMonster(true);
  hero.play('idle', { loop: true });
  if (assets.hero.jsonUrl) hero.setFacing('right');

  const fallbackText = document.createElement('span');
  fallbackText.className = 'game-arena-caption';
  fallbackText.textContent = currentCard
    ? `${currentDeck?.name || 'Study floor'} - ${currentCard.tier || 't1'}`
    : gameState?.lastFloorCleared
      ? 'Floor cleared'
      : 'Study arena';
  container.appendChild(fallbackText);

  function finishMonster(animateEntry = false) {
    monster?.destroy();
    monster = null;
    hero.play('idle', { loop: true });
    if (pendingContext) {
      currentCard = pendingContext.card;
      currentDeck = pendingContext.deck;
      pendingContext = null;
      fallbackText.textContent = `${currentDeck?.name || 'Study floor'} - ${currentCard?.tier || 't1'}`;
      monster = createMonster(animateEntry);
    } else if (animateEntry && currentCard) {
      monster = createMonster(true);
    }
  }

  function showMiss() {
    const miss = document.createElement('span');
    miss.className = 'game-arena-miss';
    miss.textContent = 'MISS';
    container.appendChild(miss);
    setTimeout(() => miss.remove(), 900);
  }

  function showHit(target) {
    if (!target?.element) return;
    target.element.classList.remove('game-arena-hit');
    void target.element.offsetWidth;
    target.element.classList.add('game-arena-hit');
    setTimeout(() => target.element.classList.remove('game-arena-hit'), 260);
  }

  function playEffects(effects = [], reviewEvent = null) {
    if (!effectsEnabled || reduceMotion) return;
    if (pendingContext?.card?.id === reviewEvent?.cardId) pendingContext = null;
    const outcome = effects.find(effect => effect.type === 'defeated' || effect.type === 'escaped');
    const deckFinished = effects.some(effect =>
      effect.type === 'floorCleared' || effect.type === 'deckFinished'
    );
    if (outcome && monster) {
      function playDeathSequence() {
        setTimeout(() => {
          if (isTinySwords) heroSlot.style.transform = 'translateX(0)';
          if (isTinySwords) {
            monster.destroy();
            monster = createThemeSprite(
              monsterSlot,
              assets.defeat,
              { ...spriteOptions(effectsEnabled, reduceMotion), scale: assets.defeat.displayScale }
            );
            monster.play('Dead', {
              durationScale: EFFECT_DURATION_SCALE,
              onDone: () => monster.play('Buried', {
                durationScale: EFFECT_DURATION_SCALE,
                onDone: () => finishMonster(false)
              })
            });
            return;
          }
          monster.play('hurt', {
            durationScale: EFFECT_DURATION_SCALE,
            onDone: () => monster.play('death', {
              durationScale: EFFECT_DURATION_SCALE,
              onDone: finishMonster
            })
          });
        }, 220);
      }

      if (outcome.type === 'defeated') {
        const attackTags = isTinySwords
          ? ['Attack_1', 'Attack_2']
          : [outcome.tier === 't3' || outcome.tier === 'boss' ? 'attack2' : 'attack1'];
        if (isTinySwords) {
          heroSlot.style.transition = 'transform 180ms ease-out';
          heroSlot.style.transform = 'translateX(18px)';
        }
        function playAttack(index) {
          hero.play(attackTags[index], {
            durationScale: EFFECT_DURATION_SCALE,
            onDone: () => {
              showHit(monster);
              if (index < attackTags.length - 1) return playAttack(index + 1);
              if (deckFinished) playDeathSequence();
              else {
                if (isTinySwords) heroSlot.style.transform = 'translateX(0)';
                hero.play('idle', { loop: true });
                monster.play(isTinySwords ? 'idle' : 'move', { loop: true });
              }
            }
          });
        }
        playAttack(0);
      } else {
        showMiss();
        showHit(monster);
        if (isTinySwords) {
          monsterSlot.style.transition = 'transform 180ms ease-out';
          monsterSlot.style.transform = 'translateX(-18px)';
          hero.play('Run', {
            onDone: () => hero.play('idle', { loop: true })
          });
        }
        monster.play(isTinySwords ? 'Attack_Right' : 'dash', {
          durationScale: EFFECT_DURATION_SCALE,
          onDone: () => {
            if (isTinySwords) monsterSlot.style.transform = 'translateX(0)';
            if (pendingContext) {
              finishMonster(false);
            } else {
              monster.play(isTinySwords ? 'idle' : 'move', { loop: true });
            }
          }
        });
      }
    }
    if (effects.some(effect => effect.type === 'levelUp' || effect.type === 'floorCleared')) {
      setTimeout(() => hero.play(isTinySwords ? 'Run' : 'jump', {
        durationScale: EFFECT_DURATION_SCALE,
        onDone: () => hero.play('idle', { loop: true })
      }), outcome ? 420 : 0);
    }
  }

  return {
    hero,
    get monster() {
      return monster;
    },
    setNextCard(nextCard, nextDeck) {
      pendingContext = { card: nextCard, deck: nextDeck };
      if (!monster || !effectsEnabled || reduceMotion) {
        finishMonster();
      }
    },
    setAmbientEnabled(enabled) {
      scene.dataset.ambient = enabled && effectsEnabled && !reduceMotion ? 'on' : 'off';
    },
    playEffects
  };
}
