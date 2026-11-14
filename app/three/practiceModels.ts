import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type PracticePropKind = "wood" | "beads" | "flower";

function createCraft(name: string) {
  const group = new THREE.Group();
  group.name = name;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const sphere = new THREE.SphereGeometry(1, 14, 10);
  geometries.add(sphere);

  function surface(color: number, roughness = .75, metalness = 0, options: THREE.MeshPhysicalMaterialParameters = {}) {
    const material = new THREE.MeshPhysicalMaterial({ color, roughness, metalness, clearcoat: .12, clearcoatRoughness: .35, ...options });
    materials.add(material);
    return material;
  }
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    group.add(object);
    return object;
  }
  function oval(material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const object = mesh(sphere, material, x, y, z);
    object.scale.set(sx, sy, sz);
    return object;
  }
  function curve(material: THREE.Material, points: number[][], radius = .0025, segments = 12) {
    const path = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    return mesh(new THREE.TubeGeometry(path, segments, radius, 5, false), material);
  }
  function horizontalRing(material: THREE.Material, radius: number, tube: number, y: number, depthScale = 1) {
    const object = mesh(new THREE.TorusGeometry(radius, tube, 5, 32), material, 0, y, 0);
    object.rotation.x = Math.PI / 2;
    object.scale.y = depthScale;
    return object;
  }
  function lathe(material: THREE.Material, profile: number[][], depthScale = 1, smooth = false) {
    const points = profile.map(([r, y]) => new THREE.Vector2(r, y));
    const sampled = smooth ? new THREE.SplineCurve(points).getPoints(44).map(point => new THREE.Vector2(Math.max(0, point.x), point.y)) : points;
    const object = mesh(new THREE.LatheGeometry(sampled, smooth ? 32 : 24), material);
    object.scale.z = depthScale;
    return object;
  }
  function merge() {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    group.children.forEach(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      const parts = batches.get(object.material) ?? [];
      parts.push(object);
      batches.set(object.material, parts);
    });
    for (const [material, parts] of batches) {
      if (parts.length < 2) continue;
      const vertexColors = material instanceof THREE.MeshStandardMaterial && material.vertexColors;
      const copies = parts.map(part => {
        part.updateMatrix();
        const transformed = part.geometry.clone().applyMatrix4(part.matrix);
        const copy = transformed.index ? transformed.toNonIndexed() : transformed;
        if (copy !== transformed) transformed.dispose();
        copy.deleteAttribute("uv");
        if (vertexColors && !copy.getAttribute("color")) copy.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(copy.getAttribute("position").count * 3).fill(1), 3));
        if (!vertexColors) copy.deleteAttribute("color");
        return copy;
      });
      const geometry = mergeGeometries(copies);
      copies.forEach(copy => copy.dispose());
      if (geometry) {
        parts.forEach(part => group.remove(part));
        mesh(geometry, material);
      }
    }
  }
  let disposed = false;
  return {
    group, surface, mesh, oval, curve, horizontalRing, lathe,
    finish() {
      merge();
      return {
        group,
        dispose() {
          if (disposed) return;
          disposed = true;
          group.removeFromParent();
          geometries.forEach(geometry => geometry.dispose());
          materials.forEach(material => material.dispose());
          group.clear();
        },
      };
    },
  };
}

function coloredPetal(base = 0xffffff, tip = base, rounded = false) {
  const positions: number[] = [], indices: number[] = [], colors: number[] = [];
  const rows = 7, columns = 4;
  const layerSize = (rows + 1) * (columns + 1);
  const baseColor = new THREE.Color(base), tipColor = new THREE.Color(tip);
  for (let layer = 0; layer < 2; layer++) for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    for (let column = 0; column <= columns; column++) {
      const across = column / columns * 2 - 1;
      const arc = Math.sin(Math.PI * t);
      const y = rounded ? .5 - Math.cos(Math.PI * t) * .5 : t;
      const width = rounded ? arc * .48 : arc ** .62 * .47;
      const cup = rounded ? -.18 * arc + .2 * y * y : .27 * arc - .16 * t * t;
      const thickness = rounded ? (.09 * (1 - across * across) + .012) * arc : .025 * arc;
      positions.push(across * width, y, cup + (layer ? -thickness : thickness));
      const color = baseColor.clone().lerp(tipColor, THREE.MathUtils.smoothstep(t, .38, 1) * (.68 + Math.abs(across) * .32));
      color.multiplyScalar(1 - Math.abs(across) * .025);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let layer = 0; layer < 2; layer++) for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = layer * layerSize + row * (columns + 1) + column, b = a + columns + 1;
    if (layer) indices.push(a, b, a + 1, a + 1, b, b + 1);
    else indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  for (let row = 0; row < rows; row++) for (const column of [0, columns]) {
    const a = row * (columns + 1) + column, b = a + columns + 1;
    if (column === 0) indices.push(a, b, a + layerSize, b, b + layerSize, a + layerSize);
    else indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** The shell is split around a real hollow mouth instead of a painted black arc. */
function woodenShell(color: number) {
  const positions: number[] = [], normals: number[] = [], colors: number[] = [], indices: number[] = [];
  const columns = 40, rows = 12;
  const tint = new THREE.Color(color), normal = new THREE.Vector3();
  for (let patch = 0; patch < 3; patch++) {
    const offset = positions.length / 3;
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const x = (column / columns * 2 - 1) * .17;
      const arc = Math.sqrt(Math.max(0, 1 - (x / .17) ** 2));
      const bottom = .018 - .105 * arc, top = .018 + .105 * arc;
      const mouth = THREE.MathUtils.clamp(.022 + Math.sin(x / .17 * Math.PI) * .008, bottom, top);
      const gap = Math.min(Math.sqrt(Math.max(0, 1 - (x / .15) ** 2)) * .008, mouth - bottom, top - mouth);
      const lower = patch === 0 ? Math.min(top, mouth + gap) : bottom;
      const upper = patch === 1 ? Math.max(bottom, mouth - gap) : top;
      const y = THREE.MathUtils.lerp(lower, upper, row / rows);
      const z = Math.sqrt(Math.max(0, 1 - (x / .17) ** 2 - ((y - .018) / .105) ** 2)) * .13 * (patch === 2 ? -1 : 1);
      positions.push(x, y, z);
      normal.set(x / (.17 * .17), (y - .018) / (.105 * .105), z / (.13 * .13)).normalize();
      normals.push(normal.x, normal.y, normal.z);
      const grain = .96 + Math.sin(x * 154 + Math.sin(y * 31) * .9 + z * 48) * .027 + Math.sin(x * 421 + y * 13) * .009;
      const value = tint.clone().multiplyScalar(grain);
      colors.push(value.r, value.g, value.b);
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = offset + row * (columns + 1) + column, b = a + columns + 1;
      if (patch === 2) indices.push(a, b, a + 1, a + 1, b, b + 1);
      else indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

function createWood(tier: number) {
  const craft = createCraft(`木鱼进阶 · ${tier}`);
  const { surface, mesh, oval, curve, horizontalRing, lathe } = craft;
  const palette = [0xa57345, 0x986038, 0x8d302a, 0x3b2923, 0x4e3028];
  const shell = surface(0xffffff, tier < 2 ? .58 : .37, 0, { vertexColors: true, clearcoat: tier < 2 ? .18 : .48 });
  const carved = surface(tier < 2 ? 0xb58554 : palette[tier], .48, 0, { clearcoat: .3 });
  const inner = surface(0x33241c, .96);
  const gold = surface(tier > 1 ? 0xcaaa65 : 0xb8915e, .32, tier > 1 ? .65 : .08);
  const base = surface(tier === 4 ? 0x5c927d : 0x72513b, tier === 4 ? .28 : .72, 0, { clearcoat: tier === 4 ? .6 : .12 });
  oval(inner, 0, .018, 0, .162, .096, .121);
  mesh(woodenShell(palette[tier]), shell);
  const onShell = (points: number[][]) => points.map(([x, y]) => [x, y, .13 * Math.sqrt(Math.max(.01, 1 - (x / .17) ** 2 - ((y - .018) / .105) ** 2)) + .0015]);
  curve(carved, onShell([[.074, .079], [.093, .092], [.12, .087], [.134, .065], [.13, .047]]), .006);
  oval(inner, .122, .069, .079, .0033, .0038, .0021);
  curve(carved, [[-.025, .111, -.025], [.004, .125, -.022], [.031, .117, -.015], [.045, .101, -.005]], .006);
  if (tier > 0) {
    lathe(base, [[0, -.104], [.112, -.104], [.134, -.099], [.141, -.091], [.135, -.081], [.111, -.075], [0, -.075]], .79);
    horizontalRing(tier > 1 ? gold : carved, .133, .0024, -.092, .79);
    for (const offset of [-.024, 0, .024]) curve(tier > 1 ? gold : carved, onShell([[-.032, -.039], [-.032 + offset, -.025], [-.032 + offset * .9, -.009], [-.032, -.019], [-.032, -.039]]), .0016);
  }
  if (tier >= 2) curve(gold, onShell([-.13, -.1, -.07, -.04, -.01, .02, .05, .08, .11].map(x => [x, -.054 + Math.sin(x * 35) * .004])), .0017, 24);
  if (tier >= 3) {
    for (const side of [-1, 1]) curve(gold, onShell([[side * .06, -.032], [side * .088, -.017], [side * .104, -.025], [side * .094, -.039], [side * .081, -.033]]), .0016);
    const leaf = coloredPetal();
    for (let index = 0; index < 10; index++) {
      const angle = index / 10 * Math.PI * 2;
      const petal = mesh(leaf, tier === 4 ? base : gold, Math.sin(angle) * .094, -.092, Math.cos(angle) * .075);
      petal.rotation.set(1.07, angle, 0, "YXZ");
      petal.scale.set(.039, .049, .039);
    }
  }
  if (tier === 4) {
    const porcelain = surface(0xffffff, .27, .04, { vertexColors: true, clearcoat: .55 });
    const leaf = coloredPetal(0xb7cbb7, 0x5f9781);
    for (let index = 0; index < 12; index++) {
      const angle = index / 12 * Math.PI * 2 + Math.PI / 12;
      const petal = mesh(leaf, porcelain, Math.sin(angle) * .104, -.103, Math.cos(angle) * .081);
      petal.rotation.set(1.22, angle, 0, "YXZ");
      petal.scale.set(.046, .061, .046);
    }
    horizontalRing(gold, .146, .0024, -.106, .79);
  }
  return craft.finish();
}

function gemstoneGeometry(color: number, pale: number, seed: number, organic: boolean) {
  const geometry = new THREE.SphereGeometry(1, organic ? 10 : 12, organic ? 7 : 9);
  const position = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
  const colors: number[] = [];
  const dark = new THREE.Color(color), light = new THREE.Color(pale);
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index), y = position.getY(index), z = position.getZ(index);
    const wave = Math.sin(x * 5.3 + z * 3.7 + seed) * Math.cos(y * 7.1 - seed * .7);
    const vein = Math.sin(x * 11 + y * 5 + z * 6 + seed) ** 12;
    const tint = dark.clone().lerp(light, .15 + wave * .1 + vein * .19);
    colors.push(tint.r, tint.g, tint.b);
    if (organic) {
      const radius = 1 - Math.cos(uv.getX(index) * Math.PI * 12) ** 8 * .027;
      position.setXYZ(index, x * radius, y * 1.075, z * radius);
    }
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createBeads(tier: number) {
  const craft = createCraft(`佛珠进阶 · ${tier}`);
  const { mesh, surface, oval, curve } = craft;
  const palette = [[0x715035, 0xa27e54], [0xb87528, 0xe4b85e], [0x6b9c83, 0xc8d8bd], [0x315778, 0x6b929b], [0x7aa98d, 0xdbdfc3]];
  const gem = surface(0xffffff, tier === 0 ? .7 : .24, 0, { vertexColors: true, clearcoat: tier === 0 ? .12 : .72, clearcoatRoughness: .23 });
  const gold = surface(tier > 0 ? 0xc8aa70 : 0x8d6843, .35, tier > 0 ? .6 : .05);
  const cord = surface(tier === 3 ? 0x986451 : tier === 4 ? 0xb49c73 : 0x9b7b56, .9);
  const beadGeometry = [0, 1, 2].map(seed => gemstoneGeometry(palette[tier][0], palette[tier][1], seed * 2.1, tier === 0));
  const spacerGeometry = new THREE.SphereGeometry(1, 7, 5);
  function spacer(x: number, y: number, z: number, sx = .0036, sy = .0042, sz = .0034) {
    const object = mesh(spacerGeometry, gold, x, y, z);
    object.scale.set(sx, sy, sz);
  }
  const radius = .088;
  mesh(new THREE.TorusGeometry(radius, .0026, 4, 32), cord);
  for (let index = 0; index < 14; index++) {
    const angle = index / 14 * Math.PI * 2;
    const stone = mesh(beadGeometry[index % 3], gem, Math.sin(angle) * radius, Math.cos(angle) * radius, 0);
    stone.scale.setScalar(.0185 + Math.sin(index * 2.4) * .0006);
    stone.rotation.set(index * .19, index * .7, angle);
    if (tier >= 2 && index % 3 === 1) {
      const spacerAngle = angle + Math.PI / 14;
      spacer(Math.sin(spacerAngle) * radius, Math.cos(spacerAngle) * radius, 0);
    }
  }
  spacer(0, -.108, 0, .0065, .006, .0065);
  const guru = mesh(gemstoneGeometry(tier === 3 ? 0x79aa9a : palette[tier][0], palette[tier][1], 5.2, tier === 0), gem, 0, -.128, 0);
  guru.scale.set(.0145, .022, .013);
  spacer(0, -.148, 0, .007, .004, .006);
  const strands = tier === 0 ? 3 : 10;
  if (tier === 0) curve(cord, [[0, -.151, 0], [0, -.161, 0], [0, -.172, .001]], .0012, 5);
  if (tier > 0) for (const side of [-1, 1]) {
    curve(cord, [[0, -.154, .002], [side * .009, -.157, .003], [side * .009, -.168, .003], [0, -.166, .004]], .0018);
    curve(cord, [[0, -.16, .006], [side * .006, -.168, .006], [0, -.175, .004]], .0017);
  }
  for (let index = 0; index < strands; index++) {
    const offset = (index - (strands - 1) / 2) * .0018;
    const length = tier === 0 ? .024 : .034 + Math.sin(index * 1.7) * .003;
    curve(cord, [[offset * .15, -.171, .001], [offset * .65, -.184, .002], [offset, -.171 - length, .003]], .0011, 9);
  }
  if (tier >= 3) for (const side of [-1, 1]) curve(gold, [[side * .009, -.114, 0], [side * .018, -.129, .002], [side * .011, -.143, .002]], .0016);
  if (tier === 4) {
    const leaf = coloredPetal();
    for (let index = 0; index < 6; index++) {
      const angle = index / 6 * Math.PI * 2;
      const petal = mesh(leaf, gold, Math.sin(angle) * .006, -.129 + Math.cos(angle) * .006, .01);
      petal.rotation.set(.16, 0, -angle);
      petal.scale.set(.014, .02, .012);
    }
    const mother = surface(0x7aa98d, .25, .02, { clearcoat: .6 });
    oval(mother, 0, -.129, .019, .008, .009, .006);
  }
  return craft.finish();
}

function lotusLeaf() {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const center = new THREE.Color(0x83986d), edge = new THREE.Color(0x496e52);
  const rings = 5, segments = 24;
  for (let ring = 0; ring <= rings; ring++) for (let segment = 0; segment <= segments; segment++) {
    const r = ring / rings, angle = segment / segments * Math.PI * 2;
    const fold = Math.cos(angle * 7) * .035 * r * r;
    positions.push(Math.sin(angle) * r * .72, (r * r * .1 + fold) * .55, Math.cos(angle) * r);
    const color = center.clone().lerp(edge, r * .8 + fold);
    colors.push(color.r, color.g, color.b);
  }
  for (let ring = 0; ring < rings; ring++) for (let segment = 0; segment < segments; segment++) {
    const a = ring * (segments + 1) + segment, b = a + segments + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createFlowers(tier: number) {
  const craft = createCraft(`供花进阶 · ${tier}`);
  const { surface, mesh, oval, curve, horizontalRing, lathe } = craft;
  const petalSurface = surface(0xffffff, .64, 0, { vertexColors: true, clearcoat: .2, side: THREE.DoubleSide });
  const leafSurface = surface(0xffffff, .73, 0, { vertexColors: true, side: THREE.DoubleSide });
  const stemSurface = surface(0x719168, .81);
  const gold = surface(0xcaaa66, .34, .58);
  const fiber = surface(0xa4865d, .91);
  const fiberLight = surface(0xc4a572, .92);
  const celadon = surface(0x7ea28f, .23, .02, { clearcoat: .73, clearcoatRoughness: .2 });
  const pink = coloredPetal(0xf3dfc7, 0xd5959b, true);
  const cream = coloredPetal(0xf2e5bd, 0xe1c69e, true);
  const goldPetal = coloredPetal(0xf0d595, 0xc59b53, true);
  const leafGeometry = lotusLeaf();
  const seedGeometry = new THREE.SphereGeometry(1, 7, 5);

  function lotus(x: number, y: number, z: number, size: number, pale = false, golden = false, bud = false) {
    const geometry = golden ? goldPetal : pale ? cream : pink;
    const layers = bud ? [{ count: 6, size: .8, angle: .3 }] : [{ count: 8, size: 1, angle: .92 }, { count: 6, size: .9, angle: .65 }, { count: 5, size: .77, angle: .25 }];
    for (const [layerIndex, layer] of layers.entries()) for (let index = 0; index < layer.count; index++) {
      const angle = index / layer.count * Math.PI * 2 + layerIndex * .38;
      const petal = mesh(geometry, petalSurface, x, y + layerIndex * size * .055, z);
      petal.rotation.set(layer.angle + Math.sin(index * 2.1) * .035, angle, 0, "YXZ");
      petal.scale.setScalar(size * layer.size);
    }
    oval(gold, x, y + size * .62, z, size * .19, size * .075, size * .19);
    if (!bud) for (let index = 0; index < 6; index++) {
      const angle = index / 6 * Math.PI * 2;
      const seed = mesh(seedGeometry, gold, x + Math.sin(angle) * size * .12, y + size * .68, z + Math.cos(angle) * size * .12);
      seed.scale.setScalar(size * .034);
    }
  }
  const arrangements = [
    [[-.008, .105, .005, .064, 0]],
    [[.018, .133, -.012, .061, 0], [-.072, .086, .012, .046, 1], [.078, .105, .012, .052, 0]],
    [[-.055, .096, .018, .055, 0], [.047, .135, -.01, .058, 0], [.073, .082, .038, .04, 1]],
    [[.015, .15, -.012, .06, 0], [-.074, .109, .012, .046, 0], [.078, .105, .018, .04, 1]],
    [[-.034, .157, -.016, .056, 0], [.074, .119, .008, .05, 0], [-.085, .094, .018, .043, 1], [.008, .098, .046, .051, 0]],
  ];
  for (const [index, point] of arrangements[tier].entries()) {
    const [x, y, z, size, bud] = point;
    curve(stemSurface, [[0, -.09, 0], [x * .25 - .009, .015, z * .35], [x * .7, y * .67, z * .82], [x, y, z]], .0031);
    lotus(x, y, z, size, index % 3 === 1, tier === 4 && index === 3, Boolean(bud));
  }
  for (const side of [-1, 1]) {
    const leaf = mesh(leafGeometry, leafSurface, side * .047, tier > 1 ? .026 : -.005, -.008);
    leaf.rotation.set(side > 0 ? -.53 : -.28, side * .7, side * -.21);
    leaf.scale.setScalar(tier === 0 ? .05 : .061);
  }
  if (tier < 2) {
    const ribbon = surface(tier === 0 ? 0xa78a61 : 0xb68178, .9);
    for (const side of [-1, 1]) curve(ribbon, [[0, -.05, .012], [side * .026, -.046, .014], [side * .017, -.064, .014], [0, -.052, .014]], .0021);
    curve(ribbon, [[0, -.053, .016], [.009, -.074, .02], [.022, -.083, .02]], .002);
  }
  if (tier === 2) {
    lathe(fiber, [[0, -.117], [.054, -.117], [.073, -.104], [.089, -.067], [.094, -.025], [.09, -.009], [.083, -.009], [.083, -.03], [.076, -.065], [.058, -.103], [0, -.103]], .8, true);
    for (let row = 0; row < 7; row++) horizontalRing(fiberLight, [.071, .082, .088, .093, .096, .096, .095][row], .0015, -.108 + row * .015, .8);
    for (let index = 0; index < 14; index++) {
      const angle = index / 14 * Math.PI * 2;
      curve(fiberLight, [[Math.sin(angle) * .07, -.11, Math.cos(angle) * .056], [Math.sin(angle + .13) * .093, -.062, Math.cos(angle + .13) * .0744], [Math.sin(angle + .24) * .094, -.012, Math.cos(angle + .24) * .0752]], .0014);
    }
    const handle = mesh(new THREE.TorusGeometry(.085, .0038, 5, 24, Math.PI), fiberLight, 0, -.01, -.02);
    handle.scale.y = 1.38;
  }
  if (tier >= 3) {
    lathe(celadon, [[0, -.126], [.044, -.126], [.052, -.121], [.052, -.108], [.064, -.09], [.074, -.055], [.073, -.025], [.059, .003], [.035, .02], [.03, .042], [.037, .054], [.038, .063], [.03, .063], [.025, .045], [.028, .02], [.051, -.007], [.062, -.035], [.063, -.061], [.052, -.094], [.038, -.111], [0, -.111]], .82, true);
    horizontalRing(gold, .036, .0018, .058, .82);
    horizontalRing(gold, .047, .0017, -.119, .82);
    for (const offset of [-.016, 0, .016]) curve(gold, [[0, -.072, .06], [offset, -.058, .064], [offset * .8, -.041, .064], [0, -.052, .066], [0, -.072, .06]], .0012);
  }
  if (tier === 4) {
    lathe(gold, [[0, -.143], [.056, -.143], [.07, -.138], [.072, -.13], [.061, -.124], [0, -.124]], .82, true);
    const petal = coloredPetal();
    for (let index = 0; index < 8; index++) {
      const angle = index / 8 * Math.PI * 2;
      const leaf = mesh(petal, gold, Math.sin(angle) * .039, -.124, Math.cos(angle) * .032);
      leaf.rotation.set(.65, angle, 0, "YXZ");
      leaf.scale.set(.025, .047, .025);
    }
    for (const side of [-1, 1]) curve(gold, [[side * .052, .005, 0], [side * .079, .005, .002], [side * .082, -.025, .002], [side * .066, -.05, 0]], .0025);
  }
  return craft.finish();
}

/** Previews and animated held items use the same owned, portable sculptures. */
export function createPracticeProp(kind: PracticePropKind, tier: number) {
  const level = Number.isFinite(tier) ? THREE.MathUtils.clamp(Math.trunc(tier), 0, 4) : 0;
  if (kind === "wood") return createWood(level);
  if (kind === "beads") return createBeads(level);
  return createFlowers(level);
}
