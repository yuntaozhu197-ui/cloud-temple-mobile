type Position = { x: number; z: number; heading: number };
type MotionSample = Position & { at: number };
const INTERPOLATION_MS = 120;
const EXTRAPOLATION_MS = 250;
const MAX_SPEED = 4.5;
const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const finite = (value: MotionSample) => [value.x, value.z, value.heading, value.at].every(Number.isFinite);
const bounded = (value: Position): Position => ({
  x: Math.max(-51.5, Math.min(51.5, value.x)), z: Math.max(-39.5, Math.min(39.5, value.z)),
  heading: Math.atan2(Math.sin(value.heading), Math.cos(value.heading)),
});

/** A short delayed path removes network jitter while retaining the actual turns. */
export function createRemoteMotion(initial: Position, timestamp = Date.now()) {
  let points: MotionSample[] = [{ ...bounded(initial), at: timestamp }];
  let lastServerAt = -Infinity;
  let clockOffset: number | null = null;
  let lastFrameAt = timestamp;
  const rendered = { ...bounded(initial), moving: false };

  function reset(position: Position, time = Date.now()) {
    const next = bounded(position);
    points = [{ ...next, at: time }];
    lastServerAt = -Infinity;
    clockOffset = null;
    lastFrameAt = time;
    Object.assign(rendered, next, { moving: false });
  }

  return {
    push(sample: MotionSample, receivedAt = Date.now()) {
      if (!finite(sample) || !Number.isFinite(receivedAt) || sample.at <= lastServerAt) return;
      const next = bounded(sample);
      const previous = points[points.length - 1];
      const lag = receivedAt - sample.at;
      if (clockOffset === null) clockOffset = lag;
      else if (lag < clockOffset) {
        // A shorter observed transit time improves clock alignment without stretching old paths.
        const correction = Math.max(-50, lag - clockOffset);
        clockOffset += correction;
        for (const point of points) point.at += correction;
      }
      const at = sample.at + clockOffset;
      const gap = Math.hypot(next.x - previous.x, next.z - previous.z);
      if (gap > 8) {
        reset(next, receivedAt);
        clockOffset = lag;
        lastServerAt = sample.at;
        return;
      }
      if (at - previous.at > 3000) {
        // Standing still can leave a long sample gap. Start a short new segment
        // from the known endpoint so the first walking step remains continuous.
        clockOffset = lag;
        points = [
          { x: previous.x, z: previous.z, heading: previous.heading, at: receivedAt - 125 },
          { ...next, at: receivedAt },
        ];
        lastServerAt = sample.at;
        return;
      }
      lastServerAt = sample.at;
      if (at <= previous.at) return;
      points.push({ ...next, at });
      while (points.length > 24 || (points.length > 2 && points[1].at < receivedAt - 2000)) points.shift();
    },
    sample(now = Date.now()) {
      const time = now - INTERPOLATION_MS;
      while (points.length > 2 && points[1].at <= time) points.shift();
      const first = points[0], last = points[points.length - 1];
      let x = first.x, z = first.z, heading = first.heading;
      if (points.length > 1 && time >= first.at) {
        const next = points[1];
        const span = Math.max(1, next.at - first.at);
        const progress = Math.max(0, Math.min(1, (time - first.at) / span));
        x += (next.x - first.x) * progress;
        z += (next.z - first.z) * progress;
        heading += angleDelta(first.heading, next.heading) * progress;
      }
      if (time > last.at && points.length > 1) {
        const previous = points[points.length - 2];
        const seconds = Math.max(.04, (last.at - previous.at) / 1000);
        let vx = (last.x - previous.x) / seconds, vz = (last.z - previous.z) / seconds;
        const speed = Math.hypot(vx, vz);
        if (speed > MAX_SPEED) { vx *= MAX_SPEED / speed; vz *= MAX_SPEED / speed; }
        const age = Math.min(EXTRAPOLATION_MS, time - last.at);
        const lead = EXTRAPOLATION_MS / 1000 * (1 - Math.exp(-age / EXTRAPOLATION_MS));
        x = last.x + vx * lead;
        z = last.z + vz * lead;
        heading = last.heading;
      }
      const elapsed = Math.max(0, now - lastFrameAt);
      const blend = elapsed > 1000 ? 1 : 1 - Math.exp(-elapsed / 45);
      const distance = Math.hypot(x - rendered.x, z - rendered.z);
      rendered.moving = elapsed > 0 && distance * blend / (elapsed / 1000) > .08;
      rendered.x += (x - rendered.x) * blend;
      rendered.z += (z - rendered.z) * blend;
      const nextHeading = rendered.heading + angleDelta(rendered.heading, heading) * blend;
      rendered.heading = Math.atan2(Math.sin(nextHeading), Math.cos(nextHeading));
      lastFrameAt = now;
      return rendered;
    },
    reset,
  };
}
