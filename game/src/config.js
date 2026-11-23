// Solmar Bay — configuration: world size, sunset palette, tuning.
// Written fresh for the r2 entry. All values are this game's own.

export const WORLD_W = 2560;
export const WORLD_H = 1920;
export const ROAD_SPACING = 320;
export const ROAD_W = 72;
export const GRID_N = 8; // roads at 160 + i*320, i = 0..7

// Sunset / dusk palette — warm oranges and purples, the r2 look.
export const PAL = {
  ground: '#3a2b4d',
  sidewalk: '#54406b',
  road: '#241a33',
  roadLine: '#e8c26a',
  crosswalk: '#d8cdb4',
  grass: '#2f5233',
  sand: '#d9a05b',
  water: '#274b7d',
  waterShine: '#4a7fb8',
  buildingRoof: ['#6b4a7a', '#7a4a52', '#4a5a7a', '#8a5a3a', '#5a6b4a', '#7a3a5a'],
  buildingWall: ['#4a3360', '#5a2f45', '#333f60', '#6b4426', '#3f5230', '#5e2b4a'],
  windowLit: '#ffd76a',
  windowDark: '#2a1f3d',
  shadow: 'rgba(20, 8, 40, 0.42)',
  glow: 'rgba(255, 190, 80, 0.20)',
  lamp: '#ffcf6e',
};

export const PLAYER = {
  walkSpeed: 190,
  runSpeed: 260,
  hpMax: 100,
  startCash: 50,
  startAmmo: 48,
};

export const CAR_TUNING = {
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 0.92,
};

// Palette of car body colours (warm, dusk-friendly).
export const CAR_COLORS = ['#e84a4a', '#e8a13c', '#4a90d9', '#37b06a', '#f2e6c9', '#8a5ad9', '#d94f8a', '#3cc1c9'];
export const POLICE_COLOR = '#dfe8f2';

export const MISSION_REWARDS = [150, 300, 500, 800, 1500, 900, 700, 1200];
export const TAXI_FARE = [50, 70, 90, 120];
export const PACKAGE_VALUE = 100;
export const HIDDEN_PACKAGES = 10;

export const SAVE_KEY = 'solmar-bay-r2-save-v1';
