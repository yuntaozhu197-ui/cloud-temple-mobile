import * as THREE from "three";

export function createSkyLanterns() {
  const group = new THREE.Group();
  group.name = "孔明灯许愿台与升空灯火";
  const capacity = 16;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instances: THREE.InstancedMesh[] = [];
  const addMaterial = (color: string, emissive = "#000000") => {
    const material = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.65, roughness: 0.8, side: THREE.DoubleSide });
    materials.add(material); return material;
  };
  const paper = addMaterial("#edbd83", "#a94d21");
  const bamboo = addMaterial("#8e724c");
  const flame = addMaterial("#ffe7a1", "#ffc565");
  const stone = addMaterial("#d6d0b2");
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
    geometries.add(geometry); const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); group.add(object); return object;
  }
  mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.08, 20), stone, 0, 0.04, 28);
  const rim = mesh(new THREE.TorusGeometry(1.05, 0.03, 5, 32), bamboo, 0, 0.1, 28); rim.rotation.x = -Math.PI / 2;
  function batch(geometry: THREE.BufferGeometry, material: THREE.Material) {
    geometries.add(geometry); const object = new THREE.InstancedMesh(geometry, material, capacity); object.frustumCulled = false; object.instanceMatrix.setUsage(THREE.DynamicDrawUsage); instances.push(object); group.add(object); return object;
  }
  const hull = batch(new THREE.LatheGeometry([[0.24,-0.4],[0.36,-0.22],[0.4,0.22],[0.29,0.43]].map(([x,y]) => new THREE.Vector2(x,y)), 10), paper);
  const bottom = batch(new THREE.TorusGeometry(0.24, 0.018, 5, 16), bamboo);
  const flames = batch(new THREE.SphereGeometry(0.1, 8, 5), flame);
  const floats: { at: number; phase: number }[] = [];
  const transform = new THREE.Object3D();
  let sequence = 0;
  let disposed = false;
  function animate(time: number) {
    if (disposed) return;
    const now = performance.now() / 1000;
    for (let index = 0; index < capacity; index++) {
      const item = floats[index];
      const age = item ? now - item.at : Infinity;
      const visible = age >= 0 && age < 90;
      const size = visible ? Math.min(1, age * 3 + 0.65) * Math.min(1, (90 - age) / 12) : 0;
      const x = visible ? Math.sin(age * 0.12 + item.phase) * Math.min(2, age * 0.03) : 0;
      const y = visible ? 1.8 + age * 0.36 : -10;
      const z = visible ? 28.3 - age * 0.075 + Math.sin(age * 0.08 + item.phase) * 0.5 : 28.3;
      transform.position.set(x, y, z); transform.rotation.set(Math.sin(time * 0.8 + index) * 0.07, item?.phase ?? 0, Math.cos(time * 0.6 + index) * 0.06); transform.scale.setScalar(size); transform.updateMatrix(); hull.setMatrixAt(index, transform.matrix);
      transform.position.y = y - 0.4 * size; transform.rotation.x = Math.PI / 2; transform.updateMatrix(); bottom.setMatrixAt(index, transform.matrix);
      transform.position.y = y - 0.2 * size; transform.rotation.set(0,0,0); transform.scale.set(size * 0.6, size * (1.3 + Math.sin(time * 4 + index) * 0.1), size * 0.6); transform.updateMatrix(); flames.setMatrixAt(index, transform.matrix);
    }
    instances.forEach(object => { object.instanceMatrix.needsUpdate = true; });
  }
  animate(0);
  return {
    group,
    landmarks: [{ name: "孔明灯许愿台", x: 0, z: 28 }],
    interactions: [{ kind: "skyLantern" as const, label: "✧ 放飞孔明灯", x: 0, y: 1.1, z: 28 }],
    release() { if (!disposed) { floats[sequence % capacity] = { at: performance.now() / 1000, phase: sequence * 2.399 }; sequence++; group.userData.released = sequence; } },
    animate,
    dispose() { if (disposed) return; disposed = true; group.removeFromParent(); instances.forEach(object => object.dispose()); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); group.clear(); },
  };
}
