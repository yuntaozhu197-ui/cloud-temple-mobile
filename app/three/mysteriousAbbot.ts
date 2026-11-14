import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

type AbbotMode = "idle" | "greeting" | "blessing" | "chant";

function createCraftedModel(name: string) {
  const group = new THREE.Group();
  group.name = name;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  geometries.add(sphere);

  function surface(color: number, roughness = .9, glow = 0) {
    const result = new THREE.MeshStandardMaterial({ color, roughness, emissive: glow ? color : 0, emissiveIntensity: glow });
    materials.add(result);
    return result;
  }
  function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  function oval(parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const result = mesh(parent, sphere, material, x, y, z);
    result.scale.set(sx, sy, sz);
    return result;
  }
  function curve(parent: THREE.Object3D, material: THREE.Material, points: number[][], radius: number) {
    const path = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    return mesh(parent, new THREE.TubeGeometry(path, 12, radius, 5, false), material);
  }
  // Static sculpture details are merged by material to keep mobile draw calls small.
  function mergeStatic(parent: THREE.Group) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...parent.children]) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
      const batch = batches.get(child.material) ?? [];
      batch.push(child);
      batches.set(child.material, batch);
    }
    for (const [material, parts] of batches) {
      if (parts.length < 2) continue;
      const copies = parts.map(part => {
        part.updateMatrix();
        const source = part.geometry.clone().applyMatrix4(part.matrix);
        const copy = source.index ? source.toNonIndexed() : source;
        if (copy !== source) source.dispose();
        copy.deleteAttribute("uv");
        return copy;
      });
      const geometry = mergeGeometries(copies);
      copies.forEach(copy => copy.dispose());
      if (!geometry) continue;
      parts.forEach(part => parent.remove(part));
      mesh(parent, geometry, material);
    }
  }
  return {
    group, mesh, oval, curve, surface, mergeStatic,
    dispose() {
      group.removeFromParent();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      group.clear();
    },
  };
}

function createPetalGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  const rows = 10;
  const columns = 6;
  for (let layer = 0; layer < 2; layer++) for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const width = Math.pow(Math.sin(Math.PI * t), .8) * .43;
    for (let column = 0; column <= columns; column++) {
      const across = column / columns * 2 - 1;
      positions.push(across * width, t, -.33 * t * t + .13 * (1 - across * across) * Math.sin(Math.PI * t) + (layer ? -.025 : .025) * Math.sin(Math.PI * t));
    }
  }
  const layerSize = (rows + 1) * (columns + 1);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const a = row * (columns + 1) + column;
    const b = a + columns + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
    indices.push(a + layerSize, b + layerSize, a + 1 + layerSize, a + 1 + layerSize, b + layerSize, b + 1 + layerSize);
  }
  for (let row = 0; row < rows; row++) {
    const left = row * (columns + 1);
    const right = left + columns;
    const nextLeft = left + columns + 1;
    const nextRight = right + columns + 1;
    indices.push(left, nextLeft, left + layerSize, nextLeft, nextLeft + layerSize, left + layerSize);
    indices.push(right, right + layerSize, nextRight, nextRight, right + layerSize, nextRight + layerSize);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A warm, hand-sculpted elder. Forward is +Z and his sandals rest on y=0. */
export function createMysteriousAbbot() {
  const model = createCraftedModel("云隐住持 · 明晦禅师");
  const { group, mesh, oval, curve, surface } = model;
  const linen = surface(0xc5b38f);
  const robe = surface(0x88624c);
  const kashaya = surface(0xa4654c);
  const stitching = surface(0xc49b69);
  const skin = surface(0xe1bb95, .83);
  const skinShadow = surface(0xb98e70);
  const hair = surface(0xe3dfca);
  const ink = surface(0x544c42);
  const wood = surface(0x685440, .76);
  const brass = surface(0xb39b65, .52);
  const light = surface(0xe7c57a, .65, .5);
  const rose = surface(0xc58974);
  const petalGeometry = createPetalGeometry();

  const feet = new THREE.Group();
  group.add(feet);
  for (const side of [-1, 1]) {
    oval(feet, wood, side * .135, .038, .035, .103, .036, .15);
    oval(feet, linen, side * .135, .072, -.008, .083, .063, .105);
  }
  model.mergeStatic(feet);

  const body = new THREE.Group();
  body.name = "abbot-bowing-rig";
  body.position.y = .65;
  group.add(body);
  const silhouette = [[0, -.57], [.26, -.57], [.315, -.54], [.325, -.43], [.31, -.1], [.27, .26], [.21, .35], [0, .37]];
  const hem = mesh(body, new THREE.LatheGeometry(silhouette.map(([r, y]) => new THREE.Vector2(r, y)), 32), robe);
  hem.scale.z = .78;
  oval(body, robe, 0, .15, 0, .3, .31, .22);
  oval(body, linen, 0, .385, .018, .17, .068, .13);
  for (const side of [-1, 1]) {
    curve(body, linen, [[side * .16, .38, .075], [side * .07, .29, .184], [0, .21, .224]], .014);
  }
  // Curved front drapery follows the robe surface, including the patchwork seams.
  function drapePoint(u: number, v: number) {
    const x = -.235 + u * .495 + v * .025;
    const y = .315 - v * .81 - u * .12;
    const radius = .31 - Math.max(0, y) * .16;
    const z = Math.sqrt(Math.max(.006, radius * radius - x * x)) * .78 + .025;
    return [x, y, z];
  }
  const drapeVertices: number[] = [];
  const drapeIndices: number[] = [];
  const drapeRows = 16;
  const drapeColumns = 10;
  for (let row = 0; row <= drapeRows; row++) for (let column = 0; column <= drapeColumns; column++) drapeVertices.push(...drapePoint(column / drapeColumns, row / drapeRows));
  for (let row = 0; row < drapeRows; row++) for (let column = 0; column < drapeColumns; column++) {
    const a = row * (drapeColumns + 1) + column;
    const b = a + drapeColumns + 1;
    drapeIndices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const drapeGeometry = new THREE.BufferGeometry();
  drapeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(drapeVertices, 3));
  drapeGeometry.setIndex(drapeIndices);
  drapeGeometry.computeVertexNormals();
  kashaya.side = THREE.DoubleSide;
  mesh(body, drapeGeometry, kashaya);
  for (const u of [0, .34, .68, 1]) curve(body, stitching, [0, .2, .4, .6, .8, 1].map(v => { const [x, y, z] = drapePoint(u, v); return [x, y, z + .006]; }), .0038);
  for (const v of [0, .24, .49, .74, 1]) curve(body, stitching, [0, .2, .4, .6, .8, 1].map(u => { const [x, y, z] = drapePoint(u, v); return [x, y, z + .006]; }), .0038);
  oval(body, brass, -.2, .282, .16, .027, .027, .012);
  for (let index = 0; index < 23; index++) {
    const angle = index / 23 * Math.PI * 2;
    oval(body, wood, Math.sin(angle) * .218, .2 + Math.cos(angle) * .2, .19 + Math.sin(angle) ** 2 * .07, .025, .029, .025);
  }
  oval(body, wood, 0, -.043, .27, .03, .043, .026);
  curve(body, stitching, [[0, -.065, .27], [0, -.11, .268], [.012, -.15, .26]], .004);

  const head = new THREE.Group();
  head.name = "abbot-gentle-face";
  head.position.set(0, .662, .012);
  body.add(head);
  oval(head, skin, 0, -.005, 0, .269, .298, .244);
  for (const side of [-1, 1]) {
    oval(head, skin, side * .266, -.025, -.006, .062, .105, .047);
    oval(head, skinShadow, side * .282, -.035, .032, .02, .045, .01);
    const x = side * .098;
    curve(head, ink, [[x - .034, -.016, .223], [x, -.028, .237], [x + .033, -.016, .223]], .0058);
    curve(head, hair, [[x - .046, .044, .218], [x - .009, .061, .237], [x + .037, .045, .224]], .014);
    curve(head, skinShadow, [[x - .035, -.05, .221], [x, -.057, .234], [x + .028, -.05, .221]], .0022);
    curve(head, skinShadow, [[side * .15, -.031, .194], [side * .174, -.043, .181], [side * .179, -.06, .172]], .0022);
    oval(head, rose, side * .158, -.081, .189, .035, .018, .007);
    curve(head, hair, [[side * .018, -.1, .25], [side * .06, -.118, .235], [side * .088, -.11, .216]], .015);
  }
  oval(head, skin, 0, -.059, .245, .028, .036, .024);
  curve(head, ink, [[-.027, -.12, .226], [0, -.127, .234], [.027, -.12, .226]], .0032);
  oval(head, hair, 0, -.191, .167, .084, .107, .058);
  for (const side of [-1, 1]) curve(head, hair, [[side * .044, -.148, .21], [side * .043, -.224, .197], [side * .012, -.281, .161]], .016);
  curve(head, skinShadow, [[-.074, .12, .201], [0, .132, .218], [.074, .12, .201]], .002);
  model.mergeStatic(head);
  model.mergeStatic(body);

  const staff = new THREE.Group();
  staff.name = "abbot-carved-khakkhara";
  staff.position.set(.47, 0, -.015);
  staff.rotation.z = -.025;
  group.add(staff);
  mesh(staff, new THREE.CylinderGeometry(.018, .024, 1.3, 10), wood, 0, .66, 0);
  for (const y of [.2, .25, .92, .97, 1.12]) mesh(staff, new THREE.TorusGeometry(.022, .004, 5, 10), brass, 0, y, 0).rotation.x = Math.PI / 2;
  mesh(staff, new THREE.TorusGeometry(.073, .011, 6, 24), brass, 0, 1.36, 0);
  oval(staff, brass, 0, 1.45, 0, .025, .039, .024);
  for (const side of [-1, 1]) for (let index = 0; index < 3; index++) {
    const ring = mesh(staff, new THREE.TorusGeometry(.026, .004, 5, 16), brass, side * (.045 + index * .009), 1.29 - index * .008, 0);
    ring.rotation.y = index * .42;
  }
  model.mergeStatic(staff);

  const upperArms: THREE.Mesh[] = [];
  const forearms: THREE.Mesh[] = [];
  const cuffs: THREE.Mesh[] = [];
  const palms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    upperArms.push(oval(body, robe, 0, 0, 0, .11, 1, .115));
    forearms.push(oval(body, robe, 0, 0, 0, .09, 1, .09));
    cuffs.push(oval(body, linen, 0, 0, 0, .073, .037, .067));
    const palm = new THREE.Group();
    palm.name = side < 0 ? "abbot-left-hand" : "abbot-right-hand";
    body.add(palm);
    oval(palm, skin, 0, 0, 0, .044, .075, .034);
    oval(palm, skin, side * .032, -.024, .018, .019, .034, .021);
    curve(palm, skinShadow, [[-.02, -.022, .031], [0, -.014, .034], [.019, -.019, .032]], .002);
    model.mergeStatic(palm);
    palms.push(palm);
  }

  const blessing = new THREE.Group();
  blessing.name = "abbot-golden-lotus-blessing";
  blessing.position.set(0, .94, .6);
  group.add(blessing);
  for (let index = 0; index < 8; index++) {
    const petal = mesh(blessing, petalGeometry, light);
    petal.scale.setScalar(.14);
    petal.rotation.set(.72, index / 8 * Math.PI * 2, 0, "YXZ");
  }
  oval(blessing, light, 0, .07, 0, .034, .064, .034);
  model.mergeStatic(blessing);
  const motes = new THREE.InstancedMesh(new THREE.SphereGeometry(.009, 6, 4), light, 18);
  motes.name = "abbot-blessing-golden-motes";
  motes.frustumCulled = false;
  motes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(motes);
  const moteGeometry = motes.geometry;
  const transform = new THREE.Object3D();
  const shoulder = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  const wrist = new THREE.Vector3();
  const axis = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  let disposed = false;

  function between(part: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, width: number) {
    part.position.copy(from).add(to).multiplyScalar(.5);
    direction.subVectors(to, from);
    part.scale.set(width, direction.length() * .58, width);
    part.quaternion.setFromUnitVectors(axis, direction.normalize());
  }
  function animate(time: number, mode: AbbotMode, progress = 0) {
    if (disposed) return;
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const gesture = mode === "chant" ? 1 : mode === "idle" ? 0 : THREE.MathUtils.smoothstep(p, 0, .22) * (1 - THREE.MathUtils.smoothstep(p, .84, 1));
    const bow = mode === "greeting" ? Math.sin(Math.PI * THREE.MathUtils.smoothstep(p, .22, .78)) * .17 : 0;
    body.position.y = .65 + Math.sin(time * 1.4) * .003 - bow * .04;
    body.rotation.x = bow;
    head.rotation.x = .035 + bow * .25;
    head.rotation.y = mode === "idle" ? Math.sin(time * .34) * .035 : 0;
    for (let index = 0; index < 2; index++) {
      const side = index === 0 ? -1 : 1;
      const blessingHand = mode === "blessing" && side > 0;
      const handX = blessingHand ? .13 : side * .031;
      const handY = blessingHand ? .43 : .245;
      const handZ = blessingHand ? .38 : .34;
      shoulder.set(side * .255, .28, 0);
      elbow.set(THREE.MathUtils.lerp(side * .34, side * .245, gesture), THREE.MathUtils.lerp(-.06, .075, gesture), THREE.MathUtils.lerp(.06, .23, gesture));
      wrist.set(THREE.MathUtils.lerp(side < 0 ? -.18 : .445, handX, gesture), THREE.MathUtils.lerp(side < 0 ? -.05 : .06, handY, gesture), THREE.MathUtils.lerp(side < 0 ? .24 : .005, handZ, gesture));
      between(upperArms[index], shoulder, elbow, .106);
      between(forearms[index], elbow, wrist, .084);
      cuffs[index].position.copy(wrist);
      cuffs[index].quaternion.copy(forearms[index].quaternion);
      palms[index].position.copy(wrist);
      palms[index].position.y += .032;
      palms[index].rotation.set(blessingHand ? -.3 * gesture : -.1, 0, side * THREE.MathUtils.lerp(-.3, .19, gesture));
      palms[index].scale.set(1, 1, 1);
    }
    const radiance = mode === "blessing" ? Math.sin(Math.PI * p) : 0;
    blessing.visible = radiance > .01;
    blessing.position.y = .94 + gesture * .1 + Math.sin(time * 2) * .012;
    blessing.scale.setScalar(.6 + radiance * .5);
    blessing.rotation.y = time * .25;
    motes.visible = radiance > .01;
    if (motes.visible) {
      for (let index = 0; index < 18; index++) {
        const angle = index * 2.399 + time * .38;
        const height = ((time * .2 + index / 18) % 1);
        const radius = .15 + Math.sin(height * Math.PI) * .23;
        transform.position.set(Math.cos(angle) * radius, .65 + height * .94, .48 + Math.sin(angle) * radius);
        transform.scale.setScalar(radiance * Math.sin(height * Math.PI) * (index % 3 ? .7 : 1.25));
        transform.updateMatrix();
        motes.setMatrixAt(index, transform.matrix);
      }
      motes.instanceMatrix.needsUpdate = true;
    }
  }
  animate(0, "idle");
  return {
    group, animate,
    dispose() {
      if (disposed) return;
      disposed = true;
      motes.dispose();
      moteGeometry.dispose();
      model.dispose();
    },
  };
}

/** The quest reward is a small warm lotus lantern that follows the player. */
export function createAbbotReward() {
  const model = createCraftedModel("住持赠礼 · 云隐莲灯");
  const { group, mesh, oval, surface } = model;
  const bronze = surface(0x9c8151, .61);
  const petal = surface(0xd7b890, .87);
  const inner = surface(0xe8cb8b, .76, .22);
  const flameSurface = surface(0xf4d38c, .6, .85);
  const geometry = createPetalGeometry();
  const lantern = new THREE.Group();
  group.add(lantern);
  mesh(lantern, new THREE.CylinderGeometry(.065, .049, .025, 16), bronze, 0, -.012, 0);
  for (let index = 0; index < 16; index++) {
    const outer = index < 8;
    const leaf = mesh(lantern, geometry, outer ? petal : inner);
    leaf.scale.setScalar(outer ? .13 : .1);
    leaf.rotation.set(outer ? 1.3 : .78, index / 8 * Math.PI * 2 + (outer ? 0 : Math.PI / 8), 0, "YXZ");
  }
  model.mergeStatic(lantern);
  const flame = oval(lantern, flameSurface, 0, .092, 0, .022, .054, .022);
  flame.castShadow = false;
  let disposed = false;
  return {
    group,
    animate(time: number) {
      if (disposed) return;
      lantern.position.y = Math.sin(time * 1.7) * .025;
      lantern.rotation.y = time * .24;
      lantern.rotation.z = Math.sin(time * 1.1) * .04;
      flame.scale.y = .052 + Math.sin(time * 5.1) * .004;
    },
    dispose() { if (!disposed) { disposed = true; model.dispose(); } },
  };
}
