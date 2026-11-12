import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TempleRoom } from "./detachedHalls";

type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };
type TowerAction = "drum" | "towerBell";

/** Open forecourts keep the fortune shrine and bell tower visible from their approaches. */
export function createFortuneTowers() {
  const group = new THREE.Group();
  group.name = "财神庙 · 鼓楼 · 钟楼";
  const staticGroup = new THREE.Group();
  group.add(staticGroup);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const colliders: Collider[] = [];
  const rooms: TempleRoom[] = [];
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const surface = new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...options });
    materials.add(surface);
    return surface;
  };
  const stone = material("#d4cdb4");
  const plaster = material("#dfc695");
  const redWood = material("#994d3d");
  const darkWood = material("#634a38");
  const tile = material("#678475", { side: THREE.DoubleSide });
  const gold = material("#d6ae60", { metalness: 0.42, roughness: 0.48 });
  const bronze = material("#87704b", { metalness: 0.6, roughness: 0.5 });
  const skin = plaster;
  const beard = material("#4a4037");
  const meshes = (geometry: THREE.BufferGeometry, surface: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = staticGroup) => {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, surface: THREE.Material, parent?: THREE.Object3D) => meshes(new THREE.BoxGeometry(w, h, d), surface, x, y, z, parent);
  const cylinder = (x: number, y: number, z: number, top: number, bottom: number, h: number, surface: THREE.Material, parent?: THREE.Object3D, segments = 12) => meshes(new THREE.CylinderGeometry(top, bottom, h, segments), surface, x, y, z, parent);
  const oval = (x: number, y: number, z: number, sx: number, sy: number, sz: number, surface: THREE.Material, parent?: THREE.Object3D) => {
    const mesh = meshes(new THREE.SphereGeometry(1, 10, 7), surface, x, y, z, parent);
    mesh.scale.set(sx, sy, sz);
    return mesh;
  };
  const block = (x: number, z: number, width: number, depth: number) => colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
  const curve = (points: number[][], radius: number, surface: THREE.Material, parent = staticGroup) => meshes(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), 8, radius, 5, false), surface, 0, 0, 0, parent);
  function batch(parent: THREE.Group) {
    parent.updateMatrixWorld(true);
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    parent.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const piece = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      piece.applyMatrix4(object.matrixWorld);
      const parts = batches.get(object.material as THREE.Material) ?? [];
      parts.push(piece);
      batches.set(object.material as THREE.Material, parts);
    });
    parent.clear();
    for (const [surface, pieces] of batches) {
      const geometry = mergeGeometries(pieces, false);
      pieces.forEach(piece => piece.dispose());
      if (geometry) meshes(geometry, surface, 0, 0, 0, parent);
    }
  }
  function plaque(title: string, x: number, y: number, z: number) {
    box(x, y, z, 3.8, 0.84, 0.18, darkWood);
    box(x, y, z + 0.1, 3.62, 0.68, 0.03, gold);
    box(x, y, z + 0.12, 3.45, 0.54, 0.025, redWood);
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 112;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#e8c97a";
    context.font = "bold 76px serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(title, 256, 60);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    const lettering = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
    materials.add(lettering);
    meshes(new THREE.PlaneGeometry(3.03, 0.59), lettering, x, y, z + 0.15);
  }
  function roof(x: number, z: number, width: number, depth: number, base: number, rise: number, roofs: THREE.Group, details: THREE.Group) {
    const height = (u: number, v: number) => base + rise * Math.pow(1 - v, 1.4) + 0.35 * Math.max(0, (v - 0.7) / 0.3) ** 2 + 0.3 * Math.abs(u) ** 6;
    for (const side of [-1, 1]) {
      const vertices: number[] = [];
      const indices: number[] = [];
      for (let row = 0; row <= 6; row++) for (let col = 0; col <= 12; col++) {
        const u = col / 6 - 1, v = row / 6;
        vertices.push(x + u * width / 2, height(u, v), z + side * v * depth / 2);
      }
      for (let row = 0; row < 6; row++) for (let col = 0; col < 12; col++) {
        const current = row * 13 + col, next = current + 13;
        indices.push(current, next, current + 1, current + 1, next, next + 1);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      meshes(geometry, tile, 0, 0, 0, roofs);
      for (let col = 0; col <= 10; col++) {
        const u = col / 5 - 1;
        curve(Array.from({ length: 7 }, (_, row) => {
          const v = row / 6;
          return [x + u * width / 2, height(u, v) + 0.02, z + side * v * depth / 2];
        }), 0.025, gold, details);
      }
    }
    box(x, base + rise + 0.1, z, width + 0.1, 0.17, 0.2, gold, details);
    for (const side of [-1, 1]) curve([[x + side * (width / 2 - 0.4), base + rise + 0.1, z], [x + side * width / 2, base + rise + 0.25, z], [x + side * (width / 2 + 0.12), base + rise + 0.55, z]], 0.08, gold, details);
  }
  function pavilion(name: string, x: number, z: number, width: number, depth: number, height: number, closed: boolean) {
    const front = z + depth / 2;
    const back = z - depth / 2;
    box(x, 0.035, z, width + 0.9, 0.07, depth + 0.9, stone);
    for (const side of [-1, 1]) {
      for (const pz of [back + 0.3, front - 0.3]) {
        cylinder(x + side * (width / 2 - 0.3), height / 2, pz, 0.2, 0.28, height, redWood);
        cylinder(x + side * (width / 2 - 0.3), 0.16, pz, 0.33, 0.39, 0.32, stone);
        block(x + side * (width / 2 - 0.3), pz, 0.65, 0.65);
        for (let bracket = 0; bracket < 3; bracket++) {
          box(x + side * (width / 2 - 0.3), height - 0.45 + bracket * 0.17, pz, 0.75 + bracket * 0.3, 0.14, 0.25, tile);
          box(x + side * (width / 2 - 0.3), height - 0.36 + bracket * 0.17, pz, 0.25, 0.14, 0.75 + bracket * 0.3, darkWood);
        }
      }
      box(x, height - 0.05, z + side * (depth / 2 - 0.3), width, 0.32, 0.3, darkWood);
      box(x + side * (width / 2 - 0.3), height - 0.05, z, 0.3, 0.32, depth, darkWood);
      if (closed) {
        box(x + side * width / 2, height / 2, z, 0.3, height, depth, plaster);
        block(x + side * width / 2, z, 0.32, depth);
        const panelWidth = width / 2 - 2.4;
        box(x + side * (width / 4 + 1.2), height / 2, front, panelWidth, height, 0.3, plaster);
        block(x + side * (width / 4 + 1.2), front, panelWidth, 0.32);
        const windowX = x + side * (width / 4 + 1.2);
        meshes(new THREE.TorusGeometry(0.68, 0.055, 5, 24), gold, windowX, 2.7, front + 0.17);
        for (let bar = -1; bar <= 1; bar++) {
          box(windowX + bar * 0.28, 2.7, front + 0.19, 0.04, 1.15, 0.05, tile);
          box(windowX, 2.7 + bar * 0.28, front + 0.2, 1.15, 0.04, 0.05, tile);
        }
      }
    }
    if (closed) {
      box(x, height / 2, back, width, height, 0.3, plaster);
      block(x, back, width, 0.32);
    }
    plaque(name, x, height - 1.1, front + 0.22);
    const roofs = new THREE.Group();
    const details = new THREE.Group();
    roofs.name = `${name}双层飞檐`;
    details.name = `${name}瓦垄与脊饰`;
    group.add(roofs, details);
    roof(x, z, width + 2.7, depth + 2.7, height + 0.05, 1.65, roofs, details);
    roof(x, z - 0.3, width - 0.5, depth - 0.5, height + 1.5, 1.2, roofs, details);
    batch(roofs);
    for (const object of roofs.children as THREE.Mesh[]) {
      const surface = tile.clone();
      materials.add(surface);
      object.material = surface;
    }
    batch(details);
    rooms.push({ name, minX: x - width / 2 + 0.4, maxX: x + width / 2 - 0.4, minZ: back + 0.4, maxZ: front - 0.4, roofs: roofs.children as THREE.Mesh[], roofDetails: [details], elevation: 0 });
  }

  pavilion("财神庙", 43, 15, 14, 10, 6.7, true);
  pavilion("钟楼", 44, -33.3, 7.6, 7.2, 7.0, false);
  pavilion("鼓楼", 20, -32, 7.6, 7.2, 7.0, false);
  box(0, 0.018, -24.2, 45, 0.036, 1.7, stone);
  box(20, 0.018, -26.5, 2.2, 0.036, 4.8, stone);
  for (const x of [-16, 16]) box(x, 0.018, -18.5, 2.0, 0.036, 12, stone);
  box(44, 0.018, -23.7, 7.6, 0.036, 11.4, stone);
  box(44, 0.018, -10, 2.2, 0.036, 14, stone);
  box(29, 0.018, 22, 30, 0.036, 1.8, stone);
  box(43, 0.018, 22, 14, 0.036, 4, stone);
  box(35, 0.018, 11.5, 1.2, 0.036, 22, stone);

  // A seated official-style figure carries a sycee, with crown, beard and layered robe.
  const fortuneStatueStart = staticGroup.children.length;
  const fortuneColliderStart = colliders.length;
  cylinder(0, 0.2, -33, 1.5, 1.65, 0.4, stone, undefined, 20);
  box(0, 1.2, -33.35, 2.5, 1.9, 0.7, darkWood);
  box(0, 2.0, -33.55, 2.75, 0.16, 0.6, gold);
  for (const side of [-1, 1]) {
    oval(side * 0.64, 0.98, -32.6, 0.61, 0.25, 0.58, redWood);
    oval(side * 0.52, 0.6, -32.18, 0.24, 0.17, 0.4, beard);
  }
  const robeProfile = [[0, 0], [0.88, 0.05], [0.85, 0.42], [0.61, 1.18], [0.7, 1.55], [0.4, 1.8], [0, 1.82]];
  meshes(new THREE.LatheGeometry(robeProfile.map(([r, y]) => new THREE.Vector2(r, y)), 20), redWood, 0, 0.88, -33);
  oval(0, 3.1, -32.94, 0.45, 0.55, 0.36, skin);
  cylinder(0, 3.58, -33, 0.38, 0.48, 0.24, beard);
  cylinder(0, 3.8, -33, 0.3, 0.39, 0.34, gold);
  for (const side of [-1, 1]) {
    box(side * 0.55, 3.67, -33, 0.62, 0.15, 0.3, gold).rotation.z = side * 0.15;
    curve([[side * 0.42, 2.46, -32.99], [side * 0.88, 2.05, -32.65], [side * 0.62, 1.8, -32.1]], 0.21, redWood);
    oval(side * 0.57, 1.84, -32.08, 0.19, 0.13, 0.18, skin);
    curve([[side * 0.33, 3.2, -32.64], [side * 0.2, 3.22, -32.57], [side * 0.09, 3.19, -32.6]], 0.025, beard);
    curve([[side * 0.1, 3.0, -32.57], [side * 0.28, 2.96, -32.55], [side * 0.36, 3.0, -32.6]], 0.035, beard);
    curve([[side * 0.65, 2.5, -32.94], [side * 0.5, 1.88, -32.52], [side * 0.76, 1.15, -32.5]], 0.03, gold);
    oval(side * 0.5, 2.0, -31.98, 0.3, 0.21, 0.23, gold).rotation.z = -side * 0.48;
  }
  oval(0, 3.99, -33, 0.11, 0.19, 0.12, gold);
  const beardShape = meshes(new THREE.ConeGeometry(0.31, 0.91, 10), beard, 0, 2.55, -32.47);
  beardShape.rotation.z = Math.PI;
  oval(0, 1.91, -31.98, 0.56, 0.14, 0.26, gold);
  oval(0, 2.06, -31.98, 0.31, 0.16, 0.23, gold);
  for (let bead = 0; bead < 9; bead++) {
    const angle = bead / 8 * Math.PI;
    oval(Math.cos(angle) * 0.38, 2.35 - Math.sin(angle) * 0.27, -32.33, 0.055, 0.065, 0.055, gold);
  }
  block(0, -33, 3.3, 3.4);
  block(0, -29, 0.95, 0.85);
  staticGroup.children.slice(fortuneStatueStart).forEach(object => { object.position.x += 43; object.position.z += 46; });
  colliders.slice(fortuneColliderStart).forEach(box => { box.minX += 43; box.maxX += 43; box.minZ += 46; box.maxZ += 46; });

  const bell = new THREE.Group();
  bell.name = "钟楼铜钟";
  const bellProfile = [[0.03, 0.78], [0.26, 0.76], [0.54, 0.55], [0.68, -0.12], [0.91, -0.93], [1.0, -1.06], [0.98, -1.17], [0.85, -1.16], [0.79, -0.9], [0.56, -0.11], [0.45, 0.49], [0.2, 0.64], [0.03, 0.64]];
  meshes(new THREE.LatheGeometry(bellProfile.map(([r, y]) => new THREE.Vector2(r, y)), 32), bronze, 0, 0, 0, bell);
  for (const y of [-0.8, -0.32, 0.2]) {
    const ring = meshes(new THREE.TorusGeometry(y < -0.5 ? 0.88 : y < 0 ? 0.67 : 0.59, 0.028, 5, 28), gold, 0, y, 0, bell);
    ring.rotation.x = Math.PI / 2;
  }
  for (let stud = 0; stud < 16; stud++) {
    const angle = stud * Math.PI / 8;
    oval(Math.sin(angle) * 0.61, 0.1, Math.cos(angle) * 0.61, 0.045, 0.07, 0.045, gold, bell);
  }
  batch(bell);
  bell.position.set(44, 4.65, -33.3);
  group.add(bell);
  cylinder(44, 5.93, -33.3, 0.055, 0.055, 1.0, darkWood);
  const striker = new THREE.Group();
  striker.name = "钟楼撞木";
  cylinder(0, 0, 0, 0.14, 0.18, 1.75, darkWood, striker).rotation.x = Math.PI / 2;
  batch(striker);
  striker.position.set(44, 4.1, -31.95);
  group.add(striker);
  for (const z of [-32.55, -31.45]) curve([[44, 5.7, z], [44, 4.1, z]], 0.018, gold);
  block(44, -33.3, 2.4, 2.8);

  const drum = new THREE.Group();
  drum.name = "鼓楼大鼓";
  cylinder(0, 0, 0, 1.0, 1.0, 1.22, redWood, drum, 32).rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    cylinder(0, 0, side * 0.63, 1.02, 1.02, 0.055, skin, drum, 32).rotation.x = Math.PI / 2;
    const rim = meshes(new THREE.TorusGeometry(1.01, 0.055, 6, 32), gold, 0, 0, side * 0.61, drum);
    rim.castShadow = false;
    for (let stud = 0; stud < 20; stud++) {
      const angle = stud * Math.PI / 10;
      oval(Math.cos(angle) * 0.92, Math.sin(angle) * 0.92, side * 0.67, 0.032, 0.032, 0.025, gold, drum);
    }
  }
  batch(drum);
  drum.position.set(20, 3.7, -32);
  group.add(drum);
  for (const side of [-1, 1]) {
    box(20 + side * 0.72, 1.35, -32, 0.23, 2.7, 1.8, darkWood).rotation.z = side * 0.08;
    box(20 + side * 0.72, 2.78, -32, 0.48, 0.18, 1.65, gold);
  }
  box(20, 0.3, -32, 2.5, 0.2, 1.65, darkWood);
  block(20, -32, 2.8, 2.4);
  const mallets = new THREE.Group();
  mallets.name = "鼓楼双槌";
  for (const side of [-1, 1]) {
    const stick = cylinder(side * 0.5, 0, 0, 0.035, 0.05, 0.85, darkWood, mallets);
    stick.rotation.x = -0.7;
    oval(side * 0.5, 0.34, 0.28, 0.085, 0.1, 0.1, darkWood, mallets);
  }
  batch(mallets);
  mallets.position.set(20, 3.5, -30.92);
  group.add(mallets);
  const waveMaterial = new THREE.MeshBasicMaterial({ color: "#e7cc8a", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  materials.add(waveMaterial);
  const waveGeometry = new THREE.RingGeometry(1.05, 1.075, 40);
  geometries.add(waveGeometry);
  const waves = new THREE.InstancedMesh(waveGeometry, waveMaterial, 6);
  waves.name = "钟鼓余韵";
  waves.frustumCulled = false;
  waves.visible = false;
  group.add(waves);
  const transform = new THREE.Object3D();
  batch(staticGroup);
  let bellAt = -Infinity;
  let drumAt = -Infinity;
  let disposed = false;
  function animate(time: number) {
    if (disposed) return;
    const now = performance.now() / 1000;
    const bellAge = now - bellAt;
    const drumAge = now - drumAt;
    const bellSwing = bellAge < 12 ? Math.sin(bellAge * 5.2) * Math.exp(-bellAge * 0.45) : 0;
    bell.rotation.z = bellSwing * 0.09;
    striker.position.z = -31.95 - (bellAge < 1.1 ? Math.sin(Math.min(1, bellAge / 0.65) * Math.PI) * 0.39 : 0);
    const drumHit = drumAge < 2.4 ? Math.sin(drumAge * 17) * Math.exp(-drumAge * 2.5) : 0;
    drum.scale.z = 1 + drumHit * 0.026;
    mallets.rotation.x = drumAge < 1.2 ? Math.sin(drumAge * 11) * Math.exp(-drumAge * 3) * 0.4 : 0;
    const recentBell = bellAt > drumAt;
    const age = recentBell ? bellAge : drumAge;
    waves.visible = age >= 0 && age < 8;
    if (waves.visible) {
      waveMaterial.opacity = Math.max(0, 1 - age / 8) * 0.24;
      for (let index = 0; index < 6; index++) {
        const phase = (age * 0.65 + index / 3) % 2;
        transform.position.set(recentBell ? 44 : 20, recentBell ? 4.25 : 3.7, recentBell ? -32.5 : -31.2);
        transform.rotation.set(0, 0, 0);
        transform.scale.setScalar(1 + phase * 0.7);
        transform.updateMatrix();
        waves.setMatrixAt(index, transform.matrix);
      }
      waves.instanceMatrix.needsUpdate = true;
    }
    group.userData.bellAge = bellAge;
    group.userData.drumAge = drumAge;
    group.userData.animationTime = time;
  }
  return {
    group,
    colliders,
    rooms,
    landmarks: [
      { name: "财神庙", x: 43, z: 18 },
      { name: "钟楼", x: 44, z: -29.8 },
      { name: "鼓楼", x: 20, z: -28.5 },
    ],
    interactions: [
      { kind: "incenseCaishen" as const, label: "♧ 财神敬香", x: 43, y: 1.2, z: 18 },
      { kind: "towerBell" as const, label: "♩ 钟楼鸣钟", x: 44, y: 1.4, z: -29.8 },
      { kind: "drum" as const, label: "♬ 鼓楼击鼓", x: 20, y: 1.4, z: -28.5 },
    ],
    interact(kind: TowerAction) {
      if (disposed) return;
      if (kind === "towerBell") bellAt = performance.now() / 1000;
      else drumAt = performance.now() / 1000;
    },
    animate,
    dispose() {
      if (disposed) return;
      disposed = true;
      waves.dispose();
      group.removeFromParent();
      group.clear();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(surface => surface.dispose());
      textures.forEach(texture => texture.dispose());
    },
  };
}
