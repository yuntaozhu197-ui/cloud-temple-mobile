import * as THREE from "three";
import type { PondSpecies } from "../pondGame";

type FishSpecies = Extract<PondSpecies, "fish" | "koi" | "goldfish">;

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
  releaseX?: number;
  releaseZ?: number;
};

type Swimmer = {
  species: FishSpecies;
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
  feedOriginX: number;
  feedOriginZ: number;
};

/** A curved split fan, shared by the held fish and the instanced swimming fish. */
export function createFishFinGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  const rings = 6;
  const rays = 12;
  for (let ring = 0; ring <= rings; ring++) for (let ray = 0; ray <= rays; ray++) {
    const distance = ring / rings;
    const across = ray / rays * 2 - 1;
    positions.push(
      across * Math.sin(distance * Math.PI / 2),
      .06 * Math.sin(distance * Math.PI) * Math.sin(across * Math.PI * 2) + .07 * distance * distance * Math.sin(across * Math.PI * 3),
      -distance * (.59 + .41 * Math.abs(across)),
    );
  }
  for (let ring = 0; ring < rings; ring++) for (let ray = 0; ray < rays; ray++) {
    const a = ring * (rays + 1) + ray;
    const b = a + rays + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createBrocadeGeometry() {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (const [centerX, centerZ, width, length, shade] of [[-.2, .45, .49, .27, 1], [.14, -.3, .56, .31, 1], [.69, -.31, .2, .19, .19]]) {
    const start = positions.length / 3;
    function point(x: number, z: number) {
      const y = Math.sqrt(Math.max(0, 1 - x * x - z * z));
      const ridge = Math.exp(-(x * x / .025 + (z + .12) ** 2 / .2)) * y * .32;
      positions.push(x * (1 - Math.max(0, z) * .12), y + ridge + .035, z);
      colors.push(shade, shade, shade);
    }
    const rings = 4;
    const rays = 16;
    for (let ring = 0; ring <= rings; ring++) for (let ray = 0; ray <= rays; ray++) {
      const angle = ray / rays * Math.PI * 2;
      const edge = (1 + Math.sin(angle * 3) * .08) * ring / rings;
      point(centerX + Math.cos(angle) * width * edge, centerZ + Math.sin(angle) * length * edge);
    }
    for (let ring = 0; ring < rings; ring++) for (let ray = 0; ray < rays; ray++) {
      const a = start + ring * (rays + 1) + ray;
      const b = a + rays + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

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
    const surface = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.07, side: THREE.DoubleSide });
    materials.push(surface);
    return surface;
  };
  const skin = material("#ffffff");
  skin.vertexColors = true;
  const eyesMaterial = material("#333b30");
  function batch(geometry: THREE.BufferGeometry, surface: THREE.Material, instances = capacity) {
    if (surface === skin && !geometry.hasAttribute("color")) geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").count * 3).fill(1), 3));
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
  const bodyGeometry = new THREE.SphereGeometry(1, 12, 8);
  const bodyVertices = bodyGeometry.getAttribute("position");
  for (let index = 0; index < bodyVertices.count; index++) {
    const x = bodyVertices.getX(index), y = bodyVertices.getY(index), z = bodyVertices.getZ(index);
    const dorsalRidge = Math.exp(-(x * x / .025 + (z + .12) ** 2 / .2)) * Math.max(0, y) * .32;
    bodyVertices.setXYZ(index, x * (1 - Math.max(0, z) * .12), y + dorsalRidge, z);
  }
  bodyGeometry.computeVertexNormals();
  const bodies = batch(bodyGeometry, skin);
  const tails = batch(createFishFinGeometry(), skin);
  const markings = batch(createBrocadeGeometry(), skin);
  const fins = batch(createFishFinGeometry(), skin, capacity * 2);
  const eyes = batch(new THREE.SphereGeometry(1, 4, 3), eyesMaterial, capacity * 2);
  bodies.name = "锦鲤鱼身";
  tails.name = "独立摆尾";
  markings.name = "各色鱼纹";
  fins.name = "胸鳍";
  eyes.name = "鱼眼";
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const palettes = [
    ["#f2e9d4", "#c6573c"],
    ["#ede3ce", "#c97938"],
    ["#f8e9cb", "#9e4736"],
    ["#ddd5c4", "#5b6255"],
    ["#ecd8aa", "#ad492f"],
    ["#efe7d4", "#a24e33"],
    ["#e5d9bd", "#c07045"],
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
  function setColors(index: number, species: FishSpecies) {
    const palette = species === "fish" ? ["#9bb5bc", "#63838c"] : species === "goldfish" ? ["#edaa3e", "#f6d075"] : palettes[Math.floor(random() * palettes.length)];
    color.set(palette[0]).multiplyScalar(0.9 + random() * 0.17);
    bodies.setColorAt(index, color);
    tails.setColorAt(index, color);
    fins.setColorAt(index * 2, color);
    fins.setColorAt(index * 2 + 1, color);
    markings.setColorAt(index, color.set(palette[1]));
  }
  function addFish(releasedAt = -Infinity, species: FishSpecies = "koi") {
    const index = sequence % capacity;
    sequence += 1;
    const angle = random() * Math.PI * 2;
    const lane = 0.2 + random() * 0.72;
    let spawnX = pond.releaseX === undefined ? pond.x + pond.radiusX * (0.77 + random() * 0.08) : pond.releaseX + (random() - 0.5) * 0.06;
    let spawnZ = pond.releaseZ === undefined ? pond.z + (random() - 0.5) * pond.radiusZ * 0.22 : pond.releaseZ + (random() - 0.5) * 0.12;
    // The whole turning tail needs the same bank clearance as a swimming fish.
    const spawnRadius = Math.hypot((spawnX - pond.x) / pond.radiusX, (spawnZ - pond.z) / pond.radiusZ);
    if (spawnRadius > 0.95) {
      spawnX = pond.x + (spawnX - pond.x) * 0.95 / spawnRadius;
      spawnZ = pond.z + (spawnZ - pond.z) * 0.95 / spawnRadius;
    }
    const x = Number.isFinite(releasedAt) ? spawnX : pond.x + Math.cos(angle) * pond.radiusX * lane;
    const z = Number.isFinite(releasedAt) ? spawnZ : pond.z + Math.sin(angle) * pond.radiusZ * lane;
    fish[index] = {
      species,
      size: 0.66 + random() * 0.67,
      phase: angle,
      speed: 0.12 + random() * 0.22,
      lane,
      reverse: random() < 0.4 ? -1 : 1,
      x,
      z,
      heading: Number.isFinite(releasedAt) ? Math.atan2(pond.x - spawnX, pond.z - spawnZ) : angle,
      releasedAt,
      spawnX,
      spawnZ,
      feedOriginX: x,
      feedOriginZ: z,
    };
    setColors(index, species);
    bodies.count = tails.count = markings.count = fish.length;
    fins.count = eyes.count = fish.length * 2;
    group.userData.fishCount = fish.length;
    for (const object of [bodies, tails, markings, fins]) {
      if (object.instanceColor) object.instanceColor.needsUpdate = true;
    }
  }
  for (let index = 0; index < pond.count; index++) addFish();

  function place(object: THREE.InstancedMesh, index: number, fishState: Swimmer, dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, turn = 0, tilt = 0, roll = 0) {
    const sine = Math.sin(fishState.heading), cosine = Math.cos(fishState.heading);
    const size = fishState.size;
    transform.position.set(
      fishState.x + (dx * cosine + dz * sine) * size,
      pond.waterY + dy * size,
      fishState.z + (-dx * sine + dz * cosine) * size,
    );
    transform.rotation.set(tilt, fishState.heading + turn, roll, "YXZ");
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
      const feedAge = now - feedingAt - swimmer.phase * 0.22;
      if (Number.isFinite(feedingAt) && feedAge < 26) {
        const feedingAngle = time * (0.6 + swimmer.speed) * swimmer.reverse + swimmer.phase;
        const spread = 0.22 + swimmer.lane * 0.42;
        const foodX = (pond.feedX ?? pond.x) + Math.cos(feedingAngle) * spread;
        const foodZ = (pond.feedZ ?? pond.z) + Math.sin(feedingAngle) * spread;
        const gather = THREE.MathUtils.smoothstep(feedAge, 0, 3.5);
        const disperse = THREE.MathUtils.smoothstep(feedAge, 11, 26);
        const gatheredX = THREE.MathUtils.lerp(swimmer.feedOriginX, foodX, gather);
        const gatheredZ = THREE.MathUtils.lerp(swimmer.feedOriginZ, foodZ, gather);
        targetX = THREE.MathUtils.lerp(gatheredX, targetX, disperse);
        targetZ = THREE.MathUtils.lerp(gatheredZ, targetZ, disperse);
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
      const small = swimmer.species === "fish";
      const goldfish = swimmer.species === "goldfish";
      const tailSwing = Math.sin(time * (goldfish ? 4.2 : 5 + swimmer.speed * 12) + swimmer.phase) * (goldfish ? .24 : .38);
      const bob = Math.sin(time * 2.3 + swimmer.phase) * .008 + (goldfish ? .035 : 0);
      const length = small ? .66 : 1;
      place(bodies, index, swimmer, 0, bob, 0, goldfish ? .127 : small ? .053 : .088, goldfish ? .061 : small ? .022 : .031, goldfish ? .145 : .25 * length);
      // River fish carry a short vertical fork. Koi have a longer folded fan,
      // while the goldfish opens a broad, rippled butterfly tail across the water.
      place(tails, index, swimmer, Math.sin(tailSwing) * .025, bob, goldfish ? -.11 : -.2 * length, goldfish ? .17 : .094 * length, goldfish ? .06 : .026, goldfish ? .22 : .16 * length, tailSwing, goldfish ? .12 + tailSwing * .3 : 0, goldfish ? .1 : small ? .4 : .18);
      place(markings, index, swimmer, 0, bob, 0, small ? 0 : goldfish ? .127 : .088, small ? 0 : goldfish ? .061 : .031, small ? 0 : goldfish ? .145 : .25);
      for (const side of [-1, 1]) {
        const pairIndex = index * 2 + (side + 1) / 2;
        place(fins, pairIndex, swimmer, side * (goldfish ? .098 : .078 * length), bob - .008, goldfish ? .05 : .065 * length, goldfish ? .068 : .05 * length, .028, goldfish ? .17 : .105 * length, side * (-.7 + tailSwing * .2), goldfish ? .3 : .08, side * (.13 + Math.sin(time * 3.6 + swimmer.phase) * .1));
        place(eyes, pairIndex, swimmer, side * (goldfish ? .085 : .054 * length), (goldfish ? .053 : .028 * length) + bob, goldfish ? .095 : .18 * length, goldfish ? .02 : .013 * length, goldfish ? .022 : .014 * length, .016 * length);
      }
    }
    batches.forEach(object => { object.instanceMatrix.needsUpdate = true; });
  }
  animate(0);
  return {
    group,
    get count() { return fish.length; },
    get totalReleased() { return totalReleased; },
    feed() {
      if (disposed) return;
      feedingAt = performance.now() / 1000;
      for (const swimmer of fish) {
        swimmer.feedOriginX = swimmer.x;
        swimmer.feedOriginZ = swimmer.z;
      }
    },
    release(amount = 7, species: FishSpecies = "koi") {
      if (disposed) return 0;
      const now = performance.now() / 1000;
      const count = THREE.MathUtils.clamp(Math.floor(amount), 1, capacity);
      for (let index = 0; index < count; index++) addFish(now + index * 0.06, species);
      totalReleased += count;
      group.userData.totalReleased = totalReleased;
      group.userData.lastReleasedSpecies = species;
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
