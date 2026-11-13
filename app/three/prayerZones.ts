import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TempleRoom } from "./detachedHalls";
import { TEMPLE_LAYOUT } from "../templeLayout";
import { createArchitecturalTextures, createBracketArmGeometry } from "./architecturalMaterials";

type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Independent inner-courtyard shrines and a lantern tower beside the southern garden. */
export function createPrayerZones() {
  const group = new THREE.Group();
  group.name = "观音殿 · 文殊殿 · 长明灯塔";
  const staticGroup = new THREE.Group();
  group.add(staticGroup);
  const colliders: Collider[] = [];
  const rooms: TempleRoom[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const architecturalTextures = createArchitecturalTextures();
  const surface = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...options });
    materials.add(material);
    return material;
  };
  const stone = surface("#cbbfa6", { roughness: .94 });
  const plaster = surface("#edddba", { map: architecturalTextures.plaster ?? null, roughness: .97 });
  const timber = surface("#8b493a", { map: architecturalTextures.wood ?? null, roughness: .91 });
  const darkWood = surface("#493a30", { map: architecturalTextures.wood ?? null });
  const tile = surface("#284e4c", { side: THREE.DoubleSide, roughness: .88 });
  const tileLight = surface("#507d70", { roughness: .91 });
  const gold = surface("#b4925b", { metalness: .38, roughness: .56 });
  const goldLight = surface("#d5bd86", { metalness: .30, roughness: .5 });
  const bronze = surface("#7e6546", { metalness: .32, roughness: .65 });
  const white = surface("#f0e6ce", { roughness: .64 });
  const jade = surface("#bdcdb8", { roughness: .76 });
  const ink = surface("#284e4c");
  const lampSurface = surface("#ffc977", { emissive: "#da8d37", emissiveIntensity: 0.18, metalness: 0.15 });
  const towerLamps = Array.from({ length: 4 }, () => surface("#ffd990", { emissive: "#e6a348", emissiveIntensity: 0.12, metalness: 0.1 }));
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = staticGroup) => {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, parent?: THREE.Object3D) => add(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  const cylinder = (x: number, y: number, z: number, top: number, bottom: number, h: number, material: THREE.Material, segments = 12, parent?: THREE.Object3D) => add(new THREE.CylinderGeometry(top, bottom, h, segments), material, x, y, z, parent);
  const oval = (x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material) => {
    const mesh = add(new THREE.SphereGeometry(1, 10, 7), material, x, y, z);
    mesh.scale.set(sx, sy, sz);
    return mesh;
  };
  const block = (x: number, z: number, w: number, d: number) => colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  function curve(points: number[][], radius: number, material: THREE.Material, parent = staticGroup) {
    return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))), 10, radius, 5, false), material, 0, 0, 0, parent);
  }
  function batch(parent: THREE.Group) {
    parent.updateMatrixWorld(true);
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    parent.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      const pieces = batches.get(object.material as THREE.Material) ?? [];
      pieces.push(geometry);
      batches.set(object.material as THREE.Material, pieces);
    });
    parent.clear();
    for (const [material, pieces] of batches) {
      const geometry = mergeGeometries(pieces, false);
      pieces.forEach(piece => piece.dispose());
      if (geometry) add(geometry, material, 0, 0, 0, parent);
    }
  }
  function plaque(title: string, x: number, y: number, z: number) {
    box(x, y, z, 3.7, 0.78, 0.18, darkWood);
    box(x, y, z + 0.10, 3.5, 0.64, 0.03, gold);
    box(x, y, z + 0.12, 3.35, 0.5, 0.025, darkWood);
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 112;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#d9bb79";
    context.font = "bold 75px serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(title, 256, 61);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
    materials.add(material);
    add(new THREE.PlaneGeometry(2.8, 0.54), material, x, y, z + 0.15);
  }
  function roof(x: number, z: number, width: number, depth: number, base: number, rise: number, parent: THREE.Group, details: THREE.Group) {
    for (const side of [-1, 1]) {
      const vertices: number[] = [];
      const indices: number[] = [];
      const height = (u: number, v: number) => base + rise * (1 - v) ** 1.45 + 0.3 * Math.max(0, (v - 0.7) / 0.3) ** 2 + 0.28 * Math.abs(u) ** 6;
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
      add(geometry, tile, 0, 0, 0, parent);
      for (let col = 0; col <= 12; col++) {
        const u = col / 6 - 1;
        const points = Array.from({ length: 7 }, (_, row) => {
          const v = row / 6;
          return [x + u * width / 2, height(u, v) + 0.025, z + side * v * depth / 2];
        });
        curve(points, .028, tileLight, details);
      }
    }
    box(x, base + rise + 0.1, z, width + 0.15, 0.17, 0.18, gold, details);
    for (const side of [-1, 1]) {
      curve([[x + side * (width / 2 - 0.5), base + rise + 0.1, z], [x + side * width / 2, base + rise + 0.27, z], [x + side * (width / 2 + 0.12), base + rise + 0.58, z]], 0.09, gold, details);
    }
  }
  function statue(x: number, guanyin: boolean) {
    const z = 26.5;
    add(new THREE.LatheGeometry([[0, 0], [1.43, 0], [1.5, .055], [1.5, .13], [1.44, .22], [1.35, .32], [0, .32]].map(([r, y]) => new THREE.Vector2(r, y)), 28), stone, x, 0, z);
    cylinder(x, 0.45, z, 1.2, 1.3, 0.28, gold, 24);
    for (let petal = 0; petal < 14; petal++) {
      const angle = petal * Math.PI * 2 / 14;
      const leaf = oval(x + Math.sin(angle) * 0.97, 0.64, z + Math.cos(angle) * 0.97, 0.3, 0.37, 0.18, white);
      leaf.rotation.y = angle;
      leaf.rotation.x = 0.22;
      const vein = curve([[0, -.15, .17], [0, 0, .195], [0, .22, .09]], .008, goldLight);
      vein.position.copy(leaf.position);
      vein.rotation.copy(leaf.rotation);
      const inner = oval(x + Math.sin(angle + Math.PI / 14) * .78, .87, z + Math.cos(angle + Math.PI / 14) * .78, .23, .20, .32, goldLight);
      inner.rotation.y = angle + Math.PI / 14;
      inner.rotation.x = -.25;
    }
    const lotusRim = add(new THREE.TorusGeometry(1.11, .025, 5, 36), bronze, x, .78, z);
    lotusRim.rotation.x = Math.PI / 2;
    const robe = guanyin ? white : gold;
    for (const side of [-1, 1]) oval(x + side * 0.5, 1.1, z + 0.26, 0.7, 0.27, 0.55, robe).rotation.z = side * 0.12;
    const profile = [[0, 0], [.74, .025], [.8, .12], [.81, .32], [.73, .58], [.6, .98], [.55, 1.17], [.65, 1.45], [.59, 1.59], [.38, 1.8], [0, 1.84]];
    add(new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), 24), robe, x, 0.98, z);
    const halo = add(new THREE.TorusGeometry(1.05, 0.045, 5, 40), gold, x, 3.05, z - 0.48);
    halo.castShadow = false;
    const innerHalo = add(new THREE.TorusGeometry(.96, .018, 4, 36), bronze, x, 3.05, z - .5);
    innerHalo.castShadow = false;
    const faceSurface = guanyin ? white : goldLight;
    const faceMaterial = faceSurface.clone();
    faceMaterial.vertexColors = true;
    materials.add(faceMaterial);
    const faceGeometry = new THREE.SphereGeometry(1, 24, 16);
    const facePositions = faceGeometry.getAttribute("position");
    const faceColors: number[] = [];
    for (let index = 0; index < facePositions.count; index++) {
      const y = facePositions.getY(index), depth = facePositions.getZ(index);
      const shade = (1 - y) * .045 + Math.max(0, -depth) * .025;
      faceColors.push(1 - shade * .6, 1 - shade, 1 - shade * 1.3);
    }
    faceGeometry.setAttribute("color", new THREE.Float32BufferAttribute(faceColors, 3));
    const face = add(faceGeometry, faceMaterial, x, 3.18, z + .01);
    face.scale.set(.39, .51, .32);
    const facePoint = (dx: number, dy: number): [number, number, number] => [x + dx, 3.18 + dy, z + .022 + Math.sqrt(Math.max(.03, 1 - (dx / .39) ** 2 - (dy / .51) ** 2)) * .32];
    const nose = facePoint(0, -.055);
    oval(x, 3.2, z + .34, .026, .085, .027, faceSurface);
    oval(nose[0], nose[1], nose[2], .038, .043, .05, faceSurface);
    const lowerLip = facePoint(0, -.205);
    oval(lowerLip[0], lowerLip[1] - .012, lowerLip[2], .071, .015, .018, faceSurface);
    curve([facePoint(-.066, -.18), facePoint(0, -.195), facePoint(.066, -.18)], .007, bronze);
    const urna = facePoint(0, .22);
    oval(urna[0], urna[1], urna[2], .024, .029, .01, goldLight);
    for (const side of [-1, 1]) {
      oval(x + side * .395, 3.10, z, .063, .19, .065, faceSurface);
      oval(x + side * .407, 3.12, z + .056, .019, .11, .009, bronze);
      const eyeX = side * .14;
      curve([facePoint(eyeX - .055, .025), facePoint(eyeX, -.012), facePoint(eyeX + .055, .025)], .0075, ink);
      curve([facePoint(eyeX - .06, .13), facePoint(eyeX, .158), facePoint(eyeX + .06, .132)], .009, bronze);
      curve([[x + side * 0.45, 2.45, z], [x + side * 0.8, 2.03, z + 0.15], [x + side * 0.6, 1.73, z + 0.65]], 0.16, robe);
      oval(x + side * 0.57, 1.75, z + 0.67, 0.17, 0.12, 0.17, faceSurface);
      for (let finger = 0; finger < 3; finger++) {
        const fx = x + side * .57 + (finger - 1) * .06;
        curve([[fx - .025, 1.79, z + .81], [fx, 1.82, z + .825], [fx + .025, 1.81, z + .80]], .009, bronze);
      }
      curve([[x + side * 0.55, 2.34, z + 0.1], [x + side * 0.33, 1.82, z + 0.58], [x + side * 0.68, 1.18, z + 0.56]], 0.022, gold);
    }
    curve([[x - .31, 2.64, z + .47], [x, 2.33, z + .64], [x + .31, 2.64, z + .47]], .026, goldLight);
    for (const offset of [-.3, 0, .3]) curve([[x + offset * .6, 2.37, z + .56], [x + offset * .82, 1.82, z + .68], [x + offset, 1.12, z + .72]], .018, guanyin ? white : goldLight);
    if (guanyin) {
      const veil = add(new THREE.SphereGeometry(1, 16, 10, Math.PI, Math.PI, 0, Math.PI * 0.65), white, x, 3.23, z - 0.07);
      veil.scale.set(0.53, 0.67, 0.46);
      for (const side of [-1, 1]) oval(x + side * 0.45, 2.86, z - 0.05, 0.12, 0.61, 0.36, white);
      for (const side of [-1, 1]) curve([[x + side * .22, 3.75, z + .22], [x + side * .43, 3.42, z + .3], [x + side * .48, 2.91, z + .24], [x + side * .49, 2.38, z + .16]], .016, goldLight);
      cylinder(x, 3.79, z, 0.13, 0.24, 0.32, gold);
      oval(x, 4.02, z, 0.08, 0.14, 0.08, gold);
      oval(x, 3.83, z + .19, .055, .087, .024, jade);
      add(new THREE.LatheGeometry([[0.1, 0], [0.17, 0.1], [0.14, 0.28], [0.07, 0.36], [0.07, 0.49], [0.1, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 12), white, x - 0.6, 1.76, z + 0.63);
      curve([[x + 0.58, 1.78, z + 0.68], [x + 0.77, 2.18, z + 0.66], [x + 0.96, 2.54, z + 0.66]], 0.025, tile);
      for (let leaf = 0; leaf < 4; leaf++) oval(x + 0.8 + leaf * 0.045, 2.22 + leaf * 0.08, z + 0.66, 0.1, 0.035, 0.035, tile).rotation.z = -0.5;
    } else {
      cylinder(x, 3.62, z, 0.28, 0.4, 0.22, gold, 12);
      for (let crown = -2; crown <= 2; crown++) {
        const tip = oval(x + crown * 0.15, 3.87 - Math.abs(crown) * 0.05, z + 0.02, 0.095, 0.26, 0.12, gold);
        tip.rotation.z = -crown * 0.12;
        oval(x + crown * .15, 3.89 - Math.abs(crown) * .05, z + .145, .035, .075, .018, jade);
      }
      // Wisdom sword and a bound sutra distinguish this shrine from Guanyin's vase.
      box(x + 0.69, 2.75, z + 0.59, 0.075, 1.6, 0.045, white);
      add(new THREE.ConeGeometry(0.072, 0.28, 4), white, x + 0.69, 3.68, z + 0.59);
      box(x + 0.69, 1.98, z + 0.59, 0.42, 0.075, 0.1, gold);
      box(x + 0.69, 1.79, z + 0.59, 0.08, 0.32, 0.08, timber);
      box(x - 0.6, 1.93, z + 0.66, 0.58, 0.16, 0.4, tile);
      box(x - 0.6, 1.97, z + 0.69, 0.51, 0.07, 0.36, white);
      for (const side of [-1, 1]) box(x - 0.6 + side * 0.17, 2.03, z + 0.69, 0.022, 0.02, 0.37, gold);
    }
    block(x, z, 3.2, 3.1);
  }

  for (const hall of [{ name: "观音殿", ...TEMPLE_LAYOUT.guanyin, guanyin: true }, { name: "文殊殿", ...TEMPLE_LAYOUT.wenshu, guanyin: false }]) {
    const { x } = hall;
    const hallMeshStart = staticGroup.children.length;
    const hallColliderStart = colliders.length;
    const offsetZ = hall.z - 29;
    box(x, 0.035, 29, 12.2, 0.07, 11.4, stone);
    box(x, 2.95, 24, 11, 5.9, 0.28, plaster);
    block(x, 24, 11, 0.3);
    for (const side of [-1, 1]) {
      box(x + side * 5.5, 2.95, 29, 0.28, 5.9, 10, plaster);
      block(x + side * 5.5, 29, 0.3, 10);
      box(x + side * 4.1, 2.95, 34, 2.8, 5.9, 0.28, plaster);
      block(x + side * 4.1, 34, 2.8, 0.3);
      const window = add(new THREE.TorusGeometry(0.64, 0.05, 5, 24), gold, x + side * 4.1, 2.6, 34.16);
      window.castShadow = false;
      const reveal = add(new THREE.TorusGeometry(.69, .055, 5, 28), stone, x + side * 4.1, 2.6, 34.10);
      reveal.castShadow = false;
      for (let bar = -1; bar <= 1; bar++) {
        box(x + side * 4.1 + bar * 0.28, 2.6, 34.17, 0.04, 1.05, 0.05, tile);
        box(x + side * 4.1, 2.6 + bar * 0.28, 34.18, 1.05, 0.04, 0.05, tile);
      }
      for (const z of [24.4, 29, 33.7]) {
        cylinder(x + side * 5, 2.95, z, 0.17, 0.23, 5.9, timber);
        cylinder(x + side * 5, 0.13, z, 0.3, 0.36, 0.26, stone);
        for (let bracket = 0; bracket < 3; bracket++) {
          add(createBracketArmGeometry(.6 + bracket * .25), tileLight, x + side * 5, 5.35 + bracket * .18, z);
          add(createBracketArmGeometry(.6 + bracket * .25), timber, x + side * 5, 5.44 + bracket * .18, z).rotation.y = Math.PI / 2;
        }
      }
      cylinder(x + side * 2.65, 2.95, 33.7, 0.19, 0.25, 5.9, timber);
      block(x + side * 2.65, 33.7, 0.5, 0.5);
      oval(x + side * 2.6, 4.55, 34.2, 0.2, 0.3, 0.2, lampSurface);
      cylinder(x + side * 2.6, 4.22, 34.2, 0.03, 0.03, 0.24, gold, 6);
    }
    for (const z of [24.4, 29, 33.7]) box(x, 5.75, z, 10.7, 0.3, 0.3, darkWood);
    const plaqueStart = staticGroup.children.length;
    plaque(hall.name, x, 4.9, 34.2);
    const plaqueParts = staticGroup.children.slice(plaqueStart);
    const roofs = new THREE.Group();
    const details = new THREE.Group();
    roofs.name = `${hall.name}重檐`;
    details.name = `${hall.name}瓦垄与屋脊`;
    group.add(roofs, details);
    for (const part of plaqueParts) details.add(part);
    box(x, 5.73, 34.17, 10.8, .36, .12, tile, details);
    for (const y of [5.59, 5.87]) box(x, y, 34.245, 10.8, .027, .025, gold, details);
    for (const side of [-1, 1]) {
      box(x + side * 4.1, 5.72, 34.245, 1.85, .16, .02, tileLight, details);
      for (const offset of [-.5, 0, .5]) {
        const diamond = box(x + side * 4.1 + offset, 5.72, 34.26, .075, .075, .018, goldLight, details);
        diamond.rotation.z = Math.PI / 4;
      }
      for (const z of [24.4, 29, 33.7]) {
        const bearing = add(createBracketArmGeometry(1.03, .28), gold, x + side * 5, 5.22, z, details);
        bearing.rotation.y = Math.PI / 2;
      }
    }
    roof(x, 29, 13.8, 12.3, 5.9, 1.85, roofs, details);
    roof(x, 28.6, 10.3, 8.2, 7.35, 1.2, roofs, details);
    batch(roofs);
    // Roof material opacity is controlled per room by the existing camera occlusion logic.
    for (const roofMesh of roofs.children as THREE.Mesh[]) {
      roofMesh.material = tile.clone();
      materials.add(roofMesh.material as THREE.Material);
    }
    batch(details);
    roofs.position.z = offsetZ;
    details.position.z = offsetZ;
    rooms.push({ name: hall.name, minX: x - 5.2, maxX: x + 5.2, minZ: hall.z - 4.7, maxZ: hall.z + 4.7, roofs: roofs.children as THREE.Mesh[], roofDetails: [details], elevation: 0 });
    statue(x, hall.guanyin);
    block(x, 30, 0.95, 0.85);
    box(x, 0.025, 35.4, 4, 0.05, 2.6, stone);
    for (const mesh of staticGroup.children.slice(hallMeshStart)) mesh.position.z += offsetZ;
    for (const collider of colliders.slice(hallColliderStart)) {
      collider.minZ += offsetZ;
      collider.maxZ += offsetZ;
    }
  }

  // The southern garden paths continue to connect the wishing platform and lamp tower.
  box(20, 0.012, 32.5, 40, 0.024, 1.9, stone);
  box(0, 0.012, 29.5, 2.1, 0.024, 16, stone);
  box(40, 0.012, 34.5, 2.1, 0.024, 5.5, stone);
  const towerX = 40, towerZ = 28;
  cylinder(towerX, 0.1, towerZ, 3.1, 3.3, 0.2, stone, 8);
  cylinder(towerX, 0.3, towerZ, 2.65, 2.85, 0.3, gold, 8);
  for (let story = 0; story < 4; story++) {
    const baseY = 0.48 + story * 1.8;
    const radius = 2.2 - story * 0.25;
    cylinder(towerX, baseY + 0.55, towerZ, radius * 0.86, radius * 0.9, 1.1, darkWood, 8);
    cylinder(towerX, baseY + 1.12, towerZ, radius + 0.1, radius + 0.45, 0.22, tile, 8);
    cylinder(towerX, baseY + 1.32, towerZ, radius * 0.65, radius + 0.12, 0.22, tile, 8);
    cylinder(towerX, baseY + 1.5, towerZ, radius * 0.62, radius * 0.68, 0.16, gold, 8);
    for (let side = 0; side < 8; side++) {
      const angle = side * Math.PI / 4;
      const lampX = towerX + Math.sin(angle) * radius * 0.87;
      const lampZ = towerZ + Math.cos(angle) * radius * 0.87;
      const niche = box(lampX, baseY + 0.57, lampZ, 0.54, 0.72, 0.08, gold);
      niche.rotation.y = angle;
      oval(lampX + Math.sin(angle) * 0.055, baseY + 0.59, lampZ + Math.cos(angle) * 0.055, 0.17, 0.27, 0.17, towerLamps[story]);
      cylinder(lampX, baseY + 0.31, lampZ, 0.2, 0.15, 0.07, gold, 8);
    }
  }
  cylinder(towerX, 7.93, towerZ, 0.04, 0.36, 1.1, gold, 12);
  oval(towerX, 8.58, towerZ, 0.16, 0.24, 0.16, gold);
  plaque("长明灯塔", towerX, 1.7, towerZ + 2.2);
  block(towerX, towerZ, 6.3, 6.3);
  batch(staticGroup);

  const ceremony = new THREE.Group();
  ceremony.name = "长明灯点亮仪式 · 二十四秒";
  ceremony.visible = false;
  group.add(ceremony);
  const glowMaterial = new THREE.MeshBasicMaterial({ color: "#ffdba0", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const petalMaterial = new THREE.MeshStandardMaterial({ color: "#ffdda3", emissive: "#eeb45d", emissiveIntensity: 1.1, transparent: true, opacity: 0, depthWrite: false, roughness: 0.6 });
  materials.add(glowMaterial);
  materials.add(petalMaterial);
  const ringGeometry = new THREE.RingGeometry(0.95, 1, 64);
  const rings = Array.from({ length: 3 }, (_, index) => {
    const ringMaterial = glowMaterial.clone();
    materials.add(ringMaterial);
    const ring = add(ringGeometry, ringMaterial, towerX, 0.26 + index * 0.06, towerZ, ceremony);
    ring.name = `莲光涟漪 ${index + 1}`;
    ring.rotation.x = -Math.PI / 2;
    ring.castShadow = false;
    return ring;
  });
  const petalGeometry = new THREE.SphereGeometry(1, 8, 5);
  geometries.add(petalGeometry);
  const petals = new THREE.InstancedMesh(petalGeometry, petalMaterial, 16);
  petals.name = "环塔莲光花瓣";
  petals.frustumCulled = false;
  ceremony.add(petals);
  const transform = new THREE.Object3D();
  const crownMaterial = glowMaterial.clone();
  materials.add(crownMaterial);
  const crown = add(new THREE.SphereGeometry(1, 12, 8), crownMaterial, towerX, 8.6, towerZ, ceremony);
  crown.name = "塔顶心灯辉光";
  crown.castShadow = false;
  const crownHalo = add(new THREE.TorusGeometry(1, 0.035, 5, 48), crownMaterial, towerX, 8.6, towerZ, ceremony);
  crownHalo.name = "塔顶金光环";
  crownHalo.rotation.x = Math.PI / 2;
  crownHalo.castShadow = false;

  // A radial alpha texture gives the single particle batch soft, rounded fireflies.
  const pointSize = 32;
  const pointPixels = new Uint8Array(pointSize * pointSize * 4);
  for (let y = 0; y < pointSize; y++) for (let x = 0; x < pointSize; x++) {
    const distance = Math.hypot((x + 0.5) / pointSize * 2 - 1, (y + 0.5) / pointSize * 2 - 1);
    const alpha = Math.round(Math.max(0, 1 - distance) ** 2 * 255);
    pointPixels.set([255, 255, 255, alpha], (y * pointSize + x) * 4);
  }
  const pointTexture = new THREE.DataTexture(pointPixels, pointSize, pointSize, THREE.RGBAFormat);
  pointTexture.magFilter = THREE.LinearFilter;
  pointTexture.minFilter = THREE.LinearFilter;
  pointTexture.needsUpdate = true;
  textures.add(pointTexture);
  const particleCount = 96;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage));
  geometries.add(particleGeometry);
  const particleMaterial = new THREE.PointsMaterial({ color: "#ffe3ac", map: pointTexture, size: 0.18, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  materials.add(particleMaterial);
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.name = "沿塔升起的九十六点灯火";
  particles.frustumCulled = false;
  ceremony.add(particles);

  const smooth = (value: number, start: number, end: number) => THREE.MathUtils.smoothstep(value, start, end);
  let litAt = -Infinity;
  let litUntil = 0;
  let restoredLit = false;
  let disposed = false;
  return {
    group,
    colliders,
    rooms,
    landmarks: [
      { name: "观音殿 · 平安祈愿", x: TEMPLE_LAYOUT.guanyin.x, z: TEMPLE_LAYOUT.guanyin.z + 2 },
      { name: "文殊殿 · 学业祈愿", x: TEMPLE_LAYOUT.wenshu.x, z: TEMPLE_LAYOUT.wenshu.z + 2 },
      { name: "长明灯塔", x: 40, z: 32.5 },
    ],
    interactions: [
      { kind: "incenseGuanyin" as const, label: "♧ 观音菩萨敬香", x: TEMPLE_LAYOUT.guanyin.x, y: 1.1, z: TEMPLE_LAYOUT.guanyin.z + 2 },
      { kind: "incenseWenshu" as const, label: "♧ 文殊菩萨敬香", x: TEMPLE_LAYOUT.wenshu.x, y: 1.1, z: TEMPLE_LAYOUT.wenshu.z + 2 },
      { kind: "longLamp" as const, label: "✺ 长明灯许愿", x: 40, y: 1.1, z: 32.5 },
    ],
    light() {
      if (disposed) return;
      litAt = performance.now();
      litUntil = litAt + 900_000;
      ceremony.visible = true;
    },
    setLampLit(lit: boolean) {
      if (disposed) return;
      restoredLit = lit;
      if (!lit) { litAt = -Infinity; litUntil = 0; ceremony.visible = false; }
    },
    animate(time: number) {
      if (disposed) return;
      const now = performance.now();
      const age = (now - litAt) / 1000;
      const lit = restoredLit || now < litUntil;
      towerLamps.forEach((lamp, story) => {
        const progress = age < 24 ? smooth(age, story * 1.6, story * 1.6 + 2.4) : 1;
        lamp.emissiveIntensity = lit ? 0.12 + progress * (1.18 + Math.sin(time * 2.1 + story * 0.6) * 0.09) : 0.12;
      });
      ceremony.visible = age >= 0 && age < 24;
      if (!ceremony.visible) return;
      const entrance = smooth(age, 0, 2.5);
      const fade = 1 - smooth(age, 18, 24);
      glowMaterial.opacity = entrance * fade * 0.35;
      petalMaterial.opacity = entrance * fade * 0.42;
      particleMaterial.opacity = smooth(age, 1, 5) * fade * 0.82;
      for (const [index, ring] of rings.entries()) {
        const ripple = ((age + index * 2.4) % 8) / 8;
        ring.scale.setScalar(2.2 + ripple * 3.2);
        ring.position.y = 0.25 + ripple * 0.55;
        ring.material.opacity = entrance * fade * Math.sin(ripple * Math.PI) * 0.42;
      }
      for (let index = 0; index < 16; index++) {
        const angle = index * Math.PI / 8 + Math.sin(time * 0.16) * 0.08;
        const opening = smooth(age, 1, 7);
        const radius = 2.2 + opening * 1.3;
        transform.position.set(towerX + Math.sin(angle) * radius, 0.35 + Math.sin(opening * Math.PI) * 0.4, towerZ + Math.cos(angle) * radius);
        transform.rotation.set(0.35 + opening * 0.45, angle, 0);
        transform.scale.set(0.32 + opening * 0.12, 0.12, 0.9 + opening * 0.55);
        transform.updateMatrix();
        petals.setMatrixAt(index, transform.matrix);
      }
      petals.instanceMatrix.needsUpdate = true;
      const crownStrength = smooth(age, 7, 13) * fade;
      crownMaterial.opacity = crownStrength * 0.24;
      crown.scale.set(0.5 + crownStrength * 0.7, 0.7 + crownStrength * 1.1, 0.5 + crownStrength * 0.7);
      crown.visible = age >= 7;
      crownHalo.visible = age >= 7;
      crownHalo.scale.setScalar(0.8 + crownStrength * 1.3);
      crownHalo.rotation.z = time * 0.16;
      for (let index = 0; index < particleCount; index++) {
        const phase = (age * (0.07 + index % 5 * 0.004) + index / particleCount) % 1;
        const angle = phase * Math.PI * 4 + index * 2.399;
        const radius = 2.05 + Math.sin(phase * Math.PI) * 0.5 + index % 4 * 0.08;
        particlePositions[index * 3] = towerX + Math.cos(angle) * radius;
        particlePositions[index * 3 + 1] = 0.6 + phase * (8.3 + crownStrength * 1.1);
        particlePositions[index * 3 + 2] = towerZ + Math.sin(angle) * radius;
      }
      particleGeometry.getAttribute("position").needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      petals.dispose();
      group.removeFromParent();
      group.clear();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(texture => texture.dispose());
      architecturalTextures.dispose();
    },
  };
}
