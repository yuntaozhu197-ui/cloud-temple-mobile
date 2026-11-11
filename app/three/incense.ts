import * as THREE from "three";

export function createIncenseOffering(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.position.set(0, 0, -14.8);
  scene.add(group);

  const bronze = new THREE.MeshStandardMaterial({
    color: "#bfa167", metalness: 0.35, roughness: 0.55,
  });
  const ash = new THREE.MeshStandardMaterial({ color: "#d5c9a8", roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ color: "#a16b45", roughness: 0.9 });
  const ember = new THREE.MeshStandardMaterial({
    color: "#f09362", emissive: "#ed754a", emissiveIntensity: 1.2,
  });
  const smokeMaterial = new THREE.LineBasicMaterial({
    color: "#fff9e8", transparent: true, opacity: 0.55, depthWrite: false,
  });
  const bowlGeometry = new THREE.CylinderGeometry(0.38, 0.25, 0.3, 20);
  const ashGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.025, 20);
  const stickGeometry = new THREE.CylinderGeometry(0.014, 0.014, 0.72, 6);
  const emberGeometry = new THREE.SphereGeometry(0.023, 8, 6);
  const bowl = new THREE.Mesh(bowlGeometry, bronze);
  bowl.position.y = 0.42;
  bowl.castShadow = true;
  group.add(bowl);
  const sand = new THREE.Mesh(ashGeometry, ash);
  sand.position.y = 0.57;
  group.add(sand);

  const sticks = new THREE.Group();
  sticks.visible = false;
  group.add(sticks);
  const smokeGeometries: THREE.BufferGeometry[] = [];
  const smokePositions: Float32Array[] = [];

  for (let index = 0; index < 3; index += 1) {
    const x = (index - 1) * 0.1;
    const stick = new THREE.Mesh(stickGeometry, wood);
    stick.position.set(x, 0.92, 0);
    sticks.add(stick);
    const tip = new THREE.Mesh(emberGeometry, ember);
    tip.position.set(x, 1.285, 0);
    sticks.add(tip);
    const positions = new Float32Array(24 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const smoke = new THREE.Line(geometry, smokeMaterial);
    smoke.frustumCulled = false;
    smokePositions.push(positions);
    smokeGeometries.push(geometry);
    sticks.add(smoke);
  }

  let activeUntil = 0;
  return {
    offer() {
      sticks.visible = true;
      activeUntil = performance.now() + 300_000;
    },
    animate(time: number) {
      if (!sticks.visible) return;
      if (performance.now() >= activeUntil) {
        sticks.visible = false;
        return;
      }
      smokePositions.forEach((positions, index) => {
        for (let point = 0; point < 24; point += 1) {
          const height = point / 23;
          positions[point * 3] = (index - 1) * 0.1 + Math.sin(height * 6 - time * 0.7 + index) * height * 0.16;
          positions[point * 3 + 1] = 1.3 + height * 1.45;
          positions[point * 3 + 2] = Math.cos(height * 5 - time * 0.45 + index) * height * 0.12;
        }
        smokeGeometries[index].getAttribute("position").needsUpdate = true;
      });
      ember.emissiveIntensity = 1.2 + Math.sin(time * 2.1) * 0.3;
    },
    dispose() {
      scene.remove(group);
      [bowlGeometry, ashGeometry, stickGeometry, emberGeometry, ...smokeGeometries].forEach(geometry => geometry.dispose());
      [bronze, ash, wood, ember, smokeMaterial].forEach(material => material.dispose());
    },
  };
}
