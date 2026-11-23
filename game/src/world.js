// Procedural Solmar Bay: road grid, building blocks, beach + water on the
// east edge, parks with trees, parked cars, docks, and key locations.
// Deterministic from a fixed seed so every run builds the same city.

import { WORLD_W, WORLD_H, ROAD_SPACING, ROAD_W, GRID_N, PAL, CAR_COLORS } from './config.js';
import { makeRng } from './random.js';

export function roadCenter(i) {
  return 160 + i * ROAD_SPACING;
}

export function isOnRoad(x, y) {
  for (let i = 0; i < GRID_N; i++) {
    const c = roadCenter(i);
    if (Math.abs(x - c) < ROAD_W / 2 + 6) return true;
    if (Math.abs(y - c) < ROAD_W / 2 + 6) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < GRID_N; i++) {
    const cx = roadCenter(i);
    for (const [px, py] of [[cx, y], [x, cx]]) {
      const d = Math.hypot(px - x, py - y);
      if (d < bestD) {
        bestD = d;
        best = { x: px, y: py };
      }
    }
  }
  return best;
}

export class World {
  constructor() {
    const rng = makeRng(20261124);
    this.rng = rng;
    this.waterX = 2280;
    this.sandX = 2120;
    this.buildings = [];
    this.parks = [];
    this.trees = [];
    this.parkedCars = [];
    this.packages = [];
    this.streetLamps = [];

    // Buildings: one or two per block between roads.
    for (let i = 0; i < GRID_N - 1; i++) {
      for (let j = 0; j < GRID_N - 1; j++) {
        const x0 = roadCenter(i) + ROAD_W / 2 + 10;
        const x1 = roadCenter(i + 1) - ROAD_W / 2 - 10;
        const y0 = roadCenter(j) + ROAD_W / 2 + 10;
        const y1 = roadCenter(j + 1) - ROAD_W / 2 - 10;
        if (x0 > this.sandX) continue; // beach side has no buildings
        const kind = rng.pick(['single', 'double-h', 'double-v', 'tower', 'park']);
        const wall = rng.pick(PAL.buildingWall);
        const roof = rng.pick(PAL.buildingRoof);
        if (kind === 'park') {
          const park = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
          this.parks.push(park);
          const n = rng.int(4, 7);
          for (let t = 0; t < n; t++) {
            this.trees.push({
              x: rng.range(x0 + 14, x1 - 14),
              y: rng.range(y0 + 14, y1 - 14),
              r: rng.range(9, 15),
            });
          }
          continue;
        }
        const h = kind === 'tower' ? rng.range(30, 52) : rng.range(12, 26);
        const mk = (bx, by, bw, bh) => ({
          x: bx, y: by, w: bw, h: bh, color: wall, roof, height: h,
          windows: this._windows(bx, by, bw, bh, rng),
        });
        if (kind === 'single') {
          this.buildings.push(mk(x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16));
        } else if (kind === 'double-h') {
          const mid = (x0 + x1) / 2;
          this.buildings.push(mk(x0 + 8, y0 + 8, mid - x0 - 14, y1 - y0 - 16));
          this.buildings.push(mk(mid + 6, y0 + 8, x1 - mid - 14, y1 - y0 - 16));
        } else {
          const mid = (y0 + y1) / 2;
          this.buildings.push(mk(x0 + 8, y0 + 8, x1 - x0 - 16, mid - y0 - 14));
          this.buildings.push(mk(x0 + 8, mid + 6, x1 - x0 - 16, y1 - mid - 14));
        }
      }
    }

    // Street lamps along the roads (for the dusk glow).
    for (let i = 0; i < GRID_N; i++) {
      for (let j = 0; j < GRID_N - 1; j++) {
        const c = roadCenter(i);
        const along = roadCenter(j) + ROAD_SPACING / 2;
        this.streetLamps.push({ x: c + ROAD_W / 2 + 4, y: along });
        this.streetLamps.push({ x: along, y: c - ROAD_W / 2 - 4 });
      }
    }

    // Parked cars along road edges.
    for (let n = 0; n < 26; n++) {
      const vertical = rng.chance(0.5);
      const i = rng.int(0, GRID_N - 1);
      const j = rng.int(0, GRID_N - 2);
      const c = roadCenter(i);
      const along = roadCenter(j) + rng.range(50, ROAD_SPACING - 50);
      this.parkedCars.push({
        x: vertical ? c + ROAD_W / 2 - 12 : along,
        y: vertical ? along : c + ROAD_W / 2 - 12,
        angle: vertical ? Math.PI / 2 : 0,
        color: rng.pick(CAR_COLORS),
        occupied: false,
      });
    }

    // 10 hidden packages scattered on sidewalks and the beach.
    const spots = [];
    for (let n = 0; n < 10; n++) {
      let x;
      let y;
      if (n < 2) {
        x = rng.range(this.sandX + 20, this.waterX - 30);
        y = rng.range(200, WORLD_H - 200);
      } else {
        x = rng.range(200, this.sandX - 100);
        y = rng.range(200, WORLD_H - 200);
        const p = nearestRoadPoint(x, y);
        x = p.x + (rng.chance(0.5) ? 44 : -44);
        y = p.y + (rng.chance(0.5) ? 44 : -44);
      }
      spots.push({ x, y, taken: false, id: n });
    }
    this.packages = spots;

    // Key locations (all on roads / open ground).
    this.lenasBar = { x: roadCenter(2), y: roadCenter(2) + 4, label: "Lena's Bar" };
    this.bank = { x: roadCenter(4), y: roadCenter(3), label: 'Bay Trust Bank' };
    this.safehouse = { x: roadCenter(1), y: roadCenter(6), label: 'Safehouse' };
    this.garage = { x: roadCenter(5), y: roadCenter(5), label: 'Maro Garage' };
    this.workshop = { x: roadCenter(6), y: roadCenter(2), label: 'Rico Workshop' };
    this.docks = { x: this.sandX + 60, y: roadCenter(4), label: 'Docks' };
    this.hospital = { x: roadCenter(3), y: roadCenter(6), label: 'Hospital' };
  }

  _windows(x, y, w, h, rng) {
    const wins = [];
    const cols = Math.max(2, Math.floor(w / 34));
    const rows = Math.max(2, Math.floor(h / 30));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        wins.push({
          x: x + 12 + (c * (w - 24)) / Math.max(1, cols - 1),
          y: y + 12 + (r * (h - 24)) / Math.max(1, rows - 1),
          lit: rng.chance(0.62),
        });
      }
    }
    return wins;
  }

  // Circle vs building rects: push the circle out, return true on hit.
  collideCircle(x, y, r) {
    for (const b of this.buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) return { hit: true, bx: b.x, by: b.y, bw: b.w, bh: b.h };
    }
    return { hit: false };
  }

  inWater(x, y) {
    return x > this.waterX;
  }
}
