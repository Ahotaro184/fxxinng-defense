// PHASE 1 Blade values live together so provisional tuning can be changed
// without touching the combat branches that consume them.
export const BLADE_CONFIG = Object.freeze({
  id: "blade",
  label: "ブレードゾンビ",
  hp: 5000,
  damage: 1000,
  baseDamage: 1000,
  aoeRadius: 90,
  // Provisional values approved for PHASE 1.
  speed: 5.2,
  range: 68,
  interval: 1.75,
  killCoins: 0,
  displaySize: 184,
  hpBarWidth: 88,
  frames: Object.freeze({
    idle: 2,
    walk: 5,
    attack: 6,
    death: 5,
  }),
  attackFps: 7,
  attackHitFrame: 3,
  deathFps: 4,
  deathFinalHold: 0.75,
  groundSpikeMaxAge: 0.65,
});

export const BLADE_ATTACK_HIT_TIME =
  BLADE_CONFIG.attackHitFrame / BLADE_CONFIG.attackFps;

export const BLADE_DEATH_REMOVE_AFTER =
  BLADE_CONFIG.frames.death / BLADE_CONFIG.deathFps +
  BLADE_CONFIG.deathFinalHold;

/**
 * Uses a crossed-time test so a large frame delta cannot skip attack/03.
 *
 * @param {number} previousElapsed
 * @param {number} currentElapsed
 * @param {number} appliedHits
 */
export function shouldApplyBladeHit(
  previousElapsed,
  currentElapsed,
  appliedHits,
) {
  return (
    appliedHits === 0 &&
    previousElapsed < BLADE_ATTACK_HIT_TIME &&
    currentElapsed >= BLADE_ATTACK_HIT_TIME
  );
}

/**
 * @template {{ team: string; hp: number; x: number; invincible?: boolean }} T
 * @param {readonly T[]} entities
 * @param {number} centerX
 * @returns {T[]}
 */
export function getBladeAreaVictims(entities, centerX) {
  return entities.filter(
    (entity) =>
      entity.team === "ally" &&
      entity.hp > 0 &&
      !entity.invincible &&
      Math.abs(entity.x - centerX) <= BLADE_CONFIG.aoeRadius,
  );
}

/** @param {number} x */
export function createGroundSpike(x) {
  return {
    x,
    age: 0,
    maxAge: BLADE_CONFIG.groundSpikeMaxAge,
    radius: BLADE_CONFIG.aoeRadius,
  };
}

/**
 * @param {number} age
 * @param {number} [maxAge]
 */
export function getGroundSpikeVisual(
  age,
  maxAge = BLADE_CONFIG.groundSpikeMaxAge,
) {
  const safeAge = Math.max(0, Math.min(age, maxAge));
  if (safeAge < 0.18) {
    const progress = safeAge / 0.18;
    return {
      heightScale: 1 - Math.pow(1 - progress, 3),
      opacity: 1,
    };
  }
  if (safeAge < 0.35) {
    return { heightScale: 1, opacity: 1 };
  }
  const fade = Math.min(1, (safeAge - 0.35) / Math.max(0.001, maxAge - 0.35));
  return {
    heightScale: 1 - fade * 0.22,
    opacity: 1 - fade,
  };
}
