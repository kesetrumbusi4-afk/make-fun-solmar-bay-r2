// Sunset rendering: warm dusk palette, long building shadows, glowing
// windows, street-lamp halos, car headlight beams, and the HUD.
// The camera follows the player; the world is drawn top-down, bigger and
// warmer than a flat demo so the screenshots read as a living city at dusk.

import { WORLD_W, WORLD_H, ROAD_W, GRID_N, PAL } from './config.js';
import { roadCenter, isOnRoad } from './world.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.viewW = 1280;
    this.viewH = 800;
    this.camX = 0;
    this.camY = 0;
    this.zoom = 0.95;
    this.dpr = 1;
    this.time = 0;
  }

  resize(w, h) {
    this.viewW = w;
    this.viewH = h;
  }

  _camTarget(game) {
    const p = game.player;
    return { x: p.x, y: p.y };
  }

  draw(game) {
    const ctx = this.ctx;
    const p = game.player;
    const t = this._camTarget(game);
    const vw = this.viewW / this.zoom;
    const vh = this.viewH / this.zoom;
    this.camX += (t.x - this.camX) * 0.12;
    this.camY += (t.y - this.camY) * 0.12;
    this.camX = Math.max(vw / 2 - 120, Math.min(WORLD_W - vw / 2 + 120, this.camX));
    this.camY = Math.max(vh / 2 - 120, Math.min(WORLD_H - vh / 2 + 120, this.camY));
    const dpr = this.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1a0f2e';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    // World space: center on the camera, then zoom.
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);
    this._drawGround(ctx, game);
    this._drawRoads(ctx, game);
    this._drawParks(ctx, game);
    this._drawBuildings(ctx, game);
    this._drawLamps(ctx, game);
    this._drawPackages(ctx, game);
    this._drawParked(ctx, game);
    game.traffic.cars.forEach((c) => c.draw(ctx));
    game.traffic.drawPeds(ctx);
    game.police.draw(ctx);
    this._drawEnemies(ctx, game);
    if (p.car) p.car.draw(ctx);
    else p.draw(ctx);
    this._drawFx(ctx, game);
    this._drawMarkers(ctx, game);
    this._drawDusk(ctx, game);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._drawHUD(ctx, game);
  }

  _drawGround(ctx, game) {
    const w = game.world;
    ctx.fillStyle = PAL.ground;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // Beach + water on the east edge.
    ctx.fillStyle = PAL.sand;
    ctx.fillRect(w.sandX, 0, w.waterX - w.sandX, WORLD_H);
    ctx.fillStyle = PAL.water;
    ctx.fillRect(w.waterX, 0, WORLD_W - w.waterX, WORLD_H);
    ctx.fillStyle = PAL.waterShine;
    for (let y = 40; y < WORLD_H; y += 130) {
      ctx.fillRect(w.waterX + 30 + ((y * 7) % 120), y, 70, 3);
    }
    // Docks planks.
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(w.sandX + 20, w.docks.y - 60, 90, 120);
  }

  _drawRoads(ctx, game) {
    ctx.fillStyle = PAL.road;
    for (let i = 0; i < GRID_N; i++) {
      const c = roadCenter(i);
      ctx.fillRect(c - ROAD_W / 2, 0, ROAD_W, WORLD_H);
      ctx.fillRect(0, c - ROAD_W / 2, WORLD_W, ROAD_W);
    }
    // Center dashes + crosswalks.
    ctx.fillStyle = PAL.roadLine;
    for (let i = 0; i < GRID_N; i++) {
      const c = roadCenter(i);
      for (let d = 200; d < WORLD_H; d += 64) {
        ctx.fillRect(c - 2, d, 4, 26);
        ctx.fillRect(d, c - 2, 26, 4);
      }
    }
    ctx.fillStyle = PAL.crosswalk;
    for (let i = 0; i < GRID_N; i++) {
      for (let j = 0; j < GRID_N; j++) {
        const cx = roadCenter(i);
        const cy = roadCenter(j);
        for (let k = -2; k <= 2; k++) {
          ctx.fillRect(cx - ROAD_W / 2 + 6 + k * 14, cy - ROAD_W / 2 - 8, 8, 6);
          ctx.fillRect(cx - ROAD_W / 2 + 6 + k * 14, cy + ROAD_W / 2 + 2, 8, 6);
        }
      }
    }
  }

  _drawParks(ctx, game) {
    for (const park of game.world.parks) {
      ctx.fillStyle = PAL.grass;
      ctx.beginPath();
      ctx.roundRect(park.x, park.y, park.w, park.h, 10);
      ctx.fill();
    }
    for (const tree of game.world.trees) {
      ctx.fillStyle = 'rgba(15, 6, 32, 0.4)';
      ctx.beginPath();
      ctx.ellipse(tree.x + 5, tree.y + 6, tree.r, tree.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f6b34';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a8a3a';
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawBuildings(ctx, game) {
    for (const b of game.world.buildings) {
      // Long dusk shadow, cast to the north-east.
      const sh = b.height * 0.9;
      ctx.fillStyle = PAL.shadow;
      ctx.beginPath();
      ctx.moveTo(b.x + 8, b.y + b.h);
      ctx.lineTo(b.x + b.w + sh, b.y + b.h);
      ctx.lineTo(b.x + b.w + sh, b.y + 10);
      ctx.lineTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + 8, b.y);
      ctx.closePath();
      ctx.fill();
      // Walls + roof.
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      ctx.fillStyle = b.roof;
      ctx.beginPath();
      ctx.roundRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10, 3);
      ctx.fill();
      // Glowing windows (most lit at dusk).
      for (const win of b.windows) {
        ctx.fillStyle = win.lit ? PAL.windowLit : PAL.windowDark;
        ctx.fillRect(win.x - 3, win.y - 3, 6, 6);
      }
    }
  }

  _drawLamps(ctx, game) {
    for (const lamp of game.world.streetLamps) {
      const g = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 42);
      g.addColorStop(0, 'rgba(255, 207, 110, 0.5)');
      g.addColorStop(1, 'rgba(255, 207, 110, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcf6e';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawPackages(ctx, game) {
    for (const pkg of game.world.packages) {
      if (pkg.taken) continue;
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 4 + pkg.id);
      ctx.fillStyle = `rgba(255, 215, 106, ${0.25 * pulse})`;
      ctx.beginPath();
      ctx.arc(pkg.x, pkg.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(pkg.x - 6, pkg.y - 6, 12, 12);
      ctx.fillStyle = '#8a5a00';
      ctx.fillRect(pkg.x - 6, pkg.y - 1, 12, 2);
    }
  }

  _drawParked(ctx, game) {
    for (const pc of game.world.parkedCars) {
      if (pc.car) {
        pc.car.draw(ctx);
        continue;
      }
      ctx.save();
      ctx.translate(pc.x, pc.y);
      ctx.rotate(pc.angle);
      ctx.fillStyle = pc.color;
      ctx.beginPath();
      ctx.roundRect(-26, -13, 52, 26, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(20, 24, 48, 0.92)';
      ctx.beginPath();
      ctx.roundRect(-13, -9, 20, 18, 4);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawEnemies(ctx, game) {
    for (const e of game.missions.enemies) {
      if (e.dead) continue;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.fillStyle = 'rgba(15, 6, 32, 0.5)';
      ctx.beginPath();
      ctx.ellipse(2, 4, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a3f5e';
      ctx.beginPath();
      ctx.roundRect(-8, -7, 16, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#f2c79a';
      ctx.beginPath();
      ctx.arc(6, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c1c26';
      ctx.fillRect(12, -1, 9, 3);
      ctx.restore();
      // Enemy health bar.
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - 12, e.y - 22, 24, 4);
      ctx.fillStyle = '#d94f3d';
      ctx.fillRect(e.x - 12, e.y - 22, 24 * Math.max(0, e.hp / 40), 4);
    }
  }

  _drawFx(ctx, game) {
    for (const s of game.fx.skids) {
      ctx.strokeStyle = `rgba(10, 6, 20, ${Math.min(0.5, s.life / 8)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - Math.cos(s.angle) * 14, s.y - Math.sin(s.angle) * 14);
      ctx.stroke();
    }
    for (const pt of game.fx.parts) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawMarkers(ctx, game) {
    const st = game.missions.currentStage;
    const drawMarker = (x, y, color, label) => {
      const bounce = Math.sin(this.time * 3) * 5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - 26 + bounce);
      ctx.lineTo(x + 9, y - 42 + bounce);
      ctx.lineTo(x - 9, y - 42 + bounce);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.stroke();
      if (label) {
        ctx.fillStyle = 'rgba(12, 6, 26, 0.85)';
        const w = ctx.measureText(label).width + 14;
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - 66 + bounce, w, 20, 5);
        ctx.fill();
        ctx.fillStyle = '#ffe9a3';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y - 52 + bounce);
      }
    };
    if (st) {
      const mx = st.pickedUp ? st.dropX ?? st.x : st.x;
      const my = st.pickedUp ? st.dropY ?? st.y : st.y;
      drawMarker(mx, my, '#ffd76a', st.text);
    }
    if (!game.missions.active) {
      const L = game.world.lenasBar;
      drawMarker(L.x, L.y, '#7ae0a3', "Lena's Bar — press M for a mission");
    }
    // Taxi fare waiting.
    if (game.taxiFare && game.taxiFare.state === 'waiting') {
      drawMarker(game.taxiFare.ped.x, game.taxiFare.ped.y, '#3cc1c9', 'TAXI — press T');
    }
  }

  _drawDusk(ctx, game) {
    // Warm sunset wash + vignette so the whole city reads as dusk.
    const vw = this.viewW / this.zoom;
    const vh = this.viewH / this.zoom;
    const g = ctx.createLinearGradient(this.camX - vw / 2, this.camY - vh / 2, this.camX - vw / 2, this.camY + vh / 2);
    g.addColorStop(0, 'rgba(255, 120, 60, 0.05)');
    g.addColorStop(0.6, 'rgba(120, 40, 120, 0.06)');
    g.addColorStop(1, 'rgba(20, 8, 50, 0.14)');
    ctx.fillStyle = g;
    ctx.fillRect(this.camX - vw / 2, this.camY - vh / 2, vw, vh);
  }

  _drawHUD(ctx, game) {
    const p = game.player;
    const vw = this.viewW;
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px system-ui, sans-serif';
    // Top-left: name, health, cash, packages.
    ctx.fillStyle = 'rgba(12, 6, 26, 0.78)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 218, 64, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('JAX MARLOWE', 22, 32);
    ctx.fillStyle = '#222';
    ctx.fillRect(22, 40, 150, 10);
    ctx.fillStyle = p.hp > 50 ? '#37b06a' : p.hp > 25 ? '#e8a13c' : '#d94f3d';
    ctx.fillRect(22, 40, 150 * Math.max(0, p.hp / 100), 10);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`$${p.cash}`, 180, 52);
    ctx.fillStyle = '#c9b8e8';
    ctx.font = '12px system-ui, sans-serif';
    const got = game.world.packages.filter((k) => k.taken).length;
    ctx.fillText(`Packages ${got}/10`, 22, 68);
    // Top-center: objective / message.
    const st = game.missions.currentStage;
    const msg = game.missions.messageTimer > 0 ? game.missions.message : st ? st.text : game.missions.active ? game.missions.active.title : 'Free roam — find Lena at the bar (M)';
    ctx.font = 'bold 14px system-ui, sans-serif';
    const tw = ctx.measureText(msg).width + 28;
    ctx.fillStyle = 'rgba(12, 6, 26, 0.78)';
    ctx.beginPath();
    ctx.roundRect(vw / 2 - tw / 2, 12, tw, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe9a3';
    ctx.textAlign = 'center';
    ctx.fillText(msg, vw / 2, 32);
    ctx.textAlign = 'left';
    // Top-right: wanted stars.
    ctx.fillStyle = 'rgba(12, 6, 26, 0.78)';
    ctx.beginPath();
    ctx.roundRect(vw - 196, 12, 184, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('WANTED', vw - 186, 28);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < game.police.stars ? '#ffd76a' : 'rgba(255,255,255,0.25)';
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText('★', vw - 186 + i * 24, 46);
    }
    // Bottom-left: speed / ammo / controls.
    ctx.fillStyle = 'rgba(12, 6, 26, 0.78)';
    ctx.beginPath();
    ctx.roundRect(12, this.viewH - 76, 230, 64, 8);
    ctx.fill();
    ctx.fillStyle = '#7ae0a3';
    ctx.font = 'bold 20px system-ui, sans-serif';
    const kmh = p.car ? Math.round(Math.abs(p.car.speed) * 0.36) : Math.round(p.speed * 0.36);
    ctx.fillText(`${kmh} km/h`, 22, this.viewH - 50);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`AMMO ${p.ammo}`, 22, this.viewH - 28);
    ctx.fillStyle = '#c9b8e8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(p.car ? 'E — exit car · Space — handbrake' : 'E — enter car · Click — shoot', 96, this.viewH - 28);
    // Mission title banner while active.
    if (game.missions.active) {
      ctx.fillStyle = 'rgba(255, 215, 106, 0.92)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`MISSION ${game.missions.active.id}/8 — ${game.missions.active.title}`, vw / 2, 58);
      ctx.textAlign = 'left';
    }
  }
}
