import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };
type Point = [number, number, number];

/** Three sculpted figures and framed murals, facing the main hall's open south side. */
export function createSacredArt(): {
  group: THREE.Group;
  colliders: Collider[];
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = "大殿三尊与莲境壁画";
  group.userData.sacredArt = true;
  group.userData.statueNames = ["释迦牟尼佛", "观世音菩萨", "地藏菩萨"];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let disposed = false;

  function surface(color: string, options: THREE.MeshStandardMaterialParameters = {}) {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...options });
    materials.add(result);
    return result;
  }

  const palette = {
    gold: surface("#b59050", { metalness: 0.28, roughness: 0.58 }),
    goldLight: surface("#d8bb7a", { metalness: 0.25, roughness: 0.54 }),
    bronze: surface("#886b43", { metalness: 0.26, roughness: 0.66 }),
    jade: surface("#ebe0ca", { roughness: 0.70 }),
    jadeShade: surface("#c0cbbb", { roughness: 0.78 }),
    ochre: surface("#a77742", { roughness: 0.86 }),
    ink: surface("#55594d", { roughness: 0.84 }),
    stone: surface("#cfc5af", { roughness: 0.91 }),
    leaf: surface("#748971", { roughness: 0.88 }),
    mural: surface("#648d7b", { roughness: 0.95 }),
  };
  const rounded = new THREE.SphereGeometry(1, 16, 10);
  const faceShape = new THREE.SphereGeometry(1, 24, 16);
  const petalShape = new THREE.SphereGeometry(1, 8, 4);
  geometries.add(rounded);
  geometries.add(faceShape);
  geometries.add(petalShape);

  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }

  function oval(parent: THREE.Object3D, material: THREE.Material, point: Point, scale: Point, detail = rounded) {
    const result = mesh(detail, material, parent, ...point);
    result.scale.set(...scale);
    return result;
  }

  function box(parent: THREE.Object3D, material: THREE.Material, point: Point, size: Point) {
    return mesh(new THREE.BoxGeometry(...size), material, parent, ...point);
  }

  function cylinder(parent: THREE.Object3D, material: THREE.Material, point: Point, top: number, bottom: number, height: number, segments = 20) {
    return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material, parent, ...point);
  }

  function curve(parent: THREE.Object3D, material: THREE.Material, points: Point[], radius: number, segments = 12) {
    const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    return mesh(new THREE.TubeGeometry(path, segments, radius, 4, false), material, parent);
  }

  function lathe(parent: THREE.Object3D, material: THREE.Material, point: Point, profile: [number, number][], segments = 20) {
    return mesh(new THREE.LatheGeometry(profile.map(([radius, height]) => new THREE.Vector2(radius, height)), segments), material, parent, ...point);
  }

  function lotusBase(parent: THREE.Object3D, radius: number, top: number, petalCount: number) {
    lathe(parent, palette.bronze, [0, 0.46, 0], [[0, 0], [radius * 1.03, 0], [radius * 1.08, 0.04], [radius * 1.08, 0.12], [radius * 1.02, 0.20], [0, 0.20]], 28);
    cylinder(parent, palette.gold, [0, 0.75, 0], radius * 0.94, radius * 1.02, 0.18, 24);
    for (let tier = 0; tier < 2; tier += 1) {
      for (let index = 0; index < petalCount; index += 1) {
        const angle = (index + tier * 0.5) * Math.PI * 2 / petalCount;
        const distance = radius * (tier === 0 ? 0.75 : 0.63);
        const petal = oval(parent, tier === 0 ? palette.gold : palette.goldLight,
          [Math.sin(angle) * distance, 0.88 + tier * 0.20, Math.cos(angle) * distance],
          [radius * 0.26, 0.19, radius * 0.40], petalShape);
        petal.rotation.y = angle;
        petal.rotation.x = tier === 0 ? 0.22 : -0.30;
        const midrib = curve(parent, palette.goldLight, [[0, 0.04, -radius * 0.24], [0, 0.19, 0], [0, 0.05, radius * 0.25]], 0.009, 6);
        midrib.position.copy(petal.position);
        midrib.rotation.copy(petal.rotation);
      }
    }
    cylinder(parent, palette.goldLight, [0, top - 0.06, 0], radius * 0.72, radius * 0.84, 0.12, 24);
    const rim = mesh(new THREE.TorusGeometry(radius * 0.86, 0.026, 5, 40), palette.bronze, parent, 0, top - 0.14, 0);
    rim.rotation.x = Math.PI / 2;
  }

  function halo(parent: THREE.Object3D, centerY: number, radius: number, depth: number) {
    mesh(new THREE.TorusGeometry(radius, 0.055, 6, 40), palette.goldLight, parent, 0, centerY, depth);
    mesh(new THREE.TorusGeometry(radius * 0.91, 0.026, 5, 36), palette.bronze, parent, 0, centerY, depth - 0.025);
    for (const side of [-1, 1]) {
      curve(parent, palette.gold, [[side * radius * 0.64, centerY - radius * 0.81, depth], [side * radius * 0.48, centerY - radius * 0.35, depth - 0.04], [side * radius * 0.41, centerY + radius * 0.42, depth]], 0.04, 10);
    }
  }

  function face(parent: THREE.Object3D, center: Point, size: Point, material: THREE.Material) {
    const [cx, cy, cz] = center;
    const [sx, sy, sz] = size;
    oval(parent, material, center, size, faceShape);
    for (const side of [-1, 1]) {
      oval(parent, material, [cx + side * sx * 1.02, cy - sy * 0.10, cz - 0.04], [sx * 0.15, sy * 0.37, sz * 0.18]);
      oval(parent, palette.bronze, [cx + side * sx * 1.04, cy - sy * 0.06, cz + sz * 0.10], [sx * 0.05, sy * 0.21, sz * 0.025]);
    }
    function onFace(x: number, y: number, lift = 0.012): Point {
      const depth = Math.sqrt(Math.max(0.05, 1 - (x / sx) ** 2 - (y / sy) ** 2)) * sz;
      return [cx + x, cy + y, cz + depth + lift];
    }
    for (const side of [-1, 1]) {
      const x = side * sx * 0.34;
      curve(parent, palette.ink, [onFace(x - sx * 0.15, sy * 0.025), onFace(x, -sy * 0.018), onFace(x + sx * 0.15, sy * 0.025)], 0.009, 10);
      curve(parent, palette.bronze, [onFace(x - sx * 0.17, sy * 0.19), onFace(x, sy * 0.23), onFace(x + sx * 0.17, sy * 0.20)], 0.011, 10);
      oval(parent, material, onFace(side * sx * .52, -sy * .14, .006), [sx * .19, sy * .17, sz * .055]);
    }
    oval(parent, material, onFace(0, sy * .025, .012), [sx * .065, sy * .19, sz * .075]);
    oval(parent, material, onFace(0, -sy * 0.11, 0.018), [sx * 0.095, sy * 0.10, sz * 0.13]);
    oval(parent, material, onFace(0, -sy * .35, .016), [sx * .15, sy * .035, sz * .04]);
    curve(parent, palette.bronze, [onFace(-sx * 0.14, -sy * 0.30), onFace(0, -sy * 0.325), onFace(sx * 0.14, -sy * 0.30)], 0.007, 10);
    oval(parent, palette.goldLight, onFace(0, sy * 0.36, 0.02), [0.037, 0.043, 0.027], petalShape);
  }

  function necklace(parent: THREE.Object3D, centerY: number, radius: number, depth: number, count: number) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.PI * index / (count - 1);
      oval(parent, palette.goldLight, [Math.cos(angle) * radius, centerY - Math.sin(angle) * radius * 0.65, depth + Math.sin(angle) * 0.12], [0.063, 0.069, 0.057], petalShape);
    }
  }

  // The blocked platform keeps visitors on the main hall floor in front of the altar.
  box(group, palette.stone, [0, 0.20, -19.2], [22.2, 0.40, 4.4]);
  box(group, palette.bronze, [0, 0.42, -19.2], [22.0, 0.08, 4.2]);
  box(group, palette.gold, [0, 0.24, -16.97], [21.7, 0.09, 0.05]);
  const colliders: Collider[] = [{ minX: -11.1, maxX: 11.1, minZ: -21.4, maxZ: -17.0 }];

  const buddha = new THREE.Group();
  buddha.name = "释迦牟尼佛 · 莲台禅坐";
  buddha.position.set(0, 0, -19.3);
  group.add(buddha);
  lotusBase(buddha, 1.95, 1.32, 14);
  halo(buddha, 3.40, 2.13, -0.77);
  for (const side of [-1, 1]) {
    const knee = oval(buddha, palette.gold, [side * 0.76, 1.65, 0.25], [0.98, 0.39, 0.75]);
    knee.rotation.y = side * 0.24;
    const foot = oval(buddha, palette.goldLight, [side * 0.36, 1.84, 0.83], [0.55, 0.16, 0.31]);
    foot.rotation.z = side * 0.16;
  }
  lathe(buddha, palette.gold, [0, 1.72, 0], [[0, 0], [0.98, 0.05], [1.12, 0.25], [1.04, 0.67], [0.94, 1.08], [1.04, 1.38], [0.74, 1.62], [0.34, 1.75], [0, 1.77]]);
  oval(buddha, palette.gold, [0, 3.63, 0.0], [0.34, 0.33, 0.30]);
  face(buddha, [0, 4.27, 0.04], [0.65, 0.80, 0.56], palette.goldLight);
  const hair = mesh(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.38), palette.ink, buddha, 0, 4.28, 0.015);
  hair.scale.set(0.70, 0.87, 0.62);
  for (const latitude of [0.35, 0.71, 1.07]) {
    for (let index = 0; index < 9; index += 1) {
      const angle = index * Math.PI * 2 / 9 + latitude;
      oval(buddha, palette.ink,
        [Math.sin(angle) * Math.sin(latitude) * 0.70, 4.28 + Math.cos(latitude) * 0.87, 0.015 + Math.cos(angle) * Math.sin(latitude) * 0.62],
        [0.105, 0.10, 0.10], petalShape);
    }
  }
  oval(buddha, palette.ink, [0, 5.24, 0.015], [0.24, 0.26, 0.23]);
  lathe(buddha, palette.goldLight, [0, 5.43, 0.015], [[0, 0], [0.085, 0.02], [0.075, 0.12], [0, 0.25]], 12);
  curve(buddha, palette.bronze, [[-0.84, 3.15, 0.34], [-0.45, 2.86, 0.84], [0.10, 2.28, 1.02], [0.67, 1.87, 0.90]], 0.085, 18);
  for (let index = 0; index < 4; index += 1) {
    const offset = index * 0.19;
    curve(buddha, palette.goldLight, [[-0.76 + offset, 2.73, 0.68], [-0.59 + offset, 2.35, 0.94], [-0.35 + offset, 1.98, 1.02]], 0.023, 10);
  }
  curve(buddha, palette.gold, [[-0.88, 3.12, 0.01], [-1.13, 2.61, 0.28], [-0.71, 2.18, 0.77]], 0.22, 14);
  oval(buddha, palette.goldLight, [-0.37, 2.10, 0.94], [0.39, 0.115, 0.23]);
  for (let finger = 0; finger < 4; finger++) {
    const x = -.65 + finger * .13;
    curve(buddha, palette.bronze, [[x, 2.15, 1.11], [x + .02, 2.16, 1.15], [x + .06, 2.12, 1.16]], .009, 6);
  }
  curve(buddha, palette.gold, [[0.87, 3.12, 0.01], [1.16, 2.72, 0.28], [1.23, 3.12, 0.75]], 0.215, 14);
  oval(buddha, palette.goldLight, [1.23, 3.29, 0.83], [0.20, 0.29, 0.12]);
  for (let index = 0; index < 4; index += 1) {
    oval(buddha, palette.goldLight, [1.09 + index * 0.087, 3.52 - Math.abs(index - 1.5) * 0.035, 0.83], [0.047, 0.16, 0.075], petalShape);
  }
  const thumb = oval(buddha, palette.goldLight, [1.03, 3.24, 0.87], [0.085, 0.16, 0.075], petalShape);
  thumb.rotation.z = -0.55;
  curve(buddha, palette.bronze, [[1.12, 3.21, .946], [1.22, 3.19, .955], [1.34, 3.27, .94]], .009, 8);

  const guanyin = new THREE.Group();
  guanyin.name = "观世音菩萨 · 白玉净瓶";
  guanyin.position.set(-7.7, 0, -19.0);
  group.add(guanyin);
  lotusBase(guanyin, 1.35, 1.26, 11);
  halo(guanyin, 3.75, 1.18, -0.62);
  lathe(guanyin, palette.jadeShade, [0, 1.25, 0], [[0, 0], [0.87, 0.04], [0.80, 0.45], [0.65, 1.24], [0.52, 1.92], [0.65, 2.20], [0.27, 2.39], [0, 2.41]]);
  oval(guanyin, palette.jade, [0, 4.02, -0.13], [0.64, 0.91, 0.48]);
  face(guanyin, [0, 4.00, 0.20], [0.46, 0.60, 0.40], palette.jade);
  for (const side of [-1, 1]) {
    curve(guanyin, palette.jade, [[side * 0.49, 4.40, 0.21], [side * 0.59, 3.92, 0.14], [side * 0.64, 3.43, 0.04], [side * 0.78, 2.82, 0.16]], 0.12, 16);
    curve(guanyin, palette.goldLight, [[side * .31, 4.53, .36], [side * .49, 4.24, .39], [side * .58, 3.65, .23], [side * .72, 2.85, .20]], .018, 16);
    curve(guanyin, palette.jade, [[side * 0.32, 3.45, 0.35], [side * 0.28, 2.69, 0.65], [side * 0.53, 1.44, 0.59]], 0.055, 16);
  }
  cylinder(guanyin, palette.gold, [0, 4.52, 0.10], 0.37, 0.45, 0.11, 16);
  for (let index = 0; index < 5; index += 1) {
    const angle = (index - 2) * 0.55;
    const petal = oval(guanyin, palette.goldLight, [Math.sin(angle) * 0.36, 4.69 + Math.cos(angle) * 0.12, 0.16 + Math.cos(angle) * 0.14], [0.115, 0.28, 0.065], petalShape);
    petal.rotation.z = -angle * 0.35;
  }
  necklace(guanyin, 3.49, 0.43, 0.47, 10);
  curve(guanyin, palette.jade, [[-0.49, 3.46, 0.0], [-0.73, 2.90, 0.15], [-0.31, 2.73, 0.57]], 0.18, 14);
  oval(guanyin, palette.jade, [-0.27, 2.74, 0.66], [0.21, 0.11, 0.17]);
  lathe(guanyin, palette.jade, [-0.28, 2.74, 0.73], [[0.10, 0], [0.19, 0.06], [0.22, 0.24], [0.16, 0.39], [0.075, 0.47], [0.075, 0.65], [0.11, 0.67]], 16);
  cylinder(guanyin, palette.goldLight, [-0.28, 3.38, 0.73], 0.12, 0.12, 0.045, 12);
  curve(guanyin, palette.jade, [[0.49, 3.46, 0.0], [0.71, 3.08, 0.19], [0.54, 3.47, 0.47]], 0.17, 14);
  oval(guanyin, palette.jade, [0.54, 3.51, 0.47], [0.11, 0.18, 0.12]);
  for (let finger = 0; finger < 3; finger++) {
    const y = 3.43 + finger * .075;
    curve(guanyin, palette.goldLight, [[.48, y, .56], [.55, y + .02, .59], [.61, y + .055, .53]], .012, 7);
  }
  curve(guanyin, palette.leaf, [[0.54, 3.47, 0.50], [0.77, 3.88, 0.46], [0.96, 4.22, 0.44], [0.88, 4.50, 0.45]], 0.024, 14);
  for (let index = 0; index < 6; index += 1) {
    const leaf = oval(guanyin, palette.leaf, [0.69 + index * 0.044, 3.82 + index * 0.10, 0.46], [0.045, 0.18, 0.025], petalShape);
    leaf.rotation.z = index % 2 ? -0.65 : 0.65;
  }
  for (let index = 0; index < 5; index += 1) {
    const x = (index - 2) * 0.22;
    curve(guanyin, palette.jade, [[x * 0.62, 3.13, 0.48], [x * 0.80, 2.40, 0.68], [x, 1.37, 0.64]], 0.026, 14);
  }

  const ksitigarbha = new THREE.Group();
  ksitigarbha.name = "地藏菩萨 · 金身锡杖";
  ksitigarbha.position.set(7.7, 0, -19.0);
  group.add(ksitigarbha);
  lotusBase(ksitigarbha, 1.35, 1.26, 11);
  halo(ksitigarbha, 3.78, 1.17, -0.62);
  lathe(ksitigarbha, palette.ochre, [0, 1.25, 0], [[0, 0], [0.88, 0.04], [0.81, 0.42], [0.65, 1.30], [0.62, 2.13], [0.45, 2.38], [0.23, 2.43], [0, 2.45]]);
  face(ksitigarbha, [0, 4.03, 0.08], [0.48, 0.63, 0.42], palette.goldLight);
  cylinder(ksitigarbha, palette.bronze, [0, 4.51, 0.04], 0.40, 0.44, 0.11, 16);
  for (let index = 0; index < 5; index += 1) {
    const angle = (index - 2) * 0.62;
    const crown = oval(ksitigarbha, palette.gold, [Math.sin(angle) * 0.39, 4.72 + Math.cos(angle) * 0.10, 0.04 + Math.cos(angle) * 0.29], [0.13, 0.30, 0.08], petalShape);
    crown.rotation.z = -angle * 0.22;
    oval(ksitigarbha, palette.goldLight, [Math.sin(angle) * 0.39, 4.72 + Math.cos(angle) * 0.10, 0.115 + Math.cos(angle) * 0.29], [0.060, 0.085, 0.025], petalShape);
  }
  necklace(ksitigarbha, 3.50, 0.47, 0.49, 12);
  curve(ksitigarbha, palette.gold, [[-0.48, 3.50, 0.22], [-0.14, 2.98, 0.71], [0.53, 2.21, 0.62], [0.74, 1.42, 0.56]], 0.07, 18);
  for (let index = 0; index < 4; index += 1) {
    const x = (index - 1.5) * 0.30;
    curve(ksitigarbha, palette.bronze, [[x * 0.6, 2.91, 0.49], [x * 0.9, 2.21, 0.67], [x, 1.38, 0.64]], 0.026, 12);
  }
  curve(ksitigarbha, palette.ochre, [[-0.52, 3.44, 0.0], [-0.73, 3.00, 0.15], [-0.38, 2.89, 0.65]], 0.18, 14);
  oval(ksitigarbha, palette.goldLight, [-0.35, 2.92, 0.72], [0.21, 0.12, 0.17]);
  mesh(new THREE.IcosahedronGeometry(0.23, 1), palette.jadeShade, ksitigarbha, -0.35, 3.15, 0.74);
  curve(ksitigarbha, palette.ochre, [[0.52, 3.44, 0.0], [0.73, 3.03, 0.18], [1.03, 3.11, 0.40]], 0.18, 14);
  oval(ksitigarbha, palette.goldLight, [1.04, 3.12, 0.43], [0.13, 0.17, 0.14]);
  for (let finger = 0; finger < 3; finger++) {
    const y = 3.02 + finger * .075;
    curve(ksitigarbha, palette.bronze, [[.96, y, .53], [1.05, y + .025, .57], [1.14, y + .045, .51]], .011, 7);
  }
  cylinder(ksitigarbha, palette.bronze, [1.07, 2.65, 0.44], 0.045, 0.055, 3.10, 10);
  mesh(new THREE.TorusGeometry(0.27, 0.042, 5, 24), palette.gold, ksitigarbha, 1.07, 4.36, 0.44);
  for (const side of [-1, 0, 1]) {
    mesh(new THREE.TorusGeometry(0.095, 0.022, 4, 12), palette.goldLight, ksitigarbha, 1.07 + side * 0.20, 4.17, 0.45);
  }
  oval(ksitigarbha, palette.goldLight, [1.07, 4.69, 0.44], [0.085, 0.16, 0.075], petalShape);

  // Framed paintings sit just inside the two side walls and share one GPU texture.
  for (const side of [-1, 1]) {
    const x = side * 12.8;
    box(group, palette.jadeShade, [x + side * 0.10, 3.8, -11.5], [0.12, 4.50, 11.5]);
    const painting = mesh(new THREE.PlaneGeometry(11, 4), palette.mural, group, x, 3.8, -11.5);
    painting.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    painting.castShadow = false;
    painting.receiveShadow = false;
    for (const edge of [-1, 1]) {
      box(group, palette.bronze, [x - side * 0.03, 3.8 + edge * 2.14, -11.5], [0.15, 0.16, 11.48]);
      box(group, palette.goldLight, [x - side * 0.055, 3.8 + edge * 2.025, -11.5], [0.05, 0.045, 11.10]);
      box(group, palette.bronze, [x - side * 0.03, 3.8, -11.5 + edge * 5.65], [0.15, 4.35, 0.16]);
    }
  }

  const muralTexture = new THREE.TextureLoader().load("/art/lotus-paradise-mural.jpg", texture => {
    if (disposed) return;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    palette.mural.map = texture;
    palette.mural.color.set("#ffffff");
    palette.mural.needsUpdate = true;
  }, undefined, () => {
    if (disposed) return;
    palette.mural.map = null;
    palette.mural.color.set("#648d7b");
    palette.mural.needsUpdate = true;
  });
  muralTexture.colorSpace = THREE.SRGBColorSpace;
  textures.add(muralTexture);

  // These pieces are static. Bake them once so mobile rendering uses a few batches.
  group.updateMatrixWorld(true);
  const batches = new Map<string, { material: THREE.Material; shadow: boolean; pieces: THREE.BufferGeometry[] }>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const key = `${object.material.uuid}:${object.castShadow ? "shadow" : "painting"}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { material: object.material, shadow: object.castShadow, pieces: [] };
      batches.set(key, batch);
    }
    const piece = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    batch.pieces.push(piece.applyMatrix4(object.matrixWorld));
  });
  group.clear();
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.pieces, false);
    for (const piece of batch.pieces) piece.dispose();
    if (!geometry) continue;
    const combined = mesh(geometry, batch.material, group);
    combined.name = `大殿圣像与壁画 · ${batch.shadow ? "雕塑" : "绘画"}`;
    combined.castShadow = batch.shadow;
    combined.receiveShadow = batch.shadow;
  }

  return {
    group,
    colliders,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      for (const texture of textures) texture.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      textures.clear();
      geometries.clear();
      materials.clear();
    },
  };
}
