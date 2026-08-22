import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/rig-engine.js', 'utf8');
const expected = JSON.parse(fs.readFileSync('config/jirai-v12-emotions.json', 'utf8'));

globalThis.window = {};
globalThis.performance = { now: () => 0 };
vm.runInThisContext(source, { filename: 'src/rig-engine.js' });

const actual = globalThis.window?.JiraiRig?.EMOTIONS;
assert.ok(actual, 'rig-engine did not publish JiraiRig.EMOTIONS');
assert.deepStrictEqual(actual, expected, 'browser EMOTIONS drifted from config/jirai-v12-emotions.json');
assert.equal(Object.keys(actual).length, 16, 'expected exactly 16 emotion presets');

console.log(JSON.stringify({
  pass: true,
  emotionCount: Object.keys(actual).length,
  ids: Object.keys(actual),
}, null, 2));
