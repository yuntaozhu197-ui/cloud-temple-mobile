import * as THREE from "three";
import { createTempleCatWorldModel, type TempleCatPose } from "./templeCatWorldModel";

type Phase = "intro" | "search" | "reveal" | "found";
type PortraitRect = { left: number; top: number; width: number; height: number };

const poses: Record<Phase, TempleCatPose> = {
  intro: "sneak",
  search: "sneak",
  reveal: "reveal",
  found: "idle",
};

export function createTempleCatPortrait(renderer: THREE.WebGLRenderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0xf3e1bf);

  const cat = createTempleCatWorldModel();
  studio.add(cat.root);

  const stage = new THREE.CylinderGeometry(.66, .64, .058, 48);
  const stageMaterial = new THREE.MeshStandardMaterial({ color: 0xc3976b, roughness: .86 });
  const cushion = new THREE.Mesh(stage, stageMaterial);
  cushion.position.set(.035, -.03, 0);
  studio.add(cushion);

  const trimShape = new THREE.TorusGeometry(.62, .008, 8, 56);
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xe5bd75, roughness: .54, metalness: .21 });
  const trim = new THREE.Mesh(trimShape, trimMaterial);
  trim.rotation.x = -Math.PI / 2;
  trim.position.set(.035, .002, 0);
  studio.add(trim);

  const surface = new THREE.PlaneGeometry(50, 50);
  const surfaceMaterial = new THREE.MeshBasicMaterial({ color: 0xf3e1bf, toneMapped: false });
  const table = new THREE.Mesh(surface, surfaceMaterial);
  table.rotation.x = -Math.PI / 2;
  table.position.y = -.065;
  studio.add(table);

  studio.add(new THREE.HemisphereLight(0xfff4e2, 0xb27c61, 1.65));
  const key = new THREE.DirectionalLight(0xffe3b7, 2.1);
  key.position.set(-2.1, 3.5, 3.4);
  studio.add(key);
  const softFill = new THREE.DirectionalLight(0xfff1e5, .88);
  softFill.position.set(2.3, 1.15, 3.2);
  studio.add(softFill);
  const rim = new THREE.DirectionalLight(0xffc675, 1.6);
  rim.position.set(.9, 2.7, -2.3);
  studio.add(rim);

  const camera = new THREE.OrthographicCamera(-.75, .75, .61, -.61, .1, 12);
  camera.position.set(.77, 1.3, 4.15);
  camera.lookAt(.055, .45, 0);
  const viewport = new THREE.Vector4();
  const scissor = new THREE.Vector4();
  const surfaceSize = new THREE.Vector2();
  const clearColor = new THREE.Color();
  let currentPhase: Phase | null = null;
  let aspect = 0;
  let lastCopy = -Infinity;
  let previousCanvas: HTMLCanvasElement | null = null;

  function copyToModal(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number) {
    const now = performance.now();
    if (canvas === previousCanvas && now - lastCopy < 1000 / 12) return;
    previousCanvas = canvas;
    lastCopy = now;
    const bounds = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d", { alpha: false });
    if (!context || bounds.width <= 0 || bounds.height <= 0) return;

    const ratio = renderer.getPixelRatio();
    const source = renderer.domElement;
    const sw = Math.min(Math.round(width * ratio), source.width - Math.round(x * ratio));
    const sh = Math.min(Math.round(height * ratio), source.height - Math.round(y * ratio));
    const sx = Math.round(x * ratio);
    const sy = source.height - Math.round(y * ratio) - sh;
    if (sw < 1 || sh < 1) return;

    const targetWidth = Math.max(1, Math.round(bounds.width * ratio));
    const targetHeight = Math.max(1, Math.round(bounds.height * ratio));
    if (canvas.width !== targetWidth) canvas.width = targetWidth;
    if (canvas.height !== targetHeight) canvas.height = targetHeight;

    // Center-crop around the cat if the phone rotates between measuring and copying.
    const targetAspect = targetWidth / targetHeight;
    const cropWidth = Math.min(sw, sh * targetAspect);
    const cropHeight = Math.min(sh, sw / targetAspect);
    context.drawImage(source, sx + (sw - cropWidth) / 2, sy + (sh - cropHeight) / 2, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
    canvas.dataset.portraitReady = "";
  }

  function draw(rect: PortraitRect, viewportHeight: number, delta: number, phase: Phase, modalCanvas?: HTMLCanvasElement | null) {
    if (viewportHeight <= 0 || renderer.getRenderTarget() !== null) return;
    renderer.getSize(surfaceSize);
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const width = Math.min(surfaceSize.x, rect.left + rect.width) - left;
    const height = Math.min(viewportHeight, rect.top + rect.height) - top;
    if (width < 2 || height < 2) return;
    const bottom = viewportHeight - top - height;

    if (phase !== currentPhase) {
      cat.show(0, 0, 0, 0, poses[phase]);
      currentPhase = phase;
    }
    cat.update(delta);

    const nextAspect = width / height;
    if (nextAspect !== aspect) {
      aspect = nextAspect;
      camera.left = -.61 * aspect;
      camera.right = .61 * aspect;
      camera.updateProjectionMatrix();
    }

    renderer.getViewport(viewport);
    renderer.getScissor(scissor);
    renderer.getClearColor(clearColor);
    const clearAlpha = renderer.getClearAlpha();
    const scissorEnabled = renderer.getScissorTest();
    const { autoClearColor, autoClearDepth } = renderer;
    try {
      renderer.setViewport(left, bottom, width, height);
      renderer.setScissor(left, bottom, width, height);
      renderer.setScissorTest(true);
      renderer.autoClearColor = true;
      renderer.autoClearDepth = true;
      renderer.render(studio, camera);
      if (modalCanvas) {
        try { copyToModal(modalCanvas, left, bottom, width, height); }
        catch { /* Keep the available portrait frame or the modal's fallback artwork. */ }
      }
    } finally {
      renderer.setScissorTest(scissorEnabled);
      renderer.setScissor(scissor);
      renderer.setViewport(viewport);
      renderer.autoClearColor = autoClearColor;
      renderer.autoClearDepth = autoClearDepth;
      renderer.setClearColor(clearColor, clearAlpha);
    }
  }

  function dispose() {
    previousCanvas = null;
    cat.dispose();
    studio.clear();
    stage.dispose();
    stageMaterial.dispose();
    trimShape.dispose();
    trimMaterial.dispose();
    surface.dispose();
    surfaceMaterial.dispose();
  }

  return { draw, dispose };
}
