import * as THREE from "three";

/** Small, locally painted surfaces keep the timber and lime plaster softly textured. */
export function createArchitecturalTextures() {
  const owned: THREE.CanvasTexture[] = [];
  function paint(kind: "wood" | "plaster") {
    if (typeof document === "undefined") return undefined;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.fillStyle = "#fffaf0";
    context.fillRect(0, 0, 128, 128);
    if (kind === "wood") {
      for (let grain = 0; grain < 35; grain++) {
        context.fillStyle = grain % 3 === 0 ? "#e0d4c0" : "#eee4d3";
        for (let row = 0; row < 32; row++) {
          const x = (grain * 3.73 + Math.sin(row * .24 + grain * 1.7) * .85) % 128;
          context.fillRect(x, row * 4, grain % 4 === 0 ? .8 : .4, 4);
        }
      }
    } else {
      for (let fleck = 0; fleck < 640; fleck++) {
        context.fillStyle = fleck % 3 ? "#f0e9da" : "#e6ddcb";
        const x = (fleck * 47.13) % 128;
        const y = (fleck * 73.37) % 128;
        context.fillRect(x, y, .6 + fleck % 3 * .25, .6);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = kind === "wood" ? "朱砂木纹 · 128" : "暖白灰泥 · 128";
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(kind === "wood" ? 2 : 4, 2);
    texture.anisotropy = 2;
    owned.push(texture);
    return texture;
  }
  const wood = paint("wood");
  const plaster = paint("plaster");
  return {
    wood,
    plaster,
    dispose() {
      owned.forEach(texture => texture.dispose());
      owned.length = 0;
    },
  };
}

/** A carved bracket rises at its tips and rests on a broad central bearing. */
export function createBracketArmGeometry(span: number, depth = .24) {
  const outline = new THREE.Shape();
  outline.moveTo(-span / 2, .1);
  outline.lineTo(-span / 2, -.005);
  outline.lineTo(-span * .3, -.065);
  outline.lineTo(-span * .13, -.12);
  outline.lineTo(span * .13, -.12);
  outline.lineTo(span * .3, -.065);
  outline.lineTo(span / 2, -.005);
  outline.lineTo(span / 2, .1);
  outline.lineTo(span * .23, .065);
  outline.lineTo(-span * .23, .065);
  outline.closePath();
  const geometry = new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: false, steps: 1, curveSegments: 1 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}
