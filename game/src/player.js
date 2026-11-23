// The player: Jax Marlowe. On foot (walk/run, visible character with a
// facing direction) or driving a stolen car. Health, cash, ammo, shooting.

import { PLAYER } from './config.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.hp = PLAYER.hpMax;
    this.cash = PLAYER.startCash;
    this.ammo = PLAYER.startAmmo;
    this.car = null;
    this.speed = 0;
    this.walkPhase = 0;
    this.shootCooldown = 0;
    this.invuln = 0;
  }

  get radius() {
    return 13;
  }

  get driving() {
    return !!this.car;
  }

  updateOnFoot(input, dt, world) {
    const a = input.axis();
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const sp = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let vx = a.x;
    let vy = a.y;
    const len = Math.hypot(vx, vy);
    if (len > 0) {
      vx /= len;
      vy /= len;
      this.angle = Math.atan2(vy, vx);
      this.walkPhase += dt * (running ? 11 : 8);
    }
    const nx = this.x + vx * sp * dt;
    const ny = this.y + vy * sp * dt;
    const hit = world.collideCircle(nx, ny, this.radius);
    if (!hit.hit && !world.inWater(nx, ny)) {
      this.x = nx;
      this.y = ny;
    } else {
      const hx = world.collideCircle(nx, this.y, this.radius);
      if (!hx.hit && !world.inWater(nx, this.y)) this.x = nx;
      else {
        const hy = world.collideCircle(this.x, ny, this.radius);
        if (!hy.hit && !world.inWater(this.x, ny)) this.y = ny;
      }
    }
    this.speed = len > 0 ? sp : 0;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
  }

  hurt(amount) {
    if (this.invuln > 0) return false;
    this.hp -= amount;
    this.invuln = 0.5;
    return true;
  }

  heal(amount) {
    this.hp = Math.min(PLAYER.hpMax, this.hp + amount);
  }

  draw(ctx) {
    if (this.car) return; // car draws the driver
    ctx.save();
    ctx.translate(this.x, this.y);
    // Shadow.
    ctx.fillStyle = 'rgba(15, 6, 32, 0.5)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(this.angle);
    const bob = Math.sin(this.walkPhase) * 1.5;
    // Legs (walking bob).
    ctx.fillStyle = '#2a2f4a';
    ctx.fillRect(-7, -6 + bob, 12, 5);
    ctx.fillRect(-7, 1 - bob, 12, 5);
    // Body — warm jacket, visible at dusk.
    ctx.fillStyle = '#e8862e';
    ctx.beginPath();
    ctx.roundRect(-9, -8, 18, 16, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Head.
    ctx.fillStyle = '#f2c79a';
    ctx.beginPath();
    ctx.arc(7, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.arc(8, 0, 6.5, -1.2, 1.2);
    ctx.fill();
    // Arm + gun when aiming.
    ctx.strokeStyle = '#2a2f4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(16, 2);
    ctx.stroke();
    ctx.fillStyle = '#1c1c26';
    ctx.fillRect(14, 0, 9, 3);
    ctx.restore();
  }
}
