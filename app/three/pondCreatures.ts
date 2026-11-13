import * as THREE from "three";
import type { PondSpecies } from "../pondGame";

type Shape = "round" | "cone" | "stem";
type PondAnimal = "turtle" | "frog" | "butterfly";
type Resources = ReturnType<typeof creatureResources>;

function creatureResources(detail: number) {
  const geometries = {
    round: new THREE.SphereGeometry(1, detail, Math.max(5, Math.round(detail * .65))),
    cone: new THREE.ConeGeometry(1, 1, 6),
    stem: new THREE.CylinderGeometry(1, 1, 1, 6),
  };
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  return {
    geometries,
    surface(color: string) {
      let surface = materials.get(color);
      if (!surface) {
        surface = new THREE.MeshStandardMaterial({ color, roughness: .76 });
        materials.set(color, surface);
      }
      return surface;
    },
    dispose() {
      Object.values(geometries).forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    },
  };
}

function creatureModel(species: PondSpecies, resources: Resources) {
  const group = new THREE.Group();
  group.name = `放生生物 · ${species}`;
  const limbs: THREE.Group[] = [];
  const wings: THREE.Group[] = [];
  let tail: THREE.Mesh | undefined;
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
    const body = goldfish ? "#e7a253" : koi ? "#efe0bd" : "#95afa1";
    part("round", body, [0, .031, 0], [goldfish ? .047 : .034, goldfish ? .036 : .023, koi ? .104 : .086]);
    tail = part("cone", goldfish ? "#df8750" : koi ? "#cc7753" : "#79998b", [0, .03, -.108], [goldfish ? .085 : .038, .065, .014]);
    tail.rotation.x = -Math.PI / 2;
    if (koi) for (const z of [-.045, .035]) part("round", "#cd7956", [.005, .05, z], [.027, .009, .025]);
    for (const side of [-1, 1]) part("round", body, [side * .036, .022, -.015], [.022, .006, .028]).rotation.y = side * .55;
    eyes(goldfish ? .032 : .022, .043, .062, .006);
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
      if (tail) tail.rotation.y = Math.sin(time * 8) * .17;
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
