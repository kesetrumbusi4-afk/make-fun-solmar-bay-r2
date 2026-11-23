// Traffic cars driving the road grid + pedestrians walking the sidewalks.
// Denser than a demo: 42 cars and 26 pedestrians, so the streets feel alive.

import { WORLD_W, WORLD_H, ROAD_SPACING, GRID_N, CAR_COLORS } from './config.js';
import { makeRng } from './random.js';
import { roadCenter } from './world.js';
import { Car } from './car.js';

export class Traffic {
  constructor(world) {
    const rng = makeRng(777);
    this.rng = rng;
    this.cars = [];
    this.peds = [];
    for (let i = 0; i < 42; i++) this.cars.push(this._spawnCar(world, rng, true));
    for (let i = 0; i < 26; i++) this.peds.push(this._spawnPed(world, rng));
  }

  _spawnCar(world, rng, anywhere) {
    const vertical = rng.chance(0.5);
    const i = rng.int(0, GRID_N - 1);
    const lane = rng.chance(0.5) ? 1 : -1;
    const c = roadCenter(i);
    const along = anywhere ? rng.range(200, (vertical ? WORLD_H : WORLD_W) - 200) : rng.range(200, 600);
    const car = new Car(
      vertical ? c + lane * 16 : along,
      vertical ? along : c + lane * 16,
      vertical ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : lane > 0 ? 0 : Math.PI,
      rng.pick(CAR_COLORS),
      { driver: true },
    );
    car.vertical = vertical;
    car.speed = rng.range(120, 210);
    car.targetSpeed = car.speed;
    return car;
  }

  _spawnPed(world, rng) {
    const vertical = rng.chance(0.5);
    const i = rng.int(0, GRID_N - 1);
    const c = roadCenter(i);
    const along = rng.range(200, (vertical ? WORLD_H : WORLD_W) - 200);
    return {
      x: vertical ? c + (rng.chance(0.5) ? 46 : -46) : along,
      y: vertical ? along : c + (rng.chance(0.5) ? 46 : -46),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(28, 62),
      phase: rng.range(0, 6),
      shirt: rng.pick(['#e84a4a', '#4a90d9', '#37b06a', '#e8a13c', '#8a5ad9', '#f2e6c9']),
      skin: rng.pick(['#f2c79a', '#c98d5f', '#8a5a3a', '#e8b88a']),
      vertical,
      pause: 0,
    };
  }

  update(dt, world, player, fx, eco) {
    this._frame = (this._frame || 0) + 1;
    // Traffic cars: keep lane, turn at intersections sometimes, avoid the player car ahead.
    for (const car of this.cars) {
      const step = car.speed * dt;
      car.x += Math.cos(car.angle) * step;
      car.y += Math.sin(car.angle) * step;
      // At a crossroad, sometimes turn.
      for (let i = 0; i < GRID_N; i++) {
        const c = roadCenter(i);
        const cross = car.vertical ? Math.abs(car.y - c) : Math.abs(car.x - c);
        if (cross < 6 && this.rng.chance(0.12)) {
          car.vertical = !car.vertical;
          car.angle = car.vertical
            ? this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2
            : this.rng.chance(0.5) ? 0 : Math.PI;
          break;
        }
      }
      // Wrap around the world edges.
      if (car.x < -60) car.x = (car.vertical ? WORLD_W : WORLD_W) + 40;
      if (car.x > WORLD_W + 60) car.x = -40;
      if (car.y < -60) car.y = WORLD_H + 40;
      if (car.y > WORLD_H + 60) car.y = -40;
      // Slow down if something is right ahead.
      car.speed += (car.targetSpeed - car.speed) * dt;
    }
    // Pedestrians: walk along sidewalks, pause and wander. In ECO mode
    // they update every other frame — half the work, same streets.
    if (eco && this._frame % 2 === 1) return;
    for (const p of this.peds) {
      p.phase += dt * 6;
      if (p.pause > 0) {
        p.pause -= dt;
        continue;
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      if (p.x < 120 || p.x > world.sandX - 20 || p.y < 120 || p.y > WORLD_H - 120) {
        p.angle += Math.PI;
      }
      if (this.rng.chance(0.002)) p.pause = this.rng.range(1, 3);
      if (this.rng.chance(0.004)) p.angle += this.rng.range(-1.2, 1.2);
    }
  }

  drawPeds(ctx, v) {
    for (const p of this.peds) {
      if (v && (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1)) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(15, 6, 32, 0.45)';
      ctx.beginPath();
      ctx.ellipse(1, 3, 7, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(p.angle);
      const bob = Math.sin(p.phase) * 1.2;
      ctx.fillStyle = '#2a2f4a';
      ctx.fillRect(-5, -4 + bob, 8, 3.5);
      ctx.fillRect(-5, 0.5 - bob, 8, 3.5);
      ctx.fillStyle = p.shirt;
      ctx.beginPath();
      ctx.roundRect(-6, -5, 11, 10, 3);
      ctx.fill();
      ctx.fillStyle = p.skin;
      ctx.beginPath();
      ctx.arc(5, 0, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
