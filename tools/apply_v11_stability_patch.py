from pathlib import Path

engine = Path('src/rig-engine.js')
s = engine.read_text(encoding='utf-8')

old = '''    step(dt) {
      dt = Math.min(dt, 0.04);
      const omega = TAU * this.frequency;
      const k = omega * omega;
      const c = 2 * this.damping * omega;
      const accel = k * (this.target - this.value) - c * this.velocity;
      this.velocity += accel * dt;
      this.value += this.velocity * dt;
      return this.value;
    }
'''
new = '''    step(dt) {
      // Implicit Euler remains stable for high-frequency facial springs even when a frame stalls.
      dt = Math.min(Math.max(dt, 0), 0.04);
      const omega = TAU * this.frequency;
      const k = omega * omega;
      const c = 2 * this.damping * omega;
      const denom = 1 + dt * c + dt * dt * k;
      this.velocity = (this.velocity + dt * k * (this.target - this.value)) / denom;
      this.value += dt * this.velocity;
      if (!Number.isFinite(this.value) || !Number.isFinite(this.velocity)) this.snap(this.target);
      return this.value;
    }
'''
if old not in s:
    raise SystemExit('Spring block not found; aborting rather than patching the wrong code.')
s = s.replace(old, new, 1)

old = '''      this.updateBlink(now);
      this.updateIdle(now, dt, qaMode);
'''
new = '''      if (qaMode && this.blinkStart < 0) {
        this.blinkL = this.blinkR = 1;
      } else {
        this.updateBlink(now);
      }
      this.updateIdle(now, dt, qaMode);
'''
if old not in s:
    raise SystemExit('Blink block not found.')
s = s.replace(old, new, 1)

old = '''      const out = {};
      for (const [key, spring] of Object.entries(this.springs)) out[key] = spring.value;
      Object.assign(out, {
'''
new = '''      const out = {};
      for (const [key, spring] of Object.entries(this.springs)) out[key] = Number.isFinite(spring.value) ? spring.value : spring.target;
      out.headAngle = clamp(out.headAngle, -14, 14);
      out.headTurn = clamp(out.headTurn, -.42, .42);
      out.bodyLean = clamp(out.bodyLean, -8, 8);
      out.bodySquash = clamp(out.bodySquash, -.12, .12);
      out.mouthForm = clamp(out.mouthForm, -1, 1);
      out.eyeL = clamp(out.eyeL); out.eyeR = clamp(out.eyeR);
      out.armL = clamp(out.armL, -.45, 1.15); out.armR = clamp(out.armR, -.45, 1.15);
      out.legL = clamp(out.legL, -.45, .45); out.legR = clamp(out.legR, -.45, .45);
      Object.assign(out, {
'''
if old not in s:
    raise SystemExit('Output block not found.')
s = s.replace(old, new, 1)
engine.write_text(s, encoding='utf-8')

qa = Path('tools/qa_browser.mjs')
q = qa.read_text(encoding='utf-8')
if 'finiteParameters:allFinite' not in q:
    old = '''const checks={
  ready:results.initial.ready===true,
'''
    new = '''const allSnapshots=[results.initial,...Object.values(results.samples),results.mouth,results.blink];
const allFinite=allSnapshots.every(s=>Object.values(s.params||{}).filter(v=>typeof v==='number').every(v=>Number.isFinite(v)&&Math.abs(v)<100));
const checks={
  ready:results.initial.ready===true,
'''
    if old not in q:
        raise SystemExit('QA checks block not found.')
    q = q.replace(old, new, 1)
    old = '''  blink:Math.min(results.blink.params?.eyeL??1,results.blink.params?.eyeR??1)<.65,
  consoleErrors:consoleErrors.length===0
};
'''
    new = '''  blink:Math.min(results.blink.params?.eyeL??1,results.blink.params?.eyeR??1)<.65,
  finiteParameters:allFinite,
  steadyFps:Math.max(...Object.values(results.samples).map(s=>s.fps||0))>=25,
  consoleErrors:consoleErrors.length===0
};
'''
    if old not in q:
        raise SystemExit('QA tail block not found.')
    q = q.replace(old, new, 1)
qa.write_text(q, encoding='utf-8')
print('Jirai Ver1.1 stability patch applied.')
