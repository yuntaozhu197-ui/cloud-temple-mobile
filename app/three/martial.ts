export const MARTIAL_DURATION = 10.8;
export const MARTIAL_BEATS = [1.1, 1.7, 2.3, 3.5, 5.2, 6.5, 8.1] as const;

function smooth(time: number, start: number, end: number) {
  const value = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return value * value * (3 - 2 * value);
}

function strike(time: number, impact: number, windup: number, recovery: number) {
  return smooth(time, impact - windup, impact) * (1 - smooth(time, impact, impact + recovery));
}

/** Shared seconds-based choreography keeps the performer, sound and courtyard effects in step. */
export function sampleMartial(seconds: number) {
  const time = Number.isFinite(seconds) ? Math.max(0, Math.min(MARTIAL_DURATION, seconds)) : 0;
  const activity = smooth(time, 0, 0.5) * (1 - smooth(time, 10.1, MARTIAL_DURATION));
  const leftPunch = strike(time, MARTIAL_BEATS[0], 0.24, 0.35) + strike(time, MARTIAL_BEATS[2], 0.24, 0.4);
  const rightPunch = strike(time, MARTIAL_BEATS[1], 0.24, 0.35);
  const sideKick = strike(time, MARTIAL_BEATS[3], 0.52, 0.65);
  const airKick = strike(time, MARTIAL_BEATS[4], 0.4, 0.62);
  const flight = Math.max(0, Math.min(1, (time - 4.4) / 2.1));
  const jump = Math.sin(flight * Math.PI);
  const spin = smooth(time, 4.45, 6.3) * Math.PI * 2;
  const landing = strike(time, MARTIAL_BEATS[5], 0.1, 0.8);
  const palm = strike(time, MARTIAL_BEATS[6], 0.5, 0.6);
  const salute = smooth(time, 8.65, 9.3) * (1 - smooth(time, 10.1, MARTIAL_DURATION));
  return {
    activity,
    leftPunch,
    rightPunch,
    sideKick,
    airKick,
    jump,
    spin,
    landing,
    palm,
    salute,
    stance: activity * (1 - jump * 0.82),
    travelX: Math.sin(flight * Math.PI * 2) * jump * 0.55,
    travelZ: jump * 0.48 + (leftPunch + rightPunch) * 0.12,
    flutter: jump * (0.75 + Math.sin(time * 28) * 0.25) + sideKick * 0.25,
  };
}
