// Wanted system: 0–5 stars. Crimes raise heat; heat decays when the player
// is calm and out of sight. Police cars spawn to match the level and chase.

import { GRID_N } from './config.js';
import { roadCenter } from './world.js';
import { Car } from './car.js';

export class Police {
  constructor(world) {
    this.world = world;
    this.stars = 0;
    this.heat = 0;
    this.cars = [];
    this.sirenTimer = 0;
    this._spawnCooldown = 0;
  }

  addHeat(amount) {
    this.heat = Math.min(100, this.heat + amount);
    this.stars = Math.max(0, Math.min(5, Math.ceil(this.heat / 20)));
  }

  setStars(n) {
    this.stars = Math.max(0, Math.min(5, n));
    this.heat = this.stars * 20;
  }

  update(dt, player, fx, audio) {
    // Heat decays when no crime is happening.
    if (this.stars > 0) {
      this.heat = Math.max(0, this.heat - dt * 2.2);
      const next = Math.ceil(this.heat / 20);
      if (next < this.stars) this.stars = next;
    }
    // Spawn police to match the level.
    this._spawnCooldown -= dt;
    const want = this.stars > 0 ? Math.min(this.stars, 4) : 0;
    if (this.cars.length < want && this._spawnCooldown <= 0) {
      this._spawnCooldown = 1.2;
      const px = player.car ? player.car.x : player.x;
      const py = player.car ? player.car.y : player.y;
      const angle = Math.random() * Math.PI * 2;
      const car = new Car(px + Math.cos(angle) * 520, py + Math.sin(angle) * 520, angle, '#e8eef7', { police: true });
      car.speed = 200;
      this.cars.push(car);
    }
    if (this.cars.length > want) this.cars.splice(want);
    // Chase + ram.
    const tx = player.car ? player.car.x : player.x;
    const ty = player.car ? player.car.y : player.y;
    for (const car of this.cars) {
      car.driveToward(tx, ty, dt);
      const d = Math.hypot(car.x - tx, car.y - ty);
      if (d < 44) {
        if (player.car) {
          player.car.damage(6 * dt * 10);
          if (Math.random() < dt * 8) fx.sparks(car.x, car.y);
        } else if (player.hurt(14 * dt * 10)) {
          fx.sparks(player.x, player.y);
        }
        // Push apart so the ram does not stick.
        const push = 60 * dt;
        car.x += Math.cos(car.angle) * -push;
        car.y += Math.sin(car.angle) * -push;
      }
      if (car.hp <= 0 || car.dead) {
        fx.explosion(car.x, car.y);
        if (audio) audio.crash();
        this.cars.splice(this.cars.indexOf(car), 1);
      }
    }
    // Siren blips while wanted.
    this.sirenTimer -= dt;
    if (this.stars > 0 && this.sirenTimer <= 0) {
      this.sirenTimer = 4.5;
      if (audio) audio.siren();
    }
  }

  draw(ctx, v) {
    for (const car of this.cars) {
      if (v && (car.x < v.x0 - 30 || car.x > v.x1 + 30 || car.y < v.y0 - 30 || car.y > v.y1 + 30)) continue;
      car.draw(ctx);
    }
  }
}
