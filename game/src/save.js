// Save / load via localStorage, wrapped so a missing store never throws.
//
// A checkpoint is the state at the start of the next mission: position,
// cash, health, ammo, completed missions and found packages. It is written
// immediately whenever a mission starts or ends (and on demand with C), so
// progress is never more than one mission old — a failed mission, a bust or
// a closed tab always resumes from the checkpoint, never from scratch.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || !data) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // Storage unavailable (private mode, headless file://) — ignore.
  }
}

// Snapshot the current progress as the checkpoint and write it at once.
export function saveCheckpoint(game) {
  const g = game;
  if (!g.saveData) g.saveData = { cash: g.player.cash, completedMissions: [], packages: 0 };
  const takenIds = g.world.packages.filter((k) => k.taken).map((k) => k.id);
  g.saveData.cash = g.player.cash;
  g.saveData.completedMissions = [...g.missions.completed];
  g.saveData.packages = g.world.packagesTaken;
  g.saveData.packageIds = takenIds;
  g.saveData.checkpoint = {
    x: Math.round(g.player.x),
    y: Math.round(g.player.y),
    cash: g.player.cash,
    hp: g.player.hp,
    ammo: g.player.ammo,
    completedMissions: [...g.missions.completed],
    packages: g.world.packagesTaken,
    packageIds: takenIds,
    nextMission: g.missions.unlocked,
  };
  writeSave(g.saveData);
  return g.saveData.checkpoint;
}

// Put the player back at the checkpoint: position, health, ammo and cash
// restored, the active mission abandoned, the wanted level cleared. Returns
// false when no checkpoint exists yet.
export function applyCheckpoint(game) {
  const g = game;
  const cp = g.saveData?.checkpoint;
  if (!cp) return false;
  const p = g.player;
  p.car = null; // step out of any car, including a wrecked target car
  p.x = cp.x;
  p.y = cp.y;
  p.hp = Math.max(50, cp.hp ?? 100);
  p.ammo = Math.max(12, cp.ammo ?? 48);
  p.cash = cp.cash;
  g.missions.abandon();
  g.police.setStars(0);
  g.saveData.cash = cp.cash;
  g.saveData.completedMissions = [...(cp.completedMissions ?? [])];
  g.missions.completed = new Set(cp.completedMissions ?? []);
  g.missions.unlocked = Math.max(1, Math.min(8, cp.nextMission ?? g.missions.completed.size + 1));
  return true;
}
