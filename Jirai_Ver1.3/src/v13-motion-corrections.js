(() => {
  'use strict';
  const Motion = window.JiraiRig?.MotionController;
  if (!Motion) return;

  const originalGesture = Motion.prototype.gesture;
  Motion.prototype.gesture = function v13Gesture(now) {
    const g = originalGesture.call(this, now) || {};
    const def = window.JiraiRig?.EMOTIONS?.[this.emotion];
    if (def?.arms === 'oneRaisedLeft' && g.armR && !g.armL) {
      g.armL = g.armR;
      g.armR = 0;
    }
    return g;
  };
})();
