(() => {
  'use strict';

  const Renderer = window.JiraiRig?.PartAtlasRenderer;
  if (!Renderer) return;

  Renderer.prototype.drawArmPose = function pivotArmPose(pose, alpha = 1, side = { l: 0, r: 0 }) {
    const lo = this.config.layout;
    const drawPair = (leftId, rightId, leftLayout, rightLayout) => {
      this.draw(leftId, {
        center: leftLayout.center,
        pivot: leftLayout.pivot,
        scale: leftLayout.scale,
        angle: (leftLayout.angle || 0) + (side.l || 0),
        alpha
      });
      this.draw(rightId, {
        center: rightLayout.center,
        pivot: rightLayout.pivot,
        scale: rightLayout.scale,
        angle: (rightLayout.angle || 0) + (side.r || 0),
        alpha
      });
    };

    if (pose === 'down') {
      drawPair('A01', 'A02', lo.armNeutralLeft, lo.armNeutralRight);
      return;
    }
    if (pose === 'open') {
      drawPair('A03', 'A04', lo.armOpenLeft, lo.armOpenRight);
      return;
    }
    if (pose === 'raised') {
      drawPair('A05', 'A06', lo.armRaisedLeft, lo.armRaisedRight);
      return;
    }
    if (pose === 'oneRaised') {
      this.draw('A01', {
        center: lo.armNeutralLeft.center,
        pivot: lo.armNeutralLeft.pivot,
        scale: lo.armNeutralLeft.scale,
        angle: (lo.armNeutralLeft.angle || 0) + (side.l || 0),
        alpha
      });
      this.draw('A06', {
        center: lo.armRaisedRight.center,
        pivot: lo.armRaisedRight.pivot,
        scale: lo.armRaisedRight.scale,
        angle: (lo.armRaisedRight.angle || 0) + (side.r || 0),
        alpha
      });
      return;
    }

    const map = { crossed: 'A07', cheek: 'A08', palms: 'A09', clasped: 'A10' };
    const id = map[pose] || 'A07';
    const offsets = {
      crossed: [300, 460, .95],
      cheek: [306, 452, 1.02],
      palms: [300, 458, 1.02],
      clasped: [300, 454, .98]
    };
    const [x, y, scale] = offsets[pose] || offsets.crossed;
    const armEnergy = ((side.l || 0) + (side.r || 0)) * .5;
    this.draw(id, {
      center: [x, y - Math.abs(armEnergy) * .65],
      scale,
      angle: armEnergy * .12,
      alpha
    });
  };

  Renderer.prototype.drawLegs = function pivotLegPose(pose, alpha = 1) {
    const lo = this.config.layout;
    const p = this._p || {};
    const leftAngle = p.legL || 0;
    const rightAngle = p.legR || 0;
    const leftPivot = lo.legLeft.pivot;
    const rightPivot = lo.legRight.pivot;

    if (pose === 'bentLeft') {
      this.draw('L07', {
        center: [232, 672],
        pivot: leftPivot,
        scale: .96,
        angle: -10 + leftAngle,
        alpha
      });
      this.draw('L03', {
        center: lo.legRight.center,
        pivot: rightPivot,
        scale: lo.legRight.scale,
        angle: rightAngle,
        alpha
      });
      this.draw('L04', {
        center: [208, 792],
        pivot: leftPivot,
        scale: lo.shoeLeft.scale,
        angle: -15 + leftAngle,
        alpha
      });
      this.draw('L05', {
        center: lo.shoeRight.center,
        pivot: rightPivot,
        scale: lo.shoeRight.scale,
        angle: rightAngle,
        alpha
      });
      return;
    }

    this.draw('L02', {
      center: lo.legLeft.center,
      pivot: leftPivot,
      scale: lo.legLeft.scale,
      angle: leftAngle,
      alpha
    });
    this.draw('L03', {
      center: lo.legRight.center,
      pivot: rightPivot,
      scale: lo.legRight.scale,
      angle: rightAngle,
      alpha
    });
    this.draw('L04', {
      center: lo.shoeLeft.center,
      pivot: leftPivot,
      scale: lo.shoeLeft.scale,
      angle: leftAngle,
      alpha
    });
    this.draw('L05', {
      center: lo.shoeRight.center,
      pivot: rightPivot,
      scale: lo.shoeRight.scale,
      angle: rightAngle,
      alpha
    });
  };

  const previousHealth = Renderer.prototype.meshHealth;
  Renderer.prototype.meshHealth = function pivotHealth() {
    const base = previousHealth ? previousHealth.call(this) : {};
    return { ...base, shoulderPivotMotion: true, hipPivotMotion: true, hairRootPivotMotion: true };
  };
})();
