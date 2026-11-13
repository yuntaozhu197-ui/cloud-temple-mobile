import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TempleRoom } from "./detachedHalls";
import { createArchitecturalTextures, createBracketArmGeometry } from "./architecturalMaterials";

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
  const architecturalTextures = createArchitecturalTextures();
  const colliders: Collider[] = [];
  const rooms: TempleRoom[] = [];
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const surface = new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...options });
    materials.add(surface);
    return surface;
  };
  const stone = material("#cbbfa6");
  const plaster = material("#edddba", { map: architecturalTextures.plaster ?? null });
  const redWood = material("#8b493a", { map: architecturalTextures.wood ?? null, roughness: .78 });
  const darkWood = material("#493a30", { map: architecturalTextures.wood ?? null });
  const tile = material("#284e4c", { side: THREE.DoubleSide, roughness: .76 });
  const tileRib = material("#507d70");
  const eaveTrim = material("#bb9560", { metalness: .15, roughness: .74 });
  const paper = material("#f3e6c8", { map: architecturalTextures.plaster ?? null });
  const gold = material("#b4925b", { metalness: 0.28, roughness: 0.66 });
  const goldLight = material("#d8bb7a", { metalness: .24, roughness: .54 });
  const bronze = material("#886b43", { metalness: 0.35, roughness: 0.6 });
  const skin = material("#d8b98e", { roughness: .78 });
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
    const mesh = meshes(new THREE.SphereGeometry(1, 12, 8), surface, x, y, z, parent);
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
  function plaque(title: string, x: number, y: number, z: number, parent: THREE.Group) {
    box(x, y, z, 3.8, 0.84, 0.18, darkWood, parent);
    box(x, y, z + 0.1, 3.62, 0.68, 0.03, gold, parent);
    box(x, y, z + 0.12, 3.45, 0.54, 0.025, redWood, parent);
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
    meshes(new THREE.PlaneGeometry(3.03, 0.59), lettering, x, y, z + 0.15, parent);
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
        }), 0.035, tileRib, details);
      }
      const eavePoints = Array.from({ length: 13 }, (_, column) => {
        const u = column / 6 - 1;
        return [x + u * (width / 2 - .12), height(u, 1) - .08, z + side * (depth / 2 - .12)];
      });
      curve(eavePoints, .075, darkWood, details);
      curve(eavePoints.map(([px, py, pz]) => [px, py - .1, pz - side * .035]), .045, eaveTrim, details);
      const tileCount = Math.ceil(width / .65);
      const tileEnd = new THREE.CylinderGeometry(.085, .085, .17, 7, 1, true);
      for (let end = 0; end < tileCount; end++) {
        const u = end / (tileCount - 1) * 2 - 1;
        const cap = meshes(tileEnd, tileRib, x + u * (width / 2 - .18), height(u, 1) - .01, z + side * (depth / 2 - .12), details);
        cap.rotation.x = Math.PI / 2;
        const rafter = box(x + u * (width / 2 - .25), height(u, 1) - .23, z + side * (depth / 2 - .65), .09, .11, .9, redWood, details);
        rafter.rotation.x = side * .08;
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
        cylinder(x + side * (width / 2 - .3), .38, pz, .29, .33, .12, gold);
        cylinder(x + side * (width / 2 - .3), height - .65, pz, .24, .24, .14, eaveTrim);
        block(x + side * (width / 2 - 0.3), pz, 0.65, 0.65);
        for (let bracket = 0; bracket < 3; bracket++) {
          meshes(createBracketArmGeometry(.75 + bracket * .3, .25), bracket % 2 ? eaveTrim : tile, x + side * (width / 2 - .3), height - .45 + bracket * .17, pz);
          const crossing = meshes(createBracketArmGeometry(.75 + bracket * .3, .25), redWood, x + side * (width / 2 - .3), height - .36 + bracket * .17, pz);
          crossing.rotation.y = Math.PI / 2;
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
        const windowPaper = meshes(new THREE.CircleGeometry(.63, 24), paper, windowX, 2.7, front + .16);
        windowPaper.castShadow = false;
        meshes(new THREE.TorusGeometry(0.68, 0.055, 5, 24), gold, windowX, 2.7, front + 0.17);
        for (let bar = -1; bar <= 1; bar++) {
          box(windowX + bar * 0.28, 2.7, front + 0.19, 0.04, 1.15, 0.05, tile);
          box(windowX, 2.7 + bar * 0.28, front + 0.2, 1.15, 0.04, 0.05, tile);
        }
        box(windowX, 1.25, front + .18, panelWidth - .3, .8, .15, redWood);
        box(windowX, 1.25, front + .27, panelWidth - .65, .51, .05, darkWood);
      }
    }
    if (closed) {
      box(x, height / 2, back, width, height, 0.3, plaster);
      block(x, back, width, 0.32);
    }
    const roofs = new THREE.Group();
    const details = new THREE.Group();
    roofs.name = `${name}双层飞檐`;
    details.name = `${name}瓦垄与脊饰`;
    group.add(roofs, details);
    plaque(name, x, height - 1.1, front + .22, details);
    for (const direction of [-1, 1]) {
      box(x, height - .55, z + direction * (depth / 2 - .26), width - .55, .42, .19, tile, details);
      for (const offset of [-.17, .17]) box(x, height - .55 + offset, z + direction * (depth / 2 - .14), width - .75, .035, .04, eaveTrim, details);
      for (const bay of [-1, 0, 1]) {
        const boss = box(x + bay * width * .28, height - .55, z + direction * (depth / 2 - .11), .22, .22, .06, eaveTrim, details);
        boss.rotation.z = Math.PI / 4;
      }
    }
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
  meshes(new THREE.LatheGeometry([[0, 0], [1.58, 0], [1.65, .07], [1.65, .17], [1.57, .29], [1.5, .4], [0, .4]].map(([r, y]) => new THREE.Vector2(r, y)), 28), stone, 0, 0, -33);
  box(0, 1.2, -33.35, 2.5, 1.9, 0.7, darkWood);
  box(0, 2.0, -33.55, 2.75, 0.16, 0.6, gold);
  for (const side of [-1, 1]) {
    oval(side * 0.64, 0.98, -32.6, 0.61, 0.25, 0.58, redWood);
    oval(side * 0.52, 0.6, -32.18, 0.24, 0.17, 0.4, beard);
  }
  const robeProfile = [[0, 0], [.82, .025], [.88, .12], [.88, .29], [.79, .61], [.64, 1.05], [.61, 1.22], [.7, 1.48], [.64, 1.61], [.4, 1.8], [0, 1.82]];
  meshes(new THREE.LatheGeometry(robeProfile.map(([r, y]) => new THREE.Vector2(r, y)), 26), redWood, 0, 0.88, -33);
  const fortuneFace = meshes(new THREE.SphereGeometry(1, 24, 16), skin, 0, 3.1, -32.94);
  fortuneFace.scale.set(.45, .55, .36);
  const fortuneFacePoint = (dx: number, dy: number): number[] => [dx, 3.1 + dy, -32.928 + Math.sqrt(Math.max(.03, 1 - (dx / .45) ** 2 - (dy / .55) ** 2)) * .36];
  oval(0, 3.15, -32.566, .036, .11, .032, skin);
  oval(0, 3.07, -32.54, .057, .052, .062, skin);
  cylinder(0, 3.58, -33, 0.38, 0.48, 0.24, beard);
  cylinder(0, 3.8, -33, 0.3, 0.39, 0.34, gold);
  for (const side of [-1, 1]) {
    box(side * 0.55, 3.67, -33, 0.62, 0.15, 0.3, gold).rotation.z = side * 0.15;
    oval(side * .61, 3.73, -32.99, .34, .065, .12, goldLight).rotation.z = side * .15;
    oval(side * .455, 3.02, -32.93, .075, .20, .08, skin);
    oval(side * .475, 3.05, -32.858, .023, .105, .008, bronze);
    const eyeX = side * .18;
    curve([fortuneFacePoint(eyeX - .08, .09), fortuneFacePoint(eyeX, .068), fortuneFacePoint(eyeX + .08, .09)], .013, beard);
    curve([fortuneFacePoint(eyeX - .09, .20), fortuneFacePoint(eyeX, .235), fortuneFacePoint(eyeX + .09, .208)], .017, beard);
    curve([[side * 0.42, 2.46, -32.99], [side * 0.88, 2.05, -32.65], [side * 0.62, 1.8, -32.1]], 0.21, redWood);
    oval(side * 0.57, 1.84, -32.08, 0.19, 0.13, 0.18, skin);
    curve([[side * 0.1, 3.0, -32.57], [side * 0.28, 2.96, -32.55], [side * 0.36, 3.0, -32.6]], 0.035, beard);
    curve([[side * 0.65, 2.5, -32.94], [side * 0.5, 1.88, -32.52], [side * 0.76, 1.15, -32.5]], 0.03, gold);
    oval(side * 0.5, 2.0, -31.98, 0.3, 0.21, 0.23, gold).rotation.z = -side * 0.48;
    for (let finger = 0; finger < 3; finger++) {
      const fx = side * .57 + (finger - 1) * .055;
      curve([[fx - .02, 1.87, -31.925], [fx, 1.9, -31.91], [fx + .025, 1.87, -31.92]], .009, bronze);
    }
  }
  oval(0, 3.99, -33, 0.11, 0.19, 0.12, gold);
  meshes(new THREE.LatheGeometry([[0, 0], [.045, .06], [.16, .26], [.26, .6], [.31, .79], [.27, .91], [0, .92]].map(([r, y]) => new THREE.Vector2(r, y)), 20), beard, 0, 2.09, -32.47);
  for (const offset of [-.13, 0, .13]) curve([[offset, 2.91, -32.19], [offset * .7, 2.58, -32.25], [offset * .25, 2.21, -32.4]], .01, bronze);
  curve([[-.36, 2.56, -32.52], [0, 2.22, -32.23], [.36, 2.56, -32.52]], .04, goldLight);
  for (const offset of [-.45, -.15, .15, .45]) curve([[offset * .65, 2.18, -32.4], [offset * .85, 1.63, -32.22], [offset, 1.02, -32.3]], .022, goldLight);
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
  curve([[44, 4.1, -31.45], [44, 2.9, -30.4], [44, .93, -30.4]], .018, gold);
  const bellRopeHandle = meshes(new THREE.TorusGeometry(.1, .018, 5, 16), darkWood, 44, .91, -30.4, group);
  bellRopeHandle.name = "钟楼拉绳握环";
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
  drum.position.set(20, 1.2, -32);
  group.add(drum);
  for (const side of [-1, 1]) {
    box(20 + side * 0.72, .32, -32, 0.23, .64, 1.8, darkWood).rotation.z = side * 0.08;
    box(20 + side * 0.72, .62, -32, 0.48, .18, 1.65, gold);
  }
  box(20, .12, -32, 2.5, .2, 1.65, darkWood);
  block(20, -32, 2.8, 2.4);
  const mallets = new THREE.Group();
  mallets.name = "鼓楼双槌";
  for (const side of [-1, 1]) {
    const stick = cylinder(side * 0.5, 0, 0, 0.035, 0.05, 0.85, darkWood, mallets);
    stick.rotation.x = -0.7;
    oval(side * 0.5, 0.34, 0.28, 0.085, 0.1, 0.1, darkWood, mallets);
  }
  batch(mallets);
  mallets.position.set(20, 1, -31.1);
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
    mallets.visible = drumAge >= 1.2;
    bellRopeHandle.position.y = .91 - (bellAge >= 0 && bellAge < .7 ? Math.sin(bellAge / .7 * Math.PI) * .1 : 0);
    drum.scale.z = 1 + drumHit * 0.026;
    mallets.rotation.x = drumAge < 1.2 ? Math.sin(drumAge * 11) * Math.exp(-drumAge * 3) * 0.4 : 0;
    const recentBell = bellAt > drumAt;
    const age = recentBell ? bellAge : drumAge;
    waves.visible = age >= 0 && age < 8;
    if (waves.visible) {
      waveMaterial.opacity = Math.max(0, 1 - age / 8) * 0.24;
      for (let index = 0; index < 6; index++) {
        const phase = (age * 0.65 + index / 3) % 2;
        transform.position.set(recentBell ? 44 : 20, recentBell ? 4.25 : 1.2, recentBell ? -32.5 : -31.2);
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
      architecturalTextures.dispose();
    },
  };
}
