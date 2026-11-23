// Minimap: a small live top-down map drawn on the main canvas — roads,
// water, buildings, the player arrow, mission marker, police and fares.

import { WORLD_W, WORLD_H, ROAD_W, GRID_N } from './config.js';
import { roadCenter } from './world.js';

export class Minimap {
  constructor(world) {
    this.world = world;
  }

  draw(ctx, viewW, viewH, game) {
    const size = 178;
    const x0 = viewW - size - 14;
    const y0 = viewH - size - 14;
    const s = size / WORLD_W;
    ctx.save();
    ctx.fillStyle = 'rgba(12, 6, 26, 0.82)';
    ctx.beginPath();
    ctx.roundRect(x0 - 6, y0 - 6, size + 12, size + 12, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 215, 106, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    // Water + sand.
    ctx.fillStyle = '#274b7d';
    ctx.fillRect(x0 + this.world.waterX * s, y0, size, size);
    ctx.fillStyle = '#d9a05b';
    ctx.fillRect(x0 + this.world.sandX * s, y0, (this.world.waterX - this.world.sandX) * s, size);
    // Ground.
    ctx.fillStyle = '#3a2b4d';
    ctx.fillRect(x0, y0, this.world.sandX * s, size);
    // Roads.
    ctx.fillStyle = '#241a33';
    for (let i = 0; i < GRID_N; i++) {
      const c = roadCenter(i) * s;
      ctx.fillRect(x0 + c - (ROAD_W / 2) * s, y0, ROAD_W * s, size);
      ctx.fillRect(x0, y0 + c - (ROAD_W / 2) * s, size, ROAD_W * s);
    }
    // Buildings.
    ctx.fillStyle = '#5a3a72';
    for (const b of this.world.buildings) {
      ctx.fillRect(x0 + b.x * s, y0 + b.y * s, b.w * s, b.h * s);
    }
    // Hidden packages.
    ctx.fillStyle = '#ffd76a';
    for (const p of this.world.packages) {
      if (!p.taken) ctx.fillRect(x0 + p.x * s - 1.5, y0 + p.y * s - 1.5, 3, 3);
    }
    // Mission marker.
    const st = game.missions.currentStage;
    if (st) {
      const mx = x0 + (st.pickedUp ? st.dropX ?? st.x : st.x) * s;
      const my = y0 + (st.pickedUp ? st.dropY ?? st.y : st.y) * s;
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(mx, my, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Police.
    ctx.fillStyle = '#4a90d9';
    for (const car of game.police.cars) {
      ctx.beginPath();
      ctx.arc(x0 + car.x * s, y0 + car.y * s, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const px = x0 + game.player.x * s;
    const py = y0 + game.player.y * s;
    ctx.fillStyle = '#fff';
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(game.player.car ? game.player.car.angle : game.player.angle);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }
}
