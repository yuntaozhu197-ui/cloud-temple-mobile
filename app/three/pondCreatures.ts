import * as THREE from "three";
import type { PondSpecies } from "../pondGame";
import { createFishFinGeometry } from "./fishSchool";

type Shape = "round" | "cone" | "stem";
type PondAnimal = "turtle" | "frog" | "butterfly";
type Resources = ReturnType<typeof creatureResources>;

function creatureResources(detail: number) {
  const geometries = {
    round: new THREE.SphereGeometry(1, detail, Math.max(5, Math.round(detail * .65))),
    cone: new THREE.ConeGeometry(1, 1, 6),
    stem: new THREE.CylinderGeometry(1, 1, 1, 6),
    fin: createFishFinGeometry(),
  };
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const extraGeometries = new Set<THREE.BufferGeometry>();
  return {
    geometries,
    keepGeometry(geometry: THREE.BufferGeometry) { extraGeometries.add(geometry); return geometry; },
    surface(color: string, roughness = .76, metalness = 0, doubleSided = false) {
      const key = `${color}:${roughness}:${metalness}:${doubleSided}`;
      let surface = materials.get(key);
      if (!surface) {
        surface = new THREE.MeshStandardMaterial({ color, roughness, metalness, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide });
        materials.set(key, surface);
      }
      return surface;
    },
    dispose() {
      Object.values(geometries).forEach(geometry => geometry.dispose());
      extraGeometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    },
  };
}

function creatureModel(species: PondSpecies, resources: Resources) {
  const group = new THREE.Group();
  group.name = `放生生物 · ${species}`;
  const limbs: THREE.Group[] = [];
  const wings: THREE.Group[] = [];
  let tail: THREE.Group | undefined;
  const fishFins: { object: THREE.Object3D; rest: number; phase: number }[] = [];
  function part(shape: Shape, color: string, position: number[], size: number[], parent: THREE.Object3D = group) {
    const object = new THREE.Mesh(resources.geometries[shape], resources.surface(color));
    object.position.set(position[0], position[1], position[2]);
    object.scale.set(size[0], size[1], size[2]);
    object.userData.pondShape = shape;
    parent.add(object);
    return object;
  }
  function eyes(x: number, y: number, z: number, radius: number) {
    for (const side of [-1, 1]) {
      part("round", "#374638", [side * x, y, z], [radius, radius, radius]);
      part("round", "#f2ead5", [side * x, y + radius * .3, z + radius * .75], [radius * .3, radius * .3, radius * .3]);
    }
  }
  if (species === "turtle") {
    part("round", "#9aab74", [0, .018, 0], [.079, .025, .11]);
    part("round", "#71865c", [0, .041, -.015], [.09, .047, .108]);
    for (const x of [-.035, .035]) for (const z of [-.047, .022]) {
      part("round", "#9cac74", [x, .079, z], [.027, .008, .031]);
    }
    part("round", "#adbc83", [0, .024, .116], [.041, .03, .047]);
    part("cone", "#9aab74", [0, .014, -.142], [.015, .055, .015]).rotation.x = -Math.PI / 2;
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * .064, .015, end * .066);
      group.add(pivot);
      part("round", "#a4b67a", [side * .026, -.005, end * .006], [.048, .012, .025], pivot).rotation.y = side * end * .45;
      limbs.push(pivot);
    }
    eyes(.026, .04, .147, .008);
  } else if (species === "frog") {
    part("round", "#719d69", [0, .023, -.014], [.061, .034, .081]);
    part("round", "#a9bc78", [0, .011, .013], [.05, .018, .063]);
    part("round", "#7faa70", [0, .04, .062], [.068, .033, .052]);
    for (const side of [-1, 1]) {
      part("round", "#8eac71", [side * .039, .069, .07], [.025, .026, .025]);
      const hind = new THREE.Group();
      hind.position.set(side * .048, .017, -.045);
      group.add(hind);
      part("round", "#719d69", [side * .023, -.002, -.017], [.04, .023, .046], hind).rotation.y = side * .55;
      part("round", "#9caf72", [side * .047, -.012, .007], [.027, .009, .049], hind).rotation.y = side * .36;
      const front = new THREE.Group();
      front.position.set(side * .047, .02, .043);
      group.add(front);
      part("round", "#83a56a", [side * .02, -.011, .027], [.015, .012, .038], front).rotation.y = side * .5;
      part("round", "#b1c081", [side * .034, -.02, .049], [.025, .007, .019], front);
      limbs.push(hind, front);
    }
    eyes(.043, .078, .087, .011);
  } else if (species === "butterfly") {
    part("round", "#695846", [0, .025, 0], [.012, .012, .068]);
    part("round", "#8b684b", [0, .027, .051], [.018, .017, .02]);
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * .012, .025, 0);
      group.add(wing);
      part("round", "#ce8d5b", [side * .055, 0, .034], [.064, .006, .067], wing).rotation.y = side * -.25;
      part("round", "#b97855", [side * .046, 0, -.046], [.051, .006, .051], wing).rotation.y = side * .32;
      part("round", "#ead3a2", [side * .065, .006, .041], [.025, .003, .029], wing);
      part("round", "#e4bf8c", [side * .053, .006, -.047], [.021, .003, .024], wing);
      const antenna = part("stem", "#695846", [side * .012, .047, .067], [.0025, .037, .0025]);
      antenna.rotation.z = side * -.45;
      wings.push(wing);
    }
    eyes(.009, .035, .067, .004);
  } else {
    const goldfish = species === "goldfish";
    const koi = species === "koi";
    const bodyColor = goldfish ? "#e99d35" : koi ? "#eee6d3" : "#a0b8b8";
    const bodyY = goldfish ? .038 : .029;
    const bodyWidth = goldfish ? .046 : koi ? .032 : .023;
    const bodyHeight = goldfish ? .035 : koi ? .025 : .017;
    const bodyLength = goldfish ? .06 : koi ? .094 : .072;
    const body = part("round", bodyColor, [0, bodyY, 0], [bodyWidth, bodyHeight, bodyLength]);
    body.name = goldfish ? "金鱼 · 圆润珍珠身" : koi ? "锦鲤 · 修长锦缎身" : "小鱼 · 银色流线身";
    body.material = resources.surface(bodyColor, goldfish ? .37 : koi ? .43 : .5, goldfish ? .12 : .05);
    part("round", goldfish ? "#f7cf78" : koi ? "#faf0d8" : "#dce5dd", [0, bodyY - bodyHeight * .45, .01], [bodyWidth * .83, bodyHeight * .64, bodyLength * .82]);

    function brocadePatch(angle: number, z: number, spread: number, length: number, color: string) {
      const vertices: number[] = [];
      const indices: number[] = [];
      const offset = color === "#4b5149" ? .0011 : .0005;
      function point(theta: number, depth: number) {
        const radius = Math.sqrt(Math.max(0, 1 - (depth / bodyLength) ** 2));
        vertices.push(Math.sin(theta) * (bodyWidth + offset) * radius, bodyY + Math.cos(theta) * (bodyHeight + offset + .0001) * radius, depth);
      }
      const rings = 5;
      const rays = 20;
      for (let ring = 0; ring <= rings; ring++) for (let ray = 0; ray <= rays; ray++) {
        const phase = ray / rays * Math.PI * 2;
        const irregular = (1 + Math.sin(phase * 3) * .09 + Math.cos(phase * 5) * .06) * ring / rings;
        point(angle + Math.cos(phase) * spread * irregular, z + Math.sin(phase) * length * irregular);
      }
      for (let ring = 0; ring < rings; ring++) for (let ray = 0; ray < rays; ray++) {
        const a = ring * (rays + 1) + ray;
        const b = a + rays + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      group.add(new THREE.Mesh(resources.keepGeometry(geometry), resources.surface(color, .45, .04, true)));
    }

    function fin(parent: THREE.Object3D, color: string, position: number[], size: number[], rotation: number[]) {
      const object = new THREE.Mesh(resources.geometries.fin, resources.surface(color, .48, .03, true));
      object.position.set(position[0], position[1], position[2]);
      object.scale.set(size[0], size[1], size[2]);
      object.rotation.set(rotation[0], rotation[1], rotation[2], "YXZ");
      parent.add(object);
      return object;
    }
    tail = new THREE.Group();
    tail.name = goldfish ? "金鱼 · 蝶形双飘尾" : koi ? "锦鲤 · 舒展燕尾" : "小鱼 · 短叉尾";
    tail.position.set(0, bodyY, -bodyLength * .78);
    group.add(tail);
    if (goldfish) {
      for (const side of [-1, 1]) {
        fin(tail, side < 0 ? "#e9a148" : "#f0ba63", [side * .008, .004, 0], [.044, .035, .075], [side * .11, side * -.25, side * .2]);
      }
    } else {
      fin(tail, koi ? "#d9d5c0" : "#819da1", [0, 0, 0], [koi ? .031 : .024, .022, koi ? .047 : .038], [0, 0, Math.PI / 2]);
      if (koi) fin(tail, "#cb6947", [0, 0, -.025], [.023, .012, .019], [0, 0, Math.PI / 2]);
    }
    for (const side of [-1, 1]) {
      const pectoral = fin(group, goldfish ? "#f1bc62" : koi ? "#e8dcc2" : "#b8c9c3", [side * bodyWidth * .78, bodyY - .007, bodyLength * .23], [goldfish ? .026 : koi ? .021 : .011, .015, goldfish ? .062 : koi ? .039 : .025], [0, side * -.56, side * -.17]);
      fishFins.push({ object: pectoral, rest: side * -.17, phase: side });
      if (goldfish) fin(group, "#e9ae50", [side * .022, .018, -.025], [.018, .015, .052], [0, side * -.25, side * -.2]);
    }
    const dorsal = fin(group, goldfish ? "#f3bc5f" : koi ? "#dacfad" : "#8da8ab", [0, bodyY + bodyHeight * .76, bodyLength * .2], [goldfish ? .026 : koi ? .018 : .009, .012, goldfish ? .066 : koi ? .06 : .037], [0, 0, Math.PI / 2]);
    dorsal.name = "挺立背鳍";

    if (koi) {
      brocadePatch(-.28, .039, .82, .023, "#c85d3e");
      brocadePatch(.18, -.027, .98, .026, "#ce6842");
      brocadePatch(1.04, -.047, .46, .016, "#4b5149");
      brocadePatch(-1.12, .005, .38, .015, "#bd563c");
      for (const side of [-1, 1]) {
        const barbel = part("stem", "#d8c493", [side * .015, .023, .092], [.0015, .021, .0015]);
        barbel.rotation.set(Math.PI / 2, 0, side * -.42);
      }
    } else if (goldfish) {
      brocadePatch(-.15, .025, .89, .025, "#df7629");
      for (const side of [-1, 1]) {
        part("round", "#f6c760", [side * .029, .046, .045], [.016, .018, .016]);
      }
    } else {
      for (const side of [-1, 1]) part("round", "#647f85", [side * .021, .03, -.005], [.0025, .003, .055]);
    }
    const eyeX = goldfish ? .044 : koi ? .024 : .017;
    const eyeZ = goldfish ? .05 : koi ? .066 : .052;
    const eyeY = goldfish ? .05 : koi ? .036 : .033;
    for (const side of [-1, 1]) part("round", goldfish ? "#f8d274" : "#dde3cd", [side * eyeX, eyeY, eyeZ], [goldfish ? .009 : .0065, goldfish ? .01 : .0065, .008]);
    eyes(eyeX + .003, eyeY + .001, eyeZ + .007, goldfish ? .0065 : .0045);
    part("round", goldfish ? "#ce762f" : koi ? "#ccb79b" : "#899f9d", [0, bodyY - .003, bodyLength * .99], [goldfish ? .012 : .007, goldfish ? .006 : .0035, .003]);
  }
  return {
    group,
    animate(time: number) {
      limbs.forEach((limb, index) => {
        const stroke = Math.sin(time * (species === "frog" ? 4.2 : 2.6) + index * Math.PI);
        limb.rotation.y = stroke * (species === "frog" ? .5 : .35);
        limb.rotation.x = species === "frog" ? stroke * .2 : 0;
      });
      wings.forEach((wing, index) => { wing.rotation.z = (index === 0 ? -1 : 1) * (.22 + (Math.sin(time * 13) + 1) * .5); });
      if (tail) tail.rotation.y = Math.sin(time * (species === "goldfish" ? 5 : species === "koi" ? 6.5 : 8)) * .18;
      fishFins.forEach(({ object, rest, phase }) => { object.rotation.z = rest + Math.sin(time * 4 + phase) * .13; });
    },
  };
}

/** The same small sculpture appears in the monk's hands and after its release. */
export function createHeldPondCreature() {
  const resources = creatureResources(12);
  const group = new THREE.Group();
  group.name = "gently-held-pond-creature";
  const models = new Map<PondSpecies, ReturnType<typeof creatureModel>>();
  let selected: PondSpecies = "fish";
  const firstModel = creatureModel(selected, resources);
  models.set(selected, firstModel);
  group.add(firstModel.group);
  let disposed = false;
  return {
    group,
    setSpecies(species: PondSpecies) {
      if (disposed) return;
      if (!models.has(species)) {
        const model = creatureModel(species, resources);
        models.set(species, model);
        group.add(model.group);
      }
      selected = species;
      models.forEach((model, id) => { model.group.visible = id === species; });
    },
    animate(time: number) { if (!disposed) models.get(selected)?.animate(time); },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      resources.dispose();
    },
  };
}

type CreatureState = { species: PondAnimal; x: number; z: number; heading: number; phase: number; releasedAt: number; spawnX: number; spawnZ: number };

/** Three instanced shapes bound the draw cost even after many release ceremonies. */
export function createPondCreatures() {
  const group = new THREE.Group();
  group.name = "放生池 · 龟蛙彩蝶";
  const resources = creatureResources(8);
  const capacity = 18;
  const models = new Map<PondAnimal, ReturnType<typeof creatureModel>>();
  const parts = new Map<PondAnimal, THREE.Mesh[]>();
  for (const species of ["turtle", "frog", "butterfly"] as const) {
    const model = creatureModel(species, resources);
    models.set(species, model);
    const meshes: THREE.Mesh[] = [];
    model.group.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
    parts.set(species, meshes);
  }
  const white = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: .76 });
  const batches = new Map<Shape, THREE.InstancedMesh>();
  for (const shape of ["round", "cone", "stem"] as const) {
    const maximum = Math.max(...[...parts.values()].map(meshes => meshes.filter(mesh => mesh.userData.pondShape === shape).length));
    const batch = new THREE.InstancedMesh(resources.geometries[shape], white, capacity * maximum);
    batch.name = `池中生物 · ${shape}`;
    batch.count = 0;
    batch.frustumCulled = false;
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    batches.set(shape, batch);
    group.add(batch);
  }
  const animals: CreatureState[] = [];
  const transform = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  let sequence = 0;
  let totalReleased = 0;
  let lastTime: number | undefined;
  let disposed = false;
  function animate(time: number) {
    if (disposed) return;
    const dt = lastTime === undefined ? 1 / 60 : THREE.MathUtils.clamp(time - lastTime, 0, .08);
    lastTime = time;
    const now = performance.now() / 1000;
    const counts: Record<Shape, number> = { round: 0, cone: 0, stem: 0 };
    for (const animal of animals) {
      const angle = time * .19 + animal.phase;
      const radius = .55 + .2 * Math.sin(animal.phase * 2.3);
      const targetX = -27.5 + Math.cos(angle) * 2 * radius;
      const targetZ = 8 + Math.sin(angle) * 2.3 * radius;
      const age = now - animal.releasedAt;
      const entry = THREE.MathUtils.smoothstep(age, 0, 6);
      const follow = 1 - Math.exp(-dt * .9);
      const previousX = animal.x, previousZ = animal.z;
      animal.x += (THREE.MathUtils.lerp(animal.spawnX, targetX, entry) - animal.x) * follow;
      animal.z += (THREE.MathUtils.lerp(animal.spawnZ, targetZ, entry) - animal.z) * follow;
      const dx = animal.x - previousX, dz = animal.z - previousZ;
      if (Math.hypot(dx, dz) > .00001) {
        const direction = Math.atan2(dx, dz);
        animal.heading += Math.atan2(Math.sin(direction - animal.heading), Math.cos(direction - animal.heading)) * Math.min(1, dt * 4);
      }
      const flight = animal.species === "butterfly" ? THREE.MathUtils.smoothstep(age, 0, 3) * (.65 + Math.sin(time * 1.8 + animal.phase) * .12) : 0;
      transform.position.set(animal.x, .12 + flight + Math.sin(time * 2 + animal.phase) * .004, animal.z);
      transform.rotation.set(0, animal.heading, 0);
      transform.scale.setScalar(animal.species === "butterfly" ? 1.4 : 1.5);
      transform.updateMatrix();
      const model = models.get(animal.species)!;
      model.animate(time + animal.phase);
      model.group.updateMatrixWorld(true);
      for (const part of parts.get(animal.species)!) {
        const shape = part.userData.pondShape as Shape;
        const batch = batches.get(shape)!;
        matrix.multiplyMatrices(transform.matrix, part.matrixWorld);
        batch.setMatrixAt(counts[shape], matrix);
        batch.setColorAt(counts[shape], (part.material as THREE.MeshStandardMaterial).color);
        counts[shape]++;
      }
    }
    batches.forEach((batch, shape) => {
      batch.count = counts[shape];
      batch.instanceMatrix.needsUpdate = true;
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
    });
  }
  return {
    group,
    get count() { return animals.length; },
    get totalReleased() { return totalReleased; },
    release(species: PondAnimal) {
      if (disposed) return 0;
      const phase = sequence * 2.399963;
      const state = { species, x: -24.39, z: 8, heading: -Math.PI / 2, phase, releasedAt: performance.now() / 1000, spawnX: -24.39, spawnZ: 8 };
      animals[sequence % capacity] = state;
      sequence++;
      totalReleased++;
      group.userData.creatureCount = animals.length;
      group.userData.totalReleased = totalReleased;
      animate(lastTime ?? 0);
      return 1;
    },
    animate,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      batches.forEach(batch => batch.dispose());
      group.clear();
      resources.dispose();
      white.dispose();
    },
  };
}
