(() => {
  'use strict';

  const Renderer = window.JiraiRig?.PartAtlasRenderer;
  if (!Renderer) return;

  const originalLoad = Renderer.prototype.load;
  const originalDraw = Renderer.prototype.draw;
  const originalHealth = Renderer.prototype.meshHealth;
  const defaultCleanup = { A05: { keepLargestComponent: true, alphaThreshold: 4 } };

  function keepLargestAlphaComponent(canvas, alphaThreshold = 4) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const w = canvas.width;
    const h = canvas.height;
    const visited = new Uint8Array(w * h);
    const component = new Int32Array(w * h);
    const queue = new Int32Array(w * h);
    let largest = [];
    let opaqueBefore = 0;
    let componentsBefore = 0;

    const alphaAt = i => data[i * 4 + 3];
    for (let i = 0; i < w * h; i++) if (alphaAt(i) > alphaThreshold) opaqueBefore++;

    for (let start = 0; start < w * h; start++) {
      if (visited[start] || alphaAt(start) <= alphaThreshold) continue;
      componentsBefore++;
      let head = 0;
      let tail = 0;
      let count = 0;
      queue[tail++] = start;
      visited[start] = 1;

      while (head < tail) {
        const idx = queue[head++];
        component[count++] = idx;
        const x = idx % w;
        const y = (idx / w) | 0;
        if (x > 0) { const n = idx - 1; if (!visited[n] && alphaAt(n) > alphaThreshold) { visited[n] = 1; queue[tail++] = n; } }
        if (x + 1 < w) { const n = idx + 1; if (!visited[n] && alphaAt(n) > alphaThreshold) { visited[n] = 1; queue[tail++] = n; } }
        if (y > 0) { const n = idx - w; if (!visited[n] && alphaAt(n) > alphaThreshold) { visited[n] = 1; queue[tail++] = n; } }
        if (y + 1 < h) { const n = idx + w; if (!visited[n] && alphaAt(n) > alphaThreshold) { visited[n] = 1; queue[tail++] = n; } }
      }
      if (count > largest.length) largest = Array.from(component.slice(0, count));
    }

    if (!largest.length) return { opaqueBefore, keptPixels: 0, removedPixels: opaqueBefore, componentsBefore, componentsAfter: 0 };
    const keep = new Uint8Array(w * h);
    for (const idx of largest) keep[idx] = 1;
    for (let i = 0; i < w * h; i++) {
      if (!keep[i]) {
        data[i * 4] = 0; data[i * 4 + 1] = 0; data[i * 4 + 2] = 0; data[i * 4 + 3] = 0;
      }
    }
    ctx.putImageData(image, 0, 0);
    return { opaqueBefore, keptPixels: largest.length, removedPixels: Math.max(0, opaqueBefore - largest.length), componentsBefore, componentsAfter: 1 };
  }

  Renderer.prototype.load = async function patchedLoad(...args) {
    const result = await originalLoad.apply(this, args);
    this.cleanedSprites = {};
    this.cleanupStats = {};
    const cleanup = { ...defaultCleanup, ...(this.config.cleanup || {}) };
    for (const [id, rule] of Object.entries(cleanup)) {
      const part = this.part(id);
      if (!part) continue;
      const img = this.images[String(part.sheet)];
      if (!img) continue;
      const [sx, sy, sw, sh] = part.src;
      const sprite = document.createElement('canvas');
      sprite.width = sw; sprite.height = sh;
      const sctx = sprite.getContext('2d', { willReadFrequently: true });
      sctx.clearRect(0, 0, sw, sh);
      sctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      this.cleanupStats[id] = rule.keepLargestComponent
        ? keepLargestAlphaComponent(sprite, rule.alphaThreshold ?? 4)
        : { componentsBefore: null, componentsAfter: null, removedPixels: 0 };
      this.cleanedSprites[id] = sprite;
    }
    return result;
  };

  function drawAroundPivot(renderer, id, opt, sprite) {
    const part = renderer.part(id);
    if (!part) return;
    const layout = renderer.config.layout?.[id] || {};
    const source = sprite || renderer.images[String(part.sheet)];
    if (!source) return;
    const [rawSx, rawSy, rawSw, rawSh] = part.src;
    const sx = sprite ? 0 : rawSx;
    const sy = sprite ? 0 : rawSy;
    const sw = sprite ? sprite.width : rawSw;
    const sh = sprite ? sprite.height : rawSh;
    const center = opt.center || layout.center || [0, 0];
    const pivot = opt.pivot || layout.pivot;
    const scale = opt.scale ?? layout.scale ?? 1;
    const scaleX = opt.scaleX ?? layout.scaleX ?? 1;
    const scaleY = opt.scaleY ?? layout.scaleY ?? 1;
    const alpha = opt.alpha ?? 1;
    const angle = opt.angle ?? layout.angle ?? 0;
    if (alpha <= .001) return;
    const flipX = opt.flipX ? -1 : 1;
    const dw = sw * scale * scaleX;
    const dh = sh * scale * scaleY;
    const c = renderer.ctx;
    c.save();
    c.globalAlpha *= alpha;
    c.translate(pivot[0], pivot[1]);
    c.rotate(angle * Math.PI / 180);
    c.translate(center[0] - pivot[0], center[1] - pivot[1]);
    c.scale(flipX, 1);
    c.drawImage(source, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    if (renderer.debug) {
      c.strokeStyle = 'rgba(90,210,255,.8)';
      c.lineWidth = 1.2;
      c.strokeRect(-dw / 2, -dh / 2, dw, dh);
      c.fillStyle = '#fff';
      c.font = '10px monospace';
      c.fillText(id, -dw / 2 + 2, -dh / 2 + 11);
      c.beginPath(); c.arc(pivot[0] - center[0], pivot[1] - center[1], 4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  Renderer.prototype.draw = function patchedDraw(id, opt = {}) {
    const layout = this.config.layout?.[id] || {};
    const drawOpt = { ...opt, scaleX: opt.scaleX ?? layout.scaleX ?? 1, scaleY: opt.scaleY ?? layout.scaleY ?? 1 };
    const sprite = this.cleanedSprites?.[id];
    const pivot = drawOpt.pivot || layout.pivot;
    if (pivot) return drawAroundPivot(this, id, drawOpt, sprite);
    if (!sprite) return originalDraw.call(this, id, drawOpt);

    const part = this.part(id);
    const key = String(part.sheet);
    const previousImage = this.images[key];
    const previousSrc = part.src;
    this.images[key] = sprite;
    part.src = [0, 0, sprite.width, sprite.height];
    try { return originalDraw.call(this, id, drawOpt); }
    finally { part.src = previousSrc; this.images[key] = previousImage; }
  };

  Renderer.prototype.meshHealth = function patchedMeshHealth() {
    const base = originalHealth ? originalHealth.call(this) : {};
    const cleanedParts = Object.keys(this.cleanedSprites || {});
    return { ...base, cleanedParts, cleanedCount: cleanedParts.length, cleanupStats: { ...(this.cleanupStats || {}) }, pivotSpriteMotion: true };
  };
})();
