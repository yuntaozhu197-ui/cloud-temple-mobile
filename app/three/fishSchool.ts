import * as THREE from "three";

type FishPond = {
  name: string;
  count: number;
  capacity: number;
  x: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  waterY: number;
  feedX?: number;
  feedZ?: number;
};

type Swimmer = {
  size: number;
  phase: number;
  speed: number;
  lane: number;
  reverse: number;
  x: number;
  z: number;
  heading: number;
  releasedAt: number;
  spawnX: number;
  spawnZ: number;
};

/** Individually animated fish share five draw calls, including fins, markings and eyes. */
export function createFishSchool(pond: FishPond) {
  const group = new THREE.Group();
  group.name = pond.name;
  const capacity = Math.max(pond.count, pond.capacity);
  const fish: Swimmer[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const batches: THREE.InstancedMesh[] = [];
  const material = (color: string) => {
    const surface = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
    materials.push(surface);
    return surface;
  };
  const skin = material("#ffffff");
  const eyesMaterial = material("#333b30");
  function batch(geometry: THREE.BufferGeometry, surface: THREE.Material, instances = capacity) {
    geometries.push(geometry);
    const object = new THREE.InstancedMesh(geometry, surface, instances);
    object.count = 0;
    object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    object.frustumCulled = false;
    object.castShadow = false;
    object.receiveShadow = false;
    batches.push(object);
    group.add(object);
    return object;
  }
  const bodies = batch(new THREE.SphereGeometry(1, 8, 5), skin);
  const tails = batch(new THREE.ConeGeometry(1, 1, 3), skin);
  const markings = batch(new THREE.SphereGeometry(1, 6, 4), skin);
  const fins = batch(new THREE.ConeGeometry(1, 1, 3), skin, capacity * 2);
  const eyes = batch(new THREE.SphereGeometry(1, 4, 3), eyesMaterial, capacity * 2);
  bodies.name = "锦鲤鱼身";
  tails.name = "独立摆尾";
  markings.name = "各色鱼纹";
  fins.name = "胸鳍";
  eyes.name = "鱼眼";
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const palettes = [
    ["#dc8a48", "#fff0d3"],
    ["#f5dfb0", "#ce6946"],
    ["#c9593f", "#f7dfb5"],
    ["#e9b956", "#aa653d"],
    ["#6a7769", "#e6d0a6"],
    ["#f2e9d4", "#4d6258"],
    ["#c58854", "#ad4735"],
  ];
  let sequence = 0;
  let totalReleased = 0;
  let feedingAt = -Infinity;
  let lastTime: number | undefined;
  let disposed = false;
  // A local generator keeps the two ponds and every release visibly different.
  let seed = Math.floor(Math.random() * 0xffffffff) || 1;
  function random() {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  }
  function setColors(index: number) {
    const palette = palettes[Math.floor(random() * palettes.length)];
    color.set(palette[0]).multiplyScalar(0.9 + random() * 0.17);
    bodies.setColorAt(index, color);
    tails.setColorAt(index, color);
    fins.setColorAt(index * 2, color);
    fins.setColorAt(index * 2 + 1, color);
    markings.setColorAt(index, color.set(palette[1]));
  }
  function addFish(releasedAt = -Infinity) {
    const index = sequence % capacity;
    sequence += 1;
    const angle = random() * Math.PI * 2;
    const lane = 0.2 + random() * 0.72;
    const spawnX = pond.x + pond.radiusX * (0.77 + random() * 0.08);
    const spawnZ = pond.z + (random() - 0.5) * pond.radiusZ * 0.22;
    fish[index] = {
      size: 0.66 + random() * 0.67,
      phase: angle,
      speed: 0.12 + random() * 0.22,
      lane,
      reverse: random() < 0.4 ? -1 : 1,
      x: Number.isFinite(releasedAt) ? spawnX : pond.x + Math.cos(angle) * pond.radiusX * lane,
      z: Number.isFinite(releasedAt) ? spawnZ : pond.z + Math.sin(angle) * pond.radiusZ * lane,
      heading: angle,
      releasedAt,
      spawnX,
      spawnZ,
    };
    setColors(index);
    bodies.count = tails.count = markings.count = fish.length;
    fins.count = eyes.count = fish.length * 2;
    group.userData.fishCount = fish.length;
    for (const object of [bodies, tails, markings, fins]) {
      if (object.instanceColor) object.instanceColor.needsUpdate = true;
    }
  }
  for (let index = 0; index < pond.count; index++) addFish();

  function place(object: THREE.InstancedMesh, index: number, fishState: Swimmer, dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, turn = 0, tilt = 0) {
    const sine = Math.sin(fishState.heading), cosine = Math.cos(fishState.heading);
    const size = fishState.size;
    transform.position.set(
      fishState.x + (dx * cosine + dz * sine) * size,
      pond.waterY + dy * size,
      fishState.z + (-dx * sine + dz * cosine) * size,
    );
    transform.rotation.set(tilt, fishState.heading + turn, 0);
    transform.scale.set(sx * size, sy * size, sz * size);
    transform.updateMatrix();
    object.setMatrixAt(index, transform.matrix);
  }
  function animate(time: number) {
    if (disposed) return;
    const dt = lastTime === undefined ? 1 / 60 : THREE.MathUtils.clamp(time - lastTime, 0, 0.08);
    lastTime = time;
    const now = performance.now() / 1000;
    for (const [index, swimmer] of fish.entries()) {
      const angle = time * swimmer.speed * swimmer.reverse + swimmer.phase;
      const radius = swimmer.lane * (0.82 + Math.sin(time * 0.19 + swimmer.phase) * 0.13);
      let targetX = pond.x + pond.radiusX * (Math.cos(angle) * radius + Math.sin(angle * 2.1 + swimmer.phase) * 0.05);
      let targetZ = pond.z + pond.radiusZ * (Math.sin(angle) * radius + Math.cos(angle * 1.7 + swimmer.phase) * 0.05);
      const feedAge = now - feedingAt - swimmer.phase * 0.3;
      const feeding = feedAge < 0 ? 0 : feedAge < 3 ? feedAge / 3 : feedAge < 10 ? 1 : Math.max(0, 1 - (feedAge - 10) / 5);
      if (feeding > 0) {
        const feedingAngle = time * (0.6 + swimmer.speed) * swimmer.reverse + swimmer.phase;
        const spread = 0.22 + swimmer.lane * 0.42;
        targetX = THREE.MathUtils.lerp(targetX, (pond.feedX ?? pond.x) + Math.cos(feedingAngle) * spread, feeding);
        targetZ = THREE.MathUtils.lerp(targetZ, (pond.feedZ ?? pond.z) + Math.sin(feedingAngle) * spread, feeding);
      }
      const normalizedRadius = Math.hypot((targetX - pond.x) / pond.radiusX, (targetZ - pond.z) / pond.radiusZ);
      if (normalizedRadius > 0.95) {
        targetX = pond.x + (targetX - pond.x) * 0.95 / normalizedRadius;
        targetZ = pond.z + (targetZ - pond.z) * 0.95 / normalizedRadius;
      }
      const releaseAge = now - swimmer.releasedAt;
      if (releaseAge < 5) {
        const progress = THREE.MathUtils.smoothstep(Math.max(0, releaseAge) / 5, 0, 1);
        targetX = THREE.MathUtils.lerp(swimmer.spawnX, targetX, progress);
        targetZ = THREE.MathUtils.lerp(swimmer.spawnZ, targetZ, progress);
      }
      const previousX = swimmer.x, previousZ = swimmer.z;
      const follow = 1 - Math.exp(-dt * (1.6 + swimmer.speed));
      swimmer.x += (targetX - swimmer.x) * follow;
      swimmer.z += (targetZ - swimmer.z) * follow;
      const dx = swimmer.x - previousX, dz = swimmer.z - previousZ;
      if (Math.hypot(dx, dz) > 0.00001) {
        const direction = Math.atan2(dx, dz);
        const difference = Math.atan2(Math.sin(direction - swimmer.heading), Math.cos(direction - swimmer.heading));
        swimmer.heading += difference * Math.min(1, dt * 5);
      }
      const tailSwing = Math.sin(time * (5 + swimmer.speed * 12) + swimmer.phase) * 0.42;
      const bob = Math.sin(time * 2.3 + swimmer.phase) * 0.008;
      place(bodies, index, swimmer, 0, bob, 0, 0.1, 0.045, 0.235);
      place(tails, index, swimmer, Math.sin(tailSwing) * 0.04, bob, -0.28, 0.115, 0.19, 0.055, tailSwing, -Math.PI / 2);
      place(markings, index, swimmer, 0.005, 0.032 + bob, -0.045, 0.077, 0.019, 0.105);
      for (const side of [-1, 1]) {
        const pairIndex = index * 2 + (side + 1) / 2;
        place(fins, pairIndex, swimmer, side * 0.105, bob, 0.005, 0.07, 0.11, 0.018, side * (0.9 + tailSwing * 0.2), Math.PI / 2);
        place(eyes, pairIndex, swimmer, side * 0.053, 0.032 + bob, 0.16, 0.015, 0.016, 0.018);
      }
    }
    batches.forEach(object => { object.instanceMatrix.needsUpdate = true; });
  }
  animate(0);
  return {
    group,
    get count() { return fish.length; },
    get totalReleased() { return totalReleased; },
    feed() { feedingAt = performance.now() / 1000; },
    release(amount = 7) {
      if (disposed) return 0;
      const now = performance.now() / 1000;
      const count = THREE.MathUtils.clamp(Math.floor(amount), 1, capacity);
      for (let index = 0; index < count; index++) addFish(now + index * 0.06);
      totalReleased += count;
      group.userData.totalReleased = totalReleased;
      animate(lastTime ?? 0);
      return count;
    },
    animate,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      batches.forEach(object => object.dispose());
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(surface => surface.dispose());
      group.clear();
    },
  };
}
