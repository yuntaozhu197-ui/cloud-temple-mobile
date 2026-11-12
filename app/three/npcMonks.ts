import * as THREE from "three";
import { createMonk } from "./monk";
import { getTempleSchedule } from "../templeSchedule";
import type { NpcResidentId } from "../npcResidents";

type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };
type Route = { from: [number, number]; to: [number, number]; action: string; heading: number; speed: number };

export type NpcResident = {
  readonly id: NpcResidentId;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heading: number;
};

const appearances = [
  { id: "mingyuan", robe: "#ab744d", sash: "#e1b772", skin: "#f2c995", width: .96, height: 1.01, head: [1.02, .99, 1], nose: 1.1 },
  { id: "mingjing", robe: "#90604f", sash: "#c3a668", skin: "#ddb88e", width: 1.13, height: 1.03, head: [1.08, .97, 1.02], nose: 1.3 },
  { id: "huizhi", robe: "#7d8590", sash: "#d6bc8a", skin: "#f1d7b0", width: .94, height: .96, head: [.97, 1.05, .99], nose: .85 },
  { id: "kongshan", robe: "#839078", sash: "#d7bd82", skin: "#d9ac80", width: .96, height: 1.12, head: [.96, 1.07, .98], nose: 1.2 },
  { id: "miaolian", robe: "#bc937f", sash: "#e6bbaf", skin: "#f0cfb1", width: 1.03, height: .88, head: [1.08, .96, 1.02], nose: .9 },
  { id: "wenxin", robe: "#628b8a", sash: "#e3c88d", skin: "#edc69a", width: .88, height: .97, head: [.96, 1.04, 1.01], nose: .95 },
  { id: "shanhe", robe: "#818b59", sash: "#cfa265", skin: "#d1a477", width: 1.07, height: 1.02, head: [1.04, 1.02, .98], nose: 1.25 },
  { id: "xingchen", robe: "#b97b4d", sash: "#dbc39a", skin: "#e4b785", width: .93, height: 1.08, head: [.98, 1.01, 1], nose: 1.05 },
] as const;

/** Scene residents use one posed prototype and shared instancing, independent of online visitors. */
export function createNpcMonks(floorHeightAt: (x: number, z: number) => number, colliders: Collider[]) {
  const group = new THREE.Group();
  group.name = "寺院常住小和尚 · 场景人物";
  const routes: Route[] = [
    { from: [-4.5, -10.5], to: [-4.5, -10.5], action: "salute", heading: Math.PI, speed: .12 },
    { from: [4.5, -10.5], to: [4.5, -10.5], action: "salute", heading: Math.PI, speed: .13 },
    { from: [-30, -14.8], to: [-30, -14.8], action: "chantSit", heading: Math.PI, speed: .12 },
    { from: [30, -12], to: [30, -12], action: "salute", heading: Math.PI, speed: .12 },
    { from: [-10, 15], to: [-10, 18], action: "idle", heading: 0, speed: .19 },
    { from: [10, 15], to: [10, 18], action: "idle", heading: 0, speed: .16 },
    { from: [-33, 1], to: [-37, 1], action: "idle", heading: -Math.PI / 2, speed: .14 },
    { from: [44, -22], to: [44, -19], action: "idle", heading: 0, speed: .15 },
  ];
  const prototype = createMonk();
  function visiblePart(object: THREE.Object3D) {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return true;
  }
  const sourceMeshes: THREE.Mesh[] = [];
  prototype.group.traverse(object => { if (object instanceof THREE.Mesh) sourceMeshes.push(object); });
  const usedMeshes = new Set<THREE.Mesh>();
  for (const action of ["idle", "walk", "prayer", "salute", "chant", "chantSit", "meditate", "beads"]) {
    prototype.update(action, .5, action === "walk");
    sourceMeshes.forEach(mesh => { if (visiblePart(mesh)) usedMeshes.add(mesh); });
  }
  prototype.update("idle", 0, false);
  const originals = sourceMeshes.filter(mesh => usedMeshes.has(mesh));
  const simplified = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  for (const mesh of originals) {
    const original = mesh.geometry;
    let geometry = simplified.get(original);
    if (!geometry && original instanceof THREE.SphereGeometry) {
      const p = original.parameters;
      const head = p.radius < 1 && p.widthSegments > 20;
      geometry = new THREE.SphereGeometry(p.radius, Math.min(p.widthSegments, head ? 14 : 10), Math.min(p.heightSegments, head ? 10 : 7), p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
    }
    if (!geometry && original instanceof THREE.TubeGeometry) {
      const p = original.parameters;
      geometry = new THREE.TubeGeometry(p.path, Math.min(6, p.tubularSegments), p.radius, Math.min(4, p.radialSegments), p.closed);
    }
    if (!geometry && original instanceof THREE.TorusGeometry) {
      const p = original.parameters;
      geometry = new THREE.TorusGeometry(p.radius, p.tube, Math.min(4, p.radialSegments), Math.min(12, p.tubularSegments), p.arc);
    }
    if (geometry) {
      simplified.set(original, geometry);
      mesh.geometry = geometry;
    }
  }
  const head = prototype.group.getObjectByName("monk-head")!;
  const torso = prototype.group.getObjectByName("monk-torso")!;
  const nose = head.children.find(object => object instanceof THREE.Mesh && Math.abs(object.position.z - .267) < .001)!;
  const noseScale = nose.scale.clone();
  const sourceGroups = new Map<string, { parts: THREE.Mesh[]; tint: "robe" | "sash" | "skin" | null }>();
  const batches: Array<{ instance: THREE.InstancedMesh; parts: THREE.Mesh[] }> = [];
  const tintedSurfaces = new Map<THREE.Material, THREE.Material>();
  for (const mesh of originals) {
    const surface = mesh.material as THREE.MeshStandardMaterial;
    const color = surface.color?.getHex();
    const tint = color === 0xcf895c ? "robe" : color === 0xe7b97c ? "sash" : color === 0xf2c995 ? "skin" : null;
    const key = `${mesh.geometry.uuid}:${surface.uuid}`;
    const entry = sourceGroups.get(key);
    if (entry) entry.parts.push(mesh);
    else sourceGroups.set(key, { parts: [mesh], tint });
    if (tint && !tintedSurfaces.has(surface)) {
      const white = surface.clone();
      white.color.set(0xffffff);
      tintedSurfaces.set(surface, white);
    }
  }
  for (const entry of sourceGroups.values()) {
    const source = entry.parts[0];
    const surface = source.material as THREE.Material;
    const instance = new THREE.InstancedMesh(source.geometry, tintedSurfaces.get(surface) ?? surface, entry.parts.length * routes.length);
    instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instance.frustumCulled = false;
    instance.castShadow = false;
    instance.receiveShadow = true;
    if (entry.tint) for (let monk = 0; monk < routes.length; monk++) for (let part = 0; part < entry.parts.length; part++) {
      instance.setColorAt(monk * entry.parts.length + part, new THREE.Color(appearances[monk][entry.tint]));
    }
    group.add(instance);
    batches.push({ instance, parts: entry.parts });
  }
  // Accessories share five low-poly geometries. Each part has one instance, even
  // though its transform follows the same animated head or torso prototype.
  const accessoryGeometry = {
    oval: new THREE.SphereGeometry(1, 10, 7),
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 8),
    cone: new THREE.ConeGeometry(1, 1, 12),
    ring: new THREE.TorusGeometry(1, .09, 4, 16),
  };
  const accessorySurface = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .88 });
  type Accessory = { object: THREE.Mesh; owner: number; color: string };
  const accessoryParts: Accessory[] = [];
  function accessory(owner: number, shape: keyof typeof accessoryGeometry, color: string, parent: THREE.Object3D, position: number[], scale: number[], rotation = [0, 0, 0]) {
    const object = new THREE.Mesh(accessoryGeometry[shape], accessorySurface);
    object.name = `${appearances[owner].id}-${shape}`;
    object.position.set(position[0], position[1], position[2]);
    object.scale.set(scale[0], scale[1], scale[2]);
    object.rotation.set(rotation[0], rotation[1], rotation[2]);
    parent.add(object);
    accessoryParts.push({ object, owner, color });
  }
  // A soft blue welcome scarf, with two hanging ends at the shoulders.
  accessory(0, "oval", "#7e9b9e", torso, [0, .38, .03], [.185, .065, .15]);
  accessory(0, "box", "#7e9b9e", torso, [-.15, .22, .2], [.085, .26, .035], [0, 0, -.12]);
  accessory(0, "box", "#a6bbad", torso, [.17, .23, .17], [.075, .2, .035], [0, 0, .2]);
  // A large wooden mala rests on the chest, clear of the prayer hands.
  for (let index = 0; index < 13; index++) {
    const angle = index / 13 * Math.PI * 2;
    accessory(1, "oval", "#674b39", torso, [Math.sin(angle) * .205, .22 + Math.cos(angle) * .17, .16 + Math.sin(angle) ** 2 * .035], [.027, .029, .025]);
  }
  for (const side of [-1, 1]) accessory(1, "oval", "#6c5142", head, [side * .095, .056, .255], [.047, .012, .013], [0, 0, side * -.12]);
  // Round wire glasses and a little stitched book satchel.
  for (const side of [-1, 1]) accessory(2, "ring", "#61564b", head, [side * .1, 0, .276], [.066, .061, .05]);
  accessory(2, "box", "#61564b", head, [0, .005, .279], [.067, .011, .009]);
  accessory(2, "box", "#86654c", torso, [-.25, .09, .18], [.13, .26, .11], [0, 0, -.12]);
  accessory(2, "box", "#e4d6b6", torso, [-.25, .09, .194], [.105, .22, .1], [0, 0, -.12]);
  accessory(2, "box", "#587d82", torso, [-.25, .09, .255], [.14, .27, .018], [0, 0, -.12]);
  // A wide straw hat has an open face and a gourd hangs at the hip.
  accessory(3, "cone", "#c5aa6a", head, [0, .3, -.015], [.44, .16, .37]);
  accessory(3, "ring", "#a98c51", head, [0, .22, -.015], [.43, .35, .038], [Math.PI / 2, 0, 0]);
  accessory(3, "oval", "#b9804a", torso, [.3, .04, -.015], [.092, .11, .085]);
  accessory(3, "oval", "#c6975b", torso, [.3, .17, -.015], [.063, .08, .06]);
  accessory(3, "cylinder", "#775e40", torso, [.3, .25, -.015], [.023, .055, .023]);
  // A lotus peeks out of a rose-colored shoulder pouch.
  accessory(4, "oval", "#a87772", torso, [.25, .04, .12], [.1, .12, .07]);
  accessory(4, "cylinder", "#768a58", torso, [.265, .2, .14], [.009, .28, .009], [0, 0, -.13]);
  for (let index = 0; index < 5; index++) {
    const angle = index / 5 * Math.PI * 2;
    accessory(4, "oval", index % 2 ? "#edc9b9" : "#d7998e", torso, [.28 + Math.sin(angle) * .035, .35, .14 + Math.cos(angle) * .03], [.028, .065, .025], [Math.cos(angle) * .5, 0, Math.sin(angle) * .5]);
  }
  // A cream scroll is bound by a narrow blue ribbon at the side.
  accessory(5, "cylinder", "#eee1bd", torso, [.27, .14, .12], [.063, .37, .063], [0, 0, -.17]);
  for (const y of [-.045, .325]) accessory(5, "cylinder", "#966847", torso, [.27 + (y - .14) * .17, y, .12], [.075, .018, .075], [0, 0, -.17]);
  accessory(5, "ring", "#557d8b", torso, [.27, .14, .12], [.067, .067, .1], [Math.PI / 2, 0, -.17]);
  accessory(5, "oval", "#654d3b", head, [-.11, .057, .25], [.044, .009, .01], [0, 0, -.2]);
  // A bamboo broom rides along the gardener's side, its bristles near the feet.
  accessory(6, "cylinder", "#a98e52", torso, [.38, .12, -.03], [.014, .95, .014], [0, 0, -.12]);
  accessory(6, "cone", "#c0a369", torso, [.32, -.29, -.03], [.14, .24, .065]);
  for (const offset of [-.07, -.035, 0, .035, .07]) accessory(6, "cylinder", "#947748", torso, [.32 + offset, -.3, .018], [.005, .2, .005], [0, 0, offset * -1.3]);
  accessory(6, "box", "#bd9c5e", torso, [.32, -.22, -.03], [.12, .032, .08]);
  // A dark headband and a padded bell mallet identify the bell keeper.
  accessory(7, "ring", "#8b674e", head, [0, .09, -.005], [.28, .265, .18], [Math.PI / 2, 0, 0]);
  accessory(7, "box", "#8b674e", head, [.24, .02, -.15], [.045, .2, .025], [0, 0, -.2]);
  accessory(7, "cylinder", "#805d3f", torso, [-.32, .13, .06], [.021, .49, .021], [0, 0, -.24]);
  accessory(7, "cylinder", "#c8a674", torso, [-.26, .36, .06], [.069, .17, .069], [0, 0, Math.PI / 2]);

  const accessoryBatches = Object.values(accessoryGeometry).map(geometry => {
    const parts = accessoryParts.filter(part => part.object.geometry === geometry);
    const instance = new THREE.InstancedMesh(geometry, accessorySurface, parts.length);
    instance.name = "常住小和尚 · 随身物品";
    instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instance.frustumCulled = false;
    instance.receiveShadow = true;
    parts.forEach((part, index) => instance.setColorAt(index, new THREE.Color(part.color)));
    group.add(instance);
    return { instance, parts };
  });
  const residents = routes.map((route, index) => ({ id: appearances[index].id as NpcResidentId, x: route.from[0], y: floorHeightAt(...route.from), z: route.from[1], heading: route.heading }));
  const routeTimes = routes.map(() => 0);
  const rootTransform = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  let lastTime = 0;
  let lastDraw = -Infinity;
  let conversationId: NpcResidentId | null = null;
  let conversationTarget: { x: number; z: number } | undefined;
  let lastScheduleSecond = -1;
  let lesson = false;
  let disposed = false;
  const blocked = (x: number, z: number) => colliders.some(box => x > box.minX - .25 && x < box.maxX + .25 && z > box.minZ - .25 && z < box.maxZ + .25);
  function animate(time: number, timestamp = Date.now()) {
    if (disposed) return;
    const elapsed = Math.max(0, Math.min(.25, time - lastTime));
    lastTime = time;
    const second = Math.floor(timestamp / 1000);
    const previousLesson = lesson;
    if (second !== lastScheduleSecond) {
      lastScheduleSecond = second;
      lesson = Boolean(getTempleSchedule(timestamp).lesson);
    }
    if (!lesson) routeTimes.forEach((value, index) => { if (residents[index].id !== conversationId) routeTimes[index] = value + elapsed; });
    if (time - lastDraw < 1 / 18 && previousLesson === lesson) return;
    lastDraw = time;
    routes.forEach((route, index) => {
      const resident = residents[index];
      const walkingRoute = route.from[0] !== route.to[0] || route.from[1] !== route.to[1];
      const talking = !lesson && resident.id === conversationId;
      const angle = routeTimes[index] * route.speed + index * .7;
      const progress = (1 - Math.cos(angle)) / 2;
      if (!lesson && !talking && walkingRoute) {
        const x = THREE.MathUtils.lerp(route.from[0], route.to[0], progress);
        const z = THREE.MathUtils.lerp(route.from[1], route.to[1], progress);
        if (!blocked(x, z)) { resident.x = x; resident.z = z; }
        const direction = Math.sin(angle) >= 0 ? 1 : -1;
        resident.heading = Math.atan2((route.to[0] - route.from[0]) * direction, (route.to[1] - route.from[1]) * direction);
      }
      if (talking && conversationTarget) resident.heading = Math.atan2(conversationTarget.x - resident.x, conversationTarget.z - resident.z);
      else if (!walkingRoute) resident.heading = route.heading;
      const walking = !lesson && !talking && walkingRoute && Math.abs(Math.sin(angle)) > .08;
      prototype.update(lesson ? "chant" : talking ? "salute" : walking ? "idle" : route.action, time + index * 1.3, walking);
      const appearance = appearances[index];
      head.scale.set(appearance.head[0], appearance.head[1], appearance.head[2]);
      nose.scale.copy(noseScale).multiplyScalar(appearance.nose);
      prototype.group.updateMatrixWorld(true);
      resident.y = floorHeightAt(resident.x, resident.z);
      rootTransform.position.set(resident.x, resident.y, resident.z);
      rootTransform.rotation.set(0, resident.heading, 0);
      rootTransform.scale.set(appearance.width * .95, appearance.height * .95, appearance.width * .95);
      rootTransform.updateMatrix();
      for (const entry of batches) entry.parts.forEach((part, partIndex) => {
        const visible = visiblePart(part);
        if (visible) matrix.multiplyMatrices(rootTransform.matrix, part.matrixWorld);
        entry.instance.setMatrixAt(index * entry.parts.length + partIndex, visible ? matrix : hidden);
      });
      for (const entry of accessoryBatches) entry.parts.forEach((part, partIndex) => {
        if (part.owner !== index) return;
        matrix.multiplyMatrices(rootTransform.matrix, part.object.matrixWorld);
        entry.instance.setMatrixAt(partIndex, matrix);
      });
    });
    for (const entry of batches) entry.instance.instanceMatrix.needsUpdate = true;
    for (const entry of accessoryBatches) entry.instance.instanceMatrix.needsUpdate = true;
  }
  animate(0);
  return {
    group,
    count: routes.length,
    residents: residents as readonly NpcResident[],
    setConversation(id: NpcResidentId | null, player?: { x: number; z: number }) {
      const nextId = residents.some(resident => resident.id === id) ? id : null;
      if (nextId !== conversationId) lastDraw = -Infinity;
      conversationId = nextId;
      conversationTarget = player;
    },
    animate,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      for (const entry of batches) entry.instance.dispose();
      tintedSurfaces.forEach(material => material.dispose());
      accessoryBatches.forEach(entry => entry.instance.dispose());
      Object.values(accessoryGeometry).forEach(geometry => geometry.dispose());
      accessorySurface.dispose();
      prototype.dispose();
      simplified.forEach(geometry => geometry.dispose());
      group.clear();
    },
  };
}
