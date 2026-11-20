import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type CatStage = "intro" | "search" | "found";
type CatHideout = "bamboo" | "eaves" | "stones";

const TAU = 2 * Math.PI;
const clamp01 = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
const easeOut = (value: number) => 1 - (1 - clamp01(value)) ** 3;

export function createTempleCatScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1.4, 0.1, 40);
  camera.position.set(2.45, 5.75, 9.8);
  camera.lookAt(0, .54, 0);

  const material = (color: number, roughness = .72, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const ochre = material(0xd88940);
  const goldenFur = material(0xf7ae59);
  const cream = material(0xffdfad);
  const stripe = material(0xad552a);
  const dark = material(0x382a28, .37);
  const earPink = material(0xe5987c);
  const eyeShine = material(0xfff1d9);
  const brass = material(0xe1a243, .33, .45);
  const gold = material(0xffcc67, .31, .31);
  const bronze = material(0x8f572e, .48, .29);
  const peach = material(0xeea18e);
  const leafSet = [material(0x497a62), material(0x628f68), material(0x8aaa70)];
  const jade = material(0x4e7b6b);
  const moss = material(0x779376);
  const creamStone = material(0xe4c7a1);
  const stoneColors = [material(0xb9bda3), material(0x929e88), material(0x7e8d84)];
  const roofColors = [material(0x284e49), material(0x385f55), material(0x477267)];
  const terracotta = material(0x8b4938);
  const endGrain = material(0x584139);
  const parchment = material(0xefdbb1);
  const floor = material(0xa4aa7e);
  const stoneEdge = material(0x687963);
  const darkEarth = material(0x495b52);
  const pawClay = material(0xbe976a);
  const stump = material(0xb38558);
  const lampGlow = new THREE.MeshStandardMaterial({
    color: 0xffd383, emissive: 0xf69b3a, emissiveIntensity: .42, roughness: .6,
  });

  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const detailSphere = new THREE.SphereGeometry(1, 10, 7);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const torus = new THREE.TorusGeometry(1, .105, 6, 22);
  const alternateRock = new THREE.IcosahedronGeometry(1, 1);
  const twig = new THREE.CylinderGeometry(1, 1, 1, 9);
  const geometries = new Set<THREE.BufferGeometry>([sphere, detailSphere, box, torus, alternateRock, twig]);
  const materials = new Set<THREE.Material>([
    ochre, goldenFur, cream, stripe, dark, earPink, eyeShine, brass, gold, bronze, peach,
    ...leafSet, jade, moss, creamStone, ...stoneColors, ...roofColors, terracotta,
    endGrain, parchment, floor, stoneEdge, darkEarth, pawClay, stump, lampGlow,
  ]);

  function mesh(geometry: THREE.BufferGeometry, surface: THREE.Material, parent: THREE.Object3D) {
    geometries.add(geometry);
    materials.add(surface);
    const object = new THREE.Mesh(geometry, surface);
    parent.add(object);
    return object;
  }

  function ellipsoid(parent: THREE.Object3D, surface: THREE.Material, x: number, y: number, z: number, rx: number, ry: number, rz: number) {
    const object = mesh(Math.max(rx, ry, rz) >= .18 ? sphere : detailSphere, surface, parent);
    object.position.set(x, y, z);
    object.scale.set(rx, ry, rz);
    return object;
  }

  function block(parent: THREE.Object3D, surface: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
    const object = mesh(box, surface, parent);
    object.position.set(x, y, z);
    object.scale.set(w, h, d);
    return object;
  }

  function tube(parent: THREE.Object3D, surface: THREE.Material, points: THREE.Vector3[], radius: number, segments = 12) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 7, false), surface, parent);
  }

  function branch(parent: THREE.Object3D, surface: THREE.Material, from: THREE.Vector3, to: THREE.Vector3, radius: number) {
    const object = mesh(twig, surface, parent);
    const along = to.clone().sub(from);
    object.position.copy(from).lerp(to, .5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), along.clone().normalize());
    object.scale.set(radius, along.length(), radius);
    return object;
  }

  function shadow(parent: THREE.Object3D, x: number, z: number, rx: number, rz: number, opacity: number) {
    const surface = new THREE.MeshBasicMaterial({
      color: 0x263d35, transparent: true, opacity, depthWrite: false,
    });
    const object = mesh(new THREE.CircleGeometry(1, 24), surface, parent);
    object.position.set(x, .014, z);
    object.rotation.x = -Math.PI / 2;
    object.scale.set(rx, rz, 1);
    return object;
  }

  function roundedIsland(width: number, depth: number, thickness: number, bevel: number, top: number, side: THREE.Material, face = side) {
    const w = width / 2, d = depth / 2, r = .92;
    const form = new THREE.Shape();
    form.moveTo(-w + r, -d);
    form.lineTo(w - r, -d);
    form.quadraticCurveTo(w, -d, w, -d + r);
    form.lineTo(w, d - r);
    form.quadraticCurveTo(w, d, w - r, d);
    form.lineTo(-w + r, d);
    form.quadraticCurveTo(-w, d, -w, d - r);
    form.lineTo(-w, -d + r);
    form.quadraticCurveTo(-w, -d, -w + r, -d);
    const geometry = new THREE.ExtrudeGeometry(form, {
      depth: thickness, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
      bevelSegments: 2, curveSegments: 7, steps: 1,
    });
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, [face, side]);
    object.rotation.x = -Math.PI / 2;
    object.position.y = top - thickness - bevel;
    scene.add(object);
  }

  // Stacked, rounded edges keep the courtyard miniature readable against the sheet.
  shadow(scene, .13, .32, 4.35, 3.0, .20).position.y = -.56;
  roundedIsland(7.63, 5.33, .25, .10, -.22, darkEarth);
  roundedIsland(7.72, 5.43, .14, .085, -.07, stoneEdge);
  roundedIsland(7.75, 5.50, .065, .045, 0, moss, floor);

  const steppingStones = [
    [-.20, 2.32, 1.14, .42, .05], [-.27, 1.69, 1.07, .49, -.04],
    [-.39, 1.06, 1.15, .54, -.10], [-.39, .31, 1.21, .52, .02],
    [-.31, -.36, 1.19, .51, .09], [-.24, -1, 1.25, .50, .03],
    [.56, 1.13, .50, .29, -.39], [1.20, 1.35, .53, .32, -.41],
    [-1.14, .87, .56, .35, .42], [-1.75, .55, .56, .31, .52],
  ];
  steppingStones.forEach(([x, z, w, d, angle], index) => {
    const paver = ellipsoid(scene, index % 3 === 0 ? stoneColors[0] : creamStone, x, .01, z, w / 2, .042, d / 2);
    paver.rotation.y = angle;
  });

  function putFlower(x: number, z: number, size: number, tint: THREE.Material, phase: number) {
    const flower = new THREE.Group();
    flower.position.set(x, .03, z);
    flower.scale.setScalar(size);
    scene.add(flower);
    branch(flower, jade, new THREE.Vector3(), new THREE.Vector3(.05, .24, 0), .016);
    const leaf = ellipsoid(flower, leafSet[1], -.04, .12, .02, .07, .021, .04);
    leaf.rotation.z = -.48;
    for (let i = 0; i < 5; i++) {
      const angle = i * TAU / 5 + phase;
      const petal = ellipsoid(flower, tint, .05 + Math.cos(angle) * .065, .245, Math.sin(angle) * .065, .065, .027, .04);
      petal.rotation.y = -angle;
    }
    ellipsoid(flower, gold, .05, .266, 0, .035, .021, .035);
  }

  [
    [-3.29, 1.68, .75], [-3.02, 2.05, .86], [-2.67, 1.94, 1],
    [2.95, 1.63, .89], [3.21, 1.17, .82], [2.52, 2.1, .68],
    [3.4, -.17, .82], [3.23, -.51, .68], [-1.92, -2.3, .72],
  ].forEach(([x, z, size], index) => putFlower(x, z, size, index % 2 === 0 ? peach : parchment, index * 1.7));

  const bamboo = new THREE.Group();
  bamboo.position.set(-2.36, 0, -.64);
  scene.add(bamboo);
  shadow(bamboo, .16, .08, 1.10, .57, .20);
  const bambooCrowns: THREE.Group[] = [];
  [
    [-.53, -.04, 1.78, -.11], [-.18, -.33, 2.36, -.07],
    [.25, -.19, 2.13, .07], [.61, .09, 1.62, .15], [-.06, .31, 1.47, .02],
  ].forEach(([x, z, h, lean], stalk) => {
    const stems = new THREE.Group();
    stems.position.set(x, 0, z);
    stems.rotation.z = lean;
    bamboo.add(stems);
    branch(stems, leafSet[stalk % 3], new THREE.Vector3(), new THREE.Vector3(0, h, 0), .044);
    const rings = Math.round(h / .28);
    for (let i = 1; i <= rings; i++) {
      const collar = mesh(torus, leafSet[(stalk + 1) % 3], stems);
      collar.position.y = i * h / (rings + .3);
      collar.rotation.x = -Math.PI / 2;
      collar.scale.setScalar(.048);
    }
    const crown = new THREE.Group();
    crown.position.y = h * .53;
    stems.add(crown);
    bambooCrowns.push(crown);
    for (let fan = 0; fan < 3; fan++) {
      const side = (fan + stalk) % 2 === 0 ? -1 : 1;
      const start = new THREE.Vector3(0, h * (.04 + fan * .17), 0);
      const end = start.clone().add(new THREE.Vector3(side * (.40 - fan * .045), .22, fan * .12 - .13));
      branch(crown, jade, start, end, .016);
      for (let i = 0; i < 4; i++) {
        const point = start.clone().lerp(end, .45 + i * .17);
        const leaf = ellipsoid(crown, leafSet[(fan + i + stalk) % 3], point.x + side * .08, point.y - i * .006, point.z + (i % 2 === 0 ? -.08 : .08), .20 - i * .014, .026, .058);
        leaf.rotation.set(.12 * (i - 1), (i % 2 === 0 ? .43 : -.57) * side, side * (.25 - i * .23));
      }
    }
  });

  const hall = new THREE.Group();
  hall.position.set(.88, 0, -1.54);
  scene.add(hall);
  shadow(hall, 0, .2, 1.5, .82, .26);
  block(hall, stoneColors[0], 0, .11, 0, 2.19, .20, 1.56);
  block(hall, creamStone, 0, .22, 0, 2.03, .12, 1.45);
  block(hall, creamStone, 0, .105, .84, .86, .18, .30);
  block(hall, stoneColors[0], 0, .053, 1.02, 1.04, .10, .24);
  block(hall, parchment, 0, .77, -.57, 1.91, 1.05, .13);
  block(hall, terracotta, 0, .71, -.48, .69, .88, .055);
  block(hall, endGrain, 0, .70, -.436, .024, .87, .02);
  for (const x of [-.23, .23]) {
    ellipsoid(hall, brass, x * .33, .77, -.40, .031, .038, .027);
    for (let vertical = 0; vertical < 4; vertical++) {
      block(hall, endGrain, x + (vertical - 1.5) * .066, 1.01, -.425, .016, .25, .024);
    }
    block(hall, endGrain, x, 1.01, -.409, .30, .019, .023);
  }
  for (const x of [-.90, .90]) {
    for (const z of [-.57, .55]) {
      block(hall, stoneColors[1], x, .27, z, .24, .16, .24);
      branch(hall, terracotta, new THREE.Vector3(x, .30, z), new THREE.Vector3(x, 1.38, z), .076);
      block(hall, endGrain, x, 1.29, z, .26, .09, .24);
      block(hall, jade, x, 1.22, z, .17, .085, .15);
    }
    block(hall, parchment, x, .55, -.22, .11, .53, .63);
  }
  block(hall, terracotta, 0, 1.31, .55, 1.96, .14, .15);
  block(hall, endGrain, 0, 1.19, .638, .61, .16, .10);
  block(hall, bronze, 0, 1.19, .695, .49, .075, .018);

  // Separate ceramic ribs follow an upturned roof silhouette.
  function roofY(x: number, t: number) {
    return 1.43 + .60 * (1 - t) ** 1.68 + .115 * Math.abs(x / 1.36) ** 6 * t + .075 * t ** 7;
  }
  const roofPositions: number[] = [];
  const roofIndices: number[] = [];
  const columns = 18, rows = 10;
  for (let i = 0; i <= columns; i++) {
    const x = (i / columns * 2 - 1) * 1.34;
    for (let j = 0; j <= rows; j++) {
      const z = (j / rows * 2 - 1) * .95;
      roofPositions.push(x, roofY(x, Math.abs(z / .95)), z);
      if (i < columns && j < rows) {
        const a = i * (rows + 1) + j;
        const b = a + rows + 1;
        roofIndices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const roof = new THREE.BufferGeometry();
  roof.setAttribute("position", new THREE.Float32BufferAttribute(roofPositions, 3));
  roof.setIndex(roofIndices);
  roof.computeVertexNormals();
  mesh(roof, roofColors[0], hall);
  for (let i = 0; i <= columns; i++) {
    const x = (i / columns * 2 - 1) * 1.34;
    for (const sign of [-1, 1]) {
      const roofPoints = Array.from({ length: 5 }, (_, j) => {
        const t = j / 4;
        return new THREE.Vector3(x, roofY(x, t) + .027, sign * t * .97);
      });
      tube(hall, roofColors[(i % 2) + 1], roofPoints, .034, 8);
      ellipsoid(hall, roofColors[i % 2 + 1], x, roofY(x, 1) + .012, sign * .977, .043, .039, .05);
    }
  }
  const ridge = Array.from({ length: 9 }, (_, i) => {
    const x = (i / 4 - 1) * 1.41;
    return new THREE.Vector3(x, 2.045 + .128 * Math.abs(x / 1.41) ** 6, 0);
  });
  tube(hall, roofColors[1], ridge, .054, 14);
  tube(hall, bronze, ridge.map(point => point.clone().add(new THREE.Vector3(0, .035, .018))), .018, 14);
  for (const side of [-1, 1]) {
    ellipsoid(hall, roofColors[2], side * 1.32, 2.25, 0, .080, .10, .075);
    ellipsoid(hall, gold, side * 1.32, 2.32, 0, .043, .052, .043);
  }
  const lanterns: THREE.Group[] = [];
  for (const x of [-.68, .68]) {
    const lantern = new THREE.Group();
    lantern.position.set(x, 1.29, .67);
    hall.add(lantern);
    lanterns.push(lantern);
    branch(lantern, bronze, new THREE.Vector3(), new THREE.Vector3(0, -.14, 0), .012);
    ellipsoid(lantern, lampGlow, 0, -.20, 0, .114, .126, .106);
    for (const y of [-.096, -.305]) ellipsoid(lantern, terracotta, 0, y, 0, .087, .027, .081);
    branch(lantern, terracotta, new THREE.Vector3(0, -.304, 0), new THREE.Vector3(0, -.385, 0), .015);
    for (let i = 0; i < 5; i++) {
      const angle = i * TAU / 5;
      tube(lantern, bronze, [0, 1, 2].map(j => {
        const r = j === 1 ? .113 : .05;
        return new THREE.Vector3(Math.cos(angle) * r, -.106 - j * .096, Math.sin(angle) * r);
      }), .011, 5);
    }
  }

  const stones = new THREE.Group();
  stones.position.set(2.28, 0, 1.02);
  scene.add(stones);
  shadow(stones, .09, .05, 1.21, .68, .22);
  [
    [-.51, .23, .07, .59, .26, .41, -.33], [.07, .38, -.12, .72, .43, .52, .28],
    [.66, .19, -.16, .45, .25, .40, -.37], [.53, .17, .49, .47, .18, .34, .25],
    [-.31, .13, .54, .31, .14, .25, .17],
  ].forEach(([x, y, z, rx, ry, rz, yaw], index) => {
    const crag = mesh(alternateRock, stoneColors[index % 3], stones);
    crag.position.set(x, y, z);
    crag.scale.set(rx, ry, rz);
    crag.rotation.set(yaw * .22, yaw, yaw * .27);
    if (index < 4) ellipsoid(stones, moss, x + .05, y + ry * .78, z - .02, rx * .61, .039, rz * .68);
  });
  block(stones, stoneColors[2], .70, .15, -.49, .49, .30, .45);
  block(stones, stoneColors[0], .70, .34, -.49, .42, .11, .41);
  block(stones, lampGlow, .70, .51, -.49, .26, .28, .26);
  for (const x of [.53, .87]) for (const z of [-.66, -.32]) {
    block(stones, stoneColors[2], x, .52, z, .075, .28, .075);
  }
  const stoneRoof = mesh(new THREE.CylinderGeometry(.09, .34, .21, 4), stoneColors[1], stones);
  stoneRoof.position.set(.70, .73, -.49);
  stoneRoof.rotation.y = Math.PI / 4;
  ellipsoid(stones, stoneColors[2], .70, .874, -.49, .102, .083, .097);

  const bellStand = new THREE.Group();
  bellStand.position.set(-.28, 0, 1.0);
  scene.add(bellStand);
  shadow(bellStand, 0, .01, .49, .30, .24);
  const stand = mesh(new THREE.CylinderGeometry(.225, .31, .25, 14), stump, bellStand);
  stand.position.y = .125;
  ellipsoid(bellStand, creamStone, 0, .27, 0, .24, .044, .23);
  for (const size of [.28, .18]) {
    const rim = mesh(torus, endGrain, bellStand);
    rim.position.y = size > .2 ? .072 : .289;
    rim.rotation.x = -Math.PI / 2;
    rim.scale.setScalar(size);
  }

  const bell = new THREE.Group();
  scene.add(bell);
  const bellProfile = [
    [.002, .30], [.072, .30], [.107, .266], [.118, .212], [.133, .132],
    [.164, .055], [.198, .017], [.202, 0], [.177, 0], [.139, .044],
    [.106, .14], [.087, .223], [.066, .262], [.002, .262],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  mesh(new THREE.LatheGeometry(bellProfile, 28), brass, bell);
  for (const [y, r] of [[.061, .16], [.015, .192], [.225, .114]]) {
    const band = mesh(torus, gold, bell);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    band.scale.setScalar(r);
  }
  const grip = mesh(torus, bronze, bell);
  grip.scale.setScalar(.062);
  grip.position.y = .331;
  ellipsoid(bell, bronze, 0, -.033, 0, .049, .051, .049);
  for (let i = 0; i < 7; i++) {
    const angle = TAU * i / 7;
    const lotus = ellipsoid(bell, gold, .142 * Math.cos(angle), .119, .142 * Math.sin(angle), .011, .036, .022);
    lotus.rotation.y = -angle;
  }

  const cat = new THREE.Group();
  const body = new THREE.Group();
  const paws: THREE.Mesh[] = [];
  scene.add(cat);
  cat.add(body);
  const catShadow = shadow(scene, 0, 0, .52, .36, .24);
  ellipsoid(body, ochre, 0, .44, -.10, .324, .322, .475);
  ellipsoid(body, goldenFur, 0, .47, -.30, .310, .292, .253);
  ellipsoid(body, cream, 0, .425, .24, .237, .27, .164);
  for (const side of [-1, 1]) {
    ellipsoid(body, ochre, side * .20, .24, -.30, .16, .202, .19);
    paws.push(ellipsoid(body, cream, side * .215, .105, -.35, .122, .079, .143));
    paws.push(ellipsoid(body, cream, side * .169, .115, .25, .105, .085, .145));
    for (const [z, y] of [[-.30, .53], [-.12, .58], [.045, .57]]) {
      const furMark = ellipsoid(body, stripe, side * .292, y, z, .027, .077, .045);
      furMark.rotation.set(.38, side * -.14, side * -.28);
    }
  }
  const tail = new THREE.Group();
  tail.position.set(.03, .46, -.43);
  body.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(), new THREE.Vector3(.19, .09, -.23), new THREE.Vector3(.35, .30, -.33),
    new THREE.Vector3(.43, .57, -.29), new THREE.Vector3(.33, .68, -.22),
  ]);
  mesh(new THREE.TubeGeometry(tailCurve, 22, .081, 9, false), goldenFur, tail);
  for (const pos of [.34, .56, .79]) {
    const ring = mesh(torus, stripe, tail);
    ring.position.copy(tailCurve.getPoint(pos));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tailCurve.getTangent(pos).normalize());
    ring.scale.setScalar(.076);
  }
  ellipsoid(tail, cream, .33, .68, -.22, .082, .086, .079);

  const head = new THREE.Group();
  head.position.set(0, .72, .30);
  body.add(head);
  ellipsoid(head, goldenFur, 0, 0, 0, .389, .327, .307);
  ellipsoid(head, cream, 0, -.17, .19, .295, .156, .129);
  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * .251, .224, -.006);
    ear.rotation.z = -side * .32;
    head.add(ear);
    const earShape = new THREE.Shape();
    earShape.moveTo(-.133, -.028);
    earShape.quadraticCurveTo(-.142, .061, -.027, .26);
    earShape.quadraticCurveTo(.003, .318, .039, .258);
    earShape.quadraticCurveTo(.142, .106, .128, -.025);
    earShape.quadraticCurveTo(.008, -.098, -.133, -.028);
    const earGeo = new THREE.ExtrudeGeometry(earShape, {
      depth: .075, bevelEnabled: true, bevelSegments: 3, bevelSize: .026,
      bevelThickness: .025, curveSegments: 9, steps: 1,
    });
    mesh(earGeo, ochre, ear);
    const lining = mesh(earGeo, earPink, ear);
    lining.position.set(0, .009, .078);
    lining.scale.set(.67, .70, .22);
    ellipsoid(head, cream, side * .103, -.115, .264, .133, .103, .076);
    ellipsoid(head, peach, side * .244, -.112, .229, .067, .030, .021);
    const eye = new THREE.Group();
    eye.position.set(side * .175, .024, .261);
    eye.rotation.y = side * .24;
    head.add(eye);
    eyes.push(eye);
    ellipsoid(eye, dark, 0, 0, 0, .062, .078, .028);
    ellipsoid(eye, eyeShine, -.013, .024, .027, .022, .024, .014);
    ellipsoid(eye, eyeShine, .019, -.019, .026, .010, .011, .008);
    for (const n of [-1, 0, 1]) {
      const height = -.11 + n * .029;
      tube(head, cream, [
        new THREE.Vector3(side * .175, height, .302),
        new THREE.Vector3(side * .286, height + n * .014, .29),
        new THREE.Vector3(side * .406, height + n * .031, .239),
      ], .0068, 6);
    }
    const angleStripe = ellipsoid(head, stripe, side * .275, .118, .193, .035, .067, .022);
    angleStripe.rotation.z = side * -.54;
    const cheekStripe = ellipsoid(head, stripe, side * .316, .067, .162, .030, .059, .025);
    cheekStripe.rotation.z = side * -.72;
    tube(head, stripe, [
      new THREE.Vector3(0, -.144, .33),
      new THREE.Vector3(side * .051, -.18, .333),
      new THREE.Vector3(side * .103, -.165, .327),
    ], .008, 7);
  }
  ellipsoid(head, earPink, 0, -.104, .337, .059, .034, .030);
  ellipsoid(head, stripe, 0, .241, .184, .035, .074, .021).rotation.x = .54;
  for (const side of [-1, 1]) ellipsoid(head, stripe, side * .082, .224, .199, .028, .061, .017).rotation.z = side * -.27;

  const landmarks = {
    bamboo: new THREE.Vector3(-2.38, 1.25, .31),
    eaves: new THREE.Vector3(.95, 1.85, -.70),
    stones: new THREE.Vector3(2.05, .81, 1.27),
  } satisfies Record<CatHideout, THREE.Vector3>;
  const hidingPlaces: Record<CatHideout, THREE.Vector3> = {
    bamboo: new THREE.Vector3(-2.15, 0, .47),
    eaves: new THREE.Vector3(.87, 0, -.43),
    stones: new THREE.Vector3(1.81, 0, 1.84),
  };

  const pawPaths: Record<CatHideout, THREE.Group> = {
    bamboo: new THREE.Group(), eaves: new THREE.Group(), stones: new THREE.Group(),
  };
  const glints: Record<CatHideout, THREE.Group> = {
    bamboo: new THREE.Group(), eaves: new THREE.Group(), stones: new THREE.Group(),
  };
  for (const key of Object.keys(hidingPlaces) as CatHideout[]) {
    const pawPath = pawPaths[key];
    scene.add(pawPath);
    const destination = hidingPlaces[key];
    const trail = new THREE.Vector3(-.04, .077, 1.44);
    for (let i = 1; i <= 4; i++) {
      const point = trail.clone().lerp(destination.clone().setY(.077), .30 + i * .125);
      point.x += i % 2 === 0 ? .078 : -.078;
      ellipsoid(pawPath, pawClay, point.x, point.y, point.z, .088, .022, .068);
      for (let toe = -1; toe <= 1; toe++) {
        ellipsoid(pawPath, pawClay, point.x + toe * .054, point.y, point.z - .086 + Math.abs(toe) * .023, .029, .018, .033);
      }
    }
    const sparks = glints[key];
    sparks.position.copy(destination);
    sparks.position.y = key === "eaves" ? .85 : .43;
    scene.add(sparks);
    for (let i = 0; i < 4; i++) {
      const spark = mesh(new THREE.OctahedronGeometry(.047 + i * .009), gold, sparks);
      spark.position.set(Math.cos(i * 2.8) * .31, .12 + i * .13, Math.sin(i * 2.8) * .28);
      spark.scale.y = 1.4;
    }
  }

  scene.add(new THREE.HemisphereLight(0xffefd9, 0x466759, 2.1));
  const sunlight = new THREE.DirectionalLight(0xffe1b9, 2.25);
  sunlight.position.set(-3.8, 6, 3.2);
  scene.add(sunlight);
  const rim = new THREE.DirectionalLight(0xd2ece8, 1.1);
  rim.position.set(3.4, 3.5, -4);
  scene.add(rim);

  // Bake fixed ornamentation into material batches. Only the poses, props and clues
  // that actually change remain separately movable; all original models stay lightweight.
  const movable = new Set<THREE.Object3D>([
    cat, body, head, catShadow, tail, bell, ...paws, ...eyes, ...bambooCrowns, ...lanterns,
    ...Object.values(pawPaths), ...Object.values(glints), ...Object.values(glints).flatMap(group => group.children),
  ]);
  function batch(root: THREE.Object3D) {
    root.updateWorldMatrix(true, true);
    const inverseRoot = root.matrixWorld.clone().invert();
    const buckets = new Map<THREE.Material, THREE.Mesh[]>();
    function collect(parent: THREE.Object3D) {
      for (const child of parent.children) {
        if (movable.has(child)) continue;
        if (child instanceof THREE.Mesh && !Array.isArray(child.material) && !child.material.transparent) {
          let group = buckets.get(child.material);
          if (!group) buckets.set(child.material, group = []);
          group.push(child);
        }
        collect(child);
      }
    }
    collect(root);
    for (const [surface, group] of buckets) {
      if (group.length < 2) continue;
      const parts = group.map(object => {
        const geometry = object.geometry.clone();
        geometry.deleteAttribute("uv");
        if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.getAttribute("position").count }, (_, index) => index));
        return geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld));
      });
      const geometry = mergeGeometries(parts);
      for (const part of parts) part.dispose();
      if (!geometry) continue;
      mesh(geometry, surface, root);
      for (const child of group) child.removeFromParent();
    }
  }
  batch(scene);
  for (const dynamic of movable) if (!(dynamic instanceof THREE.Mesh)) batch(dynamic);
  const activeGeometries = new Set<THREE.BufferGeometry>();
  scene.traverse(object => {
    if (object instanceof THREE.Mesh) activeGeometries.add(object.geometry);
  });
  for (const geometry of geometries) {
    if (activeGeometries.has(geometry)) continue;
    geometry.dispose();
    geometries.delete(geometry);
  }

  const mouth = new THREE.Vector3(0, -.163, .365);
  const worldMouth = new THREE.Vector3();
  const start = new THREE.Vector3(-1.04, 0, -.12);
  const pickup = new THREE.Vector3(-.28, 0, .27);
  // The cat vanishes among the bamboo; the intro never gives away the daily answer.
  const escape = new THREE.Vector3(-2.27, 0, -.83);
  const peek = new THREE.Vector3();
  const look = new THREE.Vector3();

  function update(stage: CatStage, seconds: number, hideout: CatHideout, inspected: readonly CatHideout[], reducedMotion = false) {
    const t = reducedMotion ? 0 : seconds;
    const destination = hidingPlaces[hideout];
    const revealed = stage === "found";
    const running = stage === "intro" && !reducedMotion;
    cat.visible = revealed || stage === "intro" && t < 2.54;
    bell.visible = cat.visible;
    catShadow.visible = cat.visible;
    body.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    body.position.set(0, 0, 0);
    cat.scale.setScalar(1);
    tail.rotation.y = Math.sin(t * 4.1) * .17;

    if (stage === "intro") {
      if (t < .77) {
        cat.position.copy(start).lerp(pickup, easeOut(t / .77));
        cat.rotation.y = .75 * (1 - easeOut(t / .70));
      } else {
        const run = easeOut((t - .77) / 2.08);
        cat.position.copy(pickup).lerp(escape, run);
        cat.position.z += Math.sin(run * Math.PI) * .31;
        look.copy(escape).sub(cat.position);
        cat.rotation.y = Math.atan2(look.x, look.z) * easeOut((t - .77) / .31);
        cat.scale.setScalar(1 - .65 * easeOut((t - 1.72) / .82));
      }
      head.rotation.x = t > .32 && t < .77 ? .15 * Math.sin((t - .32) / .45 * Math.PI) : 0;
      cat.position.y = running ? .08 * Math.abs(Math.sin(t * 16)) : 0;
    } else if (revealed) {
      const reveal = reducedMotion ? 1 : easeOut(t / .51);
      peek.copy(destination);
      peek.x = THREE.MathUtils.lerp(destination.x, 0, .12);
      peek.z += .17;
      cat.position.copy(destination).lerp(peek, reveal);
      cat.rotation.y = .13 - destination.x * .09;
      const roll = reducedMotion ? 0 : Math.sin(clamp01((t - .74) / 1.20) * Math.PI);
      body.rotation.z = -1.13 * roll;
      body.position.y = .38 * roll + .13 * Math.sin(reveal * Math.PI);
      head.rotation.z = .17 * Math.sin(t * 3.4);
    } else {
      cat.position.copy(destination);
    }

    for (let i = 0; i < paws.length; i++) {
      const pace = running ? Math.sin(t * 19 + i * Math.PI * .72) : 0;
      paws[i].position.y = (i % 2 === 0 ? .105 : .115) + .108 * Math.max(0, pace);
      paws[i].rotation.x = pace * .34;
    }
    const blink = t % 3.6 > 3.39 ? .19 : 1;
    for (const eye of eyes) eye.scale.y = blink;
    catShadow.position.x = cat.position.x + .04;
    catShadow.position.z = cat.position.z - .12;
    if (stage === "intro" && t < .63) {
      bell.position.set(-.28, .316, .97);
      bell.rotation.set(.06, -.3, .06);
    } else if (revealed) {
      bell.position.copy(cat.position).add(new THREE.Vector3(.51, .066, .26));
      bell.rotation.set(.01, .38, .11 + Math.sin(t * 13) * .21 * Math.max(0, 1 - t));
    } else {
      head.updateWorldMatrix(true, false);
      worldMouth.copy(mouth).applyMatrix4(head.matrixWorld);
      bell.position.copy(worldMouth);
      bell.position.y -= .32;
      bell.rotation.set(-.17 + Math.sin(t * 16) * .13, cat.rotation.y, Math.sin(t * 16) * .18);
    }

    bambooCrowns.forEach((crown, index) => {
      crown.rotation.z = Math.sin(t * (hideout === "bamboo" && stage === "search" ? 4.3 : 1.6) + index * .77) * .050;
      crown.rotation.y = Math.sin(t * 1.85 + index) * .048;
    });
    lanterns.forEach((lantern, index) => {
      lantern.rotation.z = Math.sin(t * (hideout === "eaves" && stage === "search" ? 4.0 : 1.6) + index * .4) * .063;
    });
    lampGlow.emissiveIntensity = .40 + .10 * Math.sin(t * 2.7);
    for (const key of Object.keys(hidingPlaces) as CatHideout[]) {
      const correct = key === hideout;
      pawPaths[key].visible = correct && (stage === "search" ? inspected.length > 0 : revealed);
      const cluster = glints[key];
      cluster.visible = correct && (revealed || stage === "search" && (inspected.length > 0 || reducedMotion || t % 2.9 < .73));
      for (let i = 0; i < cluster.children.length; i++) {
        const spark = cluster.children[i];
        spark.rotation.set(t * 1.6 + i * .26, t * 2.2 + i, .25);
        spark.scale.setScalar(.52 + .48 * (.5 + .5 * Math.sin(t * 5.2 + i)));
      }
    }
  }

  function dispose() {
    scene.clear();
    for (const geometry of geometries) geometry.dispose();
    for (const surface of materials) surface.dispose();
  }

  update("intro", 0, "bamboo", []);
  return { scene, camera, hotspots: landmarks, update, dispose };
}
