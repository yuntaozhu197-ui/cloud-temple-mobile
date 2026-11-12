import * as THREE from "three";
import { createMonk } from "./monk";
import { getTempleSchedule } from "../templeSchedule";

type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };
type Route = { from: [number, number]; to: [number, number]; action: string; heading: number; speed: number };

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
  const sourceGroups = new Map<string, { parts: THREE.Mesh[]; robe: boolean }>();
  const batches: Array<{ instance: THREE.InstancedMesh; parts: THREE.Mesh[] }> = [];
  const robeSurfaces = new Map<THREE.Material, THREE.Material>();
  for (const mesh of originals) {
    const surface = mesh.material as THREE.MeshStandardMaterial;
    const robe = surface.color?.getHex() === 0xcf895c;
    const key = `${mesh.geometry.uuid}:${surface.uuid}`;
    const entry = sourceGroups.get(key);
    if (entry) entry.parts.push(mesh);
    else sourceGroups.set(key, { parts: [mesh], robe });
    if (robe && !robeSurfaces.has(surface)) {
      const white = surface.clone();
      white.color.set(0xffffff);
      robeSurfaces.set(surface, white);
    }
  }
  const colors = ["#bf825b", "#c79660", "#a88e65", "#c49771", "#c48961", "#ba9169", "#b6845f", "#c89c73"];
  for (const entry of sourceGroups.values()) {
    const source = entry.parts[0];
    const surface = source.material as THREE.Material;
    const instance = new THREE.InstancedMesh(source.geometry, robeSurfaces.get(surface) ?? surface, entry.parts.length * routes.length);
    instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instance.frustumCulled = false;
    instance.castShadow = false;
    instance.receiveShadow = true;
    if (entry.robe) for (let monk = 0; monk < routes.length; monk++) for (let part = 0; part < entry.parts.length; part++) {
      instance.setColorAt(monk * entry.parts.length + part, new THREE.Color(colors[monk]));
    }
    group.add(instance);
    batches.push({ instance, parts: entry.parts });
  }
  const residents = routes.map(route => ({ x: route.from[0], z: route.from[1], heading: route.heading }));
  const rootTransform = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  let lastTime = 0;
  let lastDraw = -Infinity;
  let walkTime = 0;
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
    if (!lesson) walkTime += elapsed;
    if (time - lastDraw < 1 / 18 && previousLesson === lesson) return;
    lastDraw = time;
    routes.forEach((route, index) => {
      const resident = residents[index];
      const walkingRoute = route.from[0] !== route.to[0] || route.from[1] !== route.to[1];
      const angle = walkTime * route.speed + index * .7;
      const progress = (1 - Math.cos(angle)) / 2;
      if (!lesson && walkingRoute) {
        const x = THREE.MathUtils.lerp(route.from[0], route.to[0], progress);
        const z = THREE.MathUtils.lerp(route.from[1], route.to[1], progress);
        if (!blocked(x, z)) { resident.x = x; resident.z = z; }
        const direction = Math.sin(angle) >= 0 ? 1 : -1;
        resident.heading = Math.atan2((route.to[0] - route.from[0]) * direction, (route.to[1] - route.from[1]) * direction);
      }
      const walking = !lesson && walkingRoute && Math.abs(Math.sin(angle)) > .08;
      prototype.update(lesson ? "chant" : walking ? "idle" : route.action, time + index * 1.3, walking);
      prototype.group.updateMatrixWorld(true);
      rootTransform.position.set(resident.x, floorHeightAt(resident.x, resident.z), resident.z);
      rootTransform.rotation.set(0, resident.heading, 0);
      rootTransform.scale.setScalar(.9 + index % 4 * .035);
      rootTransform.updateMatrix();
      for (const entry of batches) entry.parts.forEach((part, partIndex) => {
        const visible = visiblePart(part);
        if (visible) matrix.multiplyMatrices(rootTransform.matrix, part.matrixWorld);
        entry.instance.setMatrixAt(index * entry.parts.length + partIndex, visible ? matrix : hidden);
      });
    });
    for (const entry of batches) entry.instance.instanceMatrix.needsUpdate = true;
  }
  animate(0);
  return {
    group,
    count: routes.length,
    animate,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      for (const entry of batches) entry.instance.dispose();
      robeSurfaces.forEach(material => material.dispose());
      prototype.dispose();
      simplified.forEach(geometry => geometry.dispose());
      group.clear();
    },
  };
}
