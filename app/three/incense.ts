import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function createIncenseOffering(scene: THREE.Scene, position: { x: number; z: number; smoke?: boolean } = { x: 0, z: -14.8 }) {
  const group = new THREE.Group();
  group.name = "大殿三足香炉";
  group.position.set(position.x, 0, position.z);
  scene.add(group);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instances: THREE.InstancedMesh[] = [];
  let disposed = false;

  function surface(color: string, options: THREE.MeshStandardMaterialParameters = {}) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...options });
    materials.add(material);
    return material;
  }
  const bronze = surface("#ac8551", { metalness: 0.63, roughness: 0.43 });
  const gold = surface("#d7b678", { metalness: 0.65, roughness: 0.38 });
  const darkBronze = surface("#675544", { metalness: 0.35, roughness: 0.75 });
  const ash = surface("#d8cbb6", { roughness: 1 });
  const bamboo = surface("#c8a371", { roughness: 0.91 });
  const incense = surface("#92714f", { roughness: 0.98 });
  const burnedAsh = surface("#b9ae9b", { roughness: 1 });
  const ember = surface("#e68c57", { emissive: "#f27e3e", emissiveIntensity: 1.6, roughness: 0.9 });

  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group) {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }

  const furnace = new THREE.Group();
  group.add(furnace);
  mesh(new THREE.CylinderGeometry(0.46, 0.49, 0.1, 24), darkBronze, 0, 0.10, 0, furnace);
  const profile = [[0.23, 0.31], [0.29, 0.34], [0.37, 0.43], [0.42, 0.56], [0.43, 0.66], [0.41, 0.73], [0.37, 0.74], [0.35, 0.68]];
  mesh(new THREE.LatheGeometry(profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 28), bronze, 0, 0, 0, furnace);
  const rim = mesh(new THREE.TorusGeometry(0.405, 0.035, 6, 32), gold, 0, 0.735, 0, furnace);
  rim.rotation.x = Math.PI / 2;
  const baseRing = mesh(new THREE.TorusGeometry(0.268, 0.022, 5, 24), gold, 0, 0.34, 0, furnace);
  baseRing.rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.035, 24), ash, 0, 0.705, 0, furnace);
  for (let index = 0; index < 3; index += 1) {
    const angle = index * Math.PI * 2 / 3 + Math.PI / 6;
    const foot = mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.32, 8), bronze,
      Math.cos(angle) * 0.30, 0.25, Math.sin(angle) * 0.30, furnace);
    foot.rotation.set(Math.sin(angle) * 0.17, 0, -Math.cos(angle) * 0.17);
  }
  for (const side of [-1, 1]) {
    const handle = mesh(new THREE.TorusGeometry(0.135, 0.026, 5, 20, Math.PI * 1.5), gold, side * 0.46, 0.61, 0, furnace);
    handle.rotation.z = side === 1 ? -Math.PI / 4 : Math.PI * 3 / 4;
  }
  // A small raised lotus and ash grains remain geometry when viewed up close.
  const petalShape = new THREE.SphereGeometry(0.046, 6, 4);
  for (let index = -2; index <= 2; index += 1) {
    const petal = mesh(petalShape, gold, index * 0.036, 0.53, 0.412 - Math.abs(index) * 0.003, furnace);
    petal.scale.set(0.6, 1.3, 0.24);
    petal.rotation.z = -index * 0.3;
  }
  const grainShape = new THREE.SphereGeometry(0.014, 5, 3);
  for (let index = 0; index < 10; index += 1) {
    const angle = index * 2.4;
    const radius = 0.16 + (index % 3) * 0.055;
    mesh(grainShape, burnedAsh, Math.cos(angle) * radius, 0.728, Math.sin(angle) * radius, furnace).scale.y = 0.45;
  }
  // Stationary copper details share a handful of material batches.
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  furnace.children.forEach(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    object.updateMatrix();
    const pieces = batches.get(object.material) ?? [];
    pieces.push(object.geometry.clone().applyMatrix4(object.matrix));
    batches.set(object.material, pieces);
  });
  furnace.clear();
  for (const [material, pieces] of batches) {
    const geometry = mergeGeometries(pieces, false);
    pieces.forEach(piece => piece.dispose());
    if (geometry) mesh(geometry, material, 0, 0, 0, furnace);
  }

  const sticks = new THREE.Group();
  sticks.name = "三炷清香";
  sticks.visible = false;
  group.add(sticks);
  const shaftGeometry = new THREE.CylinderGeometry(0.013, 0.013, 1, 6);
  const tipGeometry = new THREE.SphereGeometry(0.021, 8, 6);
  geometries.add(shaftGeometry);
  geometries.add(tipGeometry);

  function instanced(geometry: THREE.BufferGeometry, material: THREE.Material) {
    const object = new THREE.InstancedMesh(geometry, material, 3);
    object.frustumCulled = false;
    object.castShadow = true;
    sticks.add(object);
    instances.push(object);
    return object;
  }
  const bareShafts = instanced(shaftGeometry, bamboo);
  const coatedShafts = instanced(shaftGeometry, incense);
  const ashTips = instanced(shaftGeometry, burnedAsh);
  const embers = instanced(tipGeometry, ember);
  const glowMaterial = new THREE.MeshBasicMaterial({ color: "#f4b46d", transparent: true, opacity: 0.17, depthWrite: false, blending: THREE.AdditiveBlending });
  materials.add(glowMaterial);
  const emberGlows = instanced(tipGeometry, glowMaterial);
  emberGlows.castShadow = false;
  const transform = new THREE.Object3D();
  const tips = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  // A tiny alpha gradient softens each translucent tube and fades its upper end.
  const alphaHeight = 32;
  const alphaPixels = new Uint8Array(alphaHeight * 4);
  for (let row = 0; row < alphaHeight; row += 1) {
    const phase = row / (alphaHeight - 1);
    const opacity = Math.min(1, phase * 12) * Math.pow(1 - phase, 1.7);
    const shade = Math.round(opacity * 255);
    alphaPixels.set([shade, shade, shade, 255], row * 4);
  }
  const smokeAlpha = new THREE.DataTexture(alphaPixels, 1, alphaHeight, THREE.RGBAFormat);
  smokeAlpha.magFilter = THREE.LinearFilter;
  smokeAlpha.minFilter = THREE.LinearFilter;
  smokeAlpha.needsUpdate = true;
  const smokeMaterial = new THREE.MeshBasicMaterial({ color: "#e5dece", transparent: true, opacity: 0.24, alphaMap: smokeAlpha, side: THREE.DoubleSide, depthWrite: false });
  materials.add(smokeMaterial);
  const smokeRings = 28;
  const smokeSides = 5;
  const smokePositions: Float32Array[] = [];
  const smokeGeometries: THREE.BufferGeometry[] = [];
  for (let strand = 0; strand < 3; strand += 1) {
    const positions = new Float32Array(smokeRings * (smokeSides + 1) * 3);
    const uv: number[] = [];
    const indices: number[] = [];
    for (let ring = 0; ring < smokeRings; ring += 1) {
      for (let side = 0; side <= smokeSides; side += 1) uv.push(side / smokeSides, ring / (smokeRings - 1));
      if (ring === smokeRings - 1) continue;
      for (let side = 0; side < smokeSides; side += 1) {
        const current = ring * (smokeSides + 1) + side;
        const next = current + smokeSides + 1;
        indices.push(current, next, current + 1, current + 1, next, next + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometries.add(geometry);
    const smoke = mesh(geometry, smokeMaterial, 0, 0, 0, sticks);
    smoke.name = `轻烟 ${strand + 1}`;
    smoke.visible = position.smoke !== false;
    smoke.castShadow = false;
    smoke.receiveShadow = false;
    smoke.frustumCulled = false;
    smokePositions.push(positions);
    smokeGeometries.push(geometry);
  }

  const sparkPositions = new Float32Array(12 * 3);
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute("position", new THREE.BufferAttribute(sparkPositions, 3).setUsage(THREE.DynamicDrawUsage));
  geometries.add(sparkGeometry);
  const sparkMaterial = new THREE.PointsMaterial({ color: "#f1c58d", size: 0.025, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  materials.add(sparkMaterial);
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.name = "点香火星";
  sparks.visible = false;
  sparks.frustumCulled = false;
  sticks.add(sparks);
  const haloMaterial = new THREE.MeshBasicMaterial({ color: "#f3d89f", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  materials.add(haloMaterial);
  const halo = mesh(new THREE.RingGeometry(0.55, 0.58, 40), haloMaterial, 0, 0.058, 0);
  halo.name = "敬香暖圈";
  halo.rotation.x = -Math.PI / 2;
  halo.visible = false;
  halo.castShadow = false;
  halo.receiveShadow = false;

  let offeredAt = 0;
  let activeUntil = 0;
  const smooth = (value: number) => {
    const bounded = THREE.MathUtils.clamp(value, 0, 1);
    return bounded * bounded * (3 - 2 * bounded);
  };

  function updateShaft(object: THREE.InstancedMesh, index: number, baseX: number, distance: number, height: number, lean: number) {
    transform.position.set(baseX + Math.sin(lean) * distance, 0.72 + Math.cos(lean) * distance, 0);
    transform.rotation.set(0, 0, -lean);
    transform.scale.set(1, height, 1);
    transform.updateMatrix();
    object.setMatrixAt(index, transform.matrix);
  }

  return {
    offer() {
      if (disposed) return;
      offeredAt = performance.now();
      activeUntil = offeredAt + 300_000;
      sticks.visible = true;
    },
    animate(time: number) {
      if (disposed || !sticks.visible) return;
      const now = performance.now();
      if (now >= activeUntil) {
        sticks.visible = false;
        halo.visible = false;
        sparks.visible = false;
        return;
      }
      const age = Math.max(0, (now - offeredAt) / 1000);
      const insertion = smooth(age / 1.35);
      sticks.position.set(0, (1 - insertion) * 0.34, (1 - insertion) * 0.24);
      sticks.rotation.x = (1 - insertion) * 0.18;
      const ignition = smooth((age - 0.2) / 0.6);
      const consumed = Math.min(1, age / 300);
      const coatedHeight = 0.69 - consumed * 0.22;
      const length = coatedHeight + 0.18;
      for (let index = 0; index < 3; index += 1) {
        const baseX = (index - 1) * 0.12;
        const lean = (index - 1) * 0.035;
        updateShaft(bareShafts, index, baseX, 0.09, 0.18, lean);
        updateShaft(coatedShafts, index, baseX, 0.18 + coatedHeight / 2, coatedHeight, lean);
        updateShaft(ashTips, index, baseX, length - 0.018, 0.036, lean);
        tips[index].set(baseX + Math.sin(lean) * length, 0.72 + Math.cos(lean) * length, 0);
        transform.position.copy(tips[index]);
        transform.position.y -= 0.035;
        transform.rotation.set(0, 0, 0);
        transform.scale.setScalar(ignition);
        transform.updateMatrix();
        embers.setMatrixAt(index, transform.matrix);
        transform.scale.setScalar(ignition * (2.0 + Math.sin(time * 2.1 + index) * 0.15));
        transform.updateMatrix();
        emberGlows.setMatrixAt(index, transform.matrix);
      }
      instances.forEach(object => { object.instanceMatrix.needsUpdate = true; });
      ember.emissiveIntensity = 1.3 + Math.exp(-age * 1.2) * 2.3 + Math.sin(time * 2.1) * 0.22;
      glowMaterial.opacity = 0.12 + Math.exp(-age * 0.9) * 0.13;

      const smokeHeight = 1.75 * smooth((age - 0.35) / 1.6);
      smokeMaterial.opacity = ignition * 0.24;
      smokePositions.forEach((positions, strand) => {
        const tip = tips[strand];
        for (let ring = 0; ring < smokeRings; ring += 1) {
          const phase = ring / (smokeRings - 1);
          const drift = phase * phase;
          const centerX = tip.x + Math.sin(phase * 7 - time * 0.7 + strand * 0.8) * drift * 0.15;
          const centerY = tip.y + phase * smokeHeight;
          const centerZ = Math.cos(phase * 5.5 - time * 0.5 + strand) * drift * 0.11;
          const radius = 0.006 + phase * 0.035;
          for (let side = 0; side <= smokeSides; side += 1) {
            const angle = side / smokeSides * Math.PI * 2;
            const offset = (ring * (smokeSides + 1) + side) * 3;
            positions[offset] = centerX + Math.cos(angle) * radius;
            positions[offset + 1] = centerY;
            positions[offset + 2] = centerZ + Math.sin(angle) * radius;
          }
        }
        smokeGeometries[strand].getAttribute("position").needsUpdate = true;
      });

      sparks.visible = age < 2.4;
      sparkMaterial.opacity = Math.max(0, 1 - age / 2.4) * 0.75;
      if (sparks.visible) {
        for (let index = 0; index < 12; index += 1) {
          const flight = (age - 0.35 - index * 0.045) / (0.55 + (index % 3) * 0.1);
          const tip = tips[index % 3];
          const offset = index * 3;
          const angle = index * 2.4;
          sparkPositions[offset] = tip.x + Math.cos(angle) * Math.max(0, flight) * 0.11;
          sparkPositions[offset + 1] = flight >= 0 && flight <= 1 ? tip.y + flight * 0.32 : -10;
          sparkPositions[offset + 2] = Math.sin(angle) * Math.max(0, flight) * 0.11;
        }
        sparkGeometry.getAttribute("position").needsUpdate = true;
      }
      halo.visible = age < 4;
      haloMaterial.opacity = Math.exp(-age * 0.7) * ignition * 0.42;
      halo.scale.setScalar(0.95 + smooth(age / 3.5) * 0.65);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      instances.forEach(object => object.dispose());
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      smokeAlpha.dispose();
      group.clear();
    },
  };
}
