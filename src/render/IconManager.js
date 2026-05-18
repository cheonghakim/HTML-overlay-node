export class IconManager {
  constructor() {
    this._icons = new Map();
    this._registerBuiltins();
  }

  /**
   * Register an icon.
   * @param {string} name
   * @param {{ draw: (ctx, cx, cy, s, node) => void, tooltip?: string, onClick?: (node, controller) => void }} config
   */
  register(name, config) {
    this._icons.set(name, {
      draw: config.draw,
      tooltip: config.tooltip ?? '',
      onClick: config.onClick ?? null,
    });
    return this;
  }

  get(name) {
    return this._icons.get(name) ?? null;
  }

  has(name) {
    return this._icons.has(name);
  }

  /** Draw an icon. s = size in world px. */
  draw(ctx, name, cx, cy, s, node) {
    const icon = this._icons.get(name);
    if (icon?.draw) icon.draw(ctx, cx, cy, s, node);
  }

  _registerBuiltins() {
    // ── UI action icons ────────────────────────────────────────────

    this.register('expand', {
      tooltip: '하위 노드 보기',
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        const hw = s * 0.42, hh = s * 0.3;
        ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 1.75);
        ctx.beginPath();
        ctx.moveTo(cx - hw * 0.45, cy + hh * 0.75);
        ctx.lineTo(cx + hw * 0.45, cy + hh * 0.75);
        ctx.stroke();
        ctx.restore();
      },
    });

    this.register('arrow-right', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.35, cy);
        ctx.lineTo(cx + s * 0.2, cy);
        ctx.moveTo(cx + s * 0.02, cy - s * 0.26);
        ctx.lineTo(cx + s * 0.2, cy);
        ctx.lineTo(cx + s * 0.02, cy + s * 0.26);
        ctx.stroke();
        ctx.restore();
      },
    });

    this.register('fork', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.38, cy); ctx.lineTo(cx, cy);
        ctx.moveTo(cx, cy); ctx.lineTo(cx + s * 0.38, cy - s * 0.28);
        ctx.moveTo(cx, cy); ctx.lineTo(cx + s * 0.38, cy + s * 0.28);
        ctx.stroke();
        ctx.restore();
      },
    });

    this.register('share', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        const r = s * 0.18;
        const pts = [
          { x: cx + s * 0.3, y: cy - s * 0.28 },
          { x: cx - s * 0.3, y: cy },
          { x: cx + s * 0.3, y: cy + s * 0.28 },
        ];
        for (const p of pts) {
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y);
        ctx.moveTo(pts[1].x, pts[1].y); ctx.lineTo(pts[2].x, pts[2].y);
        ctx.stroke();
        ctx.restore();
      },
    });

    this.register('clock', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, s * 0.38, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - s * 0.25);
        ctx.moveTo(cx, cy); ctx.lineTo(cx + s * 0.18, cy + s * 0.1);
        ctx.stroke();
        ctx.restore();
      },
    });

    this.register('warning', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(251,191,36,0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.38);
        ctx.lineTo(cx + s * 0.36, cy + s * 0.28);
        ctx.lineTo(cx - s * 0.36, cy + s * 0.28);
        ctx.closePath(); ctx.stroke();
        ctx.restore();
      },
    });

    this.register('lock', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy - s * 0.1, s * 0.22, Math.PI, 0);
        ctx.stroke();
        ctx.strokeRect(cx - s * 0.28, cy - s * 0.06, s * 0.56, s * 0.4);
        ctx.restore();
      },
    });

    this.register('refresh', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.32, -0.3, Math.PI * 1.65);
        ctx.stroke();
        const ax = cx + s * 0.32 * Math.cos(-0.3);
        const ay = cy + s * 0.32 * Math.sin(-0.3);
        ctx.beginPath();
        ctx.moveTo(ax - s * 0.16, ay - s * 0.08);
        ctx.lineTo(ax, ay);
        ctx.lineTo(ax + s * 0.08, ay - s * 0.16);
        ctx.stroke();
        ctx.restore();
      },
    });

    this.register('bell', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.32, cy + s * 0.2);
        ctx.lineTo(cx - s * 0.32, cy - s * 0.1);
        ctx.arc(cx, cy - s * 0.1, s * 0.32, Math.PI, 0);
        ctx.lineTo(cx + s * 0.32, cy + s * 0.2);
        ctx.lineTo(cx - s * 0.32, cy + s * 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.26, s * 0.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },
    });

    this.register('mail', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        const hw = s * 0.38, hh = s * 0.26;
        ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
        ctx.beginPath();
        ctx.moveTo(cx - hw, cy - hh);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + hw, cy - hh);
        ctx.stroke();
        ctx.restore();
      },
    });

    // ── node-type icons ────────────────────────────────────────────

    // core/Note — horizontal lines (notepad)
    this.register('note-text', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
          const lx = i === -1 ? cx - s * 0.28 : cx - s * 0.38;
          ctx.beginPath();
          ctx.moveTo(lx, cy + i * s * 0.24);
          ctx.lineTo(cx + s * 0.38, cy + i * s * 0.24);
          ctx.stroke();
        }
        ctx.restore();
      },
    });

    // core/HtmlNote — </> brackets
    this.register('code-braces', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.14, cy - s * 0.26);
        ctx.lineTo(cx - s * 0.36, cy);
        ctx.lineTo(cx - s * 0.14, cy + s * 0.26);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + s * 0.14, cy - s * 0.26);
        ctx.lineTo(cx + s * 0.36, cy);
        ctx.lineTo(cx + s * 0.14, cy + s * 0.26);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + s * 0.08, cy - s * 0.26);
        ctx.lineTo(cx - s * 0.08, cy + s * 0.26);
        ctx.stroke();
        ctx.restore();
      },
    });

    // core/TodoNode — checklist
    this.register('format-list-checks', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        const xs = cx - s * 0.42;
        for (let i = 0; i < 3; i++) {
          const ry = cy + (i - 1) * s * 0.28;
          ctx.strokeRect(xs, ry - s * 0.1, s * 0.2, s * 0.2);
          if (i === 0) {
            ctx.beginPath();
            ctx.moveTo(xs + s * 0.03, ry);
            ctx.lineTo(xs + s * 0.09, ry + s * 0.08);
            ctx.lineTo(xs + s * 0.18, ry - s * 0.08);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.moveTo(cx - s * 0.14, ry);
          ctx.lineTo(cx + s * 0.42, ry);
          ctx.stroke();
        }
        ctx.restore();
      },
    });

    // logic/AND — AND gate (D shape)
    this.register('logic-and', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        const lx = cx - s * 0.28, bw = s * 0.26, hh = s * 0.26;
        ctx.beginPath();
        ctx.moveTo(lx, cy - hh);
        ctx.lineTo(lx + bw, cy - hh);
        ctx.arc(lx + bw, cy, hh, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(lx, cy + hh);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.5, cy - hh * 0.55);
        ctx.lineTo(lx, cy - hh * 0.55);
        ctx.moveTo(cx - s * 0.5, cy + hh * 0.55);
        ctx.lineTo(lx, cy + hh * 0.55);
        ctx.moveTo(lx + bw + hh, cy);
        ctx.lineTo(cx + s * 0.5, cy);
        ctx.stroke();
        ctx.restore();
      },
    });

    // logic/OR — OR gate (curved body)
    this.register('logic-or', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        const lx = cx - s * 0.3, hh = s * 0.27;
        ctx.beginPath();
        ctx.moveTo(lx, cy - hh);
        ctx.quadraticCurveTo(lx + s * 0.22, cy - hh, lx + s * 0.6, cy);
        ctx.quadraticCurveTo(lx + s * 0.22, cy + hh, lx, cy + hh);
        ctx.quadraticCurveTo(lx + s * 0.14, cy, lx, cy - hh);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.5, cy - hh * 0.54);
        ctx.lineTo(lx + s * 0.06, cy - hh * 0.54);
        ctx.moveTo(cx - s * 0.5, cy + hh * 0.54);
        ctx.lineTo(lx + s * 0.06, cy + hh * 0.54);
        ctx.moveTo(lx + s * 0.6, cy);
        ctx.lineTo(cx + s * 0.5, cy);
        ctx.stroke();
        ctx.restore();
      },
    });

    // logic/NOT — NOT gate (triangle + bubble)
    this.register('logic-not', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        const bx = cx - s * 0.18;
        ctx.beginPath();
        ctx.moveTo(bx - s * 0.28, cy - s * 0.24);
        ctx.lineTo(bx + s * 0.24, cy);
        ctx.lineTo(bx - s * 0.28, cy + s * 0.24);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bx + s * 0.31, cy, s * 0.07, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.5, cy);
        ctx.lineTo(bx - s * 0.28, cy);
        ctx.moveTo(bx + s * 0.38, cy);
        ctx.lineTo(cx + s * 0.5, cy);
        ctx.stroke();
        ctx.restore();
      },
    });

    // math/Add — + symbol
    this.register('plus', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.38);
        ctx.lineTo(cx, cy + s * 0.38);
        ctx.moveTo(cx - s * 0.38, cy);
        ctx.lineTo(cx + s * 0.38, cy);
        ctx.stroke();
        ctx.restore();
      },
    });

    // math/Subtract — – symbol
    this.register('minus', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.38, cy);
        ctx.lineTo(cx + s * 0.38, cy);
        ctx.stroke();
        ctx.restore();
      },
    });

    // math/Multiply — × symbol
    this.register('times', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.3, cy - s * 0.3);
        ctx.lineTo(cx + s * 0.3, cy + s * 0.3);
        ctx.moveTo(cx + s * 0.3, cy - s * 0.3);
        ctx.lineTo(cx - s * 0.3, cy + s * 0.3);
        ctx.stroke();
        ctx.restore();
      },
    });

    // math/Divide — ÷ symbol
    this.register('divide', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.34, cy);
        ctx.lineTo(cx + s * 0.34, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy - s * 0.24, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.24, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    });

    // value/Number — # hash
    this.register('numeric', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.12, cy - s * 0.36);
        ctx.lineTo(cx - s * 0.2, cy + s * 0.36);
        ctx.moveTo(cx + s * 0.12, cy - s * 0.36);
        ctx.lineTo(cx + s * 0.04, cy + s * 0.36);
        ctx.moveTo(cx - s * 0.36, cy - s * 0.12);
        ctx.lineTo(cx + s * 0.36, cy - s * 0.12);
        ctx.moveTo(cx - s * 0.32, cy + s * 0.12);
        ctx.lineTo(cx + s * 0.32, cy + s * 0.12);
        ctx.stroke();
        ctx.restore();
      },
    });

    // value/String — A shape
    this.register('alpha', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.32, cy + s * 0.3);
        ctx.lineTo(cx, cy - s * 0.3);
        ctx.lineTo(cx + s * 0.32, cy + s * 0.3);
        ctx.moveTo(cx - s * 0.17, cy + s * 0.08);
        ctx.lineTo(cx + s * 0.17, cy + s * 0.08);
        ctx.stroke();
        ctx.restore();
      },
    });

    // value/Boolean — on/off toggle pill
    this.register('toggle-switch', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        const pw = s * 0.42, ph = s * 0.21;
        ctx.beginPath();
        ctx.arc(cx + pw - ph, cy, ph, -Math.PI / 2, Math.PI / 2);
        ctx.arc(cx - pw + ph, cy, ph, Math.PI / 2, Math.PI * 1.5);
        ctx.closePath();
        ctx.stroke();
        // circle on right (ON state)
        ctx.beginPath();
        ctx.arc(cx + pw - ph, cy, ph * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },
    });

    // util/Trigger — play triangle in circle
    this.register('play-circle', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.13, cy - s * 0.18);
        ctx.lineTo(cx + s * 0.2, cy);
        ctx.lineTo(cx - s * 0.13, cy + s * 0.18);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      },
    });

    // util/Watch — eye shape
    this.register('eye', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.42, cy);
        ctx.quadraticCurveTo(cx, cy - s * 0.3, cx + s * 0.42, cy);
        ctx.quadraticCurveTo(cx, cy + s * 0.3, cx - s * 0.42, cy);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      },
    });

    // util/Print — printer shape
    this.register('printer', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        // paper (top)
        ctx.strokeRect(cx - s * 0.26, cy - s * 0.38, s * 0.52, s * 0.2);
        // printer body
        ctx.strokeRect(cx - s * 0.36, cy - s * 0.16, s * 0.72, s * 0.3);
        // paper (out)
        ctx.strokeRect(cx - s * 0.26, cy + s * 0.14, s * 0.52, s * 0.2);
        ctx.restore();
      },
    });

    // util/Timer — stopwatch
    this.register('timer', {
      draw(ctx, cx, cy, s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.06, s * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.24);
        ctx.lineTo(cx, cy - s * 0.36);
        ctx.moveTo(cx - s * 0.1, cy - s * 0.36);
        ctx.lineTo(cx + s * 0.1, cy - s * 0.36);
        ctx.moveTo(cx, cy + s * 0.06);
        ctx.lineTo(cx + s * 0.18, cy - s * 0.08);
        ctx.stroke();
        ctx.restore();
      },
    });
  }
}

export const iconManager = new IconManager();
