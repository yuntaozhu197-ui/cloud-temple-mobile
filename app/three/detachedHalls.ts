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
  const textures = new Set<THREE.Texture>();
  const colliders: Collider[] = [];
  const rooms: TempleRoom[] = [];
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const surface = new THREE.MeshStandardMaterial({ color, roughness: 0.86, ...options });
    materials.add(surface);
    return surface;
  };
  const wood = material("#815441");
  const darkWood = material("#534536");
  const plaster = material("#d9c8a6");
  const teal = material("#526f68");
  const tile = material("#526f68");
  const tileRib = material("#789187");
  const gold = material("#a68a55", { metalness: 0.22, roughness: 0.58 });
  const stone = material("#d6cbb3");
  const paper = material("#e9dfc5");
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
  function carvedStone(x: number, y: number, z: number, width: number, height: number, depth: number) {
    const bevel = Math.min(.055, height * .2, width * .1, depth * .1);
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2 + bevel, -height / 2 + bevel);
    shape.lineTo(width / 2 - bevel, -height / 2 + bevel);
    shape.lineTo(width / 2 - bevel, height / 2 - bevel);
    shape.lineTo(-width / 2 + bevel, height / 2 - bevel);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1, curveSegments: 1 });
    geometry.translate(0, 0, -depth / 2 + bevel);
    return mesh(geometry, stone, x, y, z);
  }
  function inscription(title: string, x: number, y: number, z: number, parent: THREE.Group) {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 112;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#d8bb7a";
    context.font = 'bold 76px "STKaiti", "KaiTi", serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(title, 256, 59);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    const lettering = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
    materials.add(lettering);
    mesh(new THREE.PlaneGeometry(3.8, .69), lettering, x, y, z, parent);
  }
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
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, 0.04, 4, false), tileRib, 0, 0, 0, details);
      }
      const eavePoints = Array.from({ length: 13 }, (_, index) => {
        const x = -width / 2 + .12 + index / 12 * (width - .24);
        const y = baseY + .32 + .32 * Math.pow(Math.abs(x) / (width / 2), 6) - .075;
        return new THREE.Vector3(cx + x, y, cz + direction * (depth / 2 - .12));
      });
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(eavePoints), 16, .07, 5, false), darkWood, 0, 0, 0, details);
      const tileEnd = new THREE.CylinderGeometry(.085, .085, .18, 7, 1, true);
      const tileCount = Math.ceil(width / .62);
      for (let tileIndex = 0; tileIndex < tileCount; tileIndex++) {
        const x = -width / 2 + .16 + tileIndex / (tileCount - 1) * (width - .32);
        const y = baseY + .32 + .32 * Math.pow(Math.abs(x) / (width / 2), 6) - .015;
        const end = mesh(tileEnd, tileRib, cx + x, y, cz + direction * (depth / 2 - .12), details);
        end.rotation.x = Math.PI / 2;
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
    carvedStone(x, 0.21, z, width + 0.8, 0.42, depth + 0.8);
    box(x, 0.45, z, width + 0.4, 0.06, depth + 0.4, plaster);
    for (let step = 0; step < 3; step++) carvedStone(x, (step + 1) * 0.08, front + 2.5 - step, 8.2 + step * 0.25, (step + 1) * 0.16, 1.05);
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
        const profile = [[.26, 0], [.33, .045], [.33, .12], [.27, .2], [.25, .3]];
        mesh(new THREE.LatheGeometry(profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 12), stone, sideX - side * .5, .48, pz);
        for (let bracket = 0; bracket < 3; bracket++) {
          box(sideX - side * 0.5, 6.65 + bracket * 0.2, pz, 0.9 + bracket * 0.38, 0.16, 0.3, teal);
          box(sideX - side * 0.5, 6.75 + bracket * 0.2, pz, 0.3, 0.15, 0.9 + bracket * 0.38, darkWood);
        }
        block(sideX - side * 0.5, pz, 0.7, 0.7);
      }
      const window = mesh(new THREE.CircleGeometry(0.9, 24), paper, x + side * (width / 4 + 1.8), 2.2, front + 0.18);
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
      box(x + side * 3.52, 3.45, front + .16, .13, 5.7, .2, darkWood);
    }
    for (const beamZ of [back + 0.5, z, front - 0.25]) {
      box(x, 6.9, beamZ, width - 0.4, 0.35, 0.3, darkWood);
      box(x, 7.12, beamZ, width - 0.1, 0.1, 0.45, gold);
    }
    const roofColor = hall.name === "藏经阁" ? tile : teal;
    const roofDetails = new THREE.Group();
    roofDetails.name = `${hall.name}瓦垄与屋脊`;
    group.add(roofDetails);
    box(x, 6.45, front + .16, 7.1, .14, .2, darkWood);
    box(x, 5.7, front + 0.2, 5, 0.95, 0.2, darkWood, roofDetails);
    box(x, 5.7, front + 0.32, 4.7, 0.72, 0.05, gold, roofDetails);
    box(x, 5.7, front + .36, 4.45, .55, .035, darkWood, roofDetails);
    inscription(hall.name, x, 5.7, front + .39, roofDetails);
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
      const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
      pieces.push(geometry.applyMatrix4(child.matrix));
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
      textures.forEach(texture => texture.dispose());
    },
  };
}
