import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };

export function createTempleEnvironment(scene: THREE.Scene): {
  ground: THREE.Object3D;
  colliders: Collider[];
  cushions: Array<{ x: number; z: number }>;
  landmarks: Array<{ name: string; x: number; z: number }>;
  animate: (t: number) => void;
  dispose: () => void;
} {
  const world = new THREE.Group();
  world.name = '云间寺 · 山间庭院';
  scene.add(world);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const colliders: Collider[] = [];
  const cushions = [
    { x: -3, z: 1 }, { x: -1, z: 1 }, { x: 1, z: 1 }, { x: 3, z: 1 },
    { x: -3, z: 4 }, { x: -1, z: 4 }, { x: 1, z: 4 }, { x: 3, z: 4 },
  ];

  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...options });
    materials.add(result);
    return result;
  };
  const palette = {
    grass: material('#a8bc8a'),
    grassDark: material('#8caa78'),
    stone: material('#c2c6aa'),
    stoneLight: material('#dedcc2'),
    path: material('#e9e5cb'),
    plaster: material('#e4d9b6'),
    wood: material('#9b7250'),
    woodDark: material('#6c5740'),
    roof: material('#bd795a'),
    roofRib: material('#d79a77'),
    roofShadow: material('#955c47'),
    gold: material('#c7aa69', { metalness: 0.25, roughness: 0.56 }),
    goldLight: material('#e1c786', { metalness: 0.18, roughness: 0.48 }),
    leaf: material('#8caa78'),
    leafLight: material('#adc390'),
    leafDark: material('#6d8d66'),
    bamboo: material('#95ad70'),
    straw: material('#ccb681'),
    strawRim: material('#aa9666'),
    lantern: material('#e9c38b', { emissive: '#bd793e', emissiveIntensity: 0.19 }),
    water: material('#88b5a4', { roughness: 0.28, metalness: 0.16 }),
    lily: material('#719263'),
    pink: material('#e7b5a3'),
    koi: material('#dca474'),
  };

  function mesh(
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = world,
  ) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, surface);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  function box(x: number, y: number, z: number, w: number, h: number, d: number, surface: THREE.Material, parent: THREE.Object3D = world) {
    return mesh(new THREE.BoxGeometry(w, h, d), surface, x, y, z, parent);
  }

  function cylinder(x: number, y: number, z: number, top: number, bottom: number, height: number, surface: THREE.Material, parent: THREE.Object3D = world, segments = 12) {
    return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), surface, x, y, z, parent);
  }

  function sphere(x: number, y: number, z: number, radius: number, surface: THREE.Material, parent: THREE.Object3D = world) {
    return mesh(new THREE.SphereGeometry(radius, 10, 7), surface, x, y, z, parent);
  }

  function collider(x: number, z: number, width: number, depth: number) {
    colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
  }

  function beamBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, surface: THREE.Material, parent: THREE.Object3D = world) {
    const object = cylinder(0, 0, 0, radius, radius, a.distanceTo(b), surface, parent, 8);
    object.position.copy(a).add(b).multiplyScalar(0.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return object;
  }

  // This broad, uninterrupted plane is also the tap-to-walk raycast target.
  const groundMaterial = material('#a9bd8d', { side: THREE.DoubleSide });
  const ground = mesh(new THREE.PlaneGeometry(30, 30), groundMaterial, 0, 0, 0);
  ground.rotation.x = -Math.PI / 2;
  ground.name = '可行走地面';
  ground.castShadow = false;

  box(0, 0.014, 4, 10.4, 0.028, 16.4, palette.path);
  box(0, 0.022, -6.8, 10, 0.045, 8.5, palette.path);
  box(5.9, 0.018, -4.9, 8.8, 0.035, 1.35, palette.path);
  box(-7.6, 0.018, 0.7, 5.6, 0.035, 1.35, palette.path);
  for (let z = -2; z <= 11; z += 1.35) {
    const stone = box(0, 0.039, z, 1.32, 0.035, 0.98, palette.stoneLight);
    stone.rotation.y = Math.sin(z * 3) * 0.07;
  }

  // A perimeter with a genuine opening through the front gate.
  function wall(x: number, z: number, width: number, depth: number) {
    box(x, 0.67, z, width, 1.34, depth, palette.plaster);
    box(x, 1.37, z, width + 0.12, 0.17, depth + 0.22, palette.stone);
    box(x, 0.14, z, width + 0.12, 0.28, depth + 0.1, palette.stone);
    collider(x, z, width, depth);
  }
  wall(-14, -0.25, 0.42, 28.5);
  wall(14, -0.25, 0.42, 28.5);
  wall(0, -14.3, 28, 0.42);
  wall(-8.25, 13.8, 11.5, 0.42);
  wall(8.25, 13.8, 11.5, 0.42);

  function roof(centerX: number, centerZ: number, width: number, depth: number, baseY: number, rise: number) {
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const surfaceHeight = (x: number, v: number) => {
      const eave = Math.max(0, (v - 0.72) / 0.28);
      return baseY + rise * Math.pow(1 - v, 1.5) + 0.23 * eave * eave + 0.22 * Math.pow(Math.abs(x) / halfWidth, 7);
    };
    for (const direction of [-1, 1]) {
      const vertices: number[] = [];
      const indices: number[] = [];
      const across = 16;
      const down = 10;
      for (let row = 0; row <= down; row++) {
        const v = row / down;
        for (let column = 0; column <= across; column++) {
          const x = -halfWidth + (column / across) * width;
          vertices.push(centerX + x, surfaceHeight(x, v), centerZ + direction * v * halfDepth);
        }
      }
      for (let row = 0; row < down; row++) {
        for (let column = 0; column < across; column++) {
          const a = row * (across + 1) + column;
          const b = a + across + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const roofMaterial = palette.roof.clone();
      roofMaterial.side = THREE.DoubleSide;
      materials.add(roofMaterial);
      mesh(geometry, roofMaterial, 0, 0, 0);

      // Curved tile ribs are geometry, visible from every camera angle.
      for (let column = 0; column <= across; column++) {
        const x = -halfWidth + (column / across) * width;
        const points: THREE.Vector3[] = [];
        for (let row = 0; row <= down; row++) {
          const v = row / down;
          points.push(new THREE.Vector3(centerX + x, surfaceHeight(x, v) + 0.045, centerZ + direction * v * halfDepth));
        }
        const curve = new THREE.CatmullRomCurve3(points);
        mesh(new THREE.TubeGeometry(curve, 12, 0.036, 4, false), palette.roofRib, 0, 0, 0);
      }
      for (let row = 1; row <= 5; row++) {
        const v = row / 5;
        const points: THREE.Vector3[] = [];
        for (let column = 0; column <= 12; column++) {
          const x = -halfWidth + (column / 12) * width;
          points.push(new THREE.Vector3(centerX + x, surfaceHeight(x, v) + 0.02, centerZ + direction * v * halfDepth));
        }
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, 0.025, 4, false), palette.roofShadow, 0, 0, 0);
      }
    }
    beamBetween(new THREE.Vector3(centerX - halfWidth, baseY + rise + 0.11, centerZ), new THREE.Vector3(centerX + halfWidth, baseY + rise + 0.11, centerZ), 0.105, palette.roofShadow);
    for (const side of [-1, 1]) {
      const ornament = sphere(centerX + side * halfWidth, baseY + rise + 0.25, centerZ, 0.15, palette.gold);
      ornament.scale.set(0.75, 1.3, 0.75);
    }
  }

  // Walk-in main hall. The floor stays at the courtyard's walking height.
  box(0, 1.78, -11, 10.1, 3.56, 0.28, palette.plaster);
  collider(0, -11, 10.1, 0.36);
  for (const side of [-1, 1]) {
    box(side * 5, 0.65, -7.25, 0.26, 1.3, 7.5, palette.plaster);
    box(side * 5, 3.22, -7.25, 0.26, 0.66, 7.5, palette.plaster);
    collider(side * 5, -7.25, 0.35, 7.5);
    for (let z = -10.5; z <= -3.7; z += 0.5) box(side * 5, 2.08, z, 0.2, 1.55, 0.07, palette.woodDark);
    box(side * 5, 1.34, -7.25, 0.36, 0.12, 7.5, palette.wood);
    box(side * 5, 2.85, -7.25, 0.36, 0.12, 7.5, palette.wood);
    box(side * 3.65, 0.62, -3.5, 2.5, 1.24, 0.23, palette.plaster);
    collider(side * 3.65, -3.5, 2.5, 0.34);
    for (const z of [-10.7, -7.2, -3.5]) {
      cylinder(side * 4.7, 1.92, z, 0.15, 0.19, 3.84, palette.wood, world, 10);
      cylinder(side * 4.7, 0.14, z, 0.25, 0.27, 0.28, palette.stone);
      collider(side * 4.7, z, 0.5, 0.5);
    }
    cylinder(side * 2.3, 1.92, -3.5, 0.15, 0.19, 3.84, palette.wood);
    cylinder(side * 2.3, 0.14, -3.5, 0.25, 0.27, 0.28, palette.stone);
    collider(side * 2.3, -3.5, 0.48, 0.48);
  }
  box(0, 3.66, -3.5, 10.5, 0.3, 0.32, palette.woodDark);
  box(0, 3.66, -10.85, 10.5, 0.3, 0.32, palette.woodDark);
  box(-4.8, 3.66, -7.2, 0.3, 0.3, 7.6, palette.woodDark);
  box(4.8, 3.66, -7.2, 0.3, 0.3, 7.6, palette.woodDark);
  roof(0, -7.3, 12, 10.4, 3.86, 1.78);
  box(0, 3.37, -3.28, 2, 0.65, 0.13, palette.woodDark);
  box(0, 3.37, -3.195, 1.85, 0.51, 0.035, palette.gold);
  box(0, 3.37, -3.165, 1.7, 0.39, 0.025, palette.woodDark);
  // A small lotus carved into the plaque keeps its appearance font-independent.
  for (let i = -1; i <= 1; i++) {
    const petal = sphere(i * 0.15, 3.37, -3.13, 0.105, palette.goldLight);
    petal.scale.set(0.6, 1.35, 0.35);
    petal.rotation.z = -i * 0.48;
  }

  function lantern(x: number, y: number, z: number, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    world.add(group);
    cylinder(0, 0.45, 0, 0.018, 0.018, 0.5, palette.woodDark, group, 5);
    const body = sphere(0, 0, 0, 0.24, palette.lantern, group);
    body.scale.set(1, 1.26, 1);
    cylinder(0, 0.28, 0, 0.18, 0.19, 0.07, palette.wood, group);
    cylinder(0, -0.28, 0, 0.18, 0.19, 0.07, palette.wood, group);
    cylinder(0, -0.43, 0, 0.02, 0.02, 0.23, palette.roof, group, 5);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const rib = box(Math.cos(angle) * 0.21, 0, Math.sin(angle) * 0.21, 0.018, 0.4, 0.018, palette.gold, group);
      rib.rotation.y = -angle;
    }
    return group;
  }
  const lanterns = [lantern(-3.45, 2.95, -3.25), lantern(3.45, 2.95, -3.25)];

  // A seated golden figure and lotus altar at the back of the hall.
  box(0, 0.33, -9.7, 3.5, 0.66, 1.7, palette.woodDark);
  box(0, 0.71, -9.7, 3.8, 0.12, 1.9, palette.wood);
  cylinder(0, 0.89, -9.75, 0.95, 1.08, 0.3, palette.gold);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const petal = sphere(Math.sin(angle) * 0.82, 1.01, -9.75 + Math.cos(angle) * 0.62, 0.22, palette.goldLight);
    petal.scale.set(0.6, 1, 1.4);
    petal.rotation.y = angle;
  }
  const halo = mesh(new THREE.TorusGeometry(0.81, 0.035, 6, 40), palette.goldLight, 0, 2.15, -10.17);
  halo.castShadow = false;
  const body = sphere(0, 1.6, -9.8, 0.57, palette.gold);
  body.scale.set(0.9, 1.2, 0.75);
  const legs = sphere(0, 1.22, -9.58, 0.67, palette.gold);
  legs.scale.set(1.38, 0.42, 0.8);
  sphere(0, 2.35, -9.75, 0.33, palette.goldLight);
  sphere(0, 2.69, -9.79, 0.14, palette.gold);
  for (const side of [-1, 1]) {
    const ear = sphere(side * 0.32, 2.31, -9.73, 0.1, palette.goldLight);
    ear.scale.set(0.55, 1.45, 0.7);
    beamBetween(new THREE.Vector3(side * 0.39, 1.94, -9.8), new THREE.Vector3(side * 0.59, 1.49, -9.5), 0.13, palette.gold);
    beamBetween(new THREE.Vector3(side * 0.59, 1.49, -9.5), new THREE.Vector3(side * 0.08, 1.4, -9.38), 0.1, palette.goldLight);
    const eye = box(side * 0.11, 2.37, -9.441, 0.1, 0.018, 0.018, palette.woodDark);
    eye.rotation.z = side * 0.08;
  }
  collider(0, -9.7, 3.8, 2.1);
  cylinder(0, 0.84, -8.95, 0.15, 0.11, 0.15, palette.gold);
  for (let i = -1; i <= 1; i++) cylinder(i * 0.055, 1.07, -8.95, 0.009, 0.009, 0.38, palette.woodDark, world, 4);
  for (const x of [-1.3, 1.3]) {
    cylinder(x, 0.89, -9.45, 0.08, 0.14, 0.28, palette.gold);
    const flame = sphere(x, 1.09, -9.45, 0.045, palette.lantern);
    flame.scale.set(0.75, 1.6, 0.75);
  }

  // Eight woven straw seats, exactly matching the multiplayer seat coordinates.
  for (const [index, position] of cushions.entries()) {
    const cushion = cylinder(position.x, 0.085, position.z, 0.56, 0.6, 0.16, palette.straw, world, 24);
    cushion.name = `蒲团 ${index + 1}`;
    for (const radius of [0.19, 0.34, 0.48, 0.57]) {
      const ring = mesh(new THREE.TorusGeometry(radius, 0.012, 3, 24), palette.strawRim, position.x, 0.172, position.z);
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = false;
    }
  }

  function tree(x: number, z: number, size: number, variation: number) {
    cylinder(x, 1.18 * size, z, 0.15 * size, 0.23 * size, 2.36 * size, palette.wood, world, 7);
    beamBetween(new THREE.Vector3(x, 1.2 * size, z), new THREE.Vector3(x - 0.55 * size, 2.18 * size, z + 0.15), 0.09 * size, palette.wood);
    beamBetween(new THREE.Vector3(x, 1.4 * size, z), new THREE.Vector3(x + 0.6 * size, 2.4 * size, z - 0.2), 0.08 * size, palette.wood);
    const crowns = [[0, 2.85, 0, 1.1], [-0.7, 2.45, 0.17, 0.84], [0.7, 2.64, -0.05, 0.88], [0.1, 2.48, 0.7, 0.85]];
    for (const [index, crown] of crowns.entries()) {
      const leaf = mesh(new THREE.IcosahedronGeometry(crown[3] * size, 1), [palette.leaf, palette.leafLight, palette.leafDark][(index + variation) % 3], x + crown[0] * size, crown[1] * size, z + crown[2] * size);
      leaf.scale.y = 0.82;
    }
    collider(x, z, 0.65 * size, 0.65 * size);
  }
  tree(-10.8, 8.8, 1.3, 0);
  tree(11.3, 9.5, 1.4, 1);
  tree(-11.5, -10.6, 1.5, 2);
  tree(12.3, -11.5, 1.3, 0);
  tree(-7.7, 7.7, 0.93, 1);
  tree(6.8, 9.6, 0.92, 0);

  // West bamboo grove, with separate stalks and branches that remain fully 3D.
  for (let i = 0; i < 17; i++) {
    const x = -11.6 + (i % 4) * 0.72 + Math.sin(i * 2.1) * 0.2;
    const z = -2.3 + Math.floor(i / 4) * 1.1;
    const height = 3.1 + ((i * 7) % 6) * 0.21;
    cylinder(x, height / 2, z, 0.045, 0.063, height, palette.bamboo, world, 6);
    for (let y = 0.65; y < height; y += 0.65) {
      cylinder(x, y, z, 0.065, 0.065, 0.045, palette.leafDark, world, 6);
    }
    for (let branch = 0; branch < 2; branch++) {
      const group = new THREE.Group();
      group.position.set(x, height - 0.5 - branch * 0.62, z);
      group.rotation.y = i * 1.7 + branch * 2.1;
      world.add(group);
      beamBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.66, 0.32, 0), 0.018, palette.bamboo, group);
      for (let leaf = 0; leaf < 3; leaf++) {
        const blade = mesh(new THREE.SphereGeometry(0.15, 5, 3), leaf % 2 ? palette.leafLight : palette.leafDark, 0.22 + leaf * 0.18, 0.1 + leaf * 0.08, leaf % 2 ? 0.15 : -0.1, group);
        blade.scale.set(1.8, 0.15, 0.48);
        blade.rotation.y = leaf % 2 ? -0.6 : 0.6;
      }
    }
    collider(x, z, 0.22, 0.22);
  }

  // An east-side lotus pond with shoreline rocks and slowly swimming koi.
  const pond = cylinder(9, 0.025, 2, 1, 1, 0.05, palette.water, world, 48);
  pond.scale.set(3.05, 1, 2.05);
  pond.name = '莲池';
  collider(9, 2, 5.8, 3.8);
  for (let i = 0; i < 25; i++) {
    const angle = (i / 25) * Math.PI * 2;
    const stone = mesh(new THREE.DodecahedronGeometry(0.28 + (i % 3) * 0.045, 0), i % 2 ? palette.stone : palette.stoneLight, 9 + Math.cos(angle) * 3.12, 0.15, 2 + Math.sin(angle) * 2.12);
    stone.scale.set(1.4, 0.65, 1);
    stone.rotation.set(i * 0.4, i * 0.9, 0);
  }
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4;
    const x = 9 + Math.cos(angle) * (1.5 + (i % 2) * 0.5);
    const z = 2 + Math.sin(angle) * (0.9 + (i % 2) * 0.35);
    const pad = mesh(new THREE.CircleGeometry(0.3, 14, 0.2, Math.PI * 1.8), palette.lily, x, 0.067, z);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = angle;
    pad.castShadow = false;
    if (i % 2 === 0) {
      cylinder(x, 0.13, z, 0.018, 0.018, 0.15, palette.leafDark, world, 4);
      for (let j = 0; j < 6; j++) {
        const petalAngle = (j / 6) * Math.PI * 2;
        const petal = sphere(x + Math.cos(petalAngle) * 0.08, 0.23, z + Math.sin(petalAngle) * 0.08, 0.1, palette.pink);
        petal.scale.set(0.65, 1.2, 0.65);
        petal.rotation.z = -Math.cos(petalAngle) * 0.45;
        petal.rotation.x = Math.sin(petalAngle) * 0.45;
      }
      sphere(x, 0.25, z, 0.045, palette.goldLight);
    }
  }
  const fish: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const group = new THREE.Group();
    world.add(group);
    const body = sphere(0, 0, 0, 0.13, palette.koi, group);
    body.scale.set(0.75, 0.3, 1.9);
    const tail = mesh(new THREE.ConeGeometry(0.12, 0.22, 3), palette.koi, 0, 0, -0.3, group);
    tail.rotation.x = Math.PI / 2;
    tail.scale.y = 0.6;
    fish.push(group);
  }
  const rippleMaterial = material('#c8dfcb', { transparent: true, opacity: 0.3, depthWrite: false });
  const ripples: THREE.Mesh[] = [];
  for (const position of [[8.2, 1.1], [10.2, 2.7]]) {
    const ripple = mesh(new THREE.RingGeometry(0.35, 0.37, 32), rippleMaterial, position[0], 0.071, position[1]);
    ripple.rotation.x = -Math.PI / 2;
    ripple.castShadow = false;
    ripples.push(ripple);
  }

  // The bell pavilion has four open sides and a small curved tiled roof.
  box(9, 0.055, -7, 3.7, 0.11, 3.7, palette.stoneLight);
  for (const x of [7.5, 10.5]) {
    for (const z of [-8.5, -5.5]) {
      cylinder(x, 1.45, z, 0.11, 0.15, 2.9, palette.wood);
      cylinder(x, 0.12, z, 0.23, 0.25, 0.24, palette.stone);
      collider(x, z, 0.42, 0.42);
    }
  }
  box(9, 2.83, -7, 3.4, 0.2, 0.2, palette.woodDark);
  roof(9, -7, 4.5, 4.3, 2.88, 0.92);
  const bell = new THREE.Group();
  bell.position.set(9, 2.33, -7);
  world.add(bell);
  cylinder(0, 0.24, 0, 0.04, 0.04, 0.5, palette.woodDark, bell, 6);
  cylinder(0, -0.22, 0, 0.4, 0.58, 0.77, palette.gold, bell, 20);
  cylinder(0, -0.64, 0, 0.63, 0.64, 0.12, palette.goldLight, bell, 20);
  sphere(0, -0.72, 0, 0.13, palette.woodDark, bell);
  const bellRing = mesh(new THREE.TorusGeometry(0.42, 0.025, 4, 20), palette.goldLight, 0, -0.06, 0, bell);
  bellRing.rotation.x = Math.PI / 2;
  collider(9, -7, 1.4, 1.4);
  const striker = cylinder(9, 1.68, -5.95, 0.09, 0.09, 1.6, palette.woodDark);
  striker.rotation.z = Math.PI / 2;

  // Stone garden lanterns light the approach without obstructing the path.
  function stoneLantern(x: number, z: number) {
    cylinder(x, 0.1, z, 0.43, 0.5, 0.2, palette.stone, world, 6);
    cylinder(x, 0.57, z, 0.15, 0.21, 0.88, palette.stone, world, 6);
    box(x, 1.1, z, 0.52, 0.5, 0.52, palette.stoneLight);
    box(x, 1.1, z + 0.267, 0.23, 0.28, 0.015, palette.lantern);
    mesh(new THREE.ConeGeometry(0.53, 0.3, 4), palette.leafDark, x, 1.5, z).rotation.y = Math.PI / 4;
    sphere(x, 1.7, z, 0.08, palette.stone);
    collider(x, z, 0.8, 0.8);
  }
  stoneLantern(-5.8, -1.1);
  stoneLantern(5.8, -1.1);
  stoneLantern(-3.7, 10.3);
  stoneLantern(3.7, 10.3);

  for (const side of [-1, 1]) {
    cylinder(side * 2.85, 1.65, 12.75, 0.18, 0.23, 3.3, palette.wood);
    cylinder(side * 2.85, 0.16, 12.75, 0.33, 0.36, 0.32, palette.stone);
    collider(side * 2.85, 12.75, 0.65, 0.65);
  }
  box(0, 3.15, 12.75, 6.3, 0.35, 0.35, palette.woodDark);
  roof(0, 12.75, 7.5, 2.4, 3.35, 0.65);
  lanterns.push(lantern(-2.05, 2.55, 12.75, 0.85), lantern(2.05, 2.55, 12.75, 0.85));

  // Small, deterministic ground details keep the garden tactile and lightweight.
  for (let i = 0; i < 35; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (6.2 + ((i * 13) % 59) / 10);
    const z = -12 + ((i * 31) % 242) / 10;
    if (x > 6 && z > -9 && z < 4.7) continue;
    const tuft = new THREE.Group();
    tuft.position.set(x, 0.12, z);
    world.add(tuft);
    for (let blade = 0; blade < 3; blade++) {
      const stem = mesh(new THREE.ConeGeometry(0.035, 0.28 + blade * 0.055, 3), palette.grassDark, (blade - 1) * 0.07, 0, 0, tuft);
      stem.rotation.z = (blade - 1) * 0.3;
    }
    if (i % 6 === 0) sphere(x, 0.35, z, 0.085, palette.pink);
  }

  // Distant mountains are low-poly volumes beyond the garden walls.
  const mountainMaterials = [material('#b6c7aa'), material('#cad5bb'), material('#d5ddc6')];
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 9; i++) {
      const mountain = mesh(new THREE.ConeGeometry(7.5 + (i % 3), 9 + ((i * 7) % 5), 5), mountainMaterials[layer], -33 + i * 8.1, 2.5 + layer * 0.2, -25 - layer * 8 - Math.sin(i * 2) * 2);
      mountain.rotation.y = i * 0.8;
      mountain.scale.z = 0.6;
      mountain.castShadow = false;
      mountain.receiveShadow = false;
    }
  }

  // Bake stationary shapes by material so the detailed garden stays light on phones.
  // Independent animated objects and the walkable raycast plane retain their identity.
  const movingObjects = new Set<THREE.Object3D>([...lanterns, ...fish, bell, ...ripples]);
  const staticBatches = new Map<string, { surface: THREE.Material; castShadow: boolean; receiveShadow: boolean; pieces: THREE.BufferGeometry[]; objects: THREE.Mesh[] }>();
  world.updateMatrixWorld(true);
  world.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object === ground) return;
    let ancestor: THREE.Object3D | null = object;
    while (ancestor && ancestor !== world) {
      if (movingObjects.has(ancestor)) return;
      ancestor = ancestor.parent;
    }
    const surface = object.material as THREE.Material;
    const key = `${surface.uuid}-${object.castShadow}-${object.receiveShadow}-${Boolean(object.geometry.index)}-${Object.keys(object.geometry.attributes).sort().join(',')}`;
    let batch = staticBatches.get(key);
    if (!batch) {
      batch = { surface, castShadow: object.castShadow, receiveShadow: object.receiveShadow, pieces: [], objects: [] };
      staticBatches.set(key, batch);
    }
    batch.pieces.push(object.geometry.clone().applyMatrix4(object.matrixWorld));
    batch.objects.push(object);
  });
  for (const batch of staticBatches.values()) {
    const geometry = mergeGeometries(batch.pieces, false);
    for (const piece of batch.pieces) piece.dispose();
    if (!geometry) continue;
    const combined = mesh(geometry, batch.surface, 0, 0, 0);
    combined.castShadow = batch.castShadow;
    combined.receiveShadow = batch.receiveShadow;
    for (const object of batch.objects) object.removeFromParent();
  }

  return {
    ground,
    colliders,
    cushions,
    landmarks: [
      { name: '大殿', x: 0, z: -5.7 },
      { name: '莲池', x: 5.8, z: 2 },
      { name: '竹林', x: -8.4, z: 0.7 },
      { name: '钟亭', x: 8.8, z: -4.8 },
      { name: '山门', x: 0, z: 10.8 },
    ],
    animate(t: number) {
      for (const [index, group] of lanterns.entries()) group.rotation.z = Math.sin(t * 0.7 + index) * 0.035;
      for (const [index, group] of fish.entries()) {
        const angle = t * 0.13 + index * 2.1;
        group.position.set(9 + Math.cos(angle) * (1.5 + index * 0.2), 0.078, 2 + Math.sin(angle) * (1 + index * 0.15));
        group.rotation.y = Math.atan2(-Math.sin(angle) * (1.5 + index * 0.2), Math.cos(angle) * (1 + index * 0.15));
      }
      for (const [index, ripple] of ripples.entries()) ripple.scale.setScalar(1 + Math.sin(t * 0.6 + index * 2) * 0.15);
      bell.rotation.z = Math.sin(t * 0.45) * 0.012;
    },
    dispose() {
      scene.remove(world);
      for (const geometry of geometries) geometry.dispose();
      for (const surface of materials) surface.dispose();
    },
  };
}
