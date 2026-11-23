// Eight story missions for Jax Marlowe and his fixer Lena, plus the taxi
// side job. Each mission is a list of stages: go to a marker, hold a spot,
// pick things up, deliver, or survive. Stages complete by proximity or by
// holding position; the manager pays the reward and unlocks the next one.

import { MISSION_REWARDS, PERF } from './config.js';
import { Car } from './car.js';
import { saveCheckpoint, applyCheckpoint } from './save.js';

function stage(type, x, y, opts = {}) {
  return { type, x, y, radius: opts.radius ?? 56, seconds: opts.seconds ?? 0, text: opts.text ?? '', done: false, timer: 0 };
}

export function buildMissions(world) {
  const L = world.lenasBar;
  const B = world.bank;
  const S = world.safehouse;
  const G = world.garage;
  const W = world.workshop;
  const D = world.docks;
  const H = world.hospital;
  const rc = (i) => 160 + i * 320;
  return [
    {
      id: 1, title: 'First Fare',
      brief: "Lena: 'A fare is waiting at the pier road. Pick them up and get them to the hotel before the meter runs out.'",
      reward: MISSION_REWARDS[0],
      stages: [
        stage('goto', rc(6), rc(1), { text: 'Pick up the passenger' }),
        stage('goto', rc(2), rc(5), { text: 'Drop them at the hotel — beat the clock', seconds: 45 }),
      ],
    },
    {
      id: 2, title: 'Package Run',
      brief: "Lena: 'Three packages, three corners of the Bay. Grab them all and bring them back to me.'",
      reward: MISSION_REWARDS[1],
      stages: [
        stage('pickup', rc(1), rc(1), { text: 'Collect package (1/3)' }),
        stage('pickup', rc(6), rc(6), { text: 'Collect package (2/3)' }),
        stage('pickup', rc(3), rc(2), { text: 'Collect package (3/3)' }),
        stage('goto', L.x, L.y, { text: 'Return to Lena' }),
      ],
    },
    {
      id: 3, title: 'Hot Wheels',
      brief: "Lena: 'A red Comet S sits outside the Maro Garage. Take it. Don't scratch it. Bring it to Rico.'",
      reward: MISSION_REWARDS[2],
      stages: [
        stage('steal', G.x, G.y, { text: 'Steal the red Comet S' }),
        stage('goto', W.x, W.y, { text: 'Deliver it to Rico Workshop' }),
      ],
    },
    {
      id: 4, title: 'The Informant',
      brief: "Lena: 'My informant waits in the park. Hear him out — then the cops will come. Lose them at the safehouse.'",
      reward: MISSION_REWARDS[3],
      stages: [
        stage('goto', rc(3), rc(4), { text: 'Meet the informant in the park' }),
        stage('hold', rc(3), rc(4), { seconds: 3, text: 'Hear him out — hold position' }),
        stage('goto', S.x, S.y, { text: 'Escape the police — reach the safehouse' }),
      ],
    },
    {
      id: 5, title: 'The Big Score',
      brief: "Lena: 'The Bay Trust bank, Friday evening. Grab the cash and outrun a three-star response to the safehouse.'",
      reward: MISSION_REWARDS[4],
      stages: [
        stage('goto', B.x, B.y, { text: 'Reach the Bay Trust Bank' }),
        stage('hold', B.x, B.y, { seconds: 3, text: 'Grab the cash — hold position' }),
        stage('goto', S.x, S.y, { text: 'Outrun the police — reach the safehouse' }),
      ],
    },
    {
      id: 6, title: 'Night Shift',
      brief: "Lena: 'Five fares, one night. The city never sleeps and neither do the tips.'",
      reward: MISSION_REWARDS[5],
      stages: [
        stage('taxi', rc(1), rc(3), { text: 'Fare 1/5 — pick up' }),
        stage('taxi', rc(5), rc(1), { text: 'Fare 2/5 — pick up' }),
        stage('taxi', rc(2), rc(6), { text: 'Fare 3/5 — pick up' }),
        stage('taxi', rc(6), rc(4), { text: 'Fare 4/5 — pick up' }),
        stage('taxi', rc(4), rc(6), { text: 'Fare 5/5 — pick up' }),
      ],
    },
    {
      id: 7, title: 'Dockside Deal',
      brief: "Lena: 'A crate waits at the docks. The patrols are watching the pier — keep it quiet, bring it back.'",
      reward: MISSION_REWARDS[6],
      stages: [
        stage('pickup', D.x, D.y, { text: 'Pick up the crate at the docks' }),
        stage('goto', L.x, L.y, { text: 'Deliver it to Lena — stay out of trouble' }),
      ],
    },
    {
      id: 8, title: 'Grand Theft Bay',
      brief: "Lena: 'One last job. A race-spec Veloce sits behind the fenced garage on the east side. Take it, lose the heat, deliver it to Rico.'",
      reward: MISSION_REWARDS[7],
      stages: [
        stage('steal', rc(6), rc(5), { text: 'Steal the Veloce from the fenced garage' }),
        stage('goto', W.x, W.y, { text: 'Deliver it to Rico Workshop' }),
      ],
    },
  ];
}

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.defs = buildMissions(game.world);
    this.unlocked = 1;
    this.active = null;
    this.stageIdx = 0;
    this.stageTimer = 0;
    this.fareTimer = 0;
    this.enemies = [];
    this.targetCar = null;
    this.completed = new Set(game.save?.completedMissions ?? []);
    this.unlocked = Math.max(1, Math.min(8, (this.completed.size || 0) + 1));
    this.message = '';
    this.messageTimer = 0;
    this._stageTime = 0;
    this._stuckHint = false;
  }

  get currentStage() {
    if (!this.active) return null;
    return this.active.stages[this.stageIdx] ?? null;
  }

  start(id) {
    const def = this.defs.find((d) => d.id === id);
    if (!def || id > this.unlocked) return false;
    this.active = def;
    this.stageIdx = 0;
    this.stageTimer = 0;
    this._stageTime = 0;
    this._stuckHint = false;
    this.enemies = [];
    this.message = `Mission: ${def.title} — checkpoint saved`;
    this.messageTimer = 3;
    const g = this.game;
    // Mission-specific setups.
    if (id === 3) {
      const car = new Car(g.world.garage.x + 40, g.world.garage.y + 30, 0, '#e84a4a', { target: true });
      car.parked = true;
      g.world.parkedCars.push({ x: car.x, y: car.y, angle: 0, color: '#e84a4a', car });
      this.targetCar = car;
    }
    if (id === 4) {
      g.police.setStars(2);
    }
    if (id === 5) {
      g.police.setStars(3);
      this._spawnGuards(g.world.bank.x, g.world.bank.y, 2);
    }
    if (id === 8) {
      const car = new Car(160 + 6 * 320 + 30, 160 + 5 * 320 + 20, Math.PI / 2, '#ffd76a', { target: true });
      car.parked = true;
      g.world.parkedCars.push({ x: car.x, y: car.y, angle: Math.PI / 2, color: '#ffd76a', car });
      this.targetCar = car;
      this._spawnGuards(car.x, car.y, 2);
    }
    if (g.audio) g.audio.pickup();
    // Checkpoint at mission start: a failure or a closed tab resumes here,
    // never from the beginning of the game.
    saveCheckpoint(g);
    return true;
  }

  _spawnGuards(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.enemies.push({
        x: x + (i - 0.5) * 70,
        y: y + 60,
        hp: 40,
        angle: 0,
        cooldown: 0,
        speed: 90,
        dead: false,
      });
    }
  }

  update(dt) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    const g = this.game;
    // Enemies walk toward the player and shoot.
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = g.player.x - e.x;
      const dy = g.player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.angle = Math.atan2(dy, dx);
      if (d > 260) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
      }
      e.cooldown -= dt;
      if (d < 420 && e.cooldown <= 0) {
        e.cooldown = 1.1;
        if (Math.random() < 0.6 && g.player.hurt(6)) {
          g.fx.sparks(g.player.x, g.player.y);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (!this.active) return;
    const st = this.currentStage;
    if (!st) return;
    const px = g.player.car ? g.player.car.x : g.player.x;
    const py = g.player.car ? g.player.car.y : g.player.y;
    const d = Math.hypot(px - st.x, py - st.y);
    if (st.type === 'goto' || st.type === 'pickup' || st.type === 'steal') {
      if (d < st.radius) {
        if (st.type === 'steal') {
          if (!this.targetCar || this.targetCar.dead) {
            // Target wrecked or gone: park a fresh one at the marker so the
            // mission can always be finished — no soft-lock.
            const car = new Car(
              st.x + 30, st.y + 20, this.active.id === 8 ? Math.PI / 2 : 0,
              this.active.id === 8 ? '#ffd76a' : '#e84a4a', { target: true },
            );
            car.parked = true;
            g.world.parkedCars.push({ x: car.x, y: car.y, angle: car.angle, color: car.color, car });
            this.targetCar = car;
            this.message = 'A fresh target car is waiting at the marker';
            this.messageTimer = 3;
            return;
          }
          if (g.player.car && g.player.car !== this.targetCar) {
            // Sitting in the wrong car: step out so the target can be taken.
            g._exitCar();
            this.message = 'Out of that car — take the target car';
            this.messageTimer = 2;
            return;
          }
          if (this.targetCar && !g.player.car) {
            // Player must be in the target car: auto-enter when close.
            g.player.car = this.targetCar;
            this.targetCar.parked = false;
            g.player.x = this.targetCar.x;
            g.player.y = this.targetCar.y;
            if (g.audio) g.audio.pickup();
          } else if (g.player.car === this.targetCar) {
            this._advance();
          }
          return;
        }
        if (st.type === 'pickup' && g.audio) g.audio.pickup();
        this._advance();
      }
    } else if (st.type === 'hold') {
      if (d < st.radius) {
        st.timer += dt;
        if (st.timer >= st.seconds) this._advance();
      } else {
        st.timer = Math.max(0, st.timer - dt * 2);
      }
    } else if (st.type === 'taxi') {
      // Taxi stage: reach the fare, then it becomes a drop-off at a new point.
      if (!st.pickedUp && d < st.radius) {
        st.pickedUp = true;
        const dests = [
          [160 + 2 * 320, 160 + 2 * 320],
          [160 + 5 * 320, 160 + 5 * 320],
          [160 + 1 * 320, 160 + 5 * 320],
          [160 + 6 * 320, 160 + 2 * 320],
          [160 + 3 * 320, 160 + 1 * 320],
        ];
        const dest = dests[(this.active.id * 3 + this.stageIdx) % dests.length];
        st.dropX = dest[0];
        st.dropY = dest[1];
        st.text = st.text.replace('pick up', 'drop off');
        if (g.audio) g.audio.pickup();
      } else if (st.pickedUp) {
        const dd = Math.hypot(px - st.dropX, py - st.dropY);
        if (dd < st.radius) {
          g.player.cash += 90;
          this._advance();
        }
      }
    }
    // Timed stages.
    if (st.seconds > 0 && st.type === 'goto') {
      this.fareTimer += dt;
      if (this.fareTimer > st.seconds) {
        this.fareTimer = 0;
        // Fail back to the checkpoint: position, health and progress
        // restored, so a failed mission costs seconds, not hours.
        const restored = applyCheckpoint(g);
        this.active = null;
        this.message = restored
          ? 'Too slow — mission failed. Back at the checkpoint, press M to retry.'
          : 'Too slow — mission failed. Try again from Lena.';
        this.messageTimer = 4;
      }
    }
    // Stuck detector: a stage that makes no progress for two minutes gets
    // an escape hatch instead of a dead end.
    if (this.active) {
      this._stageTime += dt;
      if (this._stageTime > PERF.stuckHintSeconds && !this._stuckHint) {
        this._stuckHint = true;
        this.message = 'Stuck? Press R to restart this mission from the checkpoint';
        this.messageTimer = 5;
      }
    }
  }

  _advance() {
    const g = this.game;
    this.stageIdx += 1;
    this.fareTimer = 0;
    this._stageTime = 0;
    this._stuckHint = false;
    if (this.stageIdx >= this.active.stages.length) {
      const def = this.active;
      g.player.cash += def.reward;
      this.completed.add(def.id);
      this.unlocked = Math.max(this.unlocked, Math.min(8, def.id + 1));
      this.message = `Mission complete: ${def.title}  +$${def.reward} — checkpoint saved`;
      this.messageTimer = 4;
      if (g.audio) g.audio.missionDone();
      if (g.saveData) {
        g.saveData.completedMissions = [...this.completed];
        g.saveData.cash = g.player.cash;
      }
      // Checkpoint at once: progress is never more than one mission old.
      saveCheckpoint(g);
      this.active = null;
      this.enemies = [];
      this.targetCar = null;
    }
  }

  abandon() {
    this.active = null;
    this.enemies = [];
    this.targetCar = null;
  }
}
