import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TEMPLE_LAYOUT } from "../templeLayout";

type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };
export type TempleRoom = Collider & { name: string; roofs: THREE.Mesh[]; roofDetails?: THREE.Object3D[]; elevation: number };

export function createDetachedHalls() {
  const group = new THREE.Group();
  group.name = "藏经阁与观云阁 · 独栋院落";
  const staticGroup = new THREE.Group();
  group.add(staticGroup);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const colliders: Collider[] = [];
  const rooms: TempleRoom[] = [];
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const surface = new THREE.MeshStandardMaterial({ color, roughness: 0.86, ...options });
    materials.add(surface);
    return surface;
  };
  const wood = material("#9c6b4b");
  const darkWood = material("#71513d");
  const plaster = material("#e0cb97");
  const teal = material("#63887c");
  const tile = material("#73917c");
  const gold = material("#d2b273", { metalness: 0.25, roughness: 0.5 });
  const stone = material("#d7d4bb");
  const paper = material("#f4e9c4");
  const bookColors = [material("#768d82"), material("#bb9975"), material("#9a7d6b")];
  const mesh = (geometry: THREE.BufferGeometry, surface: THREE.Material, x: number, y: number, z: number, parent = staticGroup) => {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, surface);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, surface: THREE.Material, parent = staticGroup) => mesh(new THREE.BoxGeometry(w, h, d), surface, x, y, z, parent);
  const block = (x: number, z: number, w: number, d: number) => colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  function roof(cx: number, cz: number, width: number, depth: number, baseY: number, rise: number, color: THREE.MeshStandardMaterial, details: THREE.Group) {
    const roofs: THREE.Mesh[] = [];
    for (const direction of [-1, 1]) {
      const positions: number[] = [];
      const indices: number[] = [];
      for (let row = 0; row <= 8; row++) {
        const v = row / 8;
        for (let col = 0; col <= 12; col++) {
          const x = (col / 12 - 0.5) * width;
          const eave = Math.max(0, (v - 0.7) / 0.3);
          positions.push(cx + x, baseY + rise * Math.pow(1 - v, 1.4) + 0.32 * eave ** 2 + 0.32 * Math.pow(Math.abs(x) / (width / 2), 6), cz + direction * v * depth / 2);
        }
      }
      for (let row = 0; row < 8; row++) for (let col = 0; col < 12; col++) {
        const a = row * 13 + col, b = a + 13;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const surface = color.clone();
      surface.side = THREE.DoubleSide;
      materials.add(surface);
      const slope = mesh(geometry, surface, 0, 0, 0, group);
      roofs.push(slope);
      for (let rib = 0; rib <= 12; rib++) {
        const x = (rib / 12 - 0.5) * width;
        const points: THREE.Vector3[] = [];
        for (let row = 0; row <= 8; row++) {
          const v = row / 8;
          const eave = Math.max(0, (v - 0.7) / 0.3);
          points.push(new THREE.Vector3(cx + x, baseY + rise * Math.pow(1 - v, 1.4) + 0.32 * eave ** 2 + 0.32 * Math.pow(Math.abs(x) / (width / 2), 6) + 0.035, cz + direction * v * depth / 2));
        }
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, 0.03, 4, false), gold, 0, 0, 0, details);
      }
    }
    box(cx, baseY + rise + 0.12, cz, width + 0.2, 0.18, 0.18, gold, details);
    for (const side of [-1, 1]) {
      const finial = mesh(new THREE.SphereGeometry(0.22, 10, 7), gold, cx + side * width / 2, baseY + rise + 0.35, cz, details);
      finial.scale.set(0.7, 1.6, 0.7);
    }
    return roofs;
  }

  for (const hall of [{ name: "藏经阁", ...TEMPLE_LAYOUT.library }, { name: "观云阁", x: 30, z: -17, width: 20, depth: 18 }]) {
    const { x, z, width, depth } = hall;
    const front = z + depth / 2;
    const back = z - depth / 2;
    box(x, 0.21, z, width + 0.8, 0.42, depth + 0.8, stone);
    box(x, 0.45, z, width + 0.4, 0.06, depth + 0.4, plaster);
    for (let step = 0; step < 3; step++) box(x, (step + 1) * 0.08, front + 2.5 - step, 8.2 + step * 0.25, (step + 1) * 0.16, 1.05, stone);
    box(x, 3.83, back, width, 6.7, 0.3, plaster);
    block(x, back, width, 0.35);
    for (const side of [-1, 1]) {
      const sideX = x + side * width / 2;
      box(sideX, 3.83, z, 0.3, 6.7, depth, plaster);
      block(sideX, z, 0.35, depth);
      const frontWidth = width / 2 - 3.6;
      box(x + side * (width / 4 + 1.8), 3.83, front, frontWidth, 6.7, 0.3, plaster);
      block(x + side * (width / 4 + 1.8), front, frontWidth, 0.35);
      for (const pz of [back + 0.5, z, front - 0.3]) {
        mesh(new THREE.CylinderGeometry(0.22, 0.29, 6.7, 10), darkWood, sideX - side * 0.5, 3.83, pz);
        for (let bracket = 0; bracket < 3; bracket++) {
          box(sideX - side * 0.5, 6.65 + bracket * 0.2, pz, 0.9 + bracket * 0.38, 0.16, 0.3, teal);
          box(sideX - side * 0.5, 6.75 + bracket * 0.2, pz, 0.3, 0.15, 0.9 + bracket * 0.38, darkWood);
        }
        block(sideX - side * 0.5, pz, 0.7, 0.7);
      }
      const window = mesh(new THREE.CircleGeometry(0.9, 24), teal, x + side * (width / 4 + 1.8), 2.2, front + 0.18);
      window.castShadow = false;
      mesh(new THREE.TorusGeometry(0.96, 0.065, 5, 24), gold, window.position.x, 2.2, front + 0.21);
      for (let bar = -1; bar <= 1; bar++) {
        box(window.position.x + bar * 0.4, 2.2, front + 0.26, 0.055, 1.55, 0.05, darkWood);
        box(window.position.x, 2.2 + bar * 0.4, front + 0.27, 1.55, 0.055, 0.05, darkWood);
      }
    }
    for (const side of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(0.23, 0.3, 6.7, 10), darkWood, x + side * 3.8, 3.83, front - 0.25);
      block(x + side * 3.8, front - 0.25, 0.55, 0.55);
      for (let bracket = 0; bracket < 3; bracket++) {
        box(x + side * 3.8, 6.65 + bracket * 0.2, front - 0.25, 0.9 + bracket * 0.38, 0.16, 0.3, teal);
        box(x + side * 3.8, 6.75 + bracket * 0.2, front - 0.25, 0.3, 0.15, 0.9 + bracket * 0.38, darkWood);
      }
      const lantern = mesh(new THREE.SphereGeometry(0.25, 10, 7), gold, x + side * 3.7, 5.6, front + 0.1);
      lantern.scale.y = 1.3;
    }
    for (const beamZ of [back + 0.5, z, front - 0.25]) {
      box(x, 6.9, beamZ, width - 0.4, 0.35, 0.3, darkWood);
      box(x, 7.12, beamZ, width - 0.1, 0.1, 0.45, gold);
    }
    box(x, 5.7, front + 0.2, 5, 0.95, 0.2, darkWood);
    box(x, 5.7, front + 0.32, 4.7, 0.72, 0.05, gold);
    const roofColor = hall.name === "藏经阁" ? tile : teal;
    const roofDetails = new THREE.Group();
    roofDetails.name = `${hall.name}瓦垄与屋脊`;
    group.add(roofDetails);
    const roofs = [...roof(x, z, width + 4, depth + 4, 7.1, 2.2, roofColor, roofDetails), ...roof(x, z - 0.6, width - 3, depth - 4, 8.8, 1.5, roofColor, roofDetails)];
    rooms.push({ name: hall.name, minX: x - width / 2 + 0.4, maxX: x + width / 2 - 0.4, minZ: back + 0.4, maxZ: front - 0.35, roofs, roofDetails: [roofDetails], elevation: 0.48 });
    const furnitureStart = staticGroup.children.length;
    if (hall.name === "藏经阁") {
      for (const shelfX of [-5, -1.7, 1.7, 5]) {
        box(x + shelfX, 1.5, back + 0.65, 2.9, 3, 0.6, darkWood);
        for (const shelfY of [0.4, 1.15, 1.9, 2.65]) {
          box(x + shelfX, shelfY, back + 1, 3, 0.08, 0.9, wood);
          for (let book = 0; book < 7; book++) box(x + shelfX - 1.15 + book * 0.38, shelfY + 0.25, back + 1.05, 0.27, 0.46, 0.45, bookColors[book % 3]);
        }
      }
      block(x, back + 0.85, 14.1, 1.5);
      box(x, 0.8, z - 1.2, 3.8, 0.16, 1.25, darkWood);
      for (const side of [-1, 1]) box(x + side * 1.5, 0.4, z - 1.2, 0.15, 0.8, 0.95, wood);
      const page = box(x, 0.92, z - 1.2, 1.3, 0.035, 0.8, paper);
      page.rotation.y = 0.1;
      block(x, z - 1.2, 4, 1.4);
    } else {
      box(x, 0.08, z, 4.8, 0.08, 3.9, teal);
      box(x, 0.13, z, 4.4, 0.025, 3.5, paper);
      for (const side of [-1, 1]) {
        box(x + side * 4.8, 0.55, back + 2.3, 1.3, 1.1, 0.9, wood);
        box(x + side * 4.8, 1.16, back + 2.3, 1.55, 0.12, 1.1, gold);
        block(x + side * 4.8, back + 2.3, 1.6, 1.2);
      }
      for (let motif = 0; motif < 9; motif++) box(x + (motif - 4) * 0.7, 2.7 + Math.sin(motif * 0.8) * 0.25, back + 0.2, 0.6, 0.08, 0.06, gold);
    }
    staticGroup.children.slice(furnitureStart).forEach(object => { object.position.y += 0.48; });
  }

  function batchGroup(parent: THREE.Group) {
    parent.updateMatrixWorld(true);
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of parent.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      const pieces = batches.get(child.material as THREE.Material) ?? [];
      pieces.push(child.geometry.clone().applyMatrix4(child.matrix));
      batches.set(child.material as THREE.Material, pieces);
    }
    parent.clear();
    for (const [surface, pieces] of batches) {
      const geometry = mergeGeometries(pieces, false);
      pieces.forEach(piece => piece.dispose());
      if (!geometry) continue;
      mesh(geometry, surface, 0, 0, 0, parent);
    }
  }
  batchGroup(staticGroup);
  for (const room of rooms) for (const details of room.roofDetails ?? []) batchGroup(details as THREE.Group);
  return {
    group,
    colliders,
    rooms,
    floorHeightAt(x: number, z: number) {
      for (const room of rooms) {
        if (x > room.minX - 0.3 && x < room.maxX + 0.3 && z > room.minZ - 0.3 && z < room.maxZ + 0.8) return room.elevation;
        const centerX = (room.minX + room.maxX) / 2;
        const front = room.maxZ + 0.35;
        if (Math.abs(x - centerX) < 4.2 && z >= front && z < front + 3) return Math.ceil((front + 3 - z) / 1) * 0.16;
      }
      return 0;
    },
    dispose() {
      group.removeFromParent();
      group.clear();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(surface => surface.dispose());
    },
  };
}
