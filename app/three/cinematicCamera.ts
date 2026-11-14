import * as THREE from "three";

type CameraLimits = { minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number };
type FacingConstraint = { origin: THREE.Vector3; direction: THREE.Vector3; minDot: number };
type Surface = { object: THREE.Mesh; material: THREE.Material; checked: number; visible: boolean };
type TriangleBatch = { surface: Surface; vertices: Float32Array; bounds: THREE.Box3; queried: number };

const CELL_SIZE = 6;
const CAMERA_RADIUS = .22;
const TRIANGLES_PER_BATCH = 96;
const ORBIT_TURNS = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2, Math.PI, Math.PI * 2 / 3, -Math.PI * 2 / 3];

/** Resolve action cameras against opaque world triangles without changing scene materials. */
export function createCinematicCamera(obstacles: THREE.Object3D[], ignored = new Set<THREE.Object3D>()) {
  const grid = new Map<string, TriangleBatch[]>();
  const broadBatches: TriangleBatch[] = [];
  const seen = new Set<THREE.Object3D>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const queryBounds = new THREE.Box3();
  const ray = new THREE.Ray();
  const triangle = new THREE.Triangle(a, b, c);
  const intersection = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const localBatches: TriangleBatch[] = [];
  const candidate = new THREE.Vector3();
  const ideal = new THREE.Vector3();
  const result = new THREE.Vector3();
  const previous = new THREE.Vector3();
  const previousTarget = new THREE.Vector3();
  const previousDesired = new THREE.Vector3();
  const desiredOffset = new THREE.Vector3();
  const queryFocus: THREE.Vector3[] = [];
  let query = 0;
  let resolution = 0;
  let hasPrevious = false;
  let disposed = false;
  let facing: FacingConstraint | undefined;

  function isIgnored(object: THREE.Object3D) {
    for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (ignored.has(parent)) return true;
    return false;
  }

  function addBatch(surface: Surface, vertices: number[]) {
    const bounds = new THREE.Box3();
    for (let index = 0; index < vertices.length; index += 3) bounds.expandByPoint(a.fromArray(vertices, index));
    const batch: TriangleBatch = { surface, vertices: new Float32Array(vertices), bounds, queried: -1 };
    const minX = Math.floor(bounds.min.x / CELL_SIZE), maxX = Math.floor(bounds.max.x / CELL_SIZE);
    const minZ = Math.floor(bounds.min.z / CELL_SIZE), maxZ = Math.floor(bounds.max.z / CELL_SIZE);
    if ((maxX - minX + 1) * (maxZ - minZ + 1) > 100) { broadBatches.push(batch); return; }
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const key = `${x},${z}`;
      const cell = grid.get(key);
      if (cell) cell.push(batch);
      else grid.set(key, [batch]);
    }
  }

  for (const root of obstacles) root.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || seen.has(object) || isIgnored(object)) return;
    seen.add(object);
    const geometry = object.geometry;
    const position = geometry.getAttribute("position");
    if (!position) return;
    const indices = geometry.index;
    const count = indices ? indices.count : position.count;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const groups = Array.isArray(object.material) ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
    for (const group of groups) {
      const material = materials[group.materialIndex ?? 0];
      if (!material || (!material.depthWrite && material.transparent)) continue;
      const surface: Surface = { object, material, checked: -1, visible: true };
      const start = Math.max(group.start, geometry.drawRange.start);
      const end = Math.min(group.start + group.count, count, geometry.drawRange.start + geometry.drawRange.count);
      let vertices: number[] = [];
      for (let index = start; index + 2 < end; index += 3) {
        for (let corner = 0; corner < 3; corner++) {
          const vertex = indices ? indices.getX(index + corner) : index + corner;
          a.fromBufferAttribute(position, vertex).applyMatrix4(object.matrixWorld);
          vertices.push(a.x, a.y, a.z);
        }
        if (vertices.length === TRIANGLES_PER_BATCH * 9) { addBatch(surface, vertices); vertices = []; }
      }
      if (vertices.length) addBatch(surface, vertices);
    }
  });

  function visible(surface: Surface) {
    if (surface.checked === resolution) return surface.visible;
    surface.checked = resolution;
    surface.visible = surface.material.visible && (!surface.material.transparent || surface.material.opacity >= .65);
    if (!surface.visible) return false;
    for (let object: THREE.Object3D | null = surface.object; object; object = object.parent) {
      if (!object.visible || ignored.has(object)) { surface.visible = false; break; }
    }
    return surface.visible;
  }

  function collect(bounds: THREE.Box3) {
    localBatches.length = 0;
    query++;
    const add = (batch: TriangleBatch) => {
      if (batch.queried === query) return;
      batch.queried = query;
      if (visible(batch.surface) && batch.bounds.intersectsBox(bounds)) localBatches.push(batch);
    };
    const minX = Math.floor(bounds.min.x / CELL_SIZE), maxX = Math.floor(bounds.max.x / CELL_SIZE);
    const minZ = Math.floor(bounds.min.z / CELL_SIZE), maxZ = Math.floor(bounds.max.z / CELL_SIZE);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) grid.get(`${x},${z}`)?.forEach(add);
    broadBatches.forEach(add);
  }

  function cameraClear(point: THREE.Vector3) {
    queryBounds.min.copy(point).addScalar(-CAMERA_RADIUS);
    queryBounds.max.copy(point).addScalar(CAMERA_RADIUS);
    collect(queryBounds);
    const clearance = CAMERA_RADIUS * CAMERA_RADIUS;
    for (const batch of localBatches) {
      if (batch.bounds.distanceToPoint(point) > CAMERA_RADIUS) continue;
      for (let index = 0; index < batch.vertices.length; index += 9) {
        a.fromArray(batch.vertices, index); b.fromArray(batch.vertices, index + 3); c.fromArray(batch.vertices, index + 6);
        triangle.closestPointToPoint(point, closest);
        if (closest.distanceToSquared(point) < clearance) return false;
      }
    }
    return true;
  }

  function sightClear(point: THREE.Vector3, focus: THREE.Vector3) {
    const length = point.distanceTo(focus);
    if (length < .25) return true;
    ray.origin.copy(point);
    ray.direction.subVectors(focus, point).divideScalar(length);
    queryBounds.makeEmpty().expandByPoint(point).expandByPoint(focus).expandByScalar(.01);
    collect(queryBounds);
    for (const batch of localBatches) {
      if (!ray.intersectsBox(batch.bounds)) continue;
      for (let index = 0; index < batch.vertices.length; index += 9) {
        a.fromArray(batch.vertices, index); b.fromArray(batch.vertices, index + 3); c.fromArray(batch.vertices, index + 6);
        // Double-sided intersections also detect cameras embedded in a solid wall.
        if (ray.intersectTriangle(a, b, c, false, intersection) && intersection.distanceTo(point) < length - .18) return false;
      }
    }
    return true;
  }

  function constrain(point: THREE.Vector3, limits?: CameraLimits) {
    if (!limits) return point;
    point.x = THREE.MathUtils.clamp(point.x, limits.minX, limits.maxX);
    point.y = THREE.MathUtils.clamp(point.y, limits.minY, limits.maxY);
    point.z = THREE.MathUtils.clamp(point.z, limits.minZ, limits.maxZ);
    return point;
  }

  function visibleFocusCount(point: THREE.Vector3) {
    if (facing) {
      const dx = point.x - facing.origin.x, dz = point.z - facing.origin.z;
      const length = Math.hypot(dx, dz) * Math.hypot(facing.direction.x, facing.direction.z);
      if (length < .01 || (dx * facing.direction.x + dz * facing.direction.z) / length < facing.minDot) return -1;
    }
    if (!cameraClear(point)) return -1;
    let count = 0;
    for (const focus of queryFocus) if (sightClear(point, focus)) count++;
    return count;
  }

  function retain(point: THREE.Vector3, desired: THREE.Vector3, target: THREE.Vector3) {
    result.copy(point);
    previous.copy(point);
    previousTarget.copy(target);
    previousDesired.copy(desired);
    hasPrevious = true;
    return result;
  }

  return {
    resolve(desired: THREE.Vector3, target: THREE.Vector3, focus: readonly THREE.Vector3[], limits?: CameraLimits, face?: FacingConstraint) {
      if (disposed) return result.copy(desired);
      resolution++;
      facing = face;
      queryFocus.length = 0;
      for (const point of focus) if ([point.x, point.y, point.z].every(Number.isFinite)) queryFocus.push(point);
      if (!queryFocus.length) queryFocus.push(target);
      candidate.copy(desired);
      if (![candidate.x, candidate.y, candidate.z].every(Number.isFinite)) candidate.copy(target).add(new THREE.Vector3(0, 2, 5));
      constrain(candidate, limits);
      ideal.copy(candidate);
      let bestCount = visibleFocusCount(candidate);
      result.copy(candidate);
      if (bestCount === queryFocus.length) return retain(candidate, desired, target);
      if (hasPrevious && previousTarget.distanceToSquared(target) < 1 && previousDesired.distanceToSquared(desired) < 1) {
        candidate.copy(previous).add(target).sub(previousTarget);
        constrain(candidate, limits);
        const count = visibleFocusCount(candidate);
        if (count === queryFocus.length) return retain(candidate, desired, target);
        if (count > bestCount) { bestCount = count; result.copy(candidate); }
      }
      desiredOffset.subVectors(ideal, target);
      const distance = Math.max(2.6, Math.hypot(desiredOffset.x, desiredOffset.z));
      const angle = Math.atan2(desiredOffset.x, desiredOffset.z);
      const height = Math.max(.9, desiredOffset.y);
      // Fixed search budget. Nearby orbital sides preserve the intended distance
      // before the solver tries lower, higher and closer indoor compositions.
      const rings = [
        { radius: distance, height },
        { radius: distance * .72, height: Math.min(height, 1.8) },
        { radius: distance * .48, height: 1.1 },
        { radius: distance * .72, height: height + 1.6 },
        { radius: Math.min(distance * .35, 2.8), height: .9 },
      ];
      for (const ring of rings) for (const turn of ORBIT_TURNS) {
        candidate.set(target.x + Math.sin(angle + turn) * ring.radius, target.y + ring.height, target.z + Math.cos(angle + turn) * ring.radius);
        constrain(candidate, limits);
        const count = visibleFocusCount(candidate);
        if (count === queryFocus.length) return retain(candidate, desired, target);
        if (count > bestCount) { bestCount = count; result.copy(candidate); }
      }
      // Impossible compositions retain the most visible focus points and a clear
      // camera volume, instead of returning a position inside the blocking wall.
      return retain(result, desired, target);
    },
    dispose() {
      disposed = true;
      grid.clear();
      broadBatches.length = 0;
      seen.clear();
      localBatches.length = 0;
      queryFocus.length = 0;
    },
  };
}
