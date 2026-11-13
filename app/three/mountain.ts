import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** A broad, connected mountain supports the entire temple's unchanged walking plane. */
export function createTempleMountain() {
  const group = new THREE.Group();
  group.name = "云间寺山峰 · 岩壁山腰与连绵山麓";
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const surface = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.97, flatShading: true, ...options });
    materials.add(material);
    return material;
  };
  const mountainMaterial = surface("#ffffff", { vertexColors: true, flatShading: false });
  const ridgeMaterial = surface("#63877d", { flatShading: false });
  const exposedRock = surface("#b6b69a");
  const bark = surface("#67533c");
  const pineMaterials = [surface("#365f53"), surface("#507967"), surface("#829765")];
  const stone = surface("#cbbfa6");
  const pathMaterial = surface("#dfcda8");
  const distantMaterials = ["#628e87", "#8cac9f", "#b0c7b9"].map(color => surface(color, { flatShading: false }));
  const floweringLeaves = surface("#c29659");
  const cloudMaterials = [0.36, 0.24].map(opacity => {
    const material = new THREE.MeshBasicMaterial({ color: "#e6e8ce", transparent: true, opacity, depthWrite: false });
    materials.add(material);
    return material;
  });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    group.add(mesh);
    return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) => add(new THREE.BoxGeometry(w, h, d), material, x, y, z);

  const segments = 96;
  const levels = [
    { width: 56, depth: 44, y: -0.06 },
    { width: 59, depth: 47, y: -3.8 },
    { width: 66, depth: 54, y: -13 },
    { width: 77, depth: 64, y: -23 },
    { width: 94, depth: 79, y: -36 },
    { width: 120, depth: 101, y: -55 },
    { width: 164, depth: 136, y: -73 },
    { width: 220, depth: 182, y: -88 },
    { width: 360, depth: 300, y: -94 },
  ];
  const rings: THREE.Vector3[][] = [];
  const vertices: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const grassColor = new THREE.Color("#93a67c");
  const rockColor = new THREE.Color("#b7b396");
  const mossColor = new THREE.Color("#5f8472");
  for (const [levelIndex, level] of levels.entries()) {
    const ring: THREE.Vector3[] = [];
    for (let index = 0; index < segments; index++) {
      const angle = index / segments * Math.PI * 2;
      const c = Math.cos(angle), s = Math.sin(angle);
      const rectangularRadius = Math.max(Math.abs(c), Math.abs(s));
      const outline = 1.025 + 0.025 * Math.sin(angle * 7 + levelIndex * 0.45) + 0.018 * Math.sin(angle * 13 - levelIndex * 0.6);
      const shoulder = levelIndex > 1 ? 1 + 0.07 * Math.sin(angle * 5 + levelIndex * 0.8) : 1;
      const x = c / rectangularRadius * level.width * outline * shoulder;
      const z = s / rectangularRadius * level.depth * outline * shoulder;
      const y = level.y + (levelIndex === 0 ? 0 : Math.sin(angle * 6 + levelIndex * 1.3) * Math.min(levelIndex * 0.6, 2.8));
      const point = new THREE.Vector3(x, y, z);
      ring.push(point);
      vertices.push(x, y, z);
      const strata = .24 + (Math.sin(angle * 8 + levelIndex * 1.6) + 1) * .23;
      const color = levelIndex === 0 ? grassColor.clone() : rockColor.clone().lerp(mossColor, strata);
      color.multiplyScalar(0.94 + Math.sin(index * 2.3 + levelIndex) * 0.06);
      colors.push(color.r, color.g, color.b);
    }
    rings.push(ring);
  }
  for (let level = 0; level < levels.length - 1; level++) for (let index = 0; index < segments; index++) {
    const next = (index + 1) % segments;
    const a = level * segments + index, b = level * segments + next;
    const c = (level + 1) * segments + index, d = (level + 1) * segments + next;
    indices.push(a, b, c, b, d, c);
  }
  const center = vertices.length / 3;
  vertices.push(0, -0.06, 0);
  colors.push(grassColor.r, grassColor.g, grassColor.b);
  for (let index = 0; index < segments; index++) indices.push(center, (index + 1) % segments, index);
  const terrainGeometry = new THREE.BufferGeometry();
  terrainGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  terrainGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  terrainGeometry.setIndex(indices);
  terrainGeometry.computeVertexNormals();
  const terrain = add(terrainGeometry, mountainMaterial);
  terrain.name = "连续山体 · 山顶0至山麓负88";
  terrain.updateMatrixWorld(true);

  // Broad projecting rock ribs break the stepped silhouette into connected mountain faces.
  for (const direction of [-2.6, -1.4, 0.15, 0.95, 2.1]) {
    const positions: number[] = [];
    const faces: number[] = [];
    for (let section = 0; section < 5; section++) {
      const t = section / 4;
      const distance = 60 + t * 106;
      const spread = 5 + t * 15;
      const x = Math.cos(direction) * distance;
      const z = Math.sin(direction) * distance * 0.82;
      const y = -10 - t * 67;
      for (const side of [-1, 0, 1]) positions.push(x + Math.sin(direction) * spread * side, y + (side === 0 ? 5 : -3), z - Math.cos(direction) * spread * side);
    }
    for (let section = 0; section < 4; section++) for (let side = 0; side < 2; side++) {
      const a = section * 3 + side, b = a + 3;
      faces.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(faces);
    geometry.computeVertexNormals();
    add(geometry, ridgeMaterial);
  }

  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const terrainHeight = (x: number, z: number) => {
    raycaster.set(new THREE.Vector3(x, 15, z), down);
    return raycaster.intersectObject(terrain, false)[0]?.point.y ?? -80;
  };

  // The landscape staircase follows the actual slope instead of floating over it.
  box(0, -0.01, 31, 4.4, 0.04, 21, pathMaterial);
  const stairPoints: THREE.Vector3[] = [];
  for (let step = 0; step < 140; step++) {
    const t = step / 139;
    const x = Math.sin(t * Math.PI * 3) * (5 + t * 17);
    const z = 41 + t * 94;
    const y = terrainHeight(x, z) + 0.16;
    const direction = Math.atan2(Math.cos(t * Math.PI * 3) * Math.PI * 3 * (5 + t * 17) + Math.sin(t * Math.PI * 3) * 17, 94);
    const tread = box(x, y - 0.13, z, 3.6, 0.26, 1.02, stone);
    tread.rotation.y = direction;
    stairPoints.push(new THREE.Vector3(x, y, z));
    if (step % 9 === 0) for (const side of [-1, 1]) {
      const px = x + Math.cos(direction) * 1.9 * side;
      const pz = z - Math.sin(direction) * 1.9 * side;
      box(px, y + 0.32, pz, 0.24, 0.65, 0.24, stone);
      add(new THREE.SphereGeometry(0.18, 6, 4), stone, px, y + 0.7, pz);
    }
  }

  for (let index = 0; index < 36; index++) {
    const angle = index * 2.39996;
    const ringIndex = 2 + index % 4;
    const point = rings[ringIndex][Math.floor(index * 7.3) % segments];
    const x = point.x + Math.sin(angle) * 2;
    const z = point.z + Math.cos(angle) * 2;
    if (z > 40 && Math.abs(x) < 28) continue;
    const y = terrainHeight(x, z);
    const scale = 0.75 + index % 4 * 0.15;
    add(new THREE.CylinderGeometry(0.12 * scale, 0.23 * scale, 3.7 * scale, 6), bark, x, y + 1.85 * scale, z);
    for (const side of [-1, 1]) {
      const branch = add(new THREE.CylinderGeometry(.045 * scale, .085 * scale, 1.4 * scale, 5), bark, x + side * .43 * scale, y + 2.5 * scale, z);
      branch.rotation.z = -side * .7;
    }
    for (let crown = 0; crown < 3; crown++) {
      const leaves = add(new THREE.IcosahedronGeometry((1.35 - crown * 0.16) * scale, 1), pineMaterials[(index + crown) % pineMaterials.length], x + Math.sin(crown * 3 + angle) * 0.6 * scale, y + (2.8 + crown * 0.68) * scale, z + Math.cos(crown * 3 + angle) * 0.5 * scale);
      leaves.scale.set(1.35 - crown * .08, .58 + crown * .035, 1.1);
      leaves.rotation.y = angle + crown * .6;
    }
    if (index % 3 === 0) {
      const rock = add(new THREE.IcosahedronGeometry(2.8, 1), exposedRock, x + 3, y + 0.45, z - 1);
      rock.scale.set(1.4, 0.65, 0.9);
      rock.rotation.y = angle;
    }
  }

  // Planted ledges sit beyond the walking boundary and frame the temple above the valley.
  for (let index = 0; index < 28; index++) {
    const angle = index / 28 * Math.PI * 2;
    const point = rings[1][Math.floor(index / 28 * segments)];
    if (point.z > 36 && Math.abs(point.x) < 30) continue;
    const x = point.x * .98, z = point.z * .98;
    const y = terrainHeight(x, z);
    const rock = add(new THREE.IcosahedronGeometry(1, 1), exposedRock, x, y + .12, z);
    rock.scale.set(1.25 + index % 3 * .3, .45, .9);
    rock.rotation.y = angle;
    for (let tuft = 0; tuft < 3; tuft++) {
      const crown = add(new THREE.IcosahedronGeometry(1, 1), index % 5 === 0 ? floweringLeaves : pineMaterials[tuft], x + Math.cos(angle + tuft) * .85, y + .48 + tuft * .16, z + Math.sin(angle + tuft) * .65);
      crown.scale.set(.8, .48, .65);
    }
  }

  // Volumetric cloud banks wrap the lower slopes, leaving the connected foothills visible.
  for (let band = 0; band < 2; band++) for (let puff = 0; puff < 30; puff++) {
    const angle = puff / 30 * Math.PI * 2 + band * 0.24;
    const width = band === 0 ? 105 : 174;
    const depth = band === 0 ? 83 : 137;
    const cloud = add(new THREE.SphereGeometry(1, 10, 5), cloudMaterials[band], Math.cos(angle) * width, (band === 0 ? -32 : -67) + Math.sin(angle * 4) * 2, Math.sin(angle) * depth);
    cloud.scale.set(13 + puff % 4 * 2, 2 + puff % 3 * 0.6, 8 + puff % 3 * 2);
    cloud.receiveShadow = false;
  }

  // Each distant ridge is a wide folded height field, with several peaks and valleys.
  for (let layer = 0; layer < distantMaterials.length; layer++) {
    const positions: number[] = [];
    const faces: number[] = [];
    const columns = 48;
    const rows = 5;
    for (let row = 0; row < rows; row++) for (let column = 0; column <= columns; column++) {
      const x = -225 + column / columns * 450;
      const cross = row / (rows - 1);
      const crest = 23 + Math.sin(column * 0.42 + layer) * 17 + Math.sin(column * 1.08) * 8;
      const y = -78 + Math.sin(cross * Math.PI) * crest * (2.7 + layer * .35);
      const z = -150 - layer * 80 - cross * 88 + Math.sin(column * 0.21) * 12;
      positions.push(x, y, z);
    }
    for (let row = 0; row < rows - 1; row++) for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + columns + 1;
      faces.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(faces);
    geometry.computeVertexNormals();
    const ridge = add(geometry, distantMaterials[layer]);
    ridge.receiveShadow = false;
  }

  group.updateMatrixWorld(true);
  const batches = new Map<string, { material: THREE.Material; shadow: boolean; pieces: THREE.BufferGeometry[] }>();
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
    const key = child.material.uuid + ':' + Object.keys(child.geometry.attributes).sort().join(',');
    const batch: { material: THREE.Material; shadow: boolean; pieces: THREE.BufferGeometry[] } = batches.get(key) ?? { material: child.material, shadow: child.receiveShadow, pieces: [] };
    const piece = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    batch.pieces.push(piece.applyMatrix4(child.matrixWorld));
    batches.set(key, batch);
  }
  group.clear();
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.pieces, false);
    batch.pieces.forEach(piece => piece.dispose());
    if (!geometry) continue;
    const mesh = add(geometry, batch.material);
    mesh.receiveShadow = batch.shadow;
  }
  group.userData = { summit: 0, mountainside: -23, foothills: -55, valley: -88, summitCoverage: { minX: -54, maxX: 54, minZ: -42, maxZ: 42 }, staircaseSteps: stairPoints.length };
  let disposed = false;
  return {
    group,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      geometries.clear();
      materials.clear();
    },
  };
}
