// A drivable car: arcade physics, building collision, ramming damage.
// Drawn big and detailed for the r2 look: body, cabin, windshield, wheels,
// headlights (dusk) and brake lights.

import { CAR_TUNING } from './config.js';

export class Car {
  constructor(x, y, angle, color, opts = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.color = color;
    this.speed = 0;
    this.w = 52;
    this.h = 26;
    this.hp = opts.hp ?? 100;
    this.police = !!opts.police;
    this.parked = !!opts.parked;
    this.driver = opts.driver ?? null; // traffic car driver present?
    this.target = opts.target || null; // mission target car?
    this.dead = false;
  }

  get radius() {
    return 26;
  }

  drive(input, dt) {
    const t = CAR_TUNING;
    let throttle = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) throttle = 1;
    if (input.down('KeyS') || input.down('ArrowDown')) throttle = -1;
    const handbrake = input.down('Space');
    if (throttle > 0) this.speed += t.accel * dt;
    else if (throttle < 0) {
      this.speed -= this.speed > 20 ? t.brake * dt : t.reverseAccel * dt;
    } else {
      this.speed *= Math.pow(0.4, dt);
      if (Math.abs(this.speed) < 4) this.speed = 0;
    }
    if (handbrake) this.speed *= Math.pow(0.15, dt);
    const maxF = this.police ? t.maxSpeed * 1.06 : t.maxSpeed;
    this.speed = Math.max(-t.maxReverse, Math.min(maxF, this.speed));
    let steer = 0;
    if (input.down('KeyA') || input.down('ArrowLeft')) steer -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) steer += 1;
    const dir = this.speed >= 0 ? 1 : -1;
    const spdF = Math.min(1, Math.abs(this.speed) / 220);
    this.angle += steer * t.steer * spdF * dir * dt * (handbrake ? 1.35 : 1);
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    return handbrake && Math.abs(this.speed) > 120;
  }

  // Simple arcade AI drive toward a point (used by police).
  driveToward(tx, ty, dt) {
    const want = Math.atan2(ty - this.y, tx - this.x);
    let diff = want - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.abs(diff) > 0.12 ? Math.sign(diff) : 0;
    const t = CAR_TUNING;
    this.speed += t.accel * 0.9 * dt;
    this.speed = Math.min(t.maxSpeed * 1.06, this.speed);
    this.angle += steer * t.steer * Math.min(1, Math.abs(this.speed) / 220) * dt;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
  }

  damage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) this.dead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const w = this.w;
    const h = this.h;
    // Shadow.
    ctx.fillStyle = 'rgba(15, 6, 32, 0.45)';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 4, -h / 2 + 5, w, h, 7);
    ctx.fill();
    // Body.
    ctx.fillStyle = this.police ? '#e8eef7' : this.color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (this.police) {
      ctx.fillStyle = '#1d3a6e';
      ctx.fillRect(-6, -h / 2, 12, h);
      ctx.fillStyle = '#c22';
      ctx.fillRect(-w / 2 + 2, -h / 2, 8, 5);
      ctx.fillStyle = '#26d';
      ctx.fillRect(-w / 2 + 2, h / 2 - 5, 8, 5);
    }
    // Cabin + windshield (bigger, readable).
    ctx.fillStyle = 'rgba(20, 24, 48, 0.92)';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 13, -h / 2 + 4, 20, h - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(140, 200, 255, 0.55)';
    ctx.fillRect(-w / 2 + 13, -h / 2 + 5, 4, h - 10);
    // Wheels.
    ctx.fillStyle = '#101018';
    for (const [wx, wy] of [[-w / 2 + 8, -h / 2 - 2], [w / 2 - 10, -h / 2 - 2], [-w / 2 + 8, h / 2 - 2], [w / 2 - 10, h / 2 - 2]]) {
      ctx.fillRect(wx, wy, 9, 5);
    }
    // Headlight beams (dusk) + tail lights.
    ctx.fillStyle = 'rgba(255, 220, 130, 0.28)';
    ctx.beginPath();
    ctx.moveTo(w / 2, -8);
    ctx.lineTo(w / 2 + 46, -20);
    ctx.lineTo(w / 2 + 46, 20);
    ctx.lineTo(w / 2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe9a3';
    ctx.fillRect(w / 2 - 2, -h / 2 + 2, 3, 4);
    ctx.fillRect(w / 2 - 2, h / 2 - 6, 3, 4);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-w / 2 - 1, -h / 2 + 2, 3, 4);
    ctx.fillRect(-w / 2 - 1, h / 2 - 6, 3, 4);
    // Mission target marker.
    if (this.target) {
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.moveTo(0, -h / 2 - 16);
      ctx.lineTo(7, -h / 2 - 28);
      ctx.lineTo(-7, -h / 2 - 28);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
