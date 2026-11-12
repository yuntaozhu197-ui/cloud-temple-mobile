import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createFishSchool } from "./fishSchool";
import { MARTIAL_BEATS, MARTIAL_DURATION, sampleMartial } from "./martial";

type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };
type ScenicAction = "release" | "martial" | "pagoda" | "pondFeed";

export function createScenicAreas() {
 const group = new THREE.Group();
 group.name = "放生池 · 塔林 · 习武广场";
 const geometries = new Set<THREE.BufferGeometry>();
 const materials = new Set<THREE.Material>();
 const colliders: Collider[] = [];
 const staticGroup = new THREE.Group();
 group.add(staticGroup);
 const surface = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
  const material = new THREE.MeshStandardMaterial({ color, roughness: .85, ...options });
  materials.add(material);
  return material;
 };
 const stone = surface("#b9b5a2");
 const paleStone = surface("#ded8bd");
 const brick = surface("#a39078");
 const shadowBrick = surface("#786958");
 const roof = surface("#777a6b");
 const wood = surface("#9b6f49");
 const darkWood = surface("#63513e");
 const red = surface("#b56f53");
 const gold = surface("#d0af65", { metalness: .3, roughness: .55 });
 const water = surface("#6caeaa", { roughness: .2, metalness: .2 });
 const leaf = surface("#728f69");
 const glow = surface("#e8cc88", { emissive: "#c7a15e", emissiveIntensity: .7, transparent: true, opacity: .5, depthWrite: false });
 function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Group = staticGroup) {
  geometries.add(geometry);
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
 }
 const box = (x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, parent?: THREE.Group) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
 const cylinder = (x: number, y: number, z: number, top: number, bottom: number, h: number, material: THREE.Material, segments = 12, parent?: THREE.Group) => mesh(new THREE.CylinderGeometry(top, bottom, h, segments), material, x, y, z, parent);
 function block(x: number, z: number, w: number, d: number) {
  colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
 }

 // A raised stone rim keeps walkers on the shore while the fish remain in the water.
 cylinder(-28, .035, 8, 4.9, 4.9, .07, paleStone, 48);
 cylinder(-28, .085, 8, 4.25, 4.25, .025, water, 48);
 const pondRim = mesh(new THREE.TorusGeometry(4.4, .15, 6, 48), stone, -28, .16, 8);
 pondRim.rotation.x = Math.PI / 2;
 block(-28, 8, 8.9, 8.9);
 for (let index = 0; index < 10; index++) {
  const angle = index * Math.PI * 2 / 10;
  const pad = cylinder(-28 + Math.cos(angle) * 3.2, .11, 8 + Math.sin(angle) * 2.9, .24, .24, .02, leaf, 10);
  pad.scale.z = .8;
 }
 for (const z of [5.8, 10.2]) {
  cylinder(-22.7, .55, z, .13, .17, 1.1, stone);
  box(-22.7, 1.1, z, .48, .14, .48, paleStone);
 }
 // The middle of the rail stays open, and decking ends before the fish enters water.
 for (const z of [6.45, 9.55]) box(-22.7, .74, z, .14, .12, 1.3, wood);
 for (let plank = 0; plank < 5; plank++) box(-22.65, .025, 7.5 + plank * .25, 1.45, .05, .21, wood);

 // Brick pagodas use repeated tapering stories, deep eaves and a small finial.
 const pagodas = [
  { x: -47.5, z: 16, stories: 5, scale: 1 },
  { x: -41.5, z: 15, stories: 7, scale: 1 },
  { x: -37, z: 20, stories: 4, scale: .85 },
  { x: -48, z: 23, stories: 4, scale: .9 },
  { x: -42.5, z: 24.5, stories: 5, scale: .85 },
  { x: -38.5, z: 29.5, stories: 3, scale: .8 },
 ];
 box(-43, .025, 22, 15, .05, 19, paleStone);
 for (const pagoda of pagodas) {
  const { x, z, stories, scale } = pagoda;
  cylinder(x, .13, z, 1.3 * scale, 1.45 * scale, .26, stone, 8);
  for (let story = 0; story < stories; story++) {
   const radius = (1.05 - story * .065) * scale;
   const y = .3 + story * .7 * scale;
   cylinder(x, y + .25 * scale, z, radius * .92, radius, .52 * scale, brick, 8);
   cylinder(x, y + .55 * scale, z, radius * 1.15, radius * 1.28, .18 * scale, roof, 8);
   box(x, y + .28 * scale, z + radius * .94, .22 * scale, .28 * scale, .04, shadowBrick);
   for (const side of [-1, 1]) box(x + side * radius * .65, y + .06 * scale, z + radius * .7, .13 * scale, .03, .05, paleStone);
  }
  const top = .3 + stories * .7 * scale;
  cylinder(x, top + .1, z, .22, .5 * scale, .35, stone, 8);
  cylinder(x, top + .5, z, .04, .14, .55, gold, 8);
  block(x, z, 2.7 * scale, 2.7 * scale);
 }
 for (let index = 0; index < 9; index++) box(-43.8, .06, 14.5 + index * 1.8, .7, .06, .8, stone);
 box(-43.8, .3, 19.4, 1.5, .6, .5, shadowBrick);
 box(-43.8, .95, 19.4, 1.2, 1.1, .28, brick);
 block(-43.8, 19.4, 1.6, .7);

 // A clear practice court with a wooden dummy, drum and weapon rack.
 box(28, .04, 12, 12.5, .08, 12, paleStone);
 for (const z of [6, 18]) box(28, .10, z, 12.6, .12, .23, red);
 for (const x of [21.8, 34.2]) box(x, .10, 12, .23, .12, 12, red);
 for (let index = 0; index < 5; index++) {
  cylinder(23, 1.0, 6.8 + index * .5, .035, .045, 2, darkWood, 6);
  const blade = mesh(new THREE.SphereGeometry(.12, 6, 4), stone, 23, 2.1, 6.8 + index * .5);
  blade.scale.set(.4, 2.2, 1);
 }
 box(23, .5, 7.8, .5, .12, 3, wood);
 block(23, 7.8, .9, 3.5);
 const drum = cylinder(25.5, 1.15, 7.3, .58, .58, .6, red, 20);
 drum.rotation.x = Math.PI / 2;
 for (const side of [-1, 1]) {
  const skin = cylinder(25.5, 1.15, 7.3 + side * .31, .56, .56, .025, paleStone, 20);
  skin.rotation.x = Math.PI / 2;
  box(25.5 + side * .38, .4, 7.3, .15, .8, .8, darkWood);
 }
 block(25.5, 7.3, 1.4, 1.4);
 const dummy = new THREE.Group();
 dummy.position.set(31.5, 0, 9.5);
 group.add(dummy);
 cylinder(0, 1.1, 0, .19, .24, 2.2, wood, 12, dummy);
 for (const [x, y, angle] of [[-.38, 1.55, -.4], [.38, 1.3, .4], [0, .75, .7]]) {
  const arm = cylinder(x, y, .12, .055, .075, .85, darkWood, 8, dummy);
  arm.rotation.z = angle + Math.PI / 2;
 }
 cylinder(31.5, .07, 9.5, .7, .7, .14, stone, 12);
 block(31.5, 9.5, 1.7, 1.7);

 const fishSchool = createFishSchool({
  name: "放生池 · 多彩鱼群", count: 24, capacity: 72,
  x: -28, z: 8, radiusX: 3.8, radiusZ: 3.8, waterY: .15,
  feedX: -25, feedZ: 8,
  releaseX: -24.3, releaseZ: 8,
 });
 group.add(fishSchool.group);
 const releaseRipple = mesh(new THREE.RingGeometry(.28, .34, 32), glow, -24.3, .13, 8, group);
 releaseRipple.rotation.x = -Math.PI / 2;
 releaseRipple.castShadow = false;
 releaseRipple.visible = false;
 const martialRing = mesh(new THREE.RingGeometry(1.0, 1.07, 32), glow, 28, .14, 12, group);
 martialRing.rotation.x = -Math.PI / 2;
 martialRing.castShadow = false;
 martialRing.visible = false;
 const martialEffects = new THREE.Group();
 martialEffects.name = "习武连招 · 拳风与落地扬尘";
 martialEffects.visible = false;
 group.add(martialEffects);
 const windMaterial = new THREE.MeshBasicMaterial({ color: "#fff3d2", transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide });
 const impactMaterial = new THREE.MeshBasicMaterial({ color: "#e9c57f", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
 const dustMaterial = new THREE.PointsMaterial({ color: "#d4c6a1", size: .07, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
 materials.add(windMaterial);
 materials.add(impactMaterial);
 materials.add(dustMaterial);
 const windGeometry = new THREE.TorusGeometry(.55, .018, 4, 28, Math.PI * 1.3);
 const impactGeometry = new THREE.RingGeometry(.84, .885, 40);
 geometries.add(windGeometry);
 geometries.add(impactGeometry);
 const windArcs = new THREE.InstancedMesh(windGeometry, windMaterial, 8);
 windArcs.name = "三连拳与飞踢风弧";
 windArcs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 windArcs.frustumCulled = false;
 martialEffects.add(windArcs);
 const impactRings = new THREE.InstancedMesh(impactGeometry, impactMaterial, 4);
 impactRings.name = "重踏与双掌冲击波";
 impactRings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 impactRings.frustumCulled = false;
 martialEffects.add(impactRings);
 const dustPositions = new Float32Array(72 * 3);
 const dustGeometry = new THREE.BufferGeometry();
 dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3).setUsage(THREE.DynamicDrawUsage));
 geometries.add(dustGeometry);
 const dust = new THREE.Points(dustGeometry, dustMaterial);
 dust.name = "落地扬尘";
 dust.frustumCulled = false;
 martialEffects.add(dust);
 const effectTransform = new THREE.Object3D();
 const prayerRing = mesh(new THREE.RingGeometry(.7, .78, 32), glow, -43, .14, 21, group);
 prayerRing.rotation.x = -Math.PI / 2;
 prayerRing.castShadow = false;
 prayerRing.visible = false;

 staticGroup.updateMatrixWorld(true);
 const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
 staticGroup.traverse(object => {
  if (!(object instanceof THREE.Mesh)) return;
  const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
  geometry.applyMatrix4(object.matrixWorld);
  const pieces = batches.get(object.material as THREE.Material) ?? [];
  pieces.push(geometry);
  batches.set(object.material as THREE.Material, pieces);
 });
 staticGroup.clear();
 for (const [material, pieces] of batches) {
  const geometry = mergeGeometries(pieces, false);
  pieces.forEach(piece => piece.dispose());
  if (geometry) mesh(geometry, material, 0, 0, 0);
 }
 let releasedAt = -Infinity;
 let martialAt = -Infinity;
 let prayerAt = -Infinity;
 let disposed = false;
 return {
  group,
  colliders,
  landmarks: [
   { name: "放生池", x: -22.5, z: 8 },
   { name: "少林塔林", x: -43, z: 21 },
   { name: "习武广场", x: 28, z: 12 },
  ],
  interactions: [
   { kind: "release" as const, label: "◌ 放生小鱼", x: -22.5, y: 1.1, z: 8 },
   { kind: "pondFeed" as const, label: "◌ 投喂池鱼", x: -22.5, y: 1.1, z: 10.5 },
   { kind: "pagoda" as const, label: "♧ 塔前合掌", x: -43, y: 1.2, z: 21 },
   { kind: "martial" as const, label: "✧ 习武练拳", x: 28, y: 1.1, z: 12 },
  ],
  interact(kind: ScenicAction) {
   if (disposed) return;
   const now = performance.now() / 1000;
   if (kind === "release") { releasedAt = now; fishSchool.release(7); }
   if (kind === "pondFeed") fishSchool.feed();
   if (kind === "martial") martialAt = now;
   if (kind === "pagoda") prayerAt = now;
  },
  stopMartial() {
   martialAt = -Infinity;
   martialEffects.visible = false;
   martialRing.visible = false;
   dummy.rotation.set(0, 0, 0);
   impactMaterial.opacity = 0;
   dustMaterial.opacity = 0;
  },
  animate(time: number) {
   if (disposed) return;
   const now = performance.now() / 1000;
   const releaseAge = now - releasedAt;
   fishSchool.animate(time);
   releaseRipple.visible = releaseAge < 5;
   if (releaseRipple.visible) releaseRipple.scale.setScalar(1 + (releaseAge % 1.4) * 1.7);
   const martialAge = now - martialAt;
   const martialActive = martialAge >= 0 && martialAge < MARTIAL_DURATION;
   martialRing.visible = martialActive;
   martialEffects.visible = martialActive;
   martialRing.scale.setScalar(martialActive ? 1.15 + Math.sin(martialAge * 3) * .07 : 1);
   dummy.rotation.z = 0;
   dummy.rotation.x = 0;
   if (martialActive) {
    const choreography = sampleMartial(martialAge);
    let impactOpacity = 0;
    let dustOpacity = 0;
    for (let index = 0; index < 8; index++) {
     const beatIndex = index === 7 ? 4 : index;
     const age = martialAge - (index === 7 ? 4.4 : MARTIAL_BEATS[beatIndex]);
     const duration = index === 7 ? 2.1 : beatIndex === 4 ? 1.45 : 1.05;
     const progress = age / duration;
     const active = age >= 0 && age < duration && beatIndex !== 5;
     const envelope = active ? Math.sin(progress * Math.PI) : 0;
     const side = index % 2 ? -1 : 1;
     effectTransform.position.set(28 + side * .38, .9 + beatIndex * .07, 12.35);
     effectTransform.rotation.set(.12, side * .5, side * (.6 + Math.max(0, progress) * .7));
     let radius = 1 + Math.max(0, progress) * .7;
     if (beatIndex === 3) {
      effectTransform.position.set(28.4, 1.2, 12);
      effectTransform.rotation.set(.2, -.5, -.65 + progress * .6);
      radius = 1.7 + Math.max(0, progress) * .6;
     }
     if (beatIndex === 4) {
      effectTransform.position.set(28 + choreography.travelX, .75 + choreography.jump * 1.35, 12 + choreography.travelZ);
      effectTransform.rotation.set(index === 7 ? Math.PI / 2 - .25 : .25, progress * Math.PI * 2, index === 7 ? Math.PI : progress * 2.4);
      radius = (index === 7 ? 2.7 : 2.3) + Math.max(0, progress) * .45;
     }
     if (beatIndex === 6) {
      effectTransform.position.set(28, .65, 12);
      effectTransform.rotation.set(Math.PI / 2, progress * 1.2, 0);
      radius = 1.6 + Math.max(0, progress) * 1.5;
     }
     effectTransform.scale.setScalar(envelope * radius);
     effectTransform.updateMatrix();
     windArcs.setMatrixAt(index, effectTransform.matrix);
    }
    for (let index = 0; index < 4; index++) {
     const eventIndex = index < 2 ? 5 : 6;
     const age = martialAge - MARTIAL_BEATS[eventIndex] - (index % 2) * .15;
     const progress = age / 1.5;
     const active = age >= 0 && age < 1.5;
     const fade = active ? (1 - progress) ** 2 : 0;
     impactOpacity = Math.max(impactOpacity, fade * .38);
     effectTransform.position.set(28, .13 + (index % 2) * .025, 12);
     effectTransform.rotation.set(-Math.PI / 2, 0, 0);
     effectTransform.scale.setScalar(active ? .65 + progress * 3.2 : 0);
     effectTransform.updateMatrix();
     impactRings.setMatrixAt(index, effectTransform.matrix);
    }
    for (let index = 0; index < 72; index++) {
     const eventIndex = index < 36 ? 5 : 6;
     const age = martialAge - MARTIAL_BEATS[eventIndex] - index % 6 * .018;
     const active = age >= 0 && age < 1.4;
     const progress = active ? age / 1.4 : 0;
     const angle = index * 2.399963;
     const radius = .35 + progress * (1.6 + index % 7 * .16);
     dustPositions[index * 3] = 28 + Math.cos(angle) * radius;
     dustPositions[index * 3 + 1] = active ? .14 + Math.sin(progress * Math.PI) * (.22 + index % 4 * .06) : -10;
     dustPositions[index * 3 + 2] = 12 + Math.sin(angle) * radius;
     dustOpacity = Math.max(dustOpacity, active ? (1 - progress) * .45 : 0);
    }
    for (const beat of MARTIAL_BEATS) {
     const age = martialAge - beat;
     if (age >= 0 && age < 1) {
      dummy.rotation.z += Math.sin(age * 20) * Math.exp(-age * 5) * .12;
      dummy.rotation.x += Math.sin(age * 17) * Math.exp(-age * 5) * .045;
     }
    }
    windArcs.instanceMatrix.needsUpdate = true;
    impactRings.instanceMatrix.needsUpdate = true;
    dustGeometry.getAttribute("position").needsUpdate = true;
    impactMaterial.opacity = impactOpacity;
    dustMaterial.opacity = dustOpacity;
   }
   prayerRing.visible = now - prayerAt < 5;
   prayerRing.scale.setScalar(1 + Math.sin(time * 1.6) * .08);
  },
  dispose() {
   if (disposed) return;
   disposed = true;
   group.removeFromParent();
   windArcs.dispose();
   impactRings.dispose();
   fishSchool.dispose();
   geometries.forEach(geometry => geometry.dispose());
   materials.forEach(material => material.dispose());
   group.clear();
  },
 };
}
