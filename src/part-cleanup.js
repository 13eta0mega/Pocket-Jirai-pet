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

    const alphaAt = i => data[i * 4 + 3];

    for (let start = 0; start < w * h; start++) {
      if (visited[start] || alphaAt(start) <= alphaThreshold) continue;
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

        if (x > 0) {
          const n = idx - 1;
          if (!visited[n] && alphaAt(n) > alphaThreshold) { visited[n] = 1; queue[tail++] = n; }
        }
        if (x + 1 < w) {
          const n = idx + 1;
          if (!visited[n] && alphaAt(n) > alphaThreshold) { visited[n] = 1; queue[tail++] = n; }
        }
        if (y > 0) {
          const n = idx - w;
          if (!visited[n] && alphaAt(n) > alphaThreshold) { visited[n] = 1; queue[tail++] = n; }
        }
        if (y + 1 < h) {
          const n = idx + w;
          if (!visited[n] && alphaAt(n) > alphaThreshold) { visited[n] = 1; queue[tail++] = n; }
        }
      }

      if (count > largest.length) largest = Array.from(component.slice(0, count));
    }

    if (!largest.length) return;
    const keep = new Uint8Array(w * h);
    for (const idx of largest) keep[idx] = 1;

    for (let i = 0; i < w * h; i++) {
      if (!keep[i]) {
        data[i * 4] = 0;
        data[i * 4 + 1] = 0;
        data[i * 4 + 2] = 0;
        data[i * 4 + 3] = 0;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  Renderer.prototype.load = async function patchedLoad(...args) {
    const result = await originalLoad.apply(this, args);
    this.cleanedSprites = {};
    const cleanup = { ...defaultCleanup, ...(this.config.cleanup || {}) };

    for (const [id, rule] of Object.entries(cleanup)) {
      const part = this.part(id);
      if (!part) continue;
      const img = this.images[String(part.sheet)];
      if (!img) continue;
      const [sx, sy, sw, sh] = part.src;
      const sprite = document.createElement('canvas');
      sprite.width = sw;
      sprite.height = sh;
      const sctx = sprite.getContext('2d', { willReadFrequently: true });
      sctx.clearRect(0, 0, sw, sh);
      sctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      if (rule.keepLargestComponent) {
        keepLargestAlphaComponent(sprite, rule.alphaThreshold ?? 4);
      }
      this.cleanedSprites[id] = sprite;
    }
    return result;
  };

  Renderer.prototype.draw = function patchedDraw(id, opt = {}) {
    const sprite = this.cleanedSprites?.[id];
    if (!sprite) return originalDraw.call(this, id, opt);

    const part = this.part(id);
    const key = String(part.sheet);
    const previousImage = this.images[key];
    const previousSrc = part.src;

    this.images[key] = sprite;
    part.src = [0, 0, sprite.width, sprite.height];
    try {
      return originalDraw.call(this, id, opt);
    } finally {
      part.src = previousSrc;
      this.images[key] = previousImage;
    }
  };

  Renderer.prototype.meshHealth = function patchedMeshHealth() {
    const base = originalHealth ? originalHealth.call(this) : {};
    const cleanedParts = Object.keys(this.cleanedSprites || {});
    return { ...base, cleanedParts, cleanedCount: cleanedParts.length };
  };
})();
