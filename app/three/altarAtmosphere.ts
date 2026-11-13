import * as THREE from "three";
import { TEMPLE_LAYOUT } from "../templeLayout";

/** Candle flames and faint smoke remain close to the three prayer-hall altars. */
export function createAltarAtmosphere() {
  const group = new THREE.Group();
  group.name = "三座殿堂香案 · 烛火薄烟";
  const positions = [
    [-2.2, -15.8], [2.2, -15.8],
    [TEMPLE_LAYOUT.guanyin.x - 1.8, TEMPLE_LAYOUT.guanyin.z - .5],
    [TEMPLE_LAYOUT.guanyin.x + 1.8, TEMPLE_LAYOUT.guanyin.z - .5],
    [TEMPLE_LAYOUT.wenshu.x - 1.8, TEMPLE_LAYOUT.wenshu.z - .5],
    [TEMPLE_LAYOUT.wenshu.x + 1.8, TEMPLE_LAYOUT.wenshu.z - .5],
  ];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instances: THREE.InstancedMesh[] = [];
  const transform = new THREE.Object3D();
  const candleSurface = new THREE.MeshStandardMaterial({ color: "#b55c45", roughness: .78 });
  const goldSurface = new THREE.MeshStandardMaterial({ color: "#cba75e", metalness: .3, roughness: .55 });
  const flameSurface = new THREE.MeshBasicMaterial({ color: "#f5b856" });
  const heartSurface = new THREE.MeshBasicMaterial({ color: "#fff1b2" });
  for (const surface of [candleSurface, goldSurface, flameSurface, heartSurface]) materials.add(surface);
  function batch(geometry: THREE.BufferGeometry, material: THREE.Material) {
    geometries.add(geometry);
    const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
    mesh.frustumCulled = false;
    group.add(mesh);
    instances.push(mesh);
    return mesh;
  }
  const candles = batch(new THREE.CylinderGeometry(.06, .07, .4, 8), candleSurface);
  const holders = batch(new THREE.CylinderGeometry(.09, .16, .76, 10), goldSurface);
  const flameGeometry = new THREE.SphereGeometry(1, 8, 6);
  const flames = batch(flameGeometry, flameSurface);
  const hearts = batch(flameGeometry, heartSurface);
  flames.name = "三殿香案烛火";
  positions.forEach(([x, z], index) => {
    transform.position.set(x, .38, z);
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    holders.setMatrixAt(index, transform.matrix);
    transform.position.y = .98;
    transform.updateMatrix();
    candles.setMatrixAt(index, transform.matrix);
  });
  const smokeGeometry = new THREE.BufferGeometry();
  const smokePositions = new Float32Array(positions.length * 16 * 3);
  smokeGeometry.setAttribute("position", new THREE.BufferAttribute(smokePositions, 3).setUsage(THREE.DynamicDrawUsage));
  geometries.add(smokeGeometry);
  const pixels = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const distance = Math.hypot((x - 7.5) / 7.5, (y - 7.5) / 7.5);
    const alpha = Math.round(Math.max(0, 1 - distance) ** 2 * 255);
    pixels.set([255, 255, 255, alpha], (y * 16 + x) * 4);
  }
  const texture = new THREE.DataTexture(pixels, 16, 16, THREE.RGBAFormat);
  texture.needsUpdate = true;
  const smokeSurface = new THREE.PointsMaterial({ color: "#d8d7cb", map: texture, size: .07, opacity: .075, transparent: true, depthWrite: false });
  materials.add(smokeSurface);
  const smoke = new THREE.Points(smokeGeometry, smokeSurface);
  smoke.name = "仅香案附近的薄烟";
  smoke.frustumCulled = false;
  group.add(smoke);
  let disposed = false;
  return {
    group,
    animate(time: number) {
      if (disposed) return;
      positions.forEach(([x, z], index) => {
        const flicker = 1 + Math.sin(time * 4.3 + index * 1.7) * .09;
        transform.position.set(x + Math.sin(time * 2.1 + index) * .009, 1.27, z);
        transform.scale.set(.04, .115 * flicker, .04);
        transform.updateMatrix();
        flames.setMatrixAt(index, transform.matrix);
        transform.position.y = 1.245;
        transform.scale.set(.022, .067 * flicker, .022);
        transform.updateMatrix();
        hearts.setMatrixAt(index, transform.matrix);
        for (let point = 0; point < 16; point++) {
          const phase = (time * .16 + point / 16) % 1;
          const offset = (index * 16 + point) * 3;
          smokePositions[offset] = x + Math.sin(phase * 6 + time * .45 + index) * phase * .07;
          smokePositions[offset + 1] = 1.36 + phase * .65;
          smokePositions[offset + 2] = z + Math.cos(phase * 4 + time * .36 + index) * phase * .05;
        }
      });
      flames.instanceMatrix.needsUpdate = true;
      hearts.instanceMatrix.needsUpdate = true;
      smokeGeometry.getAttribute("position").needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      instances.forEach(instance => instance.dispose());
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      texture.dispose();
      group.clear();
    },
  };
}
