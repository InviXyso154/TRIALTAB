function normalizeTags(tags = {}) {
  const normalized = {};
  Object.entries(tags).forEach(([name, tag]) => {
    const value = {
      from: tag.from ?? 0,
      to: tag.to ?? tag.from ?? 0,
      direction: tag.direction || 'forward'
    };
    normalized[name] = value;
    normalized[name.toLowerCase()] = value;
  });
  return normalized;
}

export function parseAsepriteAtlas(json, sheetUrl, overrides = {}) {
  const frameEntries = Array.isArray(json?.frames)
    ? json.frames
    : Object.values(json?.frames || {});
  const metadata = json?.meta?.tabdungeon || {};
  const frames = frameEntries.map(item => item.frame);
  const durations = frameEntries.map(item => item.duration || 100);
  const tags = normalizeTags(Object.fromEntries(
    (json?.meta?.frameTags || []).map(tag => [tag.name, tag])
  ));
  const parsed = {
    type: 'aseprite',
    sheet: sheetUrl,
    frames,
    durations,
    tags,
    name: overrides.name || sheetUrl,
    imageSize: json?.meta?.size || null,
    facing: metadata.facing || overrides.facing || 'none',
    anchor: metadata.anchor || overrides.anchor || { x: 0, y: 0 },
    bodyBBox: metadata.bodyBBox || overrides.bodyBBox || null,
    timeScale: metadata.timeScale || overrides.timeScale || 1,
    maxFrameMs: metadata.maxFrameMs || overrides.maxFrameMs || null,
    ...overrides,
    tags: {
      ...tags,
      ...normalizeTags(overrides.tags)
    }
  };
  return parsed;
}

export function loadGridAtlas(definition) {
  return { ...definition, type: 'grid', tags: { ...(definition.tags || {}) } };
}

export async function loadAtlas(sheetUrl, jsonUrl, overrides = {}) {
  try {
    const response = await fetch(assetUrl(jsonUrl));
    if (!response.ok) throw new Error(`Sprite JSON request failed: ${response.status}`);
    const json = await response.json();
    return parseAsepriteAtlas(json, sheetUrl, overrides);
  } catch (error) {
    return {
      type: 'aseprite',
      sheet: sheetUrl,
      frames: [],
      tags: {},
      name: overrides.name || sheetUrl,
      loadError: error.message
    };
  }
}

function findTag(atlas, tagName) {
  return atlas.tags?.[tagName] || atlas.tags?.[String(tagName).toLowerCase()];
}

export function tagFrameIndices(atlas, tagName) {
  const tag = findTag(atlas, tagName) || findTag(atlas, 'idle');
  if (!tag) return [0];
  const from = tag.from ?? 0;
  const to = tag.to ?? from;
  const forward = [];
  for (let index = from; index <= to; index += 1) forward.push(index);
  if (tag.direction === 'reverse') return forward.reverse();
  if (tag.direction === 'pingpong' && forward.length > 2) {
    return forward.concat(forward.slice(1, -1).reverse());
  }
  return forward;
}

export function gridFrameRect(atlas, frameIndex, tagName = 'idle') {
  const tag = findTag(atlas, tagName) || findTag(atlas, 'idle') || { row: 0, frames: 1 };
  const frameCount = Math.max(1, tag.frames || 1);
  const col = frameIndex % frameCount;
  return {
    x: col * atlas.cell.w + atlas.crop.x,
    y: tag.row * atlas.cell.h + atlas.crop.y,
    w: atlas.crop.w,
    h: atlas.crop.h
  };
}

function reducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function isHidden() {
  return globalThis.document?.hidden === true;
}

function imageFor(atlas, onReady, onError) {
  if (typeof Image === 'undefined') {
    onError();
    return null;
  }
  const image = new Image();
  image.onload = onReady;
  image.onerror = onError;
  image.src = assetUrl(atlas.sheet);
  return image;
}

function assetUrl(path) {
  return globalThis.chrome?.runtime?.getURL
    ? globalThis.chrome.runtime.getURL(path)
    : new URL(`../${path}`, import.meta.url).href;
}

function getDisplayScale(atlas, options) {
  return options.scale || atlas.displayScale || 1;
}

export function createSprite(container, atlas, options = {}) {
  const element = document.createElement('div');
  element.className = 'game-sprite';
  element.setAttribute('role', 'img');
  element.style.imageRendering = 'pixelated';
  container.appendChild(element);

  let timer = null;
  let destroyed = false;
  let frames = [];
  let framePosition = 0;
  let currentTag = 'idle';
  let onDone = null;
  let ready = false;
  let fallback = false;
  let pendingPlay = null;
  let facing = options.facing || atlas.facing || 'none';
  let currentFrameHeight = 0;
  let currentFrameWidth = 0;
  const effectsEnabled = options.effectsEnabled !== false;
  const defaultDurationScale = options.durationScale || 1;
  let activeDurationScale = defaultDurationScale;
  const reducedMotionOverride = options.reducedMotion === true;
  const scale = getDisplayScale(atlas, options);

  function applyTransform() {
    const anchor = atlas.type === 'aseprite' ? atlas.anchor || { x: 0, y: 0 } : { x: 0, y: 0 };
    const directionScale = facing === 'left' ? -1 : 1;
    const frameWidth = currentFrameWidth || atlas.frames?.[0]?.w || atlas.crop?.w || 0;
    const frameHeight = currentFrameHeight || atlas.frames?.[0]?.h || atlas.crop?.h || 0;
    const anchorX = frameWidth / 2 - anchor.x;
    const anchorY = frameHeight - anchor.y;
    element.style.transform = `translate(${anchorX * scale}px, ${anchorY * scale}px) scaleX(${directionScale})`;
  }

  function showFallback() {
    fallback = true;
    ready = true;
    pendingPlay = null;
    element.classList.add('sprite-placeholder');
    element.textContent = atlas.name || 'sprite';
    currentFrameWidth = atlas.crop?.w || 48;
    currentFrameHeight = atlas.crop?.h || 48;
    element.style.width = `${(atlas.crop?.w || 48) * scale}px`;
    element.style.height = `${(atlas.crop?.h || 48) * scale}px`;
    applyTransform();
    if (onDone) {
      const callback = onDone;
      onDone = null;
      callback();
    }
  }

  function renderFrame(index) {
    if (destroyed || fallback) return;
    if (atlas.type === 'grid') {
      const rect = gridFrameRect(atlas, index, currentTag);
      element.style.width = `${rect.w * scale}px`;
      element.style.height = `${rect.h * scale}px`;
      element.style.backgroundImage = `url("${assetUrl(atlas.sheet)}")`;
      element.style.backgroundSize = `${atlas.cols * atlas.cell.w * scale}px ${atlas.rows * atlas.cell.h * scale}px`;
      element.style.backgroundPosition = `${-rect.x * scale}px ${-rect.y * scale}px`;
    } else {
      const frame = atlas.frames[index] || atlas.frames[0];
      if (!frame) return showFallback();
      currentFrameWidth = frame.w;
      currentFrameHeight = frame.h;
      element.style.width = `${frame.w * scale}px`;
      element.style.height = `${frame.h * scale}px`;
      element.style.backgroundImage = `url("${assetUrl(atlas.sheet)}")`;
      if (atlas.imageSize) {
        element.style.backgroundSize = `${atlas.imageSize.w * scale}px ${atlas.imageSize.h * scale}px`;
      }
      element.style.backgroundPosition = `${-frame.x * scale}px ${-frame.y * scale}px`;
      applyTransform();
    }
  }

  function finish() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (onDone) {
      const callback = onDone;
      onDone = null;
      callback();
    }
  }

  function frameDuration(frameIndex) {
    const sourceDuration = atlas.type === 'grid'
      ? 1000 / (atlas.fps || 10)
      : atlas.durations?.[frameIndex] || 100;
    const capped = atlas.maxFrameMs ? Math.min(sourceDuration, atlas.maxFrameMs) : sourceDuration;
    return capped * (atlas.timeScale || 1) * activeDurationScale;
  }

  function step(loop) {
    if (destroyed || !ready) return;
    if (isHidden()) {
      timer = setTimeout(() => step(loop), 100);
      return;
    }
    renderFrame(frames[framePosition]);
    if (frames.length <= 1 || !effectsEnabled || reducedMotionOverride || reducedMotion()) {
      if (!loop) finish();
      return;
    }
    const duration = frameDuration(frames[framePosition]);
    framePosition += 1;
    if (framePosition >= frames.length) {
      if (!loop) return finish();
      framePosition = 0;
    }
    timer = setTimeout(() => step(loop), duration);
  }

  const image = imageFor(atlas, () => {
    ready = true;
    renderFrame(0);
    if (pendingPlay) {
      const request = pendingPlay;
      pendingPlay = null;
      step(request.loop);
    }
  }, showFallback);
  if (atlas.loadError || !image) showFallback();

  const onVisibilityChange = () => {
    if (!document.hidden && ready && !destroyed && timer === null) step(currentTag === 'idle');
  };
  if (globalThis.document) document.addEventListener('visibilitychange', onVisibilityChange);

  return {
    element,
    play(tagName, playOptions = {}) {
      if (timer) clearTimeout(timer);
      timer = null;
      onDone = null;
      pendingPlay = null;
      currentTag = findTag(atlas, tagName) ? tagName : 'idle';
      frames = atlas.type === 'grid'
        ? Array.from({ length: findTag(atlas, currentTag)?.frames || 1 }, (_, index) => index)
        : tagFrameIndices(atlas, currentTag);
      framePosition = 0;
      onDone = playOptions.onDone || null;
      activeDurationScale = playOptions.durationScale || defaultDurationScale;
      pendingPlay = { loop: playOptions.loop === true };
      if (fallback) {
        pendingPlay = null;
        if (onDone) {
          const callback = onDone;
          onDone = null;
          callback();
        }
        return;
      }
      if (ready) {
        pendingPlay = null;
        step(playOptions.loop === true);
      }
    },
    setFacing(direction) {
      facing = direction || 'none';
      applyTransform();
    },
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      onDone = null;
    },
    destroy() {
      destroyed = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      element.remove();
    }
  };
}
