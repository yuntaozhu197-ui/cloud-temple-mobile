import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type TempleFloor = 1 | 2 | 3;
export type FloorCollider = { minX: number; maxX: number; minZ: number; maxZ: number };
export const FLOOR_HEIGHTS = { 1: 0, 2: 6.6, 3: 11 } as const;
export const UPPER_BOUNDS = { minX: -11.7, maxX: 11.7, minZ: -21, maxZ: -3 };

export type TempleStair = {
  floor: TempleFloor;
  to: TempleFloor;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  label: string;
};

export function createUpperFloors() {
  const group = new THREE.Group();
  group.name = "藏经阁与观云禅阁";
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const layers = new Map<TempleFloor, THREE.Group>();
  const stairGroups: Array<{ from: TempleFloor; to: TempleFloor; group: THREE.Group }> = [];
  const colliders: Record<TempleFloor, FloorCollider[]> = { 1: [], 2: [], 3: [] };
  const surface = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...options });
    materials.add(result);
    return result;
  };
  const wood = surface("#9a6b4c");
  const darkWood = surface("#684935");
  const cream = surface("#e1c48b");
  const teal = surface("#547d72");
  const gold = surface("#d6b56c", { metalness: 0.25, roughness: 0.5 });
  const paper = surface("#f1e6bd");
  const bookColors = [surface("#789087"), surface("#c99c72"), surface("#a3806a")];
  const box = (parent: THREE.Group, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const batch = (parent: THREE.Group) => {
    parent.updateMatrixWorld(true);
    const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of parent.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      const pieces = groups.get(child.material as THREE.Material) ?? [];
      const piece = child.geometry.clone().applyMatrix4(child.matrix);
      pieces.push(piece);
      groups.set(child.material as THREE.Material, pieces);
    }
    parent.clear();
    for (const [material, pieces] of groups) {
      const geometry = mergeGeometries(pieces, false);
      pieces.forEach(piece => piece.dispose());
      if (!geometry) continue;
      geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  };

  for (const floor of [2, 3] as const) {
    const layer = new THREE.Group();
    layer.name = floor === 2 ? "二层藏经阁" : "三层观云阁";
    const base = FLOOR_HEIGHTS[floor];
    const height = floor === 2 ? 4.4 : 4.8;
    group.add(layer);
    layers.set(floor, layer);
    // The staircase openings stay outside the central walking area.
    box(layer, 0, base - 0.16, -12, 24.5, 0.32, 18.8, wood);
    for (const side of [-1, 1]) {
      box(layer, side * 12.25, base + height / 2, -12, 0.3, height, 18.8, cream);
      box(layer, side * 12.05, base + 0.7, -12, 0.16, 0.14, 18.7, teal);
      for (const z of [-20.8, -16, -11, -6.3, -2.8]) {
        box(layer, side * 11.8, base + height / 2, z, 0.3, height, 0.3, darkWood);
        for (const offset of [-0.4, 0, 0.4]) box(layer, side * 11.8, base + height - 0.3, z + offset, 0.7, 0.14, 0.2, teal);
      }
    }
    box(layer, 0, base + height / 2, -21.4, 24.5, height, 0.3, cream);
    // Open front verandas provide a view of the courtyard from each upper level.
    box(layer, 0, base + 0.95, -2.7, 24.5, 0.16, 0.16, darkWood);
    box(layer, 0, base + 0.2, -2.7, 24.5, 0.12, 0.2, teal);
    for (let x = -11.6; x <= 11.6; x += 0.8) box(layer, x, base + 0.58, -2.7, 0.09, 0.8, 0.1, darkWood);
    box(layer, 0, base + height - 0.2, -2.7, 24.6, 0.4, 0.4, teal);
    for (const x of [-11.8, -6, 0, 6, 11.8]) box(layer, x, base + height / 2, -2.8, 0.3, height, 0.3, darkWood);
    // Three stacked eave ledges make the floors legible from outside the temple.
    box(layer, 0, base - 0.34, -12, 27, 0.2, 21, teal);
    box(layer, 0, base - 0.48, -12, 27.3, 0.1, 21.3, gold);

    if (floor === 2) {
      for (const x of [-7.7, -3.8, 0, 3.8, 7.7]) {
        box(layer, x, base + 1.45, -20.3, 3.25, 2.9, 0.65, darkWood);
        for (const shelf of [0.4, 1.15, 1.9, 2.65]) {
          box(layer, x, base + shelf, -19.85, 3.3, 0.08, 0.95, wood);
          for (let book = 0; book < 7; book++) box(layer, x - 1.2 + book * 0.39, base + shelf + 0.25, -19.72, 0.29, 0.45 + (book % 2) * 0.06, 0.5, bookColors[book % 3]);
        }
      }
      box(layer, 0, base + 0.8, -16.1, 4.1, 0.18, 1.4, darkWood);
      for (const x of [-1.7, 1.7]) box(layer, x, base + 0.4, -16.1, 0.15, 0.8, 1.1, wood);
      const leftPage = box(layer, -0.42, base + 0.94, -16.05, 0.85, 0.04, 0.75, paper);
      const rightPage = box(layer, 0.42, base + 0.94, -16.05, 0.85, 0.04, 0.75, paper);
      leftPage.rotation.z = 0.09;
      rightPage.rotation.z = -0.09;
      colliders[2].push({ minX: -9.5, maxX: 9.5, minZ: -20.9, maxZ: -19.25 }, { minX: -2.2, maxX: 2.2, minZ: -16.9, maxZ: -15.3 });
    } else {
      box(layer, 0, base + 0.035, -14, 4.6, 0.07, 3.6, teal);
      box(layer, 0, base + 0.08, -14, 4.25, 0.025, 3.25, cream);
      for (const x of [-5.8, 5.8]) {
        box(layer, x, base + 0.7, -18.4, 1.2, 1.4, 0.8, darkWood);
        box(layer, x, base + 1.45, -18.4, 1.65, 0.14, 1.15, gold);
      }
      for (let motif = 0; motif < 9; motif++) box(layer, (motif - 4) * 0.7, base + 2.2 + Math.sin(motif * 0.8) * 0.3, -21.2, 0.62, 0.1, 0.08, gold);
      colliders[3].push({ minX: -6.6, maxX: -5, minZ: -19.1, maxZ: -17.7 }, { minX: 5, maxX: 6.6, minZ: -19.1, maxZ: -17.7 });
    }
    batch(layer);
  }

  const stairs: TempleStair[] = [];
  for (const from of [1, 2] as const) {
    const to = (from + 1) as TempleFloor;
    const x = from === 1 ? 10.8 : -9.5;
    const startZ = -4.5;
    const endZ = -14;
    const bottom = FLOOR_HEIGHTS[from];
    const top = FLOOR_HEIGHTS[to];
    const stair = new THREE.Group();
    stair.name = `${from}至${to}层木楼梯`;
    group.add(stair);
    stairGroups.push({ from, to, group: stair });
    for (let step = 0; step < 28; step++) {
      const progress = (step + 0.5) / 28;
      box(stair, x, bottom + (top - bottom) * progress - 0.08, startZ + (endZ - startZ) * progress, 1.7, 0.16, 0.4, wood);
      if (step % 3 === 0) for (const side of [-1, 1]) box(stair, x + side * 0.83, bottom + (top - bottom) * progress + 0.42, startZ + (endZ - startZ) * progress, 0.07, 0.9, 0.07, darkWood);
    }
    for (const side of [-1, 1]) {
      const a = new THREE.Vector3(x + side * 0.83, bottom + 0.9, startZ);
      const b = new THREE.Vector3(x + side * 0.83, top + 0.9, endZ);
      const geometry = new THREE.CylinderGeometry(0.055, 0.055, a.distanceTo(b), 6);
      geometries.add(geometry);
      const rail = new THREE.Mesh(geometry, darkWood);
      rail.position.copy(a).add(b).multiplyScalar(0.5);
      rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
      stair.add(rail);
    }
    batch(stair);
    stairs.push({ floor: from, to, x, z: startZ, targetX: x, targetZ: endZ, label: `上${to === 2 ? "二" : "三"}层` });
    stairs.push({ floor: to, to: from, x, z: endZ, targetX: x, targetZ: startZ, label: `下${from === 1 ? "一" : "二"}层` });
  }

  return {
    group,
    heights: FLOOR_HEIGHTS,
    bounds: UPPER_BOUNDS,
    colliders,
    stairs,
    setView(floor: TempleFloor, indoors: boolean) {
      for (const [level, layer] of layers) layer.visible = !indoors || level <= floor;
      for (const stair of stairGroups) stair.group.visible = !indoors || floor === stair.from || floor === stair.to;
    },
    dispose() {
      group.removeFromParent();
      group.clear();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    },
  };
}
