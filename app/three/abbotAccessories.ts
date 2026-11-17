import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { getAbbotAccessory, type AbbotAccessoryId } from "../../abbot-accessories.mjs";

/** Small carved ornaments use actual rounded surfaces and share static material batches. */
export function createAbbotAccessory(id: AbbotAccessoryId) {
  const item = getAbbotAccessory(id);
  if (!item) throw new Error("Unknown abbot accessory");
  const group = new THREE.Group();
  group.name = `住持饰品 · ${item.name}`;
  const ornament = new THREE.Group();
  group.add(ornament);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  geometries.add(sphere);

  function surface(color: number, roughness = .43, metalness = 0, extra: THREE.MeshPhysicalMaterialParameters = {}) {
    const material = new THREE.MeshPhysicalMaterial({ color, roughness, metalness, clearcoat: .22, clearcoatRoughness: .3, ...extra });
    materials.add(material);
    return material;
  }
  const gold = surface(0xb99a60, .33, .68);
  const jade = surface(0x9ab8a5, .27, .02, { clearcoat: .68 });
  const pale = surface(0xe1e3cd, .3, .02, { clearcoat: .55 });
  const colored = surface(new THREE.Color(item.color).getHex(), id === "bamboo-sachet" ? .86 : .38, 0, { clearcoat: id === "bamboo-sachet" ? .02 : .45 });
  const cord = surface(id === "echo-bell" || id === "home-lantern" || id === "sutra-scroll" ? 0xa55f52 : 0x8e7959, .89);
  const dark = surface(0x665342, .78);

  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    ornament.add(object);
    return object;
  }
  function oval(material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const object = mesh(sphere, material, x, y, z);
    object.scale.set(sx, sy, sz);
    return object;
  }
  function curve(material: THREE.Material, points: number[][], radius = .0017, segments = 10) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), segments, radius, 5), material);
  }
  function ring(material: THREE.Material, radius: number, tube: number, x: number, y: number, z = 0, scaleX = 1, scaleY = 1) {
    const object = mesh(new THREE.TorusGeometry(radius, tube, 5, 24), material, x, y, z);
    object.scale.set(scaleX, scaleY, 1);
    return object;
  }
  function lathe(material: THREE.Material, profile: number[][], depthScale = 1, centerY = 0) {
    const points = new THREE.SplineCurve(profile.map(point => new THREE.Vector2(...point))).getPoints(24);
    const object = mesh(new THREE.LatheGeometry(points.map(point => new THREE.Vector2(Math.max(.0001, point.x), point.y)), 24), material, 0, centerY);
    object.scale.z = depthScale;
    return object;
  }
  function tassel(y: number, color = cord, length = .04, x = 0, z = .005) {
    oval(gold, x, y, z, .005, .0065, .005);
    for (let index = 0; index < 5; index++) {
      const offset = (index - 2) * .0023;
      curve(color, [[x + offset * .4, y - .004, z], [x + offset, y - length * .57, z + .001], [x + offset * 1.35, y - length, z + Math.abs(offset) * .5]], .00095, 6);
    }
  }
  function knot(y: number, material = cord, x = 0, z = .003) {
    for (const side of [-1, 1]) curve(material, [[x, y, z], [x + side * .013, y + .006, z], [x + side * .013, y - .004, z], [x, y - .009, z]], .0018, 8);
    oval(gold, x, y - .005, z + .001, .003, .0045, .003);
  }
  function pendantLoop() {
    ring(gold, .006, .0018, 0, -.008, 0, .7, 1);
    curve(cord, [[0, 0, -.002], [-.005, -.013, 0], [0, -.026, .003], [.005, -.013, 0], [0, 0, -.002]], .0016, 8);
  }
  function flower(y: number, size: number, material: THREE.Material) {
    ring(gold, size * .7, .0014, 0, y, -.003);
    for (const [count, radius, length, thickness] of [[8, .5, .43, .16], [6, .27, .34, .2]]) {
      for (let index = 0; index < count; index++) {
        const angle = index / count * Math.PI * 2 + (count === 6 ? .36 : 0);
        const petal = oval(material, Math.sin(angle) * size * radius, y + Math.cos(angle) * size * radius, count === 6 ? .008 : 0, size * .23, size * length, size * thickness);
        petal.rotation.z = -angle;
        petal.rotation.x = Math.cos(angle) * .2;
      }
    }
    for (const side of [-1, 1]) curve(gold, [[side * size * .75, y - size * .15, .002], [side * size * .46, y - size * .62, .008], [0, y - size * .78, .005]], .0011);
    oval(gold, 0, y, .012, size * .26, size * .26, size * .15);
    oval(jade, 0, y, .019, size * .19, size * .19, size * .14);
  }

  if (id === "heart-lotus") {
    pendantLoop();
    flower(-.072, .055, pale);
    curve(gold, [[0, -.025, -.006], [-.018, -.04, -.009], [0, -.059, -.012], [.018, -.04, -.009], [0, -.025, -.006]], .002);
    oval(jade, 0, -.136, .001, .008, .013, .007);
    knot(-.151);
    tassel(-.166, cord, .035);
  }
  if (id === "pine-jade") {
    pendantLoop();
    oval(colored, 0, -.09, 0, .052, .061, .013);
    ring(gold, .053, .0018, 0, -.09, 0, 1, 1.16);
    curve(gold, [[.019, -.134, .014], [.005, -.112, .015], [.013, -.094, .015], [-.008, -.066, .014]], .0022);
    for (const [x, y, scale] of [[-.012, -.067, .7], [.015, -.086, 1], [-.011, -.105, 1.05]]) {
      curve(gold, [[x - .023 * scale, y - .004, .014], [x - .009 * scale, y + .009, .017], [x + .012 * scale, y + .006, .016], [x + .024 * scale, y - .003, .014]], .0015);
      curve(jade, [[x - .021 * scale, y - .009, .015], [x, y + .002, .019], [x + .022 * scale, y - .008, .015]], .0019);
    }
    knot(-.159);
    tassel(-.175, cord, .032);
  }
  if (id === "bamboo-sachet") {
    pendantLoop();
    lathe(colored, [[0, -.142], [.023, -.143], [.044, -.13], [.051, -.102], [.044, -.064], [.024, -.045], [.02, -.034], [0, -.033]], .62);
    const seam = ring(gold, .044, .0013, 0, -.102, .002, 1, 1.01);
    seam.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) curve(cord, [[side * .008, -.033, .001], [side * .035, -.023, .004], [side * .041, -.034, .007], [side * .025, -.045, .012]], .0018);
    curve(pale, [[-.006, -.13, .033], [-.007, -.1, .034], [.003, -.067, .027]], .0014);
    for (const [x, y, angle] of [[-.016, -.109, -.7], [.006, -.097, .8], [-.008, -.081, -.7], [.014, -.075, .7]]) {
      const leaf = oval(pale, x, y, .034, .004, .013, .0018);
      leaf.rotation.z = angle;
    }
    for (const side of [-1, 1]) curve(pale, [[side * .029, -.057, .019], [side * .043, -.08, .023], [side * .043, -.112, .024], [side * .026, -.135, .018]], .0011, 12);
    knot(-.03, cord, 0, .023);
    tassel(-.153, cord, .041);
  }
  if (id === "ripple-fish") {
    pendantLoop();
    ring(gold, .054, .0017, 0, -.091, -.006, 1.06, 1);
    for (const [side, material] of [[1, jade], [-1, pale]] as const) {
      const y = -.09 + side * .021;
      const body = oval(material, side * .007, y, .003, .035, .016, .013);
      body.rotation.z = side * .2;
      const tail = new THREE.Shape();
      tail.moveTo(-.005, 0);
      tail.quadraticCurveTo(.008, .017, .02, .02);
      tail.quadraticCurveTo(.013, 0, .02, -.02);
      tail.quadraticCurveTo(.008, -.017, -.005, 0);
      const fin = mesh(new THREE.ExtrudeGeometry(tail, { depth: .005, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .0025, bevelThickness: .002 }), material, -side * .033, y - side * .009, .001);
      fin.rotation.z = side > 0 ? Math.PI : 0;
      oval(gold, side * .029, y + side * .005, .015, .0027, .003, .0019);
      curve(gold, [[-side * .008, y - .012, .009], [0, y - .018, .011], [side * .011, y - .015, .01]], .0011, 8);
    }
    oval(colored, 0, -.156, .001, .008, .013, .006);
    tassel(-.174, cord, .031);
  }
  if (id === "echo-bell") {
    pendantLoop();
    ring(gold, .011, .0025, 0, -.034);
    lathe(gold, [[.006, -.037], [.017, -.043], [.03, -.06], [.035, -.092], [.043, -.123], [.049, -.131], [.043, -.137], [.038, -.127], [.03, -.093], [.025, -.065], [.012, -.049]], .9);
    for (const y of [-.062, -.106, -.131]) {
      const edge = ring(colored, y === -.062 ? .029 : y === -.106 ? .038 : .045, .0017, 0, y);
      edge.rotation.x = Math.PI / 2;
      edge.scale.y = .9;
    }
    curve(dark, [[0, -.062, 0], [0, -.117, 0], [0, -.142, 0]], .0019, 6);
    oval(gold, 0, -.141, .003, .009, .012, .009);
    for (let index = 0; index < 7; index++) {
      const angle = index / 7 * Math.PI * 2;
      const leaf = oval(colored, Math.sin(angle) * .038, -.113, Math.cos(angle) * .034, .005, .011, .003);
      leaf.rotation.y = angle;
    }
    for (const side of [-1, 1]) curve(pale, [[0, -.096, .033], [side * .013, -.09, .036], [side * .018, -.074, .031], [side * .003, -.08, .034], [0, -.096, .033]], .0013, 12);
    curve(pale, [[0, -.095, .034], [-.006, -.08, .034], [0, -.068, .031], [.006, -.08, .034], [0, -.095, .034]], .0013, 12);
    knot(-.16);
    tassel(-.176, cord, .032);
  }

  if (id === "lotus-brooch") {
    flower(-.053, .059, colored);
    for (let index = 0; index < 5; index++) {
      const angle = index / 5 * Math.PI * 2;
      oval(pale, Math.sin(angle) * .011, -.053 + Math.cos(angle) * .011, .026, .0035, .0035, .003);
    }
    oval(jade, 0, -.053, .027, .0085, .0085, .006);
  }
  if (id === "sutra-scroll") {
    pendantLoop();
    const paper = new THREE.Shape();
    paper.moveTo(-.048, -.058);
    paper.bezierCurveTo(-.035, -.052, .029, -.056, .048, -.058);
    paper.lineTo(.048, -.127);
    paper.bezierCurveTo(.02, -.121, -.026, -.131, -.048, -.127);
    paper.closePath();
    mesh(new THREE.ExtrudeGeometry(paper, { depth: .008, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .003, bevelThickness: .002 }), pale, 0, 0, -.004);
    for (const y of [-.055, -.13]) {
      const roller = mesh(new THREE.CylinderGeometry(.007, .007, .12, 12), dark, 0, y, .002);
      roller.rotation.z = Math.PI / 2;
      for (const side of [-1, 1]) oval(gold, side * .062, y, .002, .005, .009, .009);
    }
    for (let row = 0; row < 4; row++) curve(gold, [[-.029, -.074 - row * .011, .01], [-.006, -.073 - row * .011, .011], [.024 - row % 2 * .01, -.074 - row * .011, .011]], .0011, 6);
    curve(cord, [[-.028, -.038, -.003], [0, -.029, .002], [.028, -.038, -.003]], .0018);
    oval(jade, 0, -.151, .004, .007, .011, .005);
    tassel(-.169, cord, .031);
  }
  if (id === "cloud-ruyi") {
    pendantLoop();
    const cloud = new THREE.Shape();
    cloud.moveTo(-.049, -.089);
    cloud.bezierCurveTo(-.08, -.072, -.056, -.045, -.031, -.055);
    cloud.bezierCurveTo(-.037, -.022, .014, -.025, .019, -.047);
    cloud.bezierCurveTo(.056, -.039, .078, -.077, .045, -.088);
    cloud.bezierCurveTo(.024, -.091, .025, -.107, .015, -.121);
    cloud.bezierCurveTo(.007, -.136, -.013, -.132, -.022, -.12);
    cloud.bezierCurveTo(-.03, -.101, -.025, -.091, -.049, -.089);
    mesh(new THREE.ExtrudeGeometry(cloud, { depth: .012, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .0035, bevelThickness: .003 }), colored, 0, 0, -.006);
    curve(gold, [[-.042, -.074, .011], [-.046, -.062, .012], [-.028, -.064, .012], [-.013, -.051, .013], [.004, -.045, .012], [.017, -.06, .012], [.04, -.061, .012], [.047, -.074, .011]], .0017, 18);
    curve(pale, [[-.011, -.109, .012], [0, -.093, .014], [.009, -.086, .013]], .002, 10);
    oval(jade, 0, -.15, .001, .008, .011, .006);
    knot(-.166);
    tassel(-.181, cord, .029);
  }
  if (id === "home-lantern") {
    pendantLoop();
    const glow = surface(0xe9c38a, .6, 0, { emissive: 0xd69643, emissiveIntensity: .2, clearcoat: .1 });
    oval(glow, 0, -.09, 0, .031, .04, .028);
    lathe(gold, [[0, -.042], [.018, -.044], [.028, -.047], [.043, -.053], [.04, -.058], [.02, -.06], [0, -.06]], .86);
    lathe(gold, [[0, -.125], [.025, -.123], [.033, -.129], [.029, -.136], [.018, -.14], [0, -.14]], .86);
    for (let index = 0; index < 6; index++) {
      const angle = index / 6 * Math.PI * 2;
      const x = Math.sin(angle), z = Math.cos(angle);
      curve(gold, [[x * .027, -.057, z * .024], [x * .037, -.078, z * .031], [x * .035, -.112, z * .03], [x * .025, -.13, z * .022]], .0019, 10);
    }
    const upper = ring(gold, .036, .0015, 0, -.078);
    upper.rotation.x = Math.PI / 2;
    upper.scale.y = .87;
    const lower = ring(gold, .035, .0015, 0, -.109);
    lower.rotation.x = Math.PI / 2;
    lower.scale.y = .87;
    knot(-.155);
    tassel(-.171, cord, .038);
  }

  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  ornament.children.forEach(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const parts = batches.get(object.material) ?? [];
    parts.push(object);
    batches.set(object.material, parts);
  });
  for (const [material, parts] of batches) {
    if (parts.length < 2) continue;
    const copies = parts.map(part => {
      part.updateMatrix();
      const transformed = part.geometry.clone().applyMatrix4(part.matrix);
      const copy = transformed.index ? transformed.toNonIndexed() : transformed;
      if (copy !== transformed) transformed.dispose();
      copy.deleteAttribute("uv");
      return copy;
    });
    const geometry = mergeGeometries(copies);
    copies.forEach(copy => copy.dispose());
    if (geometry) {
      parts.forEach(part => ornament.remove(part));
      mesh(geometry, material);
    }
  }
  let disposed = false;
  return {
    group,
    animate(time: number) {
      if (disposed) return;
      ornament.rotation.z = id === "lotus-brooch" ? 0 : Math.sin(time * 1.6) * .025;
      ornament.rotation.x = id === "lotus-brooch" ? 0 : Math.sin(time * 1.17) * .018;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      group.clear();
    },
  };
}
