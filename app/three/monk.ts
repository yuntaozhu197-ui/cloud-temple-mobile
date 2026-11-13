import * as THREE from "three";
import { MARTIAL_DURATION, sampleMartial } from "./martial";

/** A self-contained mesh character. Forward is +Z and the feet rest at y=0. */
export function createMonk(color = 0xcf895c): {
  group: THREE.Group;
  update: (action: string, t: number, walking: boolean, phase?: number) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = "little-monk";
  const motionRig = new THREE.Group();
  motionRig.name = "monk-motion-rig";
  group.add(motionRig);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  geometries.add(sphere);

  function material(value: number, roughness = 0.88) {
    const result = new THREE.MeshStandardMaterial({ color: value, roughness });
    materials.add(result);
    return result;
  }

  const skin = material(0xf2cba8, .72);
  const earInside = material(0xdfad91, .78);
  const blush = material(0xe4af9e, .9);
  const robe = material(color, .94);
  const sash = material(0xdfc49a, .92);
  const ink = material(0x594737);
  const sandal = material(0x89694f, .9);
  const beadMaterial = material(0x785136, .48);
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
  torso.name = "monk-torso";
  torso.position.y = 0.45;
  motionRig.add(torso);

  // The rounded hem and overlapping robe make a soft, small clay-figure silhouette.
  oval(torso, robe, 0, 0.12, 0, 0.28, 0.29, 0.205);
  const hemProfile = [[0, -.135], [.24, -.135], [.275, -.115], [.288, -.07], [.28, .015], [.25, .12], [.22, .17], [0, .17]];
  const skirt = mesh(new THREE.LatheGeometry(hemProfile.map(([radius, height]) => new THREE.Vector2(radius, height)), 24), robe, torso);
  skirt.name = "rounded-cloth-hem";
  skirt.scale.z = 0.76;
  oval(torso, sash, 0, 0.38, 0.045, 0.16, 0.075, 0.12);
  const sashRows = 16, sashColumns = 4;
  const sashPositions: number[] = [], sashIndices: number[] = [];
  const sashLayerSize = (sashRows + 1) * (sashColumns + 1);
  // A cloth grid follows the chest, with a rounded cross-section and a thin back face.
  for (let layer = 0; layer < 2; layer++) for (let row = 0; row <= sashRows; row++) for (let column = 0; column <= sashColumns; column++) {
    const across = column / sashColumns;
    const y = .235 - row / sashRows * .47;
    const x = (across * 2 - 1) * (.052 + Math.sin(row / sashRows * Math.PI) * .006);
    const diagonalY = x * Math.sin(.6) + y * Math.cos(.6);
    const bodyX = .005 + x * Math.cos(.6) - y * Math.sin(.6);
    const bodyY = .16 + diagonalY * Math.cos(.1);
    const bodyFront = .205 * Math.sqrt(Math.max(0, 1 - (bodyX / .28) ** 2 - ((bodyY - .12) / .29) ** 2));
    const hemRadius = .285 - .3 * Math.max(0, bodyY + .02);
    const hemFront = bodyY < .17 ? .76 * Math.sqrt(Math.max(0, hemRadius ** 2 - bodyX ** 2)) : 0;
    const surface = (Math.max(bodyFront, hemFront) + .024 - .197 - diagonalY * Math.sin(-.1)) / Math.cos(.1);
    const thickness = layer === 0 ? .009 + Math.sin(across * Math.PI) * .003 : -.009;
    sashPositions.push(x, y, surface + thickness);
  }
  for (let row = 0; row < sashRows; row++) for (let column = 0; column < sashColumns; column++) {
    const a = row * (sashColumns + 1) + column, b = a + sashColumns + 1;
    sashIndices.push(a, b, a + 1, a + 1, b, b + 1);
    sashIndices.push(a + sashLayerSize, a + 1 + sashLayerSize, b + sashLayerSize, a + 1 + sashLayerSize, b + 1 + sashLayerSize, b + sashLayerSize);
  }
  for (let row = 0; row < sashRows; row++) {
    const left = row * (sashColumns + 1), right = left + sashColumns;
    const nextLeft = left + sashColumns + 1, nextRight = right + sashColumns + 1;
    sashIndices.push(left, left + sashLayerSize, nextLeft, nextLeft, left + sashLayerSize, nextLeft + sashLayerSize);
    sashIndices.push(right, nextRight, right + sashLayerSize, nextRight, nextRight + sashLayerSize, right + sashLayerSize);
  }
  for (let column = 0; column < sashColumns; column++) {
    const top = column, bottom = sashRows * (sashColumns + 1) + column;
    sashIndices.push(top, top + 1, top + sashLayerSize, top + 1, top + 1 + sashLayerSize, top + sashLayerSize);
    sashIndices.push(bottom, bottom + sashLayerSize, bottom + 1, bottom + 1, bottom + sashLayerSize, bottom + 1 + sashLayerSize);
  }
  const sashGeometry = new THREE.BufferGeometry();
  sashGeometry.setAttribute("position", new THREE.Float32BufferAttribute(sashPositions, 3));
  sashGeometry.setIndex(sashIndices);
  sashGeometry.computeVertexNormals();
  const crossingSash = mesh(sashGeometry, sash, torso, 0.005, 0.16, 0.197);
  crossingSash.name = "curved-linen-sash";
  crossingSash.rotation.z = 0.60;
  crossingSash.rotation.x = -0.10;
  line(torso, [[-0.19, -0.03, 0.173], [-0.04, -0.08, 0.224], [0.15, -0.08, 0.194]], 0.009, sash);
  for (const side of [-1, 1]) {
    line(torso, [[side * .19, .26, .11], [side * .235, .1, .13], [side * .205, -.08, .15]], .007, robe);
    line(torso, [[side * .11, -.04, .19], [side * .14, -.09, .2], [side * .16, -.123, .185]], .006, robe);
  }
  oval(torso, skin, 0, 0.435, 0.015, 0.095, 0.09, 0.085);

  const head = new THREE.Group();
  head.name = "monk-head";
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
    line(head, [[eyeX - .031, .049, .246], [eyeX, .058, .258], [eyeX + .03, .051, .246]], .0045, ink);
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
    arm.name = side < 0 ? "monk-left-arm" : "monk-right-arm";
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

  const heldLamp = new THREE.Group();
  heldLamp.name = "ritual-lotus-lamp";
  heldLamp.position.set(0, 0.03, 0.1);
  heldLamp.visible = false;
  prayerHands.add(heldLamp);
  const lampGold = material(0xd9b469, 0.5);
  const lampFlameMaterial = new THREE.MeshBasicMaterial({ color: 0xffe8a0 });
  materials.add(lampFlameMaterial);
  const lampPetalGeometry = new THREE.SphereGeometry(1, 8, 6);
  for (let index = 0; index < 7; index++) {
    const angle = index / 7 * Math.PI * 2;
    const petal = mesh(lampPetalGeometry, lampGold, heldLamp, Math.sin(angle) * 0.055, 0, Math.cos(angle) * 0.055);
    petal.scale.set(0.035, 0.045, 0.07);
    petal.rotation.y = angle;
    petal.rotation.x = -0.5;
  }
  const lampFlame = mesh(lampPetalGeometry, lampFlameMaterial, heldLamp, 0, 0.065, 0);
  lampFlame.scale.set(0.022, 0.055, 0.022);

  const feedBowl = new THREE.Group();
  feedBowl.name = "fish-food-bowl";
  feedBowl.position.set(-0.15, 0.19, 0.27);
  torso.add(feedBowl);
  mesh(new THREE.SphereGeometry(0.095, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), woodLight, feedBowl);
  mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.012, 12), lampGold, feedBowl, 0, -0.008, 0);
  const thrownFood = new THREE.InstancedMesh(lampPetalGeometry, lampGold, 10);
  thrownFood.name = "hand-thrown-fish-food";
  thrownFood.frustumCulled = false;
  thrownFood.castShadow = false;
  torso.add(thrownFood);
  const foodTransform = new THREE.Object3D();
  const releaseHands = new THREE.Group();
  releaseHands.name = "cupped-fish-release-hands";
  motionRig.add(releaseHands);
  const releaseArmTarget = new THREE.Vector3();
  const armRestDirection = new THREE.Vector3(0, -1, 0);
  const bendAxis = new THREE.Vector3(1, 0, 0);
  for (const side of [-1, 1]) oval(releaseHands, skin, side * 0.043, 0, 0, 0.06, 0.035, 0.1);
  const heldFish = new THREE.Group();
  heldFish.name = "gently-held-small-fish";
  releaseHands.add(heldFish);
  oval(heldFish, woodLight, 0, 0.037, 0, 0.035, 0.024, 0.09);
  const fishTail = mesh(new THREE.ConeGeometry(0.036, 0.06, 3), lampGold, heldFish, 0, 0.037, -0.095);
  fishTail.rotation.x = -Math.PI / 2;
  for (const side of [-1, 1]) oval(heldFish, ink, side * 0.019, 0.049, 0.061, 0.005, 0.005, 0.005);

  const heldSkyLantern = new THREE.Group();
  heldSkyLantern.name = "held-paper-sky-lantern";
  heldSkyLantern.position.set(0, 0.14, 0.09);
  prayerHands.add(heldSkyLantern);
  const lanternPaper = material(0xf6d8a0, 0.95);
  lanternPaper.emissive.setHex(0xb18442);
  lanternPaper.emissiveIntensity = 0.2;
  mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.25, 8, 1, true), lanternPaper, heldSkyLantern);
  const lanternTop = mesh(new THREE.CircleGeometry(0.1, 8), lanternPaper, heldSkyLantern, 0, 0.125, 0);
  lanternTop.rotation.x = -Math.PI / 2;
  const lanternRim = mesh(new THREE.TorusGeometry(0.13, 0.006, 4, 16), lampGold, heldSkyLantern, 0, -0.125, 0);
  lanternRim.rotation.x = Math.PI / 2;
  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4;
    const rib = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.25, 4), lampGold, heldSkyLantern, Math.sin(angle) * 0.115, 0, Math.cos(angle) * 0.115);
    rib.rotation.z = Math.sin(angle) * 0.12;
    rib.rotation.x = -Math.cos(angle) * 0.12;
  }
  const lanternFire = mesh(lampPetalGeometry, lampFlameMaterial, heldSkyLantern, 0, -0.1, 0);
  lanternFire.scale.set(0.025, 0.04, 0.025);

  const flowerPink = material(0xe8b4a4);
  const flowerCream = material(0xf2d9b0);
  const flowerLeaf = material(0x82936b);
  const offeringBouquet = new THREE.Group();
  offeringBouquet.name = "ceremonial-flower-bouquet";
  torso.add(offeringBouquet);
  for (let index = 0; index < 3; index++) {
    const x = (index - 1) * 0.095;
    const y = index === 1 ? 0.16 : 0.1;
    mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.26, 5), flowerLeaf, offeringBouquet, x, y - 0.12, 0);
    for (let petal = 0; petal < 6; petal++) {
      const angle = petal * Math.PI / 3;
      const blossom = mesh(lampPetalGeometry, index === 1 ? flowerCream : flowerPink, offeringBouquet, x + Math.sin(angle) * 0.035, y, Math.cos(angle) * 0.035);
      blossom.scale.set(0.035, 0.065, 0.03);
      blossom.rotation.set(Math.cos(angle) * 0.65, angle, Math.sin(angle) * 0.65);
    }
    oval(offeringBouquet, lampGold, x, y + 0.01, 0, 0.026, 0.035, 0.026);
  }
  const bouquetTie = mesh(new THREE.BoxGeometry(0.21, 0.06, 0.05), sash, offeringBouquet, 0, -0.06, 0);
  bouquetTie.rotation.z = -0.1;

  const drumSticks: THREE.Group[] = [];
  for (let index = 0; index < 2; index++) {
    const stick = new THREE.Group();
    stick.name = index === 0 ? "left-drum-stick" : "right-drum-stick";
    stick.position.set(0, -0.25, 0.008);
    torso.add(stick);
    const shaft = mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.53, 7), sandal, stick, 0, 0, 0.2);
    shaft.rotation.x = Math.PI / 2;
    oval(stick, woodLight, 0, 0, 0.47, 0.034, 0.034, 0.044);
    drumSticks.push(stick);
  }
  const towerStriker = new THREE.Group();
  towerStriker.name = "held-tower-bell-rope";
  torso.add(towerStriker);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.44, 6), sandal, towerStriker, 0, 0.18, 0);
  mesh(new THREE.TorusGeometry(0.062, 0.011, 5, 12), sandal, towerStriker, 0, -0.055, 0);
  const smallBellStriker = new THREE.Group();
  smallBellStriker.name = "held-small-bell-striker";
  smallBellStriker.position.set(0, -0.25, 0.008);
  torso.add(smallBellStriker);
  const smallHandle = mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.31, 6), sandal, smallBellStriker, 0, 0, 0.1);
  smallHandle.rotation.x = Math.PI / 2;
  oval(smallBellStriker, woodLight, 0, 0, 0.28, 0.045, 0.045, 0.05);

  const readingBook = new THREE.Group();
  readingBook.name = "open-sutra-book";
  torso.add(readingBook);
  const paper = material(0xf0e5c9);
  const bookCover = material(0x6f897d);
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.x = side * 0.09;
    leaf.rotation.z = side * 0.12;
    readingBook.add(leaf);
    mesh(new THREE.BoxGeometry(0.18, 0.012, 0.23), bookCover, leaf, 0, 0, 0);
    mesh(new THREE.BoxGeometry(0.166, 0.025, 0.214), paper, leaf, 0, 0.016, 0);
    for (let row = 0; row < 5; row++) mesh(new THREE.BoxGeometry(0.115, 0.002, 0.004), ink, leaf, 0, 0.031, -0.07 + row * 0.033);
  }
  const turningPage = mesh(new THREE.BoxGeometry(0.16, 0.003, 0.21), paper, readingBook, 0.08, 0.035, 0);
  turningPage.name = "sutra-turning-page";

  function reachTo(index: number, x: number, y: number, z: number) {
    const arm = arms[index];
    releaseArmTarget.set(x, y, z).sub(arm.position);
    const length = Math.max(0.01, releaseArmTarget.length());
    arm.quaternion.setFromUnitVectors(armRestDirection, releaseArmTarget.divideScalar(length));
    arm.scale.y = length / 0.25;
    palms[index].scale.y = 0.073 / arm.scale.y;
  }

  const standingLegs = new THREE.Group();
  standingLegs.name = "monk-standing-legs";
  motionRig.add(standingLegs);
  const legPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.name = side < 0 ? "monk-left-leg" : "monk-right-leg";
    leg.position.set(side * 0.11, 0.30, 0);
    standingLegs.add(leg);
    oval(leg, robe, 0, -0.095, 0, 0.084, 0.17, 0.082);
    oval(leg, skin, 0, -0.22, 0.043, 0.073, 0.062, 0.12);
    oval(leg, sandal, 0, -0.255, 0.047, 0.079, 0.018, 0.125);
    line(leg, [[-.047, -.235, .065], [0, -.208, .092], [.047, -.235, .065]], .008, sandal);
    legPivots.push(leg);
  }

  const sittingLegs = new THREE.Group();
  sittingLegs.name = "monk-sitting-legs";
  motionRig.add(sittingLegs);
  for (const side of [-1, 1]) {
    const folded = oval(sittingLegs, robe, side * 0.128, 0.12, 0.14, 0.22, 0.11, 0.135);
    folded.rotation.y = side * 0.30;
    oval(sittingLegs, skin, side * 0.11, 0.125, 0.255, 0.07, 0.045, 0.062);
  }

  const beadRing = new THREE.Group();
  beadRing.name = "monk-prayer-beads";
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
  motionRig.add(woodenFish);
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
    const scenePose = ["offerFlower", "drum", "towerBell", "bell", "ritual", "pagoda", "mural", "sutra", "breathe", "lotusLamp"].includes(action);
    if (walking && (scenePose || ["light", "strike", "martial", "feed", "releaseFish", "chant", "skyLantern"].includes(action))) action = "walk";
    const seated = !walking && !scenePose && !["idle", "walk", "incense", "salute", "martial", "light", "strike", "feed", "releaseFish", "chant", "skyLantern"].includes(action);
    const animationPhase = phase ?? 0;
    const sway = Math.sin(t * 9 + animationPhase);
    motionRig.position.set(0, 0, 0);
    motionRig.rotation.set(0, 0, 0);
    standingLegs.visible = !seated;
    sittingLegs.visible = seated;
    torso.position.y = seated ? 0.205 : 0.45 + (walking ? Math.abs(sway) * 0.018 : Math.sin(t * 1.7 + animationPhase) * 0.006);
    torso.rotation.set(0, 0, 0);
    skirt.rotation.set(0, 0, 0);
    skirt.scale.set(1, 1, 0.76);
    crossingSash.rotation.set(-0.1, 0, 0.6);
    head.rotation.set(0, 0, walking ? sway * 0.025 : Math.sin(t * 1.1 + animationPhase) * 0.018);
    for (let index = 0; index < 2; index += 1) {
      const side = index === 0 ? -1 : 1;
      arms[index].rotation.set(walking ? sway * side * 0.48 : -0.12, 0, side * 0.12);
      arms[index].position.set(side * 0.235, 0.34, 0.005);
      arms[index].scale.set(1, 1, 1);
      legPivots[index].rotation.set(walking ? -sway * side * 0.43 : 0, 0, 0);
      legPivots[index].position.set(side * 0.11, 0.3, 0);
      legPivots[index].scale.set(1, 1, 1);
      palms[index].visible = true;
      palms[index].scale.set(0.061, 0.073, 0.055);
    }
    prayerHands.visible = ["prayer", "incense", "salute", "light", "chant", "chantSit", "skyLantern", "ritual", "pagoda", "lotusLamp"].includes(action);
    prayerHands.position.set(0, 0.245, 0.265);
    prayerHands.scale.setScalar(1);
    heldIncense.visible = action === "incense" && (phase ?? 0) < 0.68;
    heldLamp.visible = action === "light" || action === "lotusLamp" && (phase ?? 0) < 0.72;
    heldSkyLantern.visible = action === "skyLantern" && (phase ?? 0) < 0.55;
    beadRing.visible = action === "beads";
    woodenFish.visible = action === "wood";
    feedBowl.visible = action === "feed";
    thrownFood.visible = action === "feed";
    releaseHands.visible = action === "releaseFish";
    heldFish.visible = action === "releaseFish" && (phase ?? 0) < 0.56;
    releaseHands.position.set(0, 0.68, 0.25);
    heldFish.position.set(0, 0, 0);
    heldFish.rotation.set(0, 0, 0);
    heldSkyLantern.rotation.set(0, 0, 0);
    offeringBouquet.visible = action === "offerFlower" && (phase ?? 0) < 0.78;
    drumSticks.forEach(stick => { stick.visible = action === "drum"; });
    towerStriker.visible = action === "towerBell";
    smallBellStriker.visible = action === "bell";
    readingBook.visible = action === "sutra";

    if (seated) {
      arms[0].rotation.set(-0.62, 0, 0.62);
      arms[1].rotation.set(-0.62, 0, -0.62);
    }
    if (["prayer", "incense", "salute", "light", "chant", "chantSit", "skyLantern", "ritual", "pagoda", "lotusLamp"].includes(action)) {
      arms[0].rotation.set(-0.90, -0.05, 0.79);
      arms[1].rotation.set(-0.90, 0.05, -0.79);
      palms[0].visible = false;
      palms[1].visible = false;
    }
    if (action === "prayer" || action === "chant" || action === "chantSit") {
      prayerHands.position.z = 0.34;
      prayerHands.scale.setScalar(1.18);
      head.rotation.x = Math.sin(t * 2.1) * 0.035;
    }
    if (action === "skyLantern") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const raise = THREE.MathUtils.smoothstep(progress, 0.05, 0.4);
      const release = THREE.MathUtils.smoothstep(progress, 0.4, 0.55);
      const lower = 1 - THREE.MathUtils.smoothstep(progress, 0.55, 0.85);
      prayerHands.position.y += raise * lower * 0.3;
      prayerHands.position.z += release * lower * 0.15;
      arms[0].rotation.x -= raise * lower * 0.3;
      arms[1].rotation.x -= raise * lower * 0.3;
      heldSkyLantern.rotation.y = Math.sin(t * 1.8) * 0.05;
      head.rotation.x = -raise * 0.15;
    }
    if (action === "feed") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const cast = Math.sin(THREE.MathUtils.smoothstep(progress, 0.28, 0.7) * Math.PI);
      torso.rotation.x = cast * 0.14;
      arms[0].rotation.set(-1.07, -0.12, 0.32);
      arms[1].rotation.set(-0.65 - cast * 1.05, -0.15, -0.18 - cast * 0.3);
      head.rotation.x = 0.13 + cast * 0.09;
      for (let index = 0; index < 10; index++) {
        const flight = (progress * 4.2 - 1.4 - index * 0.055) / 0.85;
        const distance = THREE.MathUtils.clamp(flight, 0, 1);
        const sourceHeight = 0.18 + index * 0.016;
        foodTransform.position.set(0.19 + Math.sin(index * 2.4) * distance * 0.11, sourceHeight + Math.sin(distance * Math.PI) * 0.2 - distance * (sourceHeight + 0.37), 0.25 + distance * 1.02);
        foodTransform.scale.setScalar(flight >= 0 && flight <= 1 ? 0.012 : 0);
        foodTransform.updateMatrix();
        thrownFood.setMatrixAt(index, foodTransform.matrix);
      }
      thrownFood.instanceMatrix.needsUpdate = true;
    }
    if (action === "releaseFish") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const lean = THREE.MathUtils.smoothstep(progress, 0.1, 0.48) * (1 - THREE.MathUtils.smoothstep(progress, 0.7, 1));
      const slip = THREE.MathUtils.smoothstep(progress, 0.48, 0.56);
      torso.position.y = 0.45 - lean * 0.15;
      torso.rotation.x = lean * 0.85;
      head.rotation.x = lean * 0.18;
      // Cupped hands reach beyond the open landing before the fish slips into water.
      releaseHands.position.set(0, 0.68 - lean * 0.46, 0.25 + lean * 0.6);
      heldFish.position.set(0, -slip * 0.1, slip * 0.25);
      heldFish.rotation.y = Math.sin(t * 8) * 0.12;
      palms[0].visible = false;
      palms[1].visible = false;
      for (let index = 0; index < 2; index++) {
        const side = index === 0 ? -1 : 1;
        const arm = arms[index];
        arm.position.z += lean * 0.06;
        releaseArmTarget.set(side * 0.043, releaseHands.position.y - torso.position.y, releaseHands.position.z);
        releaseArmTarget.applyAxisAngle(bendAxis, -torso.rotation.x).sub(arm.position);
        const reach = releaseArmTarget.length();
        arm.quaternion.setFromUnitVectors(armRestDirection, releaseArmTarget.divideScalar(reach));
        arm.scale.y = reach / 0.25;
        legPivots[index].rotation.z = side * lean * 0.2;
      }
    }
    if (action === "light") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const lift = THREE.MathUtils.smoothstep(progress, 0.05, 0.25) * (1 - THREE.MathUtils.smoothstep(progress, 0.78, 0.96));
      prayerHands.position.y += lift * 0.24;
      prayerHands.position.z += lift * 0.09;
      arms[0].rotation.x -= lift * 0.2;
      arms[1].rotation.x -= lift * 0.2;
      head.rotation.x = Math.sin(progress * Math.PI) * 0.09;
      lampFlame.scale.y = 0.055 * (1 + Math.sin(t * 4.1) * 0.09);
    }
    if (action === "strike") {
      const strike = Math.sin(THREE.MathUtils.clamp(phase ?? 0, 0, 1) * Math.PI);
      arms[0].rotation.set(-0.8 - strike * 0.6, -0.08, 0.25);
      arms[1].rotation.set(-1.1 - strike * 0.4, 0.08, -0.25);
      torso.rotation.x = strike * 0.1;
    }
    if (action === "offerFlower") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const raise = THREE.MathUtils.smoothstep(progress, 0.06, 0.25);
      const placing = THREE.MathUtils.smoothstep(progress, 0.54, 0.78);
      const settle = 1 - THREE.MathUtils.smoothstep(progress, 0.8, 1);
      const bow = Math.sin(THREE.MathUtils.clamp((progress - 0.25) / 0.3, 0, 1) * Math.PI);
      torso.rotation.x = bow * 0.33 + placing * settle * 0.2;
      head.rotation.x = bow * 0.12;
      offeringBouquet.position.set(0, 0.14 + raise * (1 - placing) * 0.28 + placing * 0.72, 0.38 + placing * 0.44);
      offeringBouquet.rotation.set(placing * -0.16, 0, 0);
      reachTo(0, -0.07, offeringBouquet.position.y - 0.04, offeringBouquet.position.z - 0.015);
      reachTo(1, 0.07, offeringBouquet.position.y - 0.04, offeringBouquet.position.z - 0.015);
    }
    if (action === "drum") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      for (let index = 0; index < 2; index++) {
        const side = index === 0 ? -1 : 1;
        const firstHit = index === 0 ? 0.18 : 0.36;
        const secondHit = index === 0 ? 0.54 : 0.72;
        const strike = Math.max(Math.exp(-(((progress - firstHit) / 0.055) ** 2)), Math.exp(-(((progress - secondHit) / 0.055) ** 2)));
        const raised = 1 - strike;
        const stick = drumSticks[index];
        stick.position.set(side * 0.17, 0.36 + raised * 0.14, 0.6 - raised * 0.12);
        stick.rotation.set(-1.0 - raised * 0.45, 0, side * 0.04);
        reachTo(index, stick.position.x, stick.position.y, stick.position.z);
      }
      torso.rotation.x = Math.sin(progress * Math.PI) * 0.045;
      head.rotation.x = 0.12;
      legPivots[0].rotation.z = -0.18;
      legPivots[1].rotation.z = 0.18;
    }
    if (action === "towerBell") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const reach = THREE.MathUtils.smoothstep(progress, 0.02, 0.2);
      const pull = THREE.MathUtils.smoothstep(progress, 0.2, 0.44);
      const settle = THREE.MathUtils.smoothstep(progress, 0.62, 1);
      towerStriker.position.set(0, 0.13 + reach * 0.31 - pull * 0.25 + settle * 0.12, 0.35 + reach * 0.24 - pull * 0.08);
      towerStriker.rotation.set(pull * -0.15, 0, 0);
      reachTo(0, -0.025, towerStriker.position.y, towerStriker.position.z);
      reachTo(1, 0.025, towerStriker.position.y - 0.09, towerStriker.position.z);
      torso.rotation.x = pull * (1 - settle) * -0.08;
      head.rotation.x = -reach * 0.1 + pull * 0.14;
      legPivots[0].rotation.x = pull * (1 - settle) * -0.14;
      legPivots[1].rotation.x = pull * (1 - settle) * 0.1;
    }
    if (action === "bell") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const lift = THREE.MathUtils.smoothstep(progress, 0.02, 0.24);
      const tap = THREE.MathUtils.smoothstep(progress, 0.24, 0.4);
      const settle = THREE.MathUtils.smoothstep(progress, 0.65, 1);
      smallBellStriker.position.set(0.18, 0.25 + lift * 0.57 - tap * 0.09 - settle * 0.34, 0.34 + tap * 0.23 - settle * 0.18);
      smallBellStriker.rotation.set(-1.3 + tap * 0.62 - settle * 0.3, 0, 0);
      reachTo(1, smallBellStriker.position.x, smallBellStriker.position.y, smallBellStriker.position.z);
      arms[0].rotation.set(-0.8, 0, 0.5);
      torso.rotation.x = tap * (1 - settle) * 0.09;
      head.rotation.x = 0.08;
    }
    if (action === "ritual") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const raise = Math.sin(THREE.MathUtils.smoothstep(progress, 0, 0.3) * Math.PI / 2) * (1 - THREE.MathUtils.smoothstep(progress, 0.82, 1));
      const bow = Math.sin(THREE.MathUtils.clamp((progress - 0.3) / 0.48, 0, 1) * Math.PI * 2) ** 2;
      prayerHands.position.y += raise * 0.2;
      torso.rotation.x = bow * 0.38;
      head.rotation.x = bow * 0.14;
      arms[0].rotation.x -= raise * 0.25;
      arms[1].rotation.x -= raise * 0.25;
    }
    if (action === "pagoda") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const step = Math.sin(progress * Math.PI * 4) * Math.sin(progress * Math.PI);
      const reverence = THREE.MathUtils.smoothstep(progress, 0.25, 0.46) * (1 - THREE.MathUtils.smoothstep(progress, 0.78, 1));
      motionRig.position.x = step * 0.07;
      motionRig.rotation.y = Math.sin(progress * Math.PI * 2) * 0.18;
      prayerHands.position.y += reverence * 0.15;
      torso.rotation.x = reverence * 0.24;
      head.rotation.x = -Math.sin(progress * Math.PI) * 0.17 + reverence * 0.22;
      legPivots[0].rotation.x = step * 0.2;
      legPivots[1].rotation.x = -step * 0.2;
    }
    if (action === "mural") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const indicate = Math.sin(progress * Math.PI);
      const scan = Math.sin(progress * Math.PI * 2);
      head.rotation.set(-0.06 - indicate * 0.1, scan * 0.34, 0);
      torso.rotation.y = scan * 0.12;
      arms[1].rotation.set(-0.12 - indicate * 1.7, -0.1 - scan * 0.12, -0.12 - indicate * 0.25);
      arms[0].rotation.set(-0.75, 0, 0.4);
    }
    if (action === "sutra") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const lift = Math.sin(progress * Math.PI) * 0.04;
      readingBook.position.set(0, 0.13 + lift, 0.39);
      readingBook.rotation.set(-0.32, 0, 0);
      const pageTurn = THREE.MathUtils.smoothstep(progress, 0.42, 0.6);
      turningPage.position.x = Math.cos(pageTurn * Math.PI) * 0.08;
      turningPage.position.y = 0.035 + Math.sin(pageTurn * Math.PI) * 0.08;
      turningPage.rotation.z = pageTurn * Math.PI;
      reachTo(0, -0.17, 0.11 + lift, 0.42);
      reachTo(1, 0.17, 0.11 + lift, 0.42);
      head.rotation.set(0.24, Math.sin(progress * Math.PI * 4) * 0.06, 0);
      torso.rotation.x = 0.04;
    }
    if (action === "breathe") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const inhale = Math.sin(progress * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
      torso.position.y = 0.45 + inhale * 0.035;
      arms[0].rotation.set(-0.16 - inhale * 0.2, 0, 0.12 + inhale * 1.2);
      arms[1].rotation.set(-0.16 - inhale * 0.2, 0, -0.12 - inhale * 1.2);
      head.rotation.x = -inhale * 0.08;
    }
    if (action === "lotusLamp") {
      const progress = THREE.MathUtils.clamp(phase ?? 0, 0, 1);
      const raise = THREE.MathUtils.smoothstep(progress, 0.04, 0.25);
      const place = THREE.MathUtils.smoothstep(progress, 0.48, 0.72);
      const release = THREE.MathUtils.smoothstep(progress, 0.76, 1);
      prayerHands.position.y += raise * (1 - place) * 0.18;
      prayerHands.position.z += place * (1 - release) * 0.27;
      arms[0].rotation.x -= raise * (1 - release) * 0.3;
      arms[1].rotation.x -= raise * (1 - release) * 0.3;
      torso.rotation.x = place * (1 - release) * 0.22;
      head.rotation.x = place * (1 - release) * 0.12;
      lampFlame.scale.y = 0.055 * (1 + Math.sin(t * 4.1) * 0.09);
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
      const pose = sampleMartial(phase === undefined ? t % MARTIAL_DURATION : phase * MARTIAL_DURATION);
      const punches = pose.leftPunch + pose.rightPunch;
      const guard = pose.activity * (1 - pose.salute);
      const kickWeightShift = Math.sin(pose.sideKick * Math.PI) * 0.04;
      motionRig.position.set(pose.travelX, pose.jump * 1.35 + pose.stance * 0.065 + pose.landing * 0.02 + kickWeightShift, pose.travelZ);
      motionRig.rotation.set(-pose.jump * 0.24, pose.spin, Math.sin(pose.spin) * pose.jump * 0.34);
      torso.position.y = 0.45 - pose.stance * 0.075 - pose.landing * 0.08 - pose.palm * 0.06;
      torso.rotation.set(punches * 0.16 + pose.landing * 0.26 + pose.palm * 0.32, (pose.rightPunch - pose.leftPunch) * 0.72 + pose.sideKick * 0.55, -pose.sideKick * 0.25);
      head.rotation.set(-pose.jump * 0.15 + pose.palm * 0.12, -torso.rotation.y * 0.65, pose.sideKick * 0.16);
      skirt.rotation.set(-pose.flutter * 0.3, pose.flutter * 0.2, Math.sin(t * 18) * pose.flutter * 0.16);
      skirt.scale.set(1 + pose.flutter * 0.25, 1 - pose.flutter * 0.1, 0.76 + pose.flutter * 0.14);
      crossingSash.rotation.z += Math.sin(t * 17) * pose.flutter * 0.12;
      for (let index = 0; index < 2; index++) {
        const side = index === 0 ? -1 : 1;
        const punch = index === 0 ? pose.leftPunch : pose.rightPunch;
        const shoulderLift = -0.12 - guard * 0.96 - punch * 0.55 - pose.airKick * 0.8 - pose.palm * 1.45;
        const shoulderTurn = -side * (guard * 0.4 - punch * 0.36);
        const shoulderSpread = side * (0.12 + guard * 0.55 - punch * 0.62 + pose.jump * 0.5);
        arms[index].rotation.set(shoulderLift, shoulderTurn, shoulderSpread);
        arms[index].position.z += punch * 0.2 + pose.palm * 0.08;
        arms[index].scale.y = 1 + punch * 0.72 + pose.palm * 0.35;
        legPivots[index].position.x = side * (0.11 + pose.stance * 0.15);
        legPivots[index].position.y = 0.3 - pose.stance * 0.015;
        legPivots[index].rotation.set(punches * side * 0.18 - pose.jump * (index === 0 ? 0.95 : 0.35), side * pose.jump * 0.35, side * (pose.stance * 0.48 + pose.landing * 0.18));
      }
      legPivots[1].rotation.set(-pose.sideKick * 2.45 - pose.airKick * 2.35 - pose.jump * 0.2, -pose.sideKick * 0.1 - pose.airKick * 0.65, -pose.stance * 0.24 + pose.sideKick * 0.4 + pose.airKick * 0.5);
      legPivots[1].scale.y = 1 + pose.sideKick * 1.4 + pose.airKick * 1.2;
      if (pose.salute > 0) {
        prayerHands.visible = true;
        arms[0].rotation.set(-0.12 - pose.salute * 0.78, -0.05, 0.12 + pose.salute * 0.67);
        arms[1].rotation.set(-0.12 - pose.salute * 0.78, 0.05, -0.12 - pose.salute * 0.67);
        palms[0].visible = false;
        palms[1].visible = false;
      }
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
      arms[1].rotation.set(-1.08, 0, -0.12);
      arms[1].position.z = 0.12;
      beadRing.position.set(0.23, 0.18 + Math.sin(t * 3) * 0.012, 0.36);
      beadRing.scale.setScalar(1.15);
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
      thrownFood.dispose();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((surface) => surface.dispose());
      group.clear();
    },
  };
}
