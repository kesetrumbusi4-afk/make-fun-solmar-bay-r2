// Solmar Bay — game loop, state machine, shooting, car enter/exit, taxi
// side job, hidden packages, busted/respawn, save, and the debug handle
// the headless play-test drives (window.__solmar).

import { WORLD_W, WORLD_H, PERF } from './config.js';
import { World, nearestRoadPoint } from './world.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { Fx } from './fx.js';
import { Renderer } from './render.js';
import { Minimap } from './minimap.js';
import { applyShot } from './shots.js';
import { loadSave, writeSave, saveCheckpoint, applyCheckpoint } from './save.js';
import { Car } from './car.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.world = new World();
    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.fx = new Fx();
    this.renderer = new Renderer(canvas);
    this.minimap = new Minimap(this.world);
    this.player = new Player(this.world.lenasBar.x + 30, this.world.lenasBar.y + 30);
    this.traffic = new Traffic(this.world);
    this.police = new Police(this.world);
    this.missions = new MissionManager(this);
    this.saveData = loadSave() || { cash: 50, completedMissions: [], packages: 0 };
    this.player.cash = this.saveData.cash ?? 50;
    if (Array.isArray(this.saveData.completedMissions)) {
      this.missions.completed = new Set(this.saveData.completedMissions);
      this.missions.unlocked = Math.max(1, Math.min(8, this.missions.completed.size + 1));
    }
    // Restore found packages (by id on new saves, by count on old ones).
    if (Array.isArray(this.saveData.packageIds)) {
      const ids = new Set(this.saveData.packageIds);
      for (const pkg of this.world.packages) if (ids.has(pkg.id)) pkg.taken = true;
      this.world.packagesTaken = this.world.packages.filter((k) => k.taken).length;
    } else {
      this.world.packagesTaken = this.saveData.packages ?? 0;
      let n = this.world.packagesTaken;
      for (const pkg of this.world.packages) {
        if (n <= 0) break;
        pkg.taken = true;
        n--;
      }
    }
    // Restore the checkpoint, if one was saved: position, health, ammo.
    this._restoredCheckpoint = null;
    if (this.saveData.checkpoint) {
      const cp = this.saveData.checkpoint;
      this.player.x = cp.x ?? this.player.x;
      this.player.y = cp.y ?? this.player.y;
      this.player.hp = Math.max(50, cp.hp ?? 100);
      this.player.ammo = Math.max(12, cp.ammo ?? 48);
      this._restoredCheckpoint = cp;
    } else {
      // Fast opening: Jax starts in his own car outside Lena's Bar, so the
      // game opens on a drive, not a walk across the city.
      const starter = new Car(this.world.lenasBar.x + 70, this.world.lenasBar.y + 40, 0, '#e84a4a', {});
      this.player.car = starter;
      this.player.x = starter.x;
      this.player.y = starter.y;
    }
    this.state = 'title'; // title | playing | busted
    this.frozen = false;
    this.time = 0;
    this.taxiFare = null;
    this.fareTimer = 0;
    this.bustedTimer = 0;
    this._lastTs = 0;
    this._saveTimer = 0;
    // Frame-time monitor: EMA of update+draw work; drives ECO mode.
    this.perf = { ema: 16.7, eco: false, frames: 0 };
    this.shot = new URLSearchParams(window.location.search).get('shot');
  }

  start() {
    this._resize();
    window.addEventListener('resize', () => this._resize());
    if (this.shot) {
      this.state = 'playing';
      applyShot(this.shot, this);
    }
    const loop = (ts) => {
      const t0 = performance.now();
      const dt = Math.min(0.05, (ts - this._lastTs) / 1000 || 0.016);
      this._lastTs = ts;
      if (!this.frozen) this.update(dt);
      this.renderer.time = this.time;
      this.renderer.draw(this);
      this.minimap.draw(this.renderer.ctx, this.renderer.viewW, this.renderer.viewH, this);
      if (this.state === 'title') this._drawTitle(this.renderer.ctx);
      if (this.state === 'busted') this._drawBusted(this.renderer.ctx);
      this.input.endFrame();
      requestAnimationFrame(loop);
      // Frame-time monitor: sustained slow frames switch to ECO mode.
      const ms = performance.now() - t0;
      this.perf.ema = this.perf.ema * 0.95 + ms * 0.05;
      this.perf.frames++;
      if (!this.perf.eco && this.perf.ema > PERF.ecoOnMs && this.perf.frames > 90) {
        this.perf.eco = true;
        this.missions.message = 'Performance mode: ECO — fewer effects, same game';
        this.missions.messageTimer = 3;
      } else if (this.perf.eco && this.perf.ema < PERF.ecoOffMs) {
        this.perf.eco = false;
      }
    };
    requestAnimationFrame(loop);
  }

  _resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.renderer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer.dpr = dpr;
    this.renderer.resize(w, h);
  }

  _toWorld(mx, my) {
    const r = this.renderer;
    return {
      x: (mx - r.viewW / 2) / r.zoom + r.camX,
      y: (my - r.viewH / 2) / r.zoom + r.camY,
    };
  }

  update(dt) {
    this.time += dt;
    const inp = this.input;
    const p = this.player;
    if (this.state === 'title') {
      if (inp.pressed('Enter') || inp.mouse.clicked) {
        this.state = 'playing';
        this.audio.ensure();
        this.audio.startMusic();
        // Fast opening: a fresh save jumps straight into Mission 1, so the
        // first minute is a drive with an objective, not a walk to find one.
        if (this.missions.completed.size === 0 && !this.missions.active) {
          this.missions.start(1);
        } else if (this._restoredCheckpoint) {
          this.missions.message = `Checkpoint restored — Mission ${this.missions.unlocked} ready at Lena's Bar`;
          this.missions.messageTimer = 4;
        }
      }
      return;
    }
    if (this.state === 'busted') {
      this.bustedTimer -= dt;
      if (this.bustedTimer <= 0) this._respawn();
      return;
    }
    // First gesture starts audio.
    if (inp.mouse.clicked || inp.pressed('KeyW')) {
      this.audio.ensure();
      this.audio.startMusic();
    }
    // Manual checkpoint (C) and mission retry from the checkpoint (R).
    if (inp.pressed('KeyC')) {
      saveCheckpoint(this);
      this.missions.message = 'Checkpoint saved';
      this.missions.messageTimer = 2;
      this.audio.pickup();
    }
    if (inp.pressed('KeyR') && this.missions.active) {
      applyCheckpoint(this);
      this.missions.message = 'Mission restarted from the checkpoint';
      this.missions.messageTimer = 3;
    }
    // Mission start near Lena's bar.
    const L = this.world.lenasBar;
    const nearLena = Math.hypot(p.x - L.x, p.y - L.y) < 90;
    if (!this.missions.active && nearLena && inp.pressed('KeyM')) {
      this.missions.start(this.missions.unlocked);
    }
    // Enter / exit car.
    if (inp.pressed('KeyE')) {
      if (p.car) this._exitCar();
      else this._tryEnterCar();
    }
    // Taxi side job.
    this._updateTaxi(dt);
    // Driving or walking.
    if (p.car) {
      const skidding = p.car.drive(inp, dt);
      if (skidding) this.fx.skid(p.car.x, p.car.y, p.car.angle);
      p.x = p.car.x;
      p.y = p.car.y;
      p.speed = Math.abs(p.car.speed);
      this.audio.setEngine(Math.abs(p.car.speed) / 560);
      this._collideCar(p.car, dt);
      if (p.car.dead) {
        this.fx.explosion(p.car.x, p.car.y);
        this.audio.crash();
        this._exitCar(true);
        p.hurt(25);
      }
    } else {
      p.updateOnFoot(inp, dt, this.world);
      this.audio.setEngine(0);
    }
    // Shooting (mouse aim).
    if (!p.car && (inp.mouse.down || inp.mouse.clicked) && p.shootCooldown <= 0 && p.ammo > 0) {
      this._shoot();
    }
    // Hidden packages.
    for (const pkg of this.world.packages) {
      if (pkg.taken) continue;
      if (Math.hypot(p.x - pkg.x, p.y - pkg.y) < 30) {
        pkg.taken = true;
        p.cash += 100;
        this.world.packagesTaken += 1;
        this.saveData.packages = this.world.packagesTaken;
        if (!Array.isArray(this.saveData.packageIds)) this.saveData.packageIds = [];
        this.saveData.packageIds.push(pkg.id);
        this.missions.message = `Hidden package found! +$100 (${this.world.packagesTaken}/10)`;
        this.missions.messageTimer = 3;
        this.audio.pickup();
      }
    }
    this.traffic.update(dt, this.world, p, this.fx, this.perf.eco);
    this.police.update(dt, p, this.fx, this.audio);
    this.missions.update(dt);
    this.fx.update(dt);
    // Busted.
    if (p.hp <= 0) {
      this.state = 'busted';
      this.bustedTimer = 2.5;
      this.police.setStars(0);
      p.cash = Math.max(0, Math.floor(p.cash * 0.9));
    }
    // Periodic save.
    this._saveTimer += dt;
    if (this._saveTimer > 10) {
      this._saveTimer = 0;
      this.saveData.cash = p.cash;
      this.saveData.completedMissions = [...this.missions.completed];
      this.saveData.packages = this.world.packagesTaken;
      this.saveData.packageIds = this.world.packages.filter((k) => k.taken).map((k) => k.id);
      writeSave(this.saveData);
    }
  }

  _tryEnterCar() {
    const p = this.player;
    let best = null;
    let bestD = 60;
    const candidates = [];
    for (const c of this.traffic.cars) candidates.push(c);
    for (const pc of this.world.parkedCars) if (pc.car) candidates.push(pc.car);
    else if (!pc.car) candidates.push(pc);
    for (const c of candidates) {
      if (c.dead) continue; // a wrecked car cannot be driven
      const cx = c.x ?? 0;
      const cy = c.y ?? 0;
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) return;
    let car = best;
    if (!(car instanceof Car)) {
      // Parked-car literal -> turn it into a real Car, and drop the literal
      // so the same car is never drawn twice.
      car = new Car(best.x, best.y, best.angle, best.color, {});
      const pi = this.world.parkedCars.indexOf(best);
      if (pi >= 0) this.world.parkedCars.splice(pi, 1);
    }
    if (car.driver) {
      // Stealing an occupied car: the driver flees, heat rises.
      car.driver = false;
      this.police.addHeat(20);
      this.audio.siren();
    }
    const idx = this.traffic.cars.indexOf(car);
    if (idx >= 0) this.traffic.cars.splice(idx, 1);
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    this.audio.pickup();
  }

  _exitCar(wrecked) {
    const p = this.player;
    if (!p.car) return;
    const car = p.car;
    car.speed = 0;
    const side = { x: p.x + Math.cos(car.angle + Math.PI / 2) * 34, y: p.y + Math.sin(car.angle + Math.PI / 2) * 34 };
    if (!this.world.collideCircle(side.x, side.y, 13).hit) {
      p.x = side.x;
      p.y = side.y;
    } else {
      p.x = car.x - 34;
      p.y = car.y;
    }
    p.car = null;
    if (!wrecked) {
      // Leave it as a parked car in the world.
      this.world.parkedCars.push({ x: car.x, y: car.y, angle: car.angle, color: car.color, car });
    }
  }

  _collideCar(car, dt) {
    const hit = this.world.collideCircle(car.x, car.y, 24);
    if (!hit.hit) return;
    // Push out along the smaller penetration axis.
    const b = hit;
    const left = car.x - (b.bx - 24);
    const right = b.bx + b.bw + 24 - car.x;
    const top = car.y - (b.by - 24);
    const bottom = b.by + b.bh + 24 - car.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) car.x = b.bx - 24;
    else if (m === right) car.x = b.bx + b.bw + 24;
    else if (m === top) car.y = b.by - 24;
    else car.y = b.by + b.bh + 24;
    if (Math.abs(car.speed) > 150) {
      this.fx.sparks(car.x, car.y);
      this.audio.crash();
      car.damage(4);
      this.police.addHeat(2);
    }
    car.speed *= 0.35;
  }

  _shoot() {
    const p = this.player;
    p.ammo -= 1;
    p.shootCooldown = 0.22;
    const aim = this._toWorld(this.input.mouse.x, this.input.mouse.y);
    const angle = Math.atan2(aim.y - p.y, aim.x - p.x);
    p.angle = angle;
    this.fx.muzzle(p.x + Math.cos(angle) * 16, p.y + Math.sin(angle) * 16, angle);
    this.audio.shot();
    // Hit the nearest enemy roughly along the aim ray.
    let best = null;
    let bestD = 460;
    for (const e of this.missions.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      const diff = Math.abs(Math.atan2(dy, dx) - angle);
      if (d < bestD && diff < 0.16) {
        bestD = d;
        best = e;
      }
    }
    if (best) {
      best.hp -= 20;
      this.fx.sparks(best.x, best.y);
      if (best.hp <= 0) {
        best.dead = true;
        this.fx.explosion(best.x, best.y);
        this.police.addHeat(20);
      }
      return;
    }
    // Or a police car in the way.
    for (const car of this.police.cars) {
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      const d = Math.hypot(dx, dy);
      const diff = Math.abs(Math.atan2(dy, dx) - angle);
      if (d < 420 && diff < 0.12) {
        car.damage(12);
        this.fx.sparks(car.x, car.y);
        this.police.addHeat(10);
        return;
      }
    }
  }

  _updateTaxi(dt) {
    const p = this.player;
    this.fareTimer -= dt;
    if (!this.taxiFare && p.car && this.fareTimer <= 0 && Math.random() < 0.02) {
      // A pedestrian flags a cab from the sidewalk.
      const near = nearestRoadPoint(p.x, p.y);
      const ped = {
        x: near.x + (Math.random() < 0.5 ? 46 : -46),
        y: near.y + (Math.random() < 0.5 ? 46 : -46),
        angle: 0, speed: 0, phase: 0,
        shirt: '#3cc1c9', skin: '#f2c79a', vertical: false, pause: 0,
      };
      this.taxiFare = { ped, state: 'waiting', destX: 0, destY: 0 };
    }
    const fare = this.taxiFare;
    if (!fare) return;
    if (fare.state === 'waiting') {
      if (Math.hypot(p.x - fare.ped.x, p.y - fare.ped.y) < 46 && this.input.pressed('KeyT')) {
        const dest = nearestRoadPoint(p.x + 900, p.y - 700);
        fare.destX = dest.x;
        fare.destY = dest.y;
        fare.state = 'riding';
        this.missions.message = 'Fare picked up — drive to the marker';
        this.missions.messageTimer = 3;
        this.audio.pickup();
      }
    } else if (fare.state === 'riding') {
      if (Math.hypot(p.x - fare.destX, p.y - fare.destY) < 56) {
        const pay = 50 + Math.floor(Math.random() * 70);
        p.cash += pay;
        this.missions.message = `Fare complete +$${pay}`;
        this.missions.messageTimer = 3;
        this.audio.missionDone();
        this.taxiFare = null;
        this.fareTimer = 30;
      }
    }
  }

  _respawn() {
    const p = this.player;
    p.hp = 100;
    p.x = this.world.hospital.x;
    p.y = this.world.hospital.y;
    p.car = null;
    p.ammo = Math.max(12, p.ammo);
    this.state = 'playing';
    this.missions.message = 'You woke up at the hospital. Lena is waiting.';
    this.missions.messageTimer = 3;
  }

  _drawTitle(ctx) {
    const vw = this.renderer.viewW;
    const vh = this.renderer.viewH;
    ctx.fillStyle = 'rgba(12, 6, 26, 0.62)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('SOLMAR BAY', vw / 2, vh / 2 - 70);
    ctx.fillStyle = '#fff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('An open-world crime game — walk, drive, steal, outrun the law', vw / 2, vh / 2 - 30);
    ctx.fillStyle = '#c9b8e8';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('WASD move · E enter/exit car · Click shoot · M mission · T taxi · C checkpoint · R retry', vw / 2, vh / 2 + 8);
    ctx.fillStyle = '#7ae0a3';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('Press ENTER to start — Mission 1 begins right away', vw / 2, vh / 2 + 52);
    ctx.textAlign = 'left';
  }

  _drawBusted(ctx) {
    const vw = this.renderer.viewW;
    const vh = this.renderer.viewH;
    ctx.fillStyle = 'rgba(20, 4, 10, 0.72)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('BUSTED', vw / 2, vh / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('The Bay PD caught up with Jax. Waking up at the hospital…', vw / 2, vh / 2 + 30);
    ctx.textAlign = 'left';
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.start();

// Debug handle for the headless play-test (not part of the game UI).
window.__solmar = {
  game,
  state() {
    const p = game.player;
    return {
      state: game.state,
      x: Math.round(p.x),
      y: Math.round(p.y),
      hp: Math.round(p.hp),
      cash: p.cash,
      ammo: p.ammo,
      driving: !!p.car,
      stars: game.police.stars,
      mission: game.missions.active ? game.missions.active.id : null,
      stage: game.missions.stageIdx,
      completed: [...game.missions.completed],
      packages: game.world.packages.filter((k) => k.taken).length,
      fps: Math.round(1000 / Math.max(1, game.perf.ema)),
      eco: game.perf.eco,
      checkpoint: game.saveData.checkpoint ? game.saveData.checkpoint.nextMission : null,
      nextMission: game.missions.unlocked,
    };
  },
  checkpoint() {
    return game.saveData.checkpoint || null;
  },
  startMission(id) {
    return game.missions.start(id);
  },
  teleport(x, y) {
    const p = game.player;
    if (p.car) {
      p.car.x = x;
      p.car.y = y;
      p.car.speed = 0;
    }
    p.x = x;
    p.y = y;
  },
  giveCar(color) {
    const car = new Car(game.player.x + 40, game.player.y, 0, color || '#e84a4a', {});
    game.player.car = car;
    return true;
  },
  setWanted(n) {
    game.police.setStars(n);
  },
  damageEnemy() {
    for (const e of game.missions.enemies) {
      e.hp = 0;
      e.dead = true;
    }
    game.missions.enemies = game.missions.enemies.filter((e) => !e.dead);
  },
};
