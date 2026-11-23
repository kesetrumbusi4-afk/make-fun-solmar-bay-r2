// Deterministic staged scenes for screenshots (?shot=cover|drive|mission|start).
// Each scene places the player, cars, police and particles, then freezes the
// world so a headless screenshot captures the same frame every time.

import { Car } from './car.js';

export function applyShot(name, game) {
  const g = game;
  const w = g.world;
  const rc = (i) => 160 + i * 320;
  if (name === 'cover') {
    // Police chase at dusk: wanted 3, three police cars, explosion behind.
    g.player.x = rc(3);
    g.player.y = rc(3);
    const car = new Car(rc(3), rc(3), 0, '#e84a4a', {});
    car.speed = 420;
    g.player.car = car;
    g.police.setStars(3);
    g.police.cars = [];
    for (let i = 0; i < 3; i++) {
      const pc = new Car(rc(3) - 130 - i * 70, rc(3) + (i - 1) * 46, 0, '#e8eef7', { police: true });
      pc.speed = 400;
      g.police.cars.push(pc);
    }
    g.fx.explosion(rc(3) + 190, rc(3) - 60);
    g.fx.explosion(rc(3) + 260, rc(3) + 40);
    g.missions.unlocked = 8;
    g.missions.start(5);
    g.missions.stageIdx = 2;
    g.player.cash = 450;
    g.player.ammo = 12;
    g.player.hp = 78;
  } else if (name === 'drive') {
    // Sunset drive along the beach road, water on the right.
    g.player.x = 2060;
    g.player.y = rc(4);
    const car = new Car(2060, rc(4), Math.PI / 2, '#4a90d9', {});
    car.speed = 380;
    g.player.car = car;
    g.player.cash = 320;
    g.player.ammo = 48;
  } else if (name === 'mission') {
    // On foot at the bank, guards nearby, "Grab the cash" objective.
    g.player.x = w.bank.x - 40;
    g.player.y = w.bank.y + 90;
    g.player.angle = -Math.PI / 2;
    g.player.cash = 150;
    g.player.ammo = 24;
    g.missions.unlocked = 8;
    g.missions.start(5);
    g.missions.stageIdx = 1;
    g.missions.enemies = [
      { x: w.bank.x + 60, y: w.bank.y + 70, hp: 40, angle: Math.PI, cooldown: 0, speed: 90, dead: false },
      { x: w.bank.x - 90, y: w.bank.y + 40, hp: 40, angle: 0, cooldown: 0, speed: 90, dead: false },
    ];
  } else if (name === 'start') {
    g.state = 'title';
    g.player.x = rc(3);
    g.player.y = rc(3);
    const car = new Car(rc(3) + 60, rc(3), Math.PI / 2, '#e8a13c', {});
    g.player.car = car;
  }
  // Center the camera on the player immediately, then freeze.
  g.renderer.camX = g.player.x;
  g.renderer.camY = g.player.y;
  g.frozen = true;
}
