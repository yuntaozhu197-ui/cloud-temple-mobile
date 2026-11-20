import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const up = new THREE.Vector3(0, 1, 0);
const saturate = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
const easeOut = (value: number) => 1 - (1 - saturate(value)) ** 3;
const arc = (value: number) => Math.sin(Math.PI * saturate(value));
export type TempleCatPose = "idle" | "sneak" | "reveal";

export function createTempleCatWorldModel() {
  const root = new THREE.Group();
  root.name = "temple-cat-reveal";
  root.visible = false;

  const puppet = new THREE.Group();
  puppet.scale.setScalar(.73);
  root.add(puppet);

  const body = new THREE.Group();
  const head = new THREE.Group();
  const tail = new THREE.Group();
  const bell = new THREE.Group();
  bell.name = "temple-cat-bronze-bell";
  const paws = [new THREE.Group(), new THREE.Group()];
  puppet.add(body, bell);
  body.add(head, tail, ...paws);
  head.position.set(0, .66, .26);
  tail.position.set(.02, .35, -.44);

  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  function material(color: number, roughness = .74, metalness = 0) {
    const surface = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.add(surface);
    return surface;
  }
  function geometry<T extends THREE.BufferGeometry>(shape: T) {
    geometries.add(shape);
    return shape;
  }

  const fur = material(0xffffff, .86);
  fur.vertexColors = true;
  const orange = new THREE.Color(0xeaa260);
  const honey = new THREE.Color(0xf1b872);
  const shade = new THREE.Color(0xcc7743);
  const tabby = new THREE.Color(0xa95331);
  const ivory = new THREE.Color(0xffebc9);
  const darkFur = material(0xd28a55);
  const cream = material(0xffe9c7, .8);
  const ink = material(0x372528, .46);
  const iris = material(0xa86c30, .42, .06);
  const light = material(0xfff6e6, .3);
  light.emissive.set(0x513a28);
  light.emissiveIntensity = .25;
  const earPink = material(0xdb897b, .79);
  const nose = material(0xae6257, .62);
  const brass = material(0xffffff, .46, .68);
  brass.vertexColors = true;
  const gold = material(0xe4af59, .33, .60);
  gold.emissive.set(0x5a2c05);
  gold.emissiveIntensity = .32;

  const detail = geometry(new THREE.SphereGeometry(1, 12, 8));
  const torus = geometry(new THREE.TorusGeometry(1, .12, 6, 32));

  function mesh(parent: THREE.Group, shape: THREE.BufferGeometry, surface: THREE.Material) {
    const object = new THREE.Mesh(shape, surface);
    parent.add(object);
    return object;
  }

  function oval(parent: THREE.Group, surface: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const object = mesh(parent, detail, surface);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    return object;
  }

  function line(parent: THREE.Group, surface: THREE.Material, points: [number, number, number][], radius: number, segments: number) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    return mesh(parent, geometry(new THREE.TubeGeometry(curve, segments, radius, 6, false)), surface);
  }

  function colorGeometry(shape: THREE.BufferGeometry, tint: (x: number, y: number, z: number, index: number) => THREE.Color) {
    const positions = shape.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    for (let index = 0; index < positions.count; index++) {
      const color = tint(positions.getX(index), positions.getY(index), positions.getZ(index), index);
      color.toArray(colors, index * 3);
    }
    shape.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return shape;
  }

  function furForm(parent: THREE.Group, center: [number, number, number], radii: [number, number, number], tint: (x: number, y: number, z: number) => THREE.Color, segments = 28) {
    const shape = new THREE.SphereGeometry(1, segments, Math.round(segments * .65));
    const object = mesh(parent, geometry(colorGeometry(shape, tint)), fur);
    object.position.set(...center);
    object.scale.set(...radii);
    return object;
  }

  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x302c22, vertexColors: true, transparent: true, opacity: .36, depthWrite: false });
  materials.add(shadowMaterial);
  const shadowGeometry = new THREE.CircleGeometry(1, 32);
  const shadowColors = new Float32Array(shadowGeometry.attributes.position.count * 4).fill(1);
  for (let index = 1; index < shadowGeometry.attributes.position.count; index++) shadowColors[index * 4 + 3] = 0;
  shadowGeometry.setAttribute("color", new THREE.BufferAttribute(shadowColors, 4));
  const shadow = mesh(root, geometry(shadowGeometry), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(.03, .022, -.085);
  shadow.scale.set(.48, .53, 1);

  const smooth = THREE.MathUtils.smoothstep;
  const tint = new THREE.Color();
  const band = (distance: number, width: number) => 1 - smooth(Math.abs(distance), width * .30, width);
  const underside = (y: number) => .16 + .4 * smooth(-y, -.17, .94);
  furForm(body, [0, .337, -.159], [.267, .264, .46], (x, y, z) => {
    const stripeHeight = z + .20 * y - .18 * x * x;
    const likeness = Math.max(band(stripeHeight + .54, .118), band(stripeHeight + .13, .12), band(stripeHeight - .27, .122));
    const saddle = smooth(y, -.72, .56) * smooth(Math.abs(x), .15, .76);
    return tint.copy(orange).lerp(shade, underside(y)).lerp(tabby, likeness * saddle * .82);
  });
  furForm(body, [0, .435, .171], [.217, .262, .229], (x, y, z) => {
    const bib = smooth(z, .21 + .43 * x * x + .12 * y, .75 + .16 * y);
    return tint.copy(orange).lerp(shade, underside(y)).lerp(ivory, bib * .95);
  });
  for (const side of [-1, 1]) {
    const hind = paws[side === -1 ? 0 : 1];
    const fore = paws[side === -1 ? 1 : 0];
    furForm(hind, [side * .163, .234, -.381], [.136, .186, .174], (x, y, z) => {
      const kneeStripe = band(z + y * .38 + .18, .20) * smooth(x * side, .12, .79);
      return tint.copy(orange).lerp(shade, underside(y)).lerp(tabby, kneeStripe * .54);
    }, 20);
    furForm(fore, [side * .131, .212, .209], [.082, .173, .091], (_x, y, _z) => {
      return tint.copy(orange).lerp(shade, underside(y)).lerp(ivory, smooth(-y, .2, .83));
    }, 20).rotation.x = -.12;
    oval(hind, cream, side * .170, .070, -.316, .095, .061, .127);
    oval(fore, cream, side * .131, .069, .273, .091, .062, .115);
    for (const toe of [-1, 1]) {
      line(fore, darkFur, [[side * .131 + toe * .023, .101, .364], [side * .131 + toe * .024, .093, .375]], .0028, 3);
    }
  }

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(), new THREE.Vector3(.10, .018, -.19), new THREE.Vector3(.269, .151, -.37),
    new THREE.Vector3(.325, .377, -.418), new THREE.Vector3(.29, .561, -.36), new THREE.Vector3(.171, .668, -.252),
  ]);
  const tailSegments = 45;
  const tailRadial = 12;
  const tailGeometry = new THREE.TubeGeometry(tailCurve, tailSegments, .079, tailRadial, false);
  const tailPoints = tailGeometry.attributes.position;
  const tailCenter = new THREE.Vector3();
  for (let index = 0; index <= tailSegments; index++) {
    const progress = index / tailSegments;
    tailCurve.getPointAt(progress, tailCenter);
    const taper = Math.max(.012, (1 - progress * .45) * Math.cos(Math.PI * .5 * saturate((progress - .84) / .16)));
    for (let side = 0; side <= tailRadial; side++) {
      const row = index * (tailRadial + 1) + side;
      tailPoints.setXYZ(row,
        tailCenter.x + (tailPoints.getX(row) - tailCenter.x) * taper,
        tailCenter.y + (tailPoints.getY(row) - tailCenter.y) * taper,
        tailCenter.z + (tailPoints.getZ(row) - tailCenter.z) * taper);
    }
  }
  tailGeometry.computeVertexNormals();
  mesh(tail, geometry(colorGeometry(tailGeometry, (_x, _y, _z, index) => {
    const progress = Math.floor(index / (tailRadial + 1)) / tailSegments;
    const stripe = Math.max(band(progress - .30, .065), band(progress - .51, .064), band(progress - .69, .069), band(progress - .85, .075));
    return tint.copy(orange).lerp(shade, .22).lerp(tabby, stripe * .84).lerp(ivory, smooth(progress, .88, .98));
  })), fur);

  furForm(head, [0, 0, 0], [.341, .289, .301], (x, y, z) => {
    const cheek = 1 - smooth(y, -.33 + .17 * Math.cos(x * 8), -.17 + .19 * Math.cos(x * 8));
    const muzzle = cheek * smooth(z, .005, .61);
    const forehead = smooth(y, .31, .52) * smooth(z, -.10, .28);
    const middleLine = band(x, .124) * smooth(y, .47, .77);
    const browLine = band(Math.abs(x) - (.16 + .20 * y), .143);
    const templeLine = Math.max(band(y - .31 - .22 * z, .122), band(y - .02 - .14 * z, .108)) * smooth(Math.abs(x), .53, .82);
    const crownLine = band(z + .3 + .3 * x * x, .127) * smooth(y, -.12, .56);
    return tint.copy(honey).lerp(orange, underside(y)).lerp(tabby, Math.max(forehead * Math.max(middleLine, browLine), templeLine, crownLine) * .78).lerp(ivory, muzzle);
  }, 46);
  const jawTint = (_x: number, y: number, _z: number) => tint.copy(ivory).lerp(orange, .20 * smooth(-y, .21, .97));
  furForm(head, [0, -.151, .184], [.227, .12, .114], jawTint);
  const earShape = new THREE.Shape();
  earShape.moveTo(-.118, -.038);
  earShape.quadraticCurveTo(-.135, .05, -.041, .21);
  earShape.quadraticCurveTo(-.01, .258, .021, .204);
  earShape.quadraticCurveTo(.112, .096, .109, -.013);
  earShape.quadraticCurveTo(.038, -.081, -.118, -.038);
  const earGeo = geometry(new THREE.ExtrudeGeometry(earShape, {
    depth: .059, bevelSegments: 3, bevelSize: .026, bevelThickness: .022, curveSegments: 7,
  }));

  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    head.add(ear);
    ear.rotation.set(-.16, side * .22, -side * .39);
    ear.position.set(side * .231, .186, .022);
    mesh(ear, earGeo, darkFur);
    const lining = mesh(ear, earGeo, earPink);
    lining.position.set(.004, .004, .082);
    lining.scale.set(.66, .68, .27);
    line(ear, cream, [[-.044, -.005, .104], [-.038, .029, .110], [-.027, .066, .103]], .007, 6);
    furForm(head, [side * .087, -.104, .25], [.108, .081, .075], jawTint, 22);
    const eye = new THREE.Group();
    eye.position.set(side * .157, .042, .256);
    eye.rotation.set(-.09, side * .39, side * .10);
    head.add(eye);
    eyes.push(eye);
    oval(eye, ink, 0, 0, 0, .069, .084, .036);
    oval(eye, iris, -.002, -.007, .025, .049, .061, .014);
    oval(eye, ink, 0, .003, .036, .033, .051, .012);
    oval(eye, light, -.021, .029, .043, .018, .020, .006);
    oval(eye, light, .018, -.025, .044, .009, .009, .005);
    line(head, darkFur, [[side * .106, .148, .235], [side * .153, .160, .239], [side * .202, .144, .212]], .0065, 7);
    for (const n of [-1, 0, 1]) {
      const height = -.105 + n * .024;
      line(head, cream, [[side * .144, height, .305], [side * .252, height + n * .016, .276], [side * .393, height + n * .040, .229]], .0037, 8);
    }
    line(head, nose, [[0, -.119, .319], [side * .035, -.146, .322], [side * .073, -.138, .321]], .0043, 7);
  }
  const noseShape = new THREE.Shape();
  noseShape.moveTo(-.037, .007);
  noseShape.bezierCurveTo(-.032, .027, -.006, .026, 0, .020);
  noseShape.bezierCurveTo(.012, .026, .037, .017, .035, .009);
  noseShape.bezierCurveTo(.027, -.002, .013, -.020, 0, -.023);
  noseShape.bezierCurveTo(-.014, -.020, -.029, -.004, -.037, .007);
  const noseMesh = mesh(head, geometry(new THREE.ExtrudeGeometry(noseShape, { depth: .014, bevelSegments: 2, bevelSize: .007, bevelThickness: .007, curveSegments: 7 })), nose);
  noseMesh.position.set(0, -.086, .319);
  oval(head, light, -.012, -.072, .341, .012, .005, .003);

  const bellProfile = [
    [.001, .32], [.050, .32], [.077, .313], [.101, .295], [.117, .272], [.126, .24], [.131, .195],
    [.142, .147], [.153, .104], [.169, .066], [.190, .043], [.207, .033], [.216, .020], [.216, .009],
    [.208, .001], [.186, .001], [.176, .013], [.166, .049], [.146, .078], [.136, .121], [.116, .184],
    [.104, .242], [.089, .277], [.066, .297], [.001, .298],
  ].reverse().map(([radius, height]) => new THREE.Vector2(radius, height));
  const warmBronze = new THREE.Color(0xb0793f);
  const yellowBronze = new THREE.Color(0xe1ac5b);
  const darkBronze = material(0x89583a, .65, .47);
  const cord = material(0xad463d, .87);
  const cordHighlight = material(0xc15c48, .82);
  const jade = material(0x759577, .26, .15);
  jade.emissive.set(0x284c32);
  jade.emissiveIntensity = .22;
  mesh(bell, geometry(colorGeometry(new THREE.LatheGeometry(bellProfile, 48), (x, y, z) => {
    const azimuth = Math.atan2(z, x);
    const grain = .5 + .5 * Math.sin(y * 146 - Math.sin(azimuth * 4) * 1.2);
    const patina = .5 + .5 * Math.cos(azimuth * 6 + y * 19);
    return tint.copy(warmBronze).lerp(yellowBronze, .29 + grain * .13 + patina * .22);
  })), brass);

  const trim = geometry(new THREE.TorusGeometry(1, .044, 5, 36));
  function bellRim(height: number, radius: number, surface: THREE.Material) {
    const rim = mesh(bell, trim, surface);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = height;
    rim.scale.set(radius, radius, radius * .62);
  }
  bellRim(.020, .214, gold);
  bellRim(.037, .204, darkBronze);
  bellRim(.053, .182, gold);
  bellRim(.229, .128, darkBronze);
  bellRim(.243, .127, gold);
  bellRim(.274, .117, gold);
  bellRim(.308, .082, darkBronze);

  function relief(angle: number, height: number, radius: number): [number, number, number] {
    return [Math.sin(angle) * radius, height, Math.cos(angle) * radius];
  }
  for (let index = 0; index < 10; index++) {
    const angle = index * Math.PI / 5;
    // A repeated cloud-scroll stamped onto the curved outer wall.
    line(bell, gold, [
      relief(angle - .18, .115, .154), relief(angle - .11, .137, .150), relief(angle + .045, .136, .149),
      relief(angle + .12, .163, .143), relief(angle + .065, .178, .137), relief(angle - .022, .164, .141),
      relief(angle + .020, .155, .145),
    ], .0034, 9);
    const stud = relief(angle, .196, .133);
    oval(bell, gold, ...stud, .009, .007, .009);
  }
  const crown = mesh(bell, torus, gold);
  crown.position.y = .343;
  crown.scale.set(.048, .052, .051);
  line(bell, darkBronze, [[0, .077, 0], [0, .046, 0], [.005, .015, 0]], .010, 5);
  oval(bell, gold, .005, .054, 0, .035, .041, .036);
  // The cord loops through the crown under a small green jade bead.
  line(bell, cord, [[-.01, .348, .012], [-.064, .397, .035], [-.068, .431, .039], [-.029, .432, .028], [.015, .397, .007], [.061, .432, .009], [.079, .402, .018], [.035, .373, .023]], .010, 23);
  line(bell, cordHighlight, [[.017, .404, .025], [.012, .432, .026], [.014, .459, .019]], .012, 9);
  line(bell, cord, [[.014, .392, .035], [.064, .365, .061], [.100, .315, .079], [.092, .281, .083]], .011, 11);
  line(bell, cordHighlight, [[.092, .294, .08], [.094, .267, .09], [.103, .239, .080]], .008, 9);
  oval(bell, jade, .014, .428, .021, .033, .027, .030);
  oval(bell, gold, .014, .392, .021, .017, .013, .015);

  // Merge the static detailing on each moving part to keep the reveal cheap to draw.
  function batch(part: THREE.Group, animated: readonly THREE.Group[] = []) {
    const partsBySurface = new Map<THREE.Material, THREE.BufferGeometry[]>();
    function collect(group: THREE.Group, parentMatrix: THREE.Matrix4) {
      for (const child of group.children) {
        if (animated.some(item => child === item)) continue;
        child.updateMatrix();
        const transform = new THREE.Matrix4().multiplyMatrices(parentMatrix, child.matrix);
        if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
          const source = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
          source.applyMatrix4(transform);
          const entries = partsBySurface.get(child.material) ?? [];
          entries.push(source);
          partsBySurface.set(child.material, entries);
        } else if (child instanceof THREE.Group) collect(child, transform);
      }
    }
    collect(part, new THREE.Matrix4());
    for (const child of [...part.children]) if (!animated.some(item => child === item)) child.removeFromParent();
    for (const [surface, entries] of partsBySurface) {
      const combined = mergeGeometries(entries);
      entries.forEach(source => source.dispose());
      if (combined) mesh(part, geometry(combined), surface);
    }
  }
  batch(body, [head, tail, ...paws]);
  batch(head, eyes);
  for (const eye of eyes) batch(eye);
  for (const pair of paws) batch(pair);
  batch(tail);
  batch(bell);

  const glints = new THREE.InstancedMesh(geometry(new THREE.OctahedronGeometry(1)), gold, 5);
  glints.frustumCulled = false;
  glints.visible = false;
  glints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  puppet.add(glints);
  const glint = new THREE.Object3D();
  const mouth = new THREE.Vector3(0, -.145, .327);
  const bellStart = new THREE.Vector3(0, .09, .60);
  const bellRest = new THREE.Vector3(.46, .009, .345);
  const bellPosition = new THREE.Vector3();
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let elapsed = 0;
  let activePose: TempleCatPose = "reveal";

  function animatePose(time: number) {
    const revealing = activePose === "reveal";
    const sneaking = activePose === "sneak";
    const hop = revealing && !reducedMotion ? saturate(time / .50) : 1;
    const roll = revealing && !reducedMotion ? arc((time - .96) / 1.18) : 0;
    const stride = !reducedMotion && sneaking ? Math.sin(time * 13) : 0;
    const breathing = reducedMotion ? 0 : .013 * Math.sin(time * 2.7);
    body.position.set(0, .15 * arc(hop) + .236 * roll + Math.abs(stride) * .021, -.17 * (1 - easeOut(hop)));
    body.rotation.set(sneaking ? .025 : 0, 0, -.77 * roll);
    body.scale.set(1, (sneaking ? .89 : 1) + breathing, 1);
    head.rotation.set(
      sneaking ? -.085 + stride * .026 : revealing ? .16 * arc((time - .43) / .48) : -.027,
      reducedMotion ? 0 : (sneaking ? .05 : .15) * Math.sin(time * 1.56),
      reducedMotion ? 0 : .063 * Math.sin(time * 2.4) + .095 * roll,
    );
    tail.rotation.set(sneaking ? -.13 : .02, reducedMotion ? .12 : .23 * Math.sin(time * (sneaking ? 5.8 : 2.25)) + .18 * roll, .16 * roll);
    paws[0].position.set(0, Math.max(0, stride) * .058, stride * .077);
    paws[1].position.set(0, Math.max(0, -stride) * .058, -stride * .077);
    for (const eye of eyes) eye.scale.y = !reducedMotion && time % 3.1 > 2.94 ? .19 : 1;

    if (sneaking || revealing && !reducedMotion && time < .46) {
      bellPosition.copy(mouth).applyQuaternion(head.quaternion).add(head.position)
        .multiply(body.scale).applyQuaternion(body.quaternion).add(body.position);
      bell.rotation.set(-.10, head.rotation.y * .45, reducedMotion ? .08 : .11 * Math.sin(time * 14));
      // Keeping the top of the knot at the mouth lets the bell swing below it.
      bell.position.set(.014, .449, .020).applyQuaternion(bell.quaternion);
      bell.position.multiplyScalar(-1).add(bellPosition);
      bellStart.copy(bell.position);
    } else {
      const drop = revealing && !reducedMotion ? saturate((time - .46) / .43) : 1;
      bell.position.copy(bellStart).lerp(bellRest, drop);
      bell.position.y += .115 * arc(drop);
      const settling = revealing && !reducedMotion;
      const sway = settling ? Math.sin((time - .89) * 19) * (1 - easeOut((time - .89) / .48)) : 0;
      if (drop >= 1) bell.position.y += .051 * Math.abs(sway);
      const tilt = settling ? .22 * drop * (1 - easeOut((time - .88) / .50)) + .10 * sway : 0;
      if (drop >= 1) bell.position.y = Math.max(bell.position.y, Math.abs(Math.sin(tilt)) * .216 + .002);
      bell.rotation.set(.095 * arc(drop), -.14 + drop * .50, tilt);
    }

    const sparkle = (time - .72) / 1.35;
    glints.visible = revealing && !reducedMotion && sparkle > 0 && sparkle < 1;
    if (!glints.visible) return;
    for (let index = 0; index < glints.count; index++) {
      const phase = saturate((sparkle - index * .07) / .75);
      const angle = index * 2.4;
      glint.position.set(bellRest.x + Math.cos(angle) * phase * .43, .24 + phase * (.46 + index * .065), bellRest.z + Math.sin(angle) * phase * .38);
      glint.quaternion.setFromAxisAngle(up, time * 2 + index * .6);
      glint.scale.set(.040, .089, .040).multiplyScalar(Math.max(.001, arc(phase)));
      glint.updateMatrix();
      glints.setMatrixAt(index, glint.matrix);
    }
    glints.instanceMatrix.needsUpdate = true;
  }

  return {
    root,
    show(x: number, y: number, z: number, facing = 0, pose: TempleCatPose = "reveal") {
      root.position.set(x, y, z);
      root.rotation.y = facing;
      activePose = pose;
      elapsed = 0;
      root.visible = true;
      animatePose(reducedMotion && pose === "reveal" ? 2.4 : 0);
    },
    hide() {
      root.visible = false;
    },
    update(deltaSeconds: number) {
      if (!root.visible || reducedMotion) return;
      elapsed += Math.max(0, deltaSeconds);
      animatePose(elapsed);
    },
    dispose() {
      root.removeFromParent();
      root.clear();
      glints.dispose();
      for (const shape of geometries) shape.dispose();
      for (const surface of materials) surface.dispose();
    },
  };
}
