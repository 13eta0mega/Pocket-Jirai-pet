(() => {
  'use strict';

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const deg = (value) => value * Math.PI / 180;

  const LABELS = {
    neutral: '기본', happy: '행복', excited: '신남', teasing: '장난',
    pleading: '울망', relaxed: '느긋', sick: '아픔', angry: '화남',
    annoyed: '삐짐', sad: '슬픔', surprised: '놀람', embarrassed: '부끄러움',
    scared: '겁남', smug: '의기양양', confused: '갸웃', love: '좋아!'
  };

  const $ = (id) => document.getElementById(id);
  const canvas = $('rigCanvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  const grid = $('emotionGrid');
  const blinkToggle = $('blinkToggle');
  const breathToggle = $('breathToggle');
  const lipToggle = $('lipToggle');
  const guideToggle = $('guideToggle');
  const referenceToggle = $('referenceToggle');
  const pixelToggle = $('pixelToggle');
  const mouthSlider = $('mouthSlider');
  const mouthValue = $('mouthValue');
  const mouthReadout = $('mouthReadout');
  const referenceSlider = $('referenceSlider');
  const referenceValue = $('referenceValue');
  const fpsTarget = $('fpsTarget');
  const fpsChip = $('fpsChip');
  const atlasChip = $('atlasChip');
  const emotionLabel = $('emotionLabel');
  const stateLabel = $('stateLabel');
  const runtimeStats = $('runtimeStats');
  const wave = $('wave');

  for (let i = 0; i < 54; i++) {
    const bar = document.createElement('i');
    bar.style.height = `${5 + Math.random() * 12}px`;
    wave.appendChild(bar);
  }

  let atlas = null;
  let reference = null;
  let manifest = null;
  let layout = null;
  let emotionData = null;

  let emotion = 'neutral';
  let previousEmotion = 'neutral';
  let transitionStart = 0;
  let transitionMs = 240;
  let mouthManual = 0;
  let mouthOpen = 0;
  let blink = 1;
  let blinkStart = -1;
  let nextBlink = performance.now() + 3200;
  let last = 0;
  let lastDraw = 0;
  let frames = [];
  let cycleTimer = null;
  let qaTimer = null;

  const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Image load failed: ${src}`));
    image.src = src;
  });

  async function loadJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  function rectFor(name) {
    return manifest?.rects?.[name] || null;
  }

  function partLayout(key) {
    return layout?.parts?.[key] || null;
  }

  function drawSprite(spriteName, layoutKey, options = {}) {
    const rect = rectFor(spriteName);
    const cfg = partLayout(layoutKey);
    if (!atlas || !rect || !cfg) return;

    const [sx, sy, sw, sh] = rect;
    const scale = (cfg.scale ?? 1) * (options.scale ?? 1);
    const dw = sw * scale;
    const dh = sh * scale;
    const x = cfg.x + (options.x || 0);
    const y = cfg.y + (options.y || 0);
    const rotation = deg((cfg.rotation || 0) + (options.rotation || 0));
    const anchor = options.anchor || cfg.anchor || [0.5, 0.5];
    const alpha = options.alpha ?? 1;

    ctx.save();
    ctx.globalAlpha *= alpha;
    const px = x + dw * anchor[0];
    const py = y + dh * anchor[1];
    ctx.translate(px, py);
    ctx.rotate(rotation);
    ctx.translate(-dw * anchor[0], -dh * anchor[1]);
    ctx.drawImage(atlas, sx, sy, sw, sh, 0, 0, dw, dh);

    if (guideToggle.checked) {
      ctx.strokeStyle = 'rgba(102, 214, 255, .75)';
      ctx.lineWidth = 1 / Math.max(scale, 0.001);
      ctx.strokeRect(0, 0, dw, dh);
      ctx.fillStyle = '#ff5f9e';
      ctx.beginPath();
      ctx.arc(dw * anchor[0], dh * anchor[1], 2.5 / Math.max(scale, 0.001), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function numericState(a, b, t) {
    return {
      head_rotation_deg: lerp(a.head_rotation_deg || 0, b.head_rotation_deg || 0, t),
      body_y: lerp(a.body_y || 0, b.body_y || 0, t),
      body_scale_y: lerp(a.body_scale_y || 1, b.body_scale_y || 1, t),
      breath: lerp(a.breath || 1, b.breath || 1, t),
      mouth_open_y: lerp(a.mouth_open_y || 0, b.mouth_open_y || 0, t)
    };
  }

  function specialMotion(name, t) {
    switch (name) {
      case 'bounce': return { y: -Math.abs(Math.sin(t * 4.4)) * 7, rot: Math.sin(t * 2.8) * 0.8 };
      case 'happy_bob': return { y: Math.sin(t * 3.2) * 2.2, rot: Math.sin(t * 1.6) * 0.45 };
      case 'micro_shake': return { x: Math.sin(t * 24) * 1.3, rot: Math.sin(t * 20) * 0.35 };
      case 'shiver': return { x: Math.sin(t * 29) * 1.8, rot: Math.sin(t * 25) * 0.45 };
      case 'sad_sink': return { y: 2 + Math.sin(t * 1.1) * 0.8, rot: 0.35 };
      case 'weak_sway': return { x: Math.sin(t * 0.9) * 1.4, rot: Math.sin(t * 0.8) * 1.0 };
      case 'slow_sway': return { x: Math.sin(t * 0.65) * 1.3, rot: Math.sin(t * 0.55) * 0.7 };
      case 'tiny_sway': return { x: Math.sin(t * 1.15) * 1.0, rot: Math.sin(t * 1.0) * 0.45 };
      case 'side_sway': return { x: Math.sin(t * 1.3) * 2.0, rot: Math.sin(t * 1.0) * 0.55 };
      case 'shy_sway': return { x: Math.sin(t * 1.05) * 1.2, rot: Math.sin(t * .8) * 0.65 };
      case 'heart_bob': return { y: Math.sin(t * 2.7) * 2.5, rot: Math.sin(t * 1.3) * 0.5 };
      case 'head_tilt': return { rot: Math.sin(t * .7) * 0.5 };
      case 'startle': return { y: -Math.max(0, Math.sin(t * 5)) * 2.0, rot: 0 };
      default: return { x: 0, y: 0, rot: 0 };
    }
  }

  function updateBlink(now) {
    if (!blinkToggle.checked) {
      blink = 1;
      blinkStart = -1;
      return;
    }
    if (blinkStart < 0 && now >= nextBlink) blinkStart = now;
    if (blinkStart < 0) return;

    const duration = layout.animation.blink_duration_ms || 320;
    const p = clamp((now - blinkStart) / duration);
    if (p < 0.36) blink = 1 - smooth(p / 0.36);
    else if (p < 0.54) blink = 0;
    else blink = smooth((p - 0.54) / 0.46);

    if (p >= 1) {
      blink = 1;
      blinkStart = -1;
      const min = layout.animation.blink_min_ms || 2800;
      const max = layout.animation.blink_max_ms || 6200;
      nextBlink = now + min + Math.random() * (max - min);
    }
  }

  function mouthSprite(value, fallback) {
    if (!lipToggle.checked && mouthManual <= 0.001) return fallback;
    if (value < 0.08) return 'mouth_closed';
    if (value < 0.24) return 'mouth_small';
    if (value < 0.43) return 'mouth_medium';
    if (value < 0.66) return 'mouth_open';
    if (value < 0.84) return 'mouth_wide';
    return 'mouth_smile_open';
  }

  function drawBody(state, t, motion) {
    const [px, py] = layout.animation.body_pivot || [360, 420];
    const breath = breathToggle.checked ? Math.sin(t * 1.55) * (layout.animation.breath_px || 2) * state.breath : 0;
    const scaleY = state.body_scale_y * (breathToggle.checked ? 1 + Math.sin(t * 1.55) * 0.006 * state.breath : 1);

    ctx.save();
    ctx.translate(px + (motion.x || 0), py + state.body_y + breath + (motion.y || 0));
    ctx.scale(1, scaleY);
    ctx.translate(-px, -py);
    drawSprite('leg_left', 'leg_left');
    drawSprite('leg_right', 'leg_right');
    drawSprite('body_dress', 'body_dress');
    ctx.restore();
  }

  function drawEyeLayer(sprite, alpha) {
    if (!sprite || alpha <= 0.001) return;
    if (sprite === 'eyes_closed_pair') {
      drawSprite(sprite, 'eyes', { alpha });
      return;
    }
    drawSprite(sprite, 'eyes', { alpha: alpha * blink });
    if (blink < 0.999) drawSprite('eyes_closed_pair', 'eyes', { alpha: alpha * (1 - blink) });
  }

  function drawHead(fromState, toState, transition, numeric, t, motion) {
    const [px, py] = layout.animation.head_pivot || [360, 260];
    const idle = breathToggle.checked ? Math.sin(t * 0.72) * (layout.animation.idle_head_deg || 0.55) : 0;
    const headRot = numeric.head_rotation_deg + idle + (motion.rot || 0);
    const headY = breathToggle.checked ? Math.sin(t * 1.55) * 0.7 * numeric.breath : 0;
    const tailSway = breathToggle.checked ? Math.sin(t * 1.35) * (layout.animation.tail_sway_deg || 4) * numeric.breath : 0;

    ctx.save();
    ctx.translate(px + (motion.x || 0), py + headY + (motion.y || 0) * 0.35);
    ctx.rotate(deg(headRot));
    ctx.translate(-px, -py);

    drawSprite('twin_tail_left', 'twin_tail_left', { rotation: -tailSway });
    drawSprite('twin_tail_right', 'twin_tail_right', { rotation: tailSway });
    drawSprite('face_blank', 'face_blank');

    const fromAlpha = 1 - transition;
    const toAlpha = transition;
    drawEyeLayer(fromState.eye, fromAlpha);
    drawEyeLayer(toState.eye, toAlpha);
    drawSprite(fromState.brow, 'brows', { alpha: fromAlpha });
    drawSprite(toState.brow, 'brows', { alpha: toAlpha });

    const baseMouthOpen = numeric.mouth_open_y || 0;
    const activeMouth = Math.max(baseMouthOpen, mouthOpen);
    const fromMouth = mouthSprite(activeMouth, fromState.mouth);
    const toMouth = mouthSprite(activeMouth, toState.mouth);
    drawSprite(fromMouth, 'mouth', { alpha: fromAlpha, scale: 0.92 + activeMouth * 0.18 });
    drawSprite(toMouth, 'mouth', { alpha: toAlpha, scale: 0.92 + activeMouth * 0.18 });

    drawSprite('hair_front', 'hair_front');
    drawSprite('bunny_clip_left', 'bunny_clip_left');
    drawSprite('bunny_clip_right', 'bunny_clip_right');

    if (guideToggle.checked) {
      ctx.strokeStyle = 'rgba(255,95,158,.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHearts(t) {
    ctx.save();
    ctx.fillStyle = '#ff5f9e';
    ctx.globalAlpha = 0.72;
    ctx.font = '26px system-ui';
    for (let i = 0; i < 4; i++) {
      const x = 260 + i * 62 + Math.sin(t * 1.2 + i) * 10;
      const y = 175 - ((t * 25 + i * 33) % 100);
      ctx.fillText('♥', x, y);
    }
    ctx.restore();
  }

  function drawReference() {
    if (!referenceToggle.checked || !reference) return;
    const ref = layout.reference_transform || { x: 0, y: 0, w: 720, h: 720 };
    ctx.save();
    ctx.globalAlpha = Number(referenceSlider.value);
    ctx.drawImage(reference, ref.x, ref.y, ref.w, ref.h);
    ctx.restore();
  }

  function render(now) {
    requestAnimationFrame(render);
    const target = Number(fpsTarget.value || 30);
    if (now - lastDraw < 1000 / target) return;
    lastDraw = now;

    const dt = Math.min(50, now - (last || now));
    last = now;
    const t = now / 1000;
    updateBlink(now);

    const autoMouth = lipToggle.checked
      ? clamp(0.08 + 0.87 * Math.abs(Math.sin(t * 4.7) * (0.62 + 0.38 * Math.sin(t * 1.3))))
      : mouthManual;
    mouthOpen += (autoMouth - mouthOpen) * (1 - Math.exp(-dt * (layout.animation.mouth_smoothing || 0.025)));

    const fromState = emotionData.states[previousEmotion] || emotionData.states.neutral;
    const toState = emotionData.states[emotion] || emotionData.states.neutral;
    const transition = clamp((now - transitionStart) / transitionMs);
    const eased = smooth(transition);
    const numeric = numericState(fromState, toState, eased);
    const motion = specialMotion(transition < 0.5 ? fromState.special : toState.special, t);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createRadialGradient(360, 260, 30, 360, 350, 345);
    gradient.addColorStop(0, 'rgba(255,110,171,.09)');
    gradient.addColorStop(1, 'rgba(255,110,171,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 720, 720);

    drawBody(numeric, t, motion);
    drawHead(fromState, toState, eased, numeric, t, motion);
    if (emotion === 'love') drawHearts(t);
    drawReference();

    if (pixelToggle.checked) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.10;
      for (let y = 0; y < 720; y += 3) ctx.fillRect(0, y, 720, 1);
      ctx.restore();
    }

    frames.push(now);
    while (frames.length && frames[0] < now - 1000) frames.shift();
    fpsChip.textContent = `${frames.length} FPS`;
    mouthValue.textContent = mouthManual.toFixed(2);
    mouthReadout.textContent = `Mouth ${mouthOpen.toFixed(2)}`;
    referenceValue.textContent = Number(referenceSlider.value).toFixed(2);

    [...wave.children].forEach((bar, index) => {
      const h = lipToggle.checked
        ? 6 + Math.abs(Math.sin(t * 4.0 + index * 0.47)) * 20 * (0.2 + mouthOpen)
        : 5 + Math.abs(Math.sin(t * 0.9 + index * 0.41)) * 5;
      bar.style.height = `${h}px`;
    });
  }

  function setEmotion(id) {
    if (!emotionData.states[id] || id === emotion) return;
    previousEmotion = emotion;
    emotion = id;
    transitionStart = performance.now();
    emotionLabel.textContent = LABELS[id] || id;
    [...grid.children].forEach((button) => button.classList.toggle('active', button.dataset.id === id));
  }

  function buildEmotionButtons() {
    Object.keys(emotionData.states).forEach((id) => {
      const button = document.createElement('button');
      button.dataset.id = id;
      button.innerHTML = `${LABELS[id] || id}<small>PARAM</small>`;
      button.onclick = () => setEmotion(id);
      grid.appendChild(button);
    });
    [...grid.children].forEach((button) => button.classList.toggle('active', button.dataset.id === emotion));
  }

  function updateStats() {
    const count = Object.keys(manifest.rects || {}).length;
    const ready = manifest.firmware_ready ? 'ready' : 'QA only';
    runtimeStats.innerHTML = `
      <div><span>Atlas</span><strong>${manifest.size[0]}×${manifest.size[1]} indexed PNG</strong></div>
      <div><span>Parts</span><strong>${count} rects</strong></div>
      <div><span>Target</span><strong>15–30 FPS / &lt; 3 MiB</strong></div>
      <div><span>Firmware</span><strong class="${manifest.firmware_ready ? '' : 'runtime-warning'}">${ready}</strong></div>`;
    atlasChip.textContent = `Atlas v${manifest.version} · ${count} parts`;
  }

  mouthSlider.oninput = () => {
    mouthManual = Number(mouthSlider.value);
    lipToggle.checked = false;
  };

  fpsTarget.onchange = () => { frames = []; };

  $('cycleBtn').onclick = () => {
    clearInterval(cycleTimer);
    const ids = Object.keys(emotionData.states);
    let index = ids.indexOf(emotion);
    cycleTimer = setInterval(() => {
      index = (index + 1) % ids.length;
      setEmotion(ids[index]);
    }, 1450);
  };

  $('qaBtn').onclick = () => {
    clearInterval(qaTimer);
    setEmotion('neutral');
    lipToggle.checked = true;
    blinkToggle.checked = true;
    let count = 0;
    qaTimer = setInterval(() => {
      count += 1;
      if (count % 2 === 0) blinkStart = performance.now();
      if (count > 8) {
        clearInterval(qaTimer);
        qaTimer = null;
      }
    }, 450);
  };

  $('resetBtn').onclick = () => {
    clearInterval(cycleTimer);
    clearInterval(qaTimer);
    cycleTimer = null;
    qaTimer = null;
    mouthManual = 0;
    mouthSlider.value = '0';
    lipToggle.checked = false;
    blinkToggle.checked = true;
    breathToggle.checked = true;
    referenceToggle.checked = false;
    guideToggle.checked = false;
    setEmotion('neutral');
  };

  async function init() {
    stateLabel.textContent = 'loading runtime atlas…';
    [manifest, layout, emotionData] = await Promise.all([
      loadJson('assets/runtime/jirai_runtime_atlas_v0.json'),
      loadJson('config/rig_layout_v0.json'),
      loadJson('config/emotions_v0.json')
    ]);
    transitionMs = emotionData.transition_ms || 240;

    atlas = await loadImage(`assets/runtime/${manifest.atlas}`);
    reference = await loadImage(layout.reference);
    buildEmotionButtons();
    updateStats();
    stateLabel.textContent = 'atlas · idle · blink · breath · lip';
    transitionStart = performance.now() - transitionMs;
    nextBlink = performance.now() + 2600;
    requestAnimationFrame(render);
  }

  init().catch((error) => {
    console.error(error);
    stateLabel.textContent = `runtime load error: ${error.message}`;
    atlasChip.textContent = 'Atlas error';
  });
})();
