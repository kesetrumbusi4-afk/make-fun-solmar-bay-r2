// Particles: explosions, muzzle flashes, sparks, smoke, skid marks.

export class Fx {
  constructor() {
    this.parts = [];
    this.skids = [];
  }

  burst(x, y, n, colors, speed, life, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.5 + Math.random() * 0.5),
        maxLife: life,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: size * (0.6 + Math.random() * 0.8),
      });
    }
  }

  explosion(x, y) {
    this.burst(x, y, 26, ['#ff9d2e', '#ffd76a', '#ff5a2e', '#8a8a8a'], 260, 0.9, 7);
    this.burst(x, y, 12, ['#5a5a6a', '#3a3a4a'], 90, 1.6, 11);
  }

  muzzle(x, y, angle) {
    for (let i = 0; i < 5; i++) {
      this.parts.push({
        x: x + Math.cos(angle) * 14,
        y: y + Math.sin(angle) * 14,
        vx: Math.cos(angle + (Math.random() - 0.5) * 0.6) * 320,
        vy: Math.sin(angle + (Math.random() - 0.5) * 0.6) * 320,
        life: 0.12,
        maxLife: 0.12,
        color: '#ffe9a3',
        size: 3,
      });
    }
  }

  sparks(x, y) {
    this.burst(x, y, 8, ['#ffd76a', '#ffffff', '#ff9d2e'], 200, 0.35, 2.5);
  }

  smoke(x, y) {
    this.parts.push({
      x, y,
      vx: (Math.random() - 0.5) * 20,
      vy: -30 - Math.random() * 20,
      life: 1.2,
      maxLife: 1.2,
      color: '#6a6a7a',
      size: 9,
    });
  }

  skid(x, y, angle) {
    this.skids.push({ x, y, angle, life: 6 });
    if (this.skids.length > 220) this.skids.shift();
  }

  update(dt) {
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.4 * dt;
      p.vy *= 1 - 2.4 * dt;
      p.life -= dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const s of this.skids) s.life -= dt;
    this.skids = this.skids.filter((s) => s.life > 0);
  }
}
