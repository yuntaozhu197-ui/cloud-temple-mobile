import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSacredArt } from './sacredArt';
import { createDetachedHalls, type TempleRoom } from './detachedHalls';
import { createScenicAreas } from './scenicAreas';
import { createTempleMountain } from './mountain';
import { createFishSchool } from './fishSchool';
import { createPrayerZones } from './prayerZones';
import { createFortuneTowers } from './fortuneTowers';
import { createSkyLanterns } from './skyLanterns';
import { createNpcMonks } from './npcMonks';
import { createAltarAtmosphere } from './altarAtmosphere';
import { TEMPLE_SEATS } from '../templeSeats';

type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };

export function createTempleEnvironment(scene: THREE.Scene): {
  ground: THREE.Object3D;
  colliders: Collider[];
  cushions: Array<{ x: number; z: number }>;
  landmarks: Array<{ name: string; x: number; z: number }>;
  interactions: Array<{ kind: 'incense' | 'incenseGuanyin' | 'incenseWenshu' | 'incenseCaishen' | 'longLamp' | 'skyLantern' | 'drum' | 'towerBell' | 'flower' | 'ritual' | 'bell' | 'fish' | 'pondFeed' | 'mural' | 'lamp' | 'sutra' | 'breathe' | 'release' | 'martial' | 'pagoda'; label: string; x: number; y: number; z: number }>;
  rooms: TempleRoom[];
  floorHeightAt: (x: number, z: number) => number;
  offerFlowers: () => void;
  startRitual: () => void;
  lightLongLamp: () => void;
  restoreLongLamp: (lit: boolean) => void;
  releaseSkyLantern: () => void;
  stopMartial: () => void;
  interact: (kind: 'bell' | 'fish' | 'pondFeed' | 'lamp' | 'release' | 'martial' | 'pagoda' | 'drum' | 'towerBell') => void;
  animate: (t: number) => void;
  dispose: () => void;
} {
  const world = new THREE.Group();
  world.name = '云间寺 · 山间庭院';
  scene.add(world);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const colliders: Collider[] = [];
  const instances: THREE.InstancedMesh[] = [];
  const cushions = TEMPLE_SEATS.map(position => ({ ...position }));

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
  const hallPlaster = material('#d5b777');
  const hallWood = material('#895640');
  const tealTimber = material('#557b70');

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

  function batchMovingGroup(group: THREE.Group) {
    const batches = new Map<THREE.Material, { pieces: THREE.BufferGeometry[]; objects: THREE.Mesh[] }>();
    for (const child of group.children) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
      child.updateMatrix();
      let batch = batches.get(child.material);
      if (!batch) {
        batch = { pieces: [], objects: [] };
        batches.set(child.material, batch);
      }
      batch.pieces.push(child.geometry.clone().applyMatrix4(child.matrix));
      batch.objects.push(child);
    }
    for (const [surface, batch] of batches) {
      const geometry = mergeGeometries(batch.pieces, false);
      for (const piece of batch.pieces) piece.dispose();
      if (!geometry) continue;
      mesh(geometry, surface, 0, 0, 0, group);
      for (const child of batch.objects) child.removeFromParent();
    }
  }

  const petalGeometry = new THREE.SphereGeometry(0.1, 6, 4);
  const stemGeometry = new THREE.CylinderGeometry(0.015, 0.02, 0.33, 5);
  geometries.add(petalGeometry);
  geometries.add(stemGeometry);
  const flowerMaterial = material('#ffffff');

  function flowerPatch(positions: Array<[number, number, number]>, parent: THREE.Object3D) {
    function instanced(geometry: THREE.BufferGeometry, surface: THREE.Material, count: number) {
      const object = new THREE.InstancedMesh(geometry, surface, count);
      object.castShadow = true;
      object.receiveShadow = true;
      parent.add(object);
      instances.push(object);
      return object;
    }
    const stems = instanced(stemGeometry, palette.leafDark, positions.length);
    const leaves = instanced(petalGeometry, palette.leaf, positions.length * 2);
    const petals = instanced(petalGeometry, flowerMaterial, positions.length * 5);
    const centers = instanced(petalGeometry, palette.goldLight, positions.length);
    const transform = new THREE.Object3D();
    const colors = ['#f2c3b5', '#faf0d6', '#e5b4ce'];
    positions.forEach(([x, y, z], index) => {
      transform.position.set(x, y + 0.165, z);
      transform.rotation.set(0, 0, 0);
      transform.scale.set(1, 1, 1);
      transform.updateMatrix();
      stems.setMatrixAt(index, transform.matrix);
      transform.position.y = y + 0.37;
      transform.scale.set(0.55, 0.55, 0.55);
      transform.updateMatrix();
      centers.setMatrixAt(index, transform.matrix);
      for (let petal = 0; petal < 5; petal += 1) {
        const angle = petal * Math.PI * 2 / 5 + index * 0.4;
        transform.position.set(x + Math.cos(angle) * 0.075, y + 0.35, z + Math.sin(angle) * 0.075);
        transform.rotation.set(Math.sin(angle) * 0.45, 0, -Math.cos(angle) * 0.45);
        transform.scale.set(0.7, 1.15, 0.7);
        transform.updateMatrix();
        petals.setMatrixAt(index * 5 + petal, transform.matrix);
        petals.setColorAt(index * 5 + petal, new THREE.Color(colors[index % colors.length]));
      }
      for (let leaf = 0; leaf < 2; leaf += 1) {
        const side = leaf ? 1 : -1;
        transform.position.set(x + side * 0.075, y + 0.16, z);
        transform.rotation.set(0, index * 0.3, side * 0.3);
        transform.scale.set(1.45, 0.24, 0.55);
        transform.updateMatrix();
        leaves.setMatrixAt(index * 2 + leaf, transform.matrix);
      }
    });
  }

  // This broad, uninterrupted plane is also the tap-to-walk raycast target.
  const groundMaterial = material('#a9bd8d', { side: THREE.DoubleSide });
  const ground = mesh(new THREE.PlaneGeometry(108, 84), groundMaterial, 0, 0, 0);
  ground.rotation.x = -Math.PI / 2;
  ground.name = '可行走地面';
  ground.castShadow = false;

  box(0, 0.014, 11, 26, 0.028, 22, palette.path).name = '中央庭院石铺地面';
  box(0, 0.022, -12, 26, 0.045, 20, palette.stoneLight).name = '大殿石铺地面';
  box(15.8, 0.018, -9, 1.4, 0.035, 23, palette.path);
  box(-22, 0.018, 0, 44, 0.035, 1.8, palette.path);
  box(-30, 0.018, -3.5, 2.2, 0.035, 7, palette.path);
  box(25, 0.018, 0, 50, 0.035, 1.8, palette.path);
  box(30, 0.018, -2.5, 2.2, 0.035, 5, palette.path);
  box(42, 0.018, -6, 2.2, 0.035, 12, palette.path);
  box(17, 0.018, -5.5, 3.5, 0.035, 1.4, palette.path);
  box(-7.6, 0.018, 0.7, 5.6, 0.035, 1.35, palette.path);
  box(0, 0.014, 16.5, 4.6, 0.028, 12.4, palette.path);
  box(13, 0.018, 7, 9, 0.035, 1.35, palette.path);
  box(16, 0.018, 5.4, 1.35, 0.035, 4.5, palette.path);
  box(-16, 0.018, -0.7, 5.5, 0.035, 1.35, palette.path);
  box(-18.2, 0.018, -2.5, 1.35, 0.035, 5.5, palette.path);
  for (const x of [-12, 12]) box(x, 0.047, -12, 0.22, 0.045, 19.4, palette.woodDark);
  for (const z of [-21.5, -2.5]) box(0, 0.047, z, 24, 0.045, 0.22, palette.woodDark);
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
  wall(-52, 0, 0.42, 80);
  wall(52, 0, 0.42, 80);
  wall(0, -40, 104, 0.42);
  wall(-27.25, 40, 49.5, 0.42);
  wall(27.25, 40, 49.5, 0.42);

  const mainRoofDetails: THREE.Group[] = [];
  function roof(centerX: number, centerZ: number, width: number, depth: number, baseY: number, rise: number) {
    const isMainRoof = centerX === 0 && centerZ < 0 && width > 20;
    const details = isMainRoof ? new THREE.Group() : world;
    if (isMainRoof) { details.name = "大雄宝殿瓦垄与屋脊"; world.add(details); mainRoofDetails.push(details); }
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const surfaceHeight = (x: number, v: number) => {
      const eave = Math.max(0, (v - 0.72) / 0.28);
      const eaveLift = width > 20 ? 0.6 : 0.23;
      const cornerLift = width > 20 ? 0.52 : 0.22;
      return baseY + rise * Math.pow(1 - v, 1.5) + eaveLift * eave * eave + cornerLift * Math.pow(Math.abs(x) / halfWidth, 7);
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
        mesh(new THREE.TubeGeometry(curve, 12, 0.036, 4, false), palette.roofRib, 0, 0, 0, details);
      }
      for (let row = 1; row <= 5; row++) {
        const v = row / 5;
        const points: THREE.Vector3[] = [];
        for (let column = 0; column <= 12; column++) {
          const x = -halfWidth + (column / 12) * width;
          points.push(new THREE.Vector3(centerX + x, surfaceHeight(x, v) + 0.02, centerZ + direction * v * halfDepth));
        }
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, 0.025, 4, false), palette.roofShadow, 0, 0, 0, details);
      }
    }
    beamBetween(new THREE.Vector3(centerX - halfWidth, baseY + rise + 0.11, centerZ), new THREE.Vector3(centerX + halfWidth, baseY + rise + 0.11, centerZ), 0.105, palette.roofShadow, details);
    for (const side of [-1, 1]) {
      const ornament = sphere(centerX + side * halfWidth, baseY + rise + 0.25, centerZ, 0.15, palette.gold, details);
      ornament.scale.set(0.75, 1.3, 0.75);
    }
    if (isMainRoof) batchMovingGroup(details);
  }

  // Deep eaves and interlocking timber brackets frame a hall almost as large as its courtyard.
  box(0, 3.2, -22, 26.3, 6.4, 0.36, hallPlaster);
  box(0, 0.3, -21.96, 26.4, 0.6, 0.48, palette.stone);
  collider(0, -22, 26.3, 0.4);
  function bracket(x: number, z: number) {
    for (let level = 0; level < 3; level += 1) {
      const span = 0.75 + level * 0.36;
      box(x, 5.62 + level * 0.22, z, span, 0.17, 0.28, level % 2 ? palette.gold : tealTimber);
      box(x, 5.72 + level * 0.22, z, 0.28, 0.17, span, hallWood);
    }
  }
  function hallColumn(x: number, z: number) {
    cylinder(x, 2.9, z, 0.2, 0.26, 5.8, hallWood, world, 12);
    cylinder(x, 0.19, z, 0.37, 0.43, 0.38, palette.stone, world, 12);
    cylinder(x, 0.43, z, 0.28, 0.35, 0.13, palette.stoneLight, world, 12);
    collider(x, z, 0.75, 0.75);
    bracket(x, z);
  }
  for (const side of [-1, 1]) {
    box(side * 13, 3.15, -12, 0.36, 6.3, 20, hallPlaster);
    box(side * 12.96, 0.3, -12, 0.5, 0.6, 20.2, palette.stone);
    collider(side * 13, -12, 0.4, 20);
    box(side * 9.4, 3.15, -2, 7.2, 6.3, 0.3, hallPlaster);
    box(side * 9.4, 0.35, -1.94, 7.4, 0.7, 0.45, palette.stone);
    collider(side * 9.4, -2, 7.2, 0.4);
    for (const z of [-21.3, -12, -1.7]) hallColumn(side * 12.2, z);
    hallColumn(side * 6.1, -1.7);
    hallColumn(side * 7.7, -12.5);
    const frontWindow = mesh(new THREE.CircleGeometry(1.21, 32), tealTimber, side * 9.4, 3.2, -1.82);
    frontWindow.castShadow = false;
    mesh(new THREE.TorusGeometry(1.27, 0.09, 6, 32), palette.gold, side * 9.4, 3.2, -1.75);
    for (let bar = -2; bar <= 2; bar += 1) {
      const span = Math.sqrt(1.21 ** 2 - (bar * 0.42) ** 2) * 2;
      box(side * 9.4 + bar * 0.42, 3.2, -1.69, 0.065, span, 0.065, hallWood);
      box(side * 9.4, 3.2 + bar * 0.42, -1.68, span, 0.065, 0.07, hallWood);
    }
    // Lattice windows sit beyond the mural panels at either end of the side aisles.
    for (const z of [-4.4, -20]) {
      const glass = mesh(new THREE.CircleGeometry(1.21, 32), tealTimber, side * 12.76, 3.2, z);
      glass.rotation.y = -side * Math.PI / 2;
      const frame = mesh(new THREE.TorusGeometry(1.27, 0.09, 6, 32), palette.gold, side * 12.68, 3.2, z);
      frame.rotation.y = Math.PI / 2;
      for (let bar = -2; bar <= 2; bar += 1) {
        const span = Math.sqrt(1.21 ** 2 - (bar * 0.42) ** 2) * 2;
        box(side * 12.63, 3.2, z + bar * 0.42, 0.06, span, 0.065, hallWood);
        box(side * 12.62, 3.2 + bar * 0.42, z, 0.07, 0.065, span, hallWood);
      }
    }
    box(side * 12.1, 6.2, -12, 0.34, 0.35, 20.2, palette.woodDark);
  }
  for (const z of [-21.3, -16.7, -12.1, -7.5, -1.7]) {
    box(0, 6.2, z, 25, 0.34, 0.3, palette.woodDark);
    box(0, 6.42, z, 24.7, 0.09, 0.4, palette.gold);
  }
  for (const x of [-9.1, -4.55, 0, 4.55, 9.1]) box(x, 6.16, -12, 0.18, 0.23, 19.6, palette.wood);
  const ceilingRing = mesh(new THREE.TorusGeometry(2.15, 0.07, 5, 40), palette.gold, 0, 6.03, -11.8);
  ceilingRing.rotation.x = Math.PI / 2;
  for (let petal = 0; petal < 8; petal += 1) {
    const angle = petal * Math.PI / 4;
    const carving = sphere(Math.cos(angle) * 0.85, 6.0, -11.8 + Math.sin(angle) * 0.85, 0.55, palette.goldLight);
    carving.scale.set(1.5, 0.12, 0.65);
    carving.rotation.y = -angle;
  }
  roof(0, -12, 30, 23, 6.4, 2.2);
  for (const z of [-20.1, -5.5]) {
    box(0, 7.6, z, 23.7, 0.6, 0.25, tealTimber);
    for (let x = -11.4; x <= 11.4; x += 0.76) box(x, 7.6, z + (z > -12 ? 0.15 : -0.15), 0.07, 0.65, 0.07, hallWood);
  }
  for (const x of [-11.8, 11.8]) box(x, 7.6, -12.8, 0.25, 0.6, 14.6, tealTimber);
  roof(0, -12.8, 24.5, 15.5, 7.9, 1.45);
  box(0, 5.1, -1.66, 4.4, 1.05, 0.18, palette.woodDark);
  box(0, 5.1, -1.55, 4.15, 0.84, 0.04, palette.gold);
  box(0, 5.1, -1.52, 3.9, 0.65, 0.025, palette.woodDark);
  for (let petal = -2; petal <= 2; petal += 1) {
    const carving = sphere(petal * 0.21, 5.1, -1.49, 0.17, palette.goldLight);
    carving.scale.set(0.6, 1.35, 0.3);
    carving.rotation.z = -petal * 0.32;
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
    batchMovingGroup(group);
    return group;
  }
  const lanterns = [lantern(-5.8, 5.1, -1.6, 1.35), lantern(5.8, 5.1, -1.6, 1.35)];
  const scenicAreas = createScenicAreas();
  world.add(scenicAreas.group);
  colliders.push(...scenicAreas.colliders);
  const detachedHalls = createDetachedHalls();
  world.add(detachedHalls.group);
  colliders.push(...detachedHalls.colliders);
  const sacredArt = createSacredArt();
  world.add(sacredArt.group);
  colliders.push(...sacredArt.colliders);

  const altarFlowers = new THREE.Group();
  altarFlowers.visible = false;
  world.add(altarFlowers);
  const flowerPositions: Array<[number, number, number]> = [];
  for (const side of [-1, 1]) {
    cylinder(side * 2.8, 1.08, -17.2, 0.2, 0.14, 0.38, palette.pink);
    for (let index = 0; index < 3; index += 1) {
      flowerPositions.push([side * 2.8 + (index - 1) * 0.17, 1.25 + (index % 2) * 0.15, -17.2 + (index % 2) * 0.08]);
    }
  }
  flowerPatch(flowerPositions, altarFlowers);
  let flowersUntil = 0;
  let flowersStarted = 0;

  const ritualAura = new THREE.Group();
  ritualAura.visible = false;
  world.add(ritualAura);
  const ritualGlow = material('#ffe3a1', { emissive: '#edb860', emissiveIntensity: 0.9, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const ritualHalo = mesh(new THREE.RingGeometry(1.3, 1.42, 48), ritualGlow, 42, 2.05, -13.7, ritualAura);
  ritualHalo.castShadow = false;
  const ritualFloor = mesh(new THREE.RingGeometry(2, 2.07, 48), ritualGlow, 42, 0.13, -12, ritualAura);
  ritualFloor.rotation.x = -Math.PI / 2;
  ritualFloor.castShadow = false;
  let ritualUntil = 0;

  // Woven seats use the same ordered coordinates as the multiplayer room.
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
  tree(-45, -29, 1.5, 2);
  tree(21.5, -12.5, 1.3, 0);
  tree(-10.6, 4.2, 0.93, 1);
  tree(11.1, 5.3, 0.92, 0);

  // West bamboo grove, with separate stalks and branches that remain fully 3D.
  for (let i = 0; i < 17; i++) {
    const x = -11.6 + (i % 4) * 0.72 + Math.sin(i * 2.1) * 0.2;
    const z = -0.5 + Math.floor(i / 4) * 1.1;
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
  const fishSchool = createFishSchool({
    name: '莲池 · 十六尾锦鲤', count: 16, capacity: 16,
    x: 9, z: 2, radiusX: 2.75, radiusZ: 1.75, waterY: 0.078,
    feedX: 7.15, feedZ: 2,
  });
  world.add(fishSchool.group);
  const rippleMaterial = material('#c8dfcb', { transparent: true, opacity: 0.3, depthWrite: false });
  const ripples: THREE.Mesh[] = [];
  for (const position of [[8.2, 1.1], [10.2, 2.7]]) {
    const ripple = mesh(new THREE.RingGeometry(0.35, 0.37, 32), rippleMaterial, position[0], 0.071, position[1]);
    ripple.rotation.x = -Math.PI / 2;
    ripple.castShadow = false;
    ripples.push(ripple);
  }
  const crumbGeometry = new THREE.SphereGeometry(0.032, 5, 3);
  geometries.add(crumbGeometry);
  const foodCrumbs = new THREE.InstancedMesh(crumbGeometry, palette.goldLight, 9);
  foodCrumbs.visible = false;
  foodCrumbs.frustumCulled = false;
  world.add(foodCrumbs);
  instances.push(foodCrumbs);
  const crumbTransform = new THREE.Object3D();
  const feedRippleMaterial = material('#eee4b9', { transparent: true, opacity: 0, depthWrite: false });
  const feedRipple = mesh(new THREE.RingGeometry(0.36, 0.38, 32), feedRippleMaterial, 6.8, 0.075, 2);
  feedRipple.rotation.x = -Math.PI / 2;
  feedRipple.castShadow = false;
  feedRipple.visible = false;
  let feedStarted = -Infinity;

  const bellObjectsStart = world.children.length;
  const bellCollidersStart = colliders.length;
  // The bell pavilion has four open sides and a small curved tiled roof.
  box(18, 0.055, -8, 3.7, 0.11, 3.7, palette.stoneLight);
  for (const x of [16.5, 19.5]) {
    for (const z of [-9.5, -6.5]) {
      cylinder(x, 1.45, z, 0.11, 0.15, 2.9, palette.wood);
      cylinder(x, 0.12, z, 0.23, 0.25, 0.24, palette.stone);
      collider(x, z, 0.42, 0.42);
    }
  }
  box(18, 2.83, -8, 3.4, 0.2, 0.2, palette.woodDark);
  roof(18, -8, 4.5, 4.3, 2.88, 0.92);
  const bell = new THREE.Group();
  bell.position.set(18, 2.33, -8);
  world.add(bell);
  cylinder(0, 0.24, 0, 0.04, 0.04, 0.5, palette.woodDark, bell, 6);
  cylinder(0, -0.22, 0, 0.4, 0.58, 0.77, palette.gold, bell, 20);
  cylinder(0, -0.64, 0, 0.63, 0.64, 0.12, palette.goldLight, bell, 20);
  sphere(0, -0.72, 0, 0.13, palette.woodDark, bell);
  const bellRing = mesh(new THREE.TorusGeometry(0.42, 0.025, 4, 20), palette.goldLight, 0, -0.06, 0, bell);
  bellRing.rotation.x = Math.PI / 2;
  batchMovingGroup(bell);
  collider(18, -8, 1.4, 1.4);
  const striker = cylinder(18, 1.68, -6.95, 0.09, 0.09, 1.6, palette.woodDark);
  striker.rotation.z = Math.PI / 2;
  let bellStarted = -Infinity;

  world.children.slice(bellObjectsStart).forEach(object => { object.position.z += 8; });
  colliders.slice(bellCollidersStart).forEach(box => { box.minZ += 8; box.maxZ += 8; });

  // An individually lit lotus lamp gives the quieter side aisle a small ritual of its own.
  cylinder(8.8, 0.16, -16.4, 0.52, 0.62, 0.32, palette.stone, world, 16);
  cylinder(8.8, 0.65, -16.4, 0.15, 0.23, 0.9, palette.gold, world, 12);
  const lampPetals = material('#d5b774', { emissive: '#d8a751', emissiveIntensity: 0.07, metalness: 0.3, roughness: 0.45 });
  for (let petal = 0; petal < 8; petal += 1) {
    const angle = petal * Math.PI / 4;
    const shape = sphere(8.8 + Math.cos(angle) * 0.24, 1.2, -16.4 + Math.sin(angle) * 0.24, 0.23, lampPetals);
    shape.scale.set(0.7, 1.2, 0.7);
    shape.rotation.set(Math.sin(angle) * 0.5, 0, -Math.cos(angle) * 0.5);
  }
  const lampFlameMaterial = material('#ffe2a1', { emissive: '#ffd391', emissiveIntensity: 1.6, transparent: true, opacity: 0.9 });
  const lampFlame = sphere(8.8, 1.49, -16.4, 0.14, lampFlameMaterial);
  lampFlame.scale.set(0.65, 1.6, 0.65);
  lampFlame.visible = false;
  lampFlame.castShadow = false;
  collider(8.8, -16.4, 0.9, 0.9);
  let lampUntil = 0;

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

  // The outer garden adds clear destinations without dense decorative geometry.
  cylinder(16, 0.025, 5, 3.2, 3.2, 0.05, palette.path, world, 28);
  const gardenFlowers: Array<[number, number, number]> = [];
  for (let index = 0; index < 32; index += 1) {
    const angle = index * Math.PI * 2 / 32;
    const radius = 2.4 + (index % 2) * 0.32;
    gardenFlowers.push([16 + Math.cos(angle) * radius, 0.03, 5 + Math.sin(angle) * radius]);
  }
  flowerPatch(gardenFlowers, world);
  tree(20.5, 1.7, 1.1, 1);
  tree(20.5, 9.2, 1.25, 0);
  stoneLantern(14, 8.5);

  const pavilionObjectsStart = world.children.length;
  const pavilionCollidersStart = colliders.length;
  // An open-sided meditation pavilion is reached through the western walkway.
  box(-18.2, 0.04, -7, 5.8, 0.08, 5.8, palette.stoneLight);
  for (const x of [-20.5, -15.9]) {
    for (const z of [-9.3, -4.7]) {
      cylinder(x, 1.5, z, 0.12, 0.17, 3, palette.wood);
      cylinder(x, 0.12, z, 0.22, 0.26, 0.24, palette.stone);
      collider(x, z, 0.46, 0.46);
    }
  }
  roof(-18.2, -7, 6.7, 6.4, 3.05, 0.95);
  box(-18.2, 0.42, -7.5, 1.8, 0.84, 0.9, palette.woodDark);
  box(-18.2, 0.89, -7.5, 2.1, 0.12, 1.15, palette.wood);
  collider(-18.2, -7.5, 2.1, 1.15);
  cylinder(-18.2, 1.03, -7.5, 0.13, 0.19, 0.18, palette.gold);
  lanterns.push(lantern(-18.2, 2.6, -5, 0.85));
  tree(-20.5, -10.5, 1.25, 2);
  tree(-20.5, -1, 1.2, 0);

  world.children.slice(pavilionObjectsStart).forEach(object => { object.position.z += 17; });
  colliders.slice(pavilionCollidersStart).forEach(box => { box.minZ += 17; box.maxZ += 17; });

  const terraceObjectsStart = world.children.length;
  const terraceCollidersStart = colliders.length;
  // The eastern prayer terrace has its own approach beyond the enlarged hall.
  cylinder(18, 0.045, -18, 2.8, 2.8, 0.09, palette.stoneLight, world, 32);
  cylinder(18, 0.102, -18, 2.15, 2.15, 0.025, palette.path, world, 32);
  box(18, 0.42, -19.5, 1.4, 0.84, 0.7, palette.woodDark);
  box(18, 0.9, -19.5, 1.65, 0.12, 0.95, palette.wood);
  collider(18, -19.5, 1.65, 0.95);
  cylinder(18, 1.08, -19.5, 0.24, 0.16, 0.22, palette.gold);
  tree(18, -21.5, 1.15, 1);
  stoneLantern(15.5, -20);
  stoneLantern(20.5, -20);
  for (let index = 0; index < 7; index += 1) {
    const x = 17.1 + index * 0.3;
    const ribbon = box(x, 1.6 + (index % 2) * 0.12, -21.15, 0.12, 0.45, 0.025, index % 2 ? palette.roof : palette.goldLight);
    ribbon.rotation.z = (index % 3 - 1) * 0.12;
  }

  world.children.slice(terraceObjectsStart).forEach(object => { object.position.x += 24; object.position.z += 6; });
  colliders.slice(terraceCollidersStart).forEach(box => { box.minX += 24; box.maxX += 24; box.minZ += 6; box.maxZ += 6; });

  for (const side of [-1, 1]) {
    cylinder(side * 2.85, 1.65, 22.5, 0.18, 0.23, 3.3, palette.wood);
    cylinder(side * 2.85, 0.16, 22.5, 0.33, 0.36, 0.32, palette.stone);
    collider(side * 2.85, 22.5, 0.65, 0.65);
  }
  box(0, 3.15, 22.5, 6.3, 0.35, 0.35, palette.woodDark);
  roof(0, 22.5, 7.5, 2.4, 3.35, 0.65);
  lanterns.push(lantern(-2.05, 2.55, 22.5, 0.85), lantern(2.05, 2.55, 22.5, 0.85));

  // Small, deterministic ground details keep the garden tactile and lightweight.
  for (let i = 0; i < 35; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (21.3 + (i % 5) * 0.22);
    const z = -21 + ((i * 31) % 420) / 10;
    const tuft = new THREE.Group();
    tuft.position.set(x, 0.12, z);
    world.add(tuft);
    for (let blade = 0; blade < 3; blade++) {
      const stem = mesh(new THREE.ConeGeometry(0.035, 0.28 + blade * 0.055, 3), palette.grassDark, (blade - 1) * 0.07, 0, 0, tuft);
      stem.rotation.z = (blade - 1) * 0.3;
    }
    if (i % 6 === 0) sphere(x, 0.35, z, 0.085, palette.pink);
  }

  const mountain = createTempleMountain();
  world.add(mountain.group);
  const prayerZones = createPrayerZones();
  world.add(prayerZones.group);
  colliders.push(...prayerZones.colliders);
  const fortuneTowers = createFortuneTowers();
  world.add(fortuneTowers.group);
  colliders.push(...fortuneTowers.colliders);
  const skyLanterns = createSkyLanterns();
  world.add(skyLanterns.group);
  const npcMonks = createNpcMonks(detachedHalls.floorHeightAt, colliders);
  world.add(npcMonks.group);
  const altarAtmosphere = createAltarAtmosphere();
  world.add(altarAtmosphere.group);

  // Bake stationary shapes by material so the detailed garden stays light on phones.
  // Independent animated objects and the walkable raycast plane retain their identity.
  const movingObjects = new Set<THREE.Object3D>([...lanterns, fishSchool.group, bell, striker, ...ripples, feedRipple, lampFlame, altarFlowers, ritualAura, sacredArt.group, detachedHalls.group, scenicAreas.group, ...mainRoofDetails, mountain.group, prayerZones.group, fortuneTowers.group, npcMonks.group, altarAtmosphere.group, skyLanterns.group]);
  const staticBatches = new Map<string, { surface: THREE.Material; castShadow: boolean; receiveShadow: boolean; pieces: THREE.BufferGeometry[]; objects: THREE.Mesh[] }>();
  world.updateMatrixWorld(true);
  world.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || object === ground) return;
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
    rooms: [{ name: '大雄宝殿', minX: -12.6, maxX: 12.6, minZ: -21.6, maxZ: -2.2, roofs: [], roofDetails: mainRoofDetails, elevation: 0 }, ...detachedHalls.rooms, ...prayerZones.rooms, ...fortuneTowers.rooms],
    floorHeightAt: detachedHalls.floorHeightAt,
    landmarks: [
      ...scenicAreas.landmarks,
      ...prayerZones.landmarks,
      ...fortuneTowers.landmarks,
      ...skyLanterns.landmarks,
      { name: '大雄宝殿', x: 0, z: -13.8 },
      { name: '藏经阁', x: -30, z: -13.5 },
      { name: '观云阁', x: 30, z: -16 },
      { name: '莲池', x: 5.8, z: 2 },
      { name: '竹林', x: -8.4, z: 0.7 },
      { name: '钟亭', x: 18, z: 2.5 },
      { name: '山门', x: 0, z: 21.5 },
      { name: '花园', x: 16, z: 5 },
      { name: '禅修院', x: -18.2, z: 12 },
      { name: '祈愿台', x: 42, z: -12 },
      { name: '观音莲座', x: -7.7, z: -15.8 },
      { name: '莲灯', x: 8.8, z: -15.5 },
      { name: '壁画长廊', x: -11.2, z: -10 },
    ],
    interactions: [
      ...scenicAreas.interactions,
      ...prayerZones.interactions,
      ...fortuneTowers.interactions,
      ...skyLanterns.interactions,
      { kind: 'incense', label: '♧ 如来敬香', x: 0, y: 1.3, z: -13.8 },
      { kind: 'flower', label: '✿ 供花', x: 16, y: 0.7, z: 5 },
      { kind: 'ritual', label: '✦ 做法事', x: 42, y: 0.9, z: -12 },
      { kind: 'bell', label: '♩ 鸣钟', x: 18, y: 1.2, z: 2.5 },
      { kind: 'fish', label: '◌ 喂锦鲤', x: 6, y: 0.7, z: 2 },
      { kind: 'mural', label: '✧ 赏壁画', x: -11.2, y: 1.3, z: -10 },
      { kind: 'lamp', label: '✺ 点莲灯', x: 8.8, y: 1.3, z: -15.5 },
      { kind: 'sutra', label: '▤ 藏经阁诵读', x: -30, y: 1.7, z: -13.5 },
      { kind: 'breathe', label: '☁ 观云调息', x: 30, y: 1.7, z: -16 },
    ],
    offerFlowers() {
      altarFlowers.visible = true;
      flowersStarted = performance.now();
      flowersUntil = flowersStarted + 300_000;
    },
    startRitual() {
      ritualAura.visible = true;
      ritualUntil = performance.now() + 30_000;
    },
    lightLongLamp() { prayerZones.light(); },
    restoreLongLamp(lit) { prayerZones.setLampLit(lit); },
    releaseSkyLantern() { skyLanterns.release(); },
    stopMartial() { scenicAreas.stopMartial(); },
    interact(kind) {
      if (kind === 'drum' || kind === 'towerBell') { fortuneTowers.interact(kind); return; }
      if (kind === 'release' || kind === 'martial' || kind === 'pagoda' || kind === 'pondFeed') { scenicAreas.interact(kind); return; }
      const now = performance.now();
      if (kind === 'bell') bellStarted = now;
      if (kind === 'fish') { feedStarted = now; fishSchool.feed(); }
      if (kind === 'lamp') lampUntil = now + 90_000;
    },
    animate(t: number) {
      scenicAreas.animate(t);
      prayerZones.animate(t);
      fortuneTowers.animate(t);
      skyLanterns.animate(t);
      npcMonks.animate(t);
      altarAtmosphere.animate(t);
      const now = performance.now();
      altarFlowers.visible = now < flowersUntil;
      if (altarFlowers.visible) {
        const settled = Math.min(1, (now - flowersStarted) / 600);
        altarFlowers.position.y = (1 - settled) * 0.08;
      }
      const ritualRemaining = Math.max(0, (ritualUntil - now) / 1000);
      ritualAura.visible = ritualRemaining > 0;
      ritualGlow.opacity = Math.min(1, ritualRemaining / 3) * (0.28 + Math.sin(t * 1.8) * 0.07);
      ritualHalo.scale.setScalar(1 + Math.sin(t * 1.1) * 0.025);
      ritualFloor.scale.setScalar(1 + Math.sin(t * 1.1) * 0.04);
      palette.lantern.emissiveIntensity = ritualRemaining > 0 ? 0.4 + Math.sin(t * 1.8) * 0.12 : 0.19;
      for (const [index, group] of lanterns.entries()) group.rotation.z = Math.sin(t * 0.7 + index) * 0.035;
      const feedAge = (now - feedStarted) / 1000;
      const feedAmount = feedAge < 2 ? Math.max(0, feedAge / 2) : feedAge < 12 ? 1 : Math.max(0, 1 - (feedAge - 12) / 4);
      fishSchool.animate(t);
      foodCrumbs.visible = feedAge < 12;
      if (foodCrumbs.visible) {
        for (let index = 0; index < 9; index += 1) {
          const angle = index * 2.4;
          const spread = 0.16 + (index % 3) * 0.12;
          crumbTransform.position.set(6.8 + Math.cos(angle) * spread, 0.09 + Math.sin(t * 1.2 + index) * 0.01, 2 + Math.sin(angle) * spread);
          crumbTransform.scale.setScalar(Math.min(1, (12 - feedAge) / 4));
          crumbTransform.updateMatrix();
          foodCrumbs.setMatrixAt(index, crumbTransform.matrix);
        }
        foodCrumbs.instanceMatrix.needsUpdate = true;
      }
      feedRipple.visible = feedAmount > 0;
      feedRipple.scale.setScalar(1 + (t % 1.8) * 0.7);
      feedRippleMaterial.opacity = feedAmount * (0.4 - (t % 1.8) * 0.17);
      for (const [index, ripple] of ripples.entries()) ripple.scale.setScalar(1 + Math.sin(t * 0.6 + index * 2) * 0.15);
      const bellAge = (now - bellStarted) / 1000;
      const bellSwing = bellAge < 8 ? Math.sin(bellAge * 7) * Math.exp(-bellAge * 0.32) : 0;
      bell.rotation.z = bellSwing * 0.23 + Math.sin(t * 0.45) * 0.012;
      striker.position.z = 1.05 - Math.max(0, bellSwing) * 0.48;
      const lampLit = now < lampUntil;
      lampFlame.visible = lampLit;
      lampPetals.emissiveIntensity = lampLit ? 0.85 + Math.sin(t * 2.5) * 0.1 : 0.07;
      if (lampLit) lampFlame.scale.y = 1.6 + Math.sin(t * 4.2) * 0.12;
    },
    dispose() {
      scene.remove(world);
      sacredArt.dispose();
      detachedHalls.dispose();
      scenicAreas.dispose();
      mountain.dispose();
      prayerZones.dispose();
      fortuneTowers.dispose();
      skyLanterns.dispose();
      npcMonks.dispose();
      altarAtmosphere.dispose();
      fishSchool.dispose();
      for (const instance of instances) instance.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const surface of materials) surface.dispose();
    },
  };
}
