import * as THREE from "three";

/** A self-contained mesh character. Forward is +Z and the feet rest at y=0. */
export function createMonk(color = 0xcf895c): {
  group: THREE.Group;
  update: (action: string, t: number, walking: boolean, phase?: number) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = "little-monk";
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  geometries.add(sphere);

  function material(value: number, roughness = 0.88) {
    const result = new THREE.MeshStandardMaterial({ color: value, roughness });
    materials.add(result);
    return result;
  }

  const skin = material(0xf2c995);
  const earInside = material(0xe2ad85);
  const blush = material(0xe9a08a);
  const robe = material(color);
  const sash = material(0xe7b97c);
  const ink = material(0x654b3b);
  const sandal = material(0x98704e);
  const beadMaterial = material(0x7f5438, 0.65);
  const woodMaterial = material(0xae7749);
  const woodLight = material(0xc6925c);
  const slitMaterial = material(0x624731);

  function mesh(
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    parent: THREE.Object3D,
    x = 0, y = 0, z = 0,
  ) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, surface);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function oval(
    parent: THREE.Object3D, surface: THREE.Material,
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
  ) {
    const object = mesh(sphere, surface, parent, x, y, z);
    object.scale.set(sx, sy, sz);
    return object;
  }

  function line(parent: THREE.Object3D, points: number[][], radius: number, surface: THREE.Material) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    return mesh(new THREE.TubeGeometry(curve, 16, radius, 5, false), surface, parent);
  }

  const torso = new THREE.Group();
  torso.position.y = 0.45;
  group.add(torso);

  // The rounded hem and overlapping robe make a soft, small clay-figure silhouette.
  oval(torso, robe, 0, 0.12, 0, 0.28, 0.29, 0.205);
  const skirt = mesh(new THREE.CylinderGeometry(0.22, 0.285, 0.23, 24), robe, torso, 0, -0.015, 0);
  skirt.scale.z = 0.76;
  oval(torso, sash, 0, 0.38, 0.045, 0.16, 0.075, 0.12);
  const crossingSash = mesh(new THREE.BoxGeometry(0.115, 0.47, 0.027), sash, torso, 0.005, 0.16, 0.197);
  crossingSash.rotation.z = 0.60;
  crossingSash.rotation.x = -0.10;
  line(torso, [[-0.19, -0.03, 0.16], [-0.04, -0.08, 0.205], [0.15, -0.08, 0.17]], 0.009, sash);
  oval(torso, skin, 0, 0.435, 0.015, 0.095, 0.09, 0.085);

  const head = new THREE.Group();
  head.position.set(0, 0.645, 0.015);
  torso.add(head);
  oval(head, skin, -0.283, -0.008, 0, 0.067, 0.084, 0.052);
  oval(head, skin, 0.283, -0.008, 0, 0.067, 0.084, 0.052);
  oval(head, earInside, -0.301, -0.008, 0.044, 0.029, 0.049, 0.013);
  oval(head, earInside, 0.301, -0.008, 0.044, 0.029, 0.049, 0.013);
  const headMesh = mesh(new THREE.SphereGeometry(0.282, 32, 22), skin, head);
  headMesh.scale.set(1, 1.04, 0.94);

  // Facial features follow the sphere surface and remain actual curved mesh geometry.
  for (const side of [-1, 1]) {
    const eyeX = side * 0.094;
    line(head, [[eyeX - 0.034, 0.004, 0.251], [eyeX, -0.009, 0.265], [eyeX + 0.034, 0.004, 0.251]], 0.008, ink);
    oval(head, blush, side * 0.16, -0.064, 0.207, 0.045, 0.024, 0.013);
  }
  line(head, [[-0.032, -0.083, 0.247], [0, -0.099, 0.253], [0.032, -0.083, 0.247]], 0.006, ink);
  oval(head, skin, 0, -0.035, 0.267, 0.021, 0.022, 0.016);
  for (const [x, y] of [[-0.052, 0.183], [0, 0.198], [0.052, 0.183]]) {
    const z = Math.sqrt(0.282 ** 2 - x ** 2 - (y / 1.04) ** 2) * 0.94;
    oval(head, sandal, x, y, z, 0.012, 0.012, 0.006);
  }

  const arms: THREE.Group[] = [];
  const palms: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.235, 0.34, 0.005);
    torso.add(arm);
    oval(arm, robe, 0, -0.095, 0, 0.107, 0.17, 0.108);
    oval(arm, sash, 0, -0.209, 0.006, 0.082, 0.037, 0.085);
    palms.push(oval(arm, skin, 0, -0.25, 0.008, 0.061, 0.073, 0.055));
    arms.push(arm);
  }

  const prayerHands = new THREE.Group();
  prayerHands.position.set(0, 0.245, 0.265);
  torso.add(prayerHands);
  for (const side of [-1, 1]) {
    const hand = oval(prayerHands, skin, side * 0.032, 0, 0, 0.032, 0.103, 0.059);
    hand.rotation.z = side * 0.08;
  }
  line(prayerHands, [[0, -0.06, 0.059], [0, 0.025, 0.059], [0, 0.08, 0.04]], 0.0026, earInside);

  const heldIncense = new THREE.Group();
  heldIncense.name = "ritual-incense-bundle";
  heldIncense.position.set(0, 0.015, 0.025);
  heldIncense.visible = false;
  prayerHands.add(heldIncense);
  const incenseStem = material(0x825e3c);
  const incenseEmber = new THREE.MeshBasicMaterial({ color: 0xe8a06a });
  materials.add(incenseEmber);
  for (const side of [-1, 0, 1]) {
    mesh(new THREE.CylinderGeometry(0.007, 0.008, 0.47, 5), incenseStem, heldIncense, side * 0.025, 0.23, 0);
    oval(heldIncense, incenseEmber, side * 0.025, 0.47, 0, 0.012, 0.018, 0.012);
  }

  const standingLegs = new THREE.Group();
  group.add(standingLegs);
  const legPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.11, 0.30, 0);
    standingLegs.add(leg);
    oval(leg, robe, 0, -0.095, 0, 0.084, 0.17, 0.082);
    oval(leg, skin, 0, -0.22, 0.043, 0.073, 0.062, 0.12);
    oval(leg, sandal, 0, -0.255, 0.047, 0.079, 0.018, 0.125);
    legPivots.push(leg);
  }

  const sittingLegs = new THREE.Group();
  group.add(sittingLegs);
  for (const side of [-1, 1]) {
    const folded = oval(sittingLegs, robe, side * 0.128, 0.12, 0.14, 0.22, 0.11, 0.135);
    folded.rotation.y = side * 0.30;
    oval(sittingLegs, skin, side * 0.11, 0.125, 0.255, 0.07, 0.045, 0.062);
  }

  const beadRing = new THREE.Group();
  beadRing.position.set(0.25, 0.14, 0.34);
  torso.add(beadRing);
  mesh(new THREE.TorusGeometry(0.088, 0.004, 4, 20), sandal, beadRing);
  for (let index = 0; index < 14; index += 1) {
    const angle = index / 14 * Math.PI * 2;
    oval(beadRing, beadMaterial, Math.sin(angle) * 0.088, Math.cos(angle) * 0.088, 0, 0.019, 0.019, 0.019);
  }
  line(beadRing, [[0, -0.09, 0], [0, -0.13, 0], [0.015, -0.15, 0]], 0.005, robe);

  const woodenFish = new THREE.Group();
  woodenFish.position.set(0.42, 0.10, 0.24);
  group.add(woodenFish);
  oval(woodenFish, woodMaterial, 0, 0.015, 0, 0.17, 0.105, 0.13);
  oval(woodenFish, woodLight, 0.125, 0.013, 0.038, 0.059, 0.058, 0.069);
  line(woodenFish, [[-0.08, 0.075, 0.06], [-0.015, 0.105, 0.025], [0.045, 0.085, 0.067], [0.01, 0.045, 0.116]], 0.013, slitMaterial);
  line(woodenFish, [[-0.11, 0.035, 0.083], [-0.08, 0.002, 0.105], [-0.025, -0.004, 0.118]], 0.006, woodLight);
  const mallet = new THREE.Group();
  mallet.position.set(-0.19, 0.20, 0.02);
  woodenFish.add(mallet);
  const handle = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.23, 8), sandal, mallet, 0.07, 0.045, 0);
  handle.rotation.z = -0.95;
  oval(mallet, woodLight, 0.16, 0.105, 0, 0.043, 0.037, 0.04);

  function update(action: string, t: number, walking: boolean, phase?: number) {
    const seated = !walking && !["idle", "walk", "incense", "salute", "martial"].includes(action);
    const animationPhase = phase ?? 0;
    const sway = Math.sin(t * 9 + animationPhase);
    standingLegs.visible = !seated;
    sittingLegs.visible = seated;
    torso.position.y = seated ? 0.205 : 0.45 + (walking ? Math.abs(sway) * 0.018 : Math.sin(t * 1.7 + animationPhase) * 0.006);
    torso.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, walking ? sway * 0.025 : Math.sin(t * 1.1 + animationPhase) * 0.018);
    for (let index = 0; index < 2; index += 1) {
      const side = index === 0 ? -1 : 1;
      arms[index].rotation.set(walking ? sway * side * 0.48 : -0.12, 0, side * 0.12);
      legPivots[index].rotation.set(walking ? -sway * side * 0.43 : 0, 0, 0);
      palms[index].visible = true;
    }
    prayerHands.visible = action === "prayer" || action === "incense" || action === "salute";
    prayerHands.position.set(0, 0.245, 0.265);
    heldIncense.visible = action === "incense" && (phase ?? 0) < 0.68;
    beadRing.visible = action === "beads";
    woodenFish.visible = action === "wood";

    if (seated) {
      arms[0].rotation.set(-0.62, 0, 0.62);
      arms[1].rotation.set(-0.62, 0, -0.62);
    }
    if (action === "prayer" || action === "incense" || action === "salute") {
      arms[0].rotation.set(-0.90, -0.05, 0.79);
      arms[1].rotation.set(-0.90, 0.05, -0.79);
      palms[0].visible = false;
      palms[1].visible = false;
    }
    if (action === "incense") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const raise = THREE.MathUtils.smoothstep(progress, 0.12, 0.24);
      const lower = THREE.MathUtils.smoothstep(progress, 0.56, 0.68);
      const extend = lower * (1 - THREE.MathUtils.smoothstep(progress, 0.76, 0.90));
      const bowProgress = THREE.MathUtils.clamp((progress - 0.24) / 0.32, 0, 1);
      const bow = Math.sin(bowProgress * Math.PI * 3) ** 2;
      torso.rotation.x = bow * 0.27 + extend * 0.10;
      head.rotation.x = bow * 0.16;
      prayerHands.position.y += raise * (1 - lower) * 0.24 + extend * 0.04;
      prayerHands.position.z += extend * 0.25;
      arms[0].rotation.x -= raise * (1 - lower) * 0.24 + extend * 0.4;
      arms[1].rotation.x -= raise * (1 - lower) * 0.24 + extend * 0.4;
      heldIncense.rotation.x = -extend * 0.12;
    }
    if (action === "martial") {
      const punch = Math.sin(t * 8);
      torso.rotation.y = punch * 0.18;
      torso.position.y = 0.42 + Math.abs(punch) * 0.025;
      arms[0].rotation.set(-1.25 - punch * 0.65, -0.12, 0.22);
      arms[1].rotation.set(-1.25 + punch * 0.65, 0.12, -0.22);
      legPivots[0].rotation.z = 0.22;
      legPivots[1].rotation.set(Math.max(0, Math.sin(t * 4)) * -0.5, 0, -0.22);
    }
    if (action === "bow") {
      const bowPhase = phase === undefined ? t % 1 : THREE.MathUtils.clamp(phase, 0, 1);
      const bow = (1 - Math.cos(bowPhase * Math.PI * 2)) * 0.5;
      torso.rotation.x = 0.12 + bow * 1.27;
      arms[0].rotation.set(-0.40, 0, -0.10);
      arms[1].rotation.set(-0.40, 0, 0.10);
      head.rotation.z = 0;
    }
    if (action === "beads") {
      arms[1].rotation.set(-0.98, 0, -0.18);
      beadRing.rotation.z = -t * 0.7;
      beadRing.rotation.y = Math.sin(t * 0.8) * 0.18;
    }
    if (action === "wood") {
      const strike = Math.sin(t * Math.PI * 2.4);
      arms[1].rotation.set(-0.75 + strike * 0.20, 0, -0.29);
      mallet.rotation.z = -0.40 - strike * 0.38;
    }
  }

  update("idle", 0, false);
  return {
    group,
    update,
    dispose() {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((surface) => surface.dispose());
      group.clear();
    },
  };
}
