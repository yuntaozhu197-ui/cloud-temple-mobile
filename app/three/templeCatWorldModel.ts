import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const up = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3(0, 0, 1);
const saturate = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
const easeOut = (value: number) => 1 - (1 - saturate(value)) ** 3;
const arc = (value: number) => Math.sin(Math.PI * saturate(value));

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
  puppet.add(body, bell);
  body.add(head, tail);
  head.position.set(0, .66, .26);
  tail.position.set(.045, .39, -.35);

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

  const fur = material(0xea9a53);
  const darkFur = material(0xcf793e);
  const cream = material(0xffe0ae);
  const stripe = material(0xa65330);
  const ink = material(0x372728, .45);
  const earPink = material(0xe89883);
  const brass = material(0xcf8738, .42, .32);
  const gold = material(0xffcf71, .34, .24);
  gold.emissive.set(0x5a2c05);
  gold.emissiveIntensity = .32;

  const sphere = geometry(new THREE.SphereGeometry(1, 16, 11));
  const detail = geometry(new THREE.SphereGeometry(1, 10, 7));
  const torus = geometry(new THREE.TorusGeometry(1, .12, 6, 20));

  function mesh(parent: THREE.Group, shape: THREE.BufferGeometry, surface: THREE.Material) {
    const object = new THREE.Mesh(shape, surface);
    parent.add(object);
    return object;
  }

  function oval(parent: THREE.Group, surface: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const object = mesh(parent, Math.max(sx, sy, sz) >= .18 ? sphere : detail, surface);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    return object;
  }

  function line(parent: THREE.Group, surface: THREE.Material, points: [number, number, number][], radius: number, segments: number) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    return mesh(parent, geometry(new THREE.TubeGeometry(curve, segments, radius, 6, false)), surface);
  }

  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x302c22, transparent: true, opacity: .21, depthWrite: false });
  materials.add(shadowMaterial);
  const shadow = mesh(root, geometry(new THREE.CircleGeometry(1, 24)), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, .022, -.035);
  shadow.scale.set(.40, .36, 1);

  oval(body, fur, 0, .39, -.105, .30, .303, .43);
  oval(body, cream, 0, .38, .19, .211, .242, .154);
  for (const side of [-1, 1]) {
    oval(body, darkFur, side * .18, .24, -.265, .151, .184, .20);
    oval(body, fur, side * .155, .196, .24, .091, .133, .105);
    oval(body, cream, side * .181, .088, -.28, .113, .075, .142);
    oval(body, cream, side * .161, .078, .265, .098, .071, .13);
    for (const [y, z] of [[.47, -.318], [.51, -.185], [.53, -.045]]) {
      const mark = oval(body, stripe, side * .255, y, z, .025, .063, .036);
      mark.rotation.z = -side * .42;
      mark.rotation.x = .35;
    }
  }

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(), new THREE.Vector3(.134, .056, -.19), new THREE.Vector3(.284, .245, -.30),
    new THREE.Vector3(.34, .474, -.245), new THREE.Vector3(.262, .583, -.18),
  ]);
  mesh(tail, geometry(new THREE.TubeGeometry(tailCurve, 18, .072, 8, false)), fur);
  for (const at of [.36, .57, .77]) {
    const band = mesh(tail, torus, stripe);
    band.position.copy(tailCurve.getPoint(at));
    band.quaternion.setFromUnitVectors(forward, tailCurve.getTangent(at));
    band.scale.set(.07, .07, .111);
  }
  oval(tail, cream, .26, .575, -.182, .075, .092, .07);

  oval(head, fur, 0, 0, 0, .348, .295, .277);
  oval(head, cream, 0, -.136, .144, .253, .144, .126);
  const earShape = new THREE.Shape();
  earShape.moveTo(-.116, -.033);
  earShape.quadraticCurveTo(-.128, .055, -.022, .228);
  earShape.quadraticCurveTo(.003, .277, .035, .221);
  earShape.quadraticCurveTo(.121, .08, .111, -.027);
  earShape.quadraticCurveTo(0, -.079, -.116, -.033);
  const earGeo = geometry(new THREE.ExtrudeGeometry(earShape, {
    depth: .059, bevelSegments: 2, bevelSize: .023, bevelThickness: .019, curveSegments: 6,
  }));

  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    head.add(ear);
    ear.rotation.z = -side * .34;
    ear.position.set(side * .232, .187, .006);
    mesh(ear, earGeo, darkFur);
    const lining = mesh(ear, earGeo, earPink);
    lining.position.set(0, .004, .061);
    lining.scale.set(.66, .68, .2);

    oval(head, cream, side * .094, -.105, .233, .112, .084, .069);
    oval(head, earPink, side * .217, -.095, .213, .054, .026, .023);
    const eye = new THREE.Group();
    eye.position.set(side * .153, .025, .239);
    eye.rotation.y = side * .22;
    head.add(eye);
    eyes.push(eye);
    oval(eye, ink, 0, 0, 0, .053, .07, .027);
    oval(eye, cream, -.013, .026, .026, .019, .021, .013);
    oval(eye, cream, .018, -.016, .026, .009, .01, .008);

    for (const [y, z, x] of [[.113, .176, .238], [.064, .143, .278]]) {
      const mark = oval(head, stripe, side * x, y, z, .029, .057, .020);
      mark.rotation.z = -side * .63;
    }
    for (const n of [-1, 0, 1]) {
      const height = -.09 + n * .027;
      line(head, cream, [[side * .169, height, .256], [side * .269, height + n * .016, .245], [side * .364, height + n * .037, .204]], .006, 5);
    }
    line(head, ink, [[0, -.13, .303], [side * .042, -.157, .296], [side * .082, -.144, .294]], .005, 6);
  }
  oval(head, earPink, 0, -.09, .287, .048, .026, .025);
  oval(head, stripe, 0, .216, .148, .029, .059, .024).rotation.x = .60;
  for (const side of [-1, 1]) {
    oval(head, stripe, side * .071, .203, .164, .024, .05, .021).rotation.z = -side * .23;
  }

  const bellProfile = [
    [.001, .29], [.067, .29], [.093, .267], [.108, .222], [.124, .143], [.149, .068],
    [.188, .022], [.195, .004], [.167, .004], [.137, .046], [.11, .105], [.083, .201], [.058, .26], [.001, .26],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  mesh(bell, geometry(new THREE.LatheGeometry(bellProfile, 24)), brass);
  for (const [height, radius] of [[.023, .174], [.068, .146], [.22, .103]]) {
    const rim = mesh(bell, torus, gold);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = height;
    rim.scale.set(radius, radius, radius * .7);
  }
  const grip = mesh(bell, torus, gold);
  grip.position.y = .325;
  grip.scale.setScalar(.056);
  for (let index = 0; index < 7; index++) {
    const angle = index * 2 * Math.PI / 7;
    const petal = oval(bell, gold, .131 * Math.cos(angle), .122, .131 * Math.sin(angle), .014, .027, .015);
    petal.rotation.set(-Math.sin(angle) * .32, angle, Math.cos(angle) * .32);
  }

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
  batch(body, [head, tail]);
  batch(head, eyes);
  for (const eye of eyes) batch(eye);
  batch(tail);
  batch(bell);

  const glints = new THREE.InstancedMesh(geometry(new THREE.OctahedronGeometry(1)), gold, 5);
  glints.frustumCulled = false;
  glints.visible = false;
  glints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  puppet.add(glints);
  const glint = new THREE.Object3D();
  const mouth = new THREE.Vector3(0, -.145, .317);
  const bellStart = new THREE.Vector3(0, .23, .56);
  const bellPosition = new THREE.Vector3();
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let elapsed = 0;

  function pose(time: number) {
    const hop = reducedMotion ? 1 : saturate(time / .52);
    const roll = reducedMotion ? 0 : arc((time - .95) / 1.1);
    body.position.set(0, .15 * arc(hop) + .24 * roll, -.19 * (1 - easeOut(hop)));
    body.rotation.z = -.96 * roll;
    body.scale.set(1, 1 + (reducedMotion ? 0 : .013 * Math.sin(time * 3)), 1);
    head.rotation.x = .17 * arc((time - .42) / .44);
    head.rotation.z = reducedMotion ? 0 : .08 * Math.sin(time * 4) + .085 * roll;
    tail.rotation.y = reducedMotion ? .12 : .21 * Math.sin(time * 4.4) + .15 * roll;
    for (const eye of eyes) eye.scale.y = !reducedMotion && time % 3.1 > 2.94 ? .19 : 1;

    if (!reducedMotion && time < .46) {
      bellPosition.copy(mouth).applyQuaternion(head.quaternion).add(head.position).add(body.position);
      bell.position.copy(bellPosition);
      bell.position.y -= .33;
      bellStart.copy(bell.position);
      bell.rotation.set(-.11, -.13, .19 * Math.sin(time * 17));
    } else {
      const drop = reducedMotion ? 1 : saturate((time - .46) / .43);
      bell.position.set(
        THREE.MathUtils.lerp(bellStart.x, .39, drop),
        THREE.MathUtils.lerp(bellStart.y, .041, drop) + .10 * arc(drop),
        THREE.MathUtils.lerp(bellStart.z, .35, drop),
      );
      const bounce = reducedMotion ? 0 : .06 * Math.abs(Math.sin((time - .89) * 18)) * (1 - easeOut((time - .89) / .45));
      if (drop >= 1) bell.position.y += bounce;
      bell.rotation.set(.08 * arc(drop), -.13 + drop * .45, .23 * drop * (1 - easeOut((time - .88) / .50)));
    }

    const sparkle = (time - .72) / 1.35;
    glints.visible = !reducedMotion && sparkle > 0 && sparkle < 1;
    if (!glints.visible) return;
    for (let index = 0; index < glints.count; index++) {
      const phase = saturate((sparkle - index * .07) / .75);
      const angle = index * 2.4;
      glint.position.set(.39 + Math.cos(angle) * phase * .43, .24 + phase * (.46 + index * .065), .35 + Math.sin(angle) * phase * .38);
      glint.quaternion.setFromAxisAngle(up, time * 2 + index * .6);
      glint.scale.set(.040, .089, .040).multiplyScalar(Math.max(.001, arc(phase)));
      glint.updateMatrix();
      glints.setMatrixAt(index, glint.matrix);
    }
    glints.instanceMatrix.needsUpdate = true;
  }

  return {
    root,
    show(x: number, y: number, z: number, facing = 0) {
      root.position.set(x, y, z);
      root.rotation.y = facing;
      elapsed = 0;
      root.visible = true;
      pose(reducedMotion ? 2.4 : 0);
    },
    hide() {
      root.visible = false;
    },
    update(deltaSeconds: number) {
      if (!root.visible || reducedMotion) return;
      elapsed += Math.max(0, deltaSeconds);
      pose(elapsed);
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
