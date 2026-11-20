import { useEffect, useRef } from "react";
import type { OddityItem } from "./catalog";

type Props = { item: OddityItem; locked?: boolean; className?: string };

function drawItem(canvas: HTMLCanvasElement, item: OddityItem, locked: boolean) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const ctx = context;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, 128, 128);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const ink = "#553d31";
  const { color, accent } = item;
  const shade = ctx.createLinearGradient(31, 25, 98, 105);
  shade.addColorStop(0, "#fff3cb");
  shade.addColorStop(.36, accent);
  shade.addColorStop(.58, color);
  shade.addColorStop(1, "#603e3d");

  function shape(d: string, fill: string | CanvasGradient = shade, outline = ink) {
    const path = new Path2D(d);
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.35;
    ctx.stroke(path);
    return path;
  }

  function line(d: string, stroke = "#fff2cba0", width = 1.3) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke(new Path2D(d));
  }

  function oval(x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, tilt = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, tilt, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function dot(x: number, y: number, radius: number, fill = "#fff2cb") {
    oval(x, y, radius, radius, fill);
  }

  function glint(x: number, y: number, size: number) {
    shape(`M${x},${y-size} Q${x+1},${y-1} ${x+size},${y} Q${x+1},${y+1} ${x},${y+size} Q${x-1},${y+1} ${x-size},${y} Q${x-1},${y-1} ${x},${y-size}Z`, "#fff4ce", "#e6b75d");
  }

  function grain(path: Path2D, count: number, seed: number) {
    ctx.save();
    ctx.clip(path);
    for (let n = 0; n < count; n++) {
      const x = 18 + (n * 687 + seed * 17) % 91;
      const y = 20 + (n * 547 + seed * 31) % 91;
      dot(x, y, (n % 3 + 1) * .22, n % 2 ? "#fff2ca5c" : "#59382f46");
    }
    ctx.restore();
  }

  function jewel(d: string, facets: string, highlight = "M42 59L56 37 67 35") {
    grain(shape(d), 96, item.art.length);
    line(facets, "#fff6db96", 1.5);
    line(highlight, "#fff9e0dc", 2.3);
    dot(82, 58, 2, "#fff2ccbc");
  }

  function bloom(count: number, length: number, width: number, center: number, stagger = 0) {
    for (let n = 0; n < count; n++) {
      ctx.save();
      ctx.translate(64, 59);
      ctx.rotate(n * Math.PI * 2 / count + stagger);
      ctx.translate(-64, -59);
      const petal = `M64 62 C${64-width} 49 ${64-width} ${59-length*.71} 64 ${59-length} C${64+width} ${59-length*.81} ${64+width} 50 64 62Z`;
      shape(petal, n % 2 ? shade : color, "#6d4540");
      line(`M64 57 Q${63-width/3} ${59-length*.55} 65 ${62-length}`, "#fff2ccb7", 1.1);
      ctx.restore();
    }
    dot(64, 59, center, "#c68a46");
    dot(63, 58, center * .72, "#efd18c");
    for (let n = 0; n < 7; n++) {
      const angle = n * Math.PI * 2 / 7;
      dot(64 + Math.sin(angle) * center * .65, 59 + Math.cos(angle) * center * .65, 1, "#9c6541");
    }
  }

  switch (item.art) {
    case "leaf":
      grain(shape("M30 91C17 51 44 24 94 29C99 66 79 102 30 91Z"), 115, 5);
      line("M28 99Q45 69 87 36M43 78L38 55M55 66L53 45M63 58L79 63M52 70L70 77", "#fcde8c", 1.65);
      break;
    case "seed":
      grain(shape("M63 19C71 30 99 50 94 70C94 88 78 104 61 105C45 101 31 86 31 68C35 44 51 39 63 19Z"), 82, 4);
      line("M63 28C58 49 46 60 49 78S65 94 64 102M65 42Q79 62 76 79", "#ffe5adbe", 3);
      dot(68, 80, 2);
      break;
    case "bead":
      shape("M65 21C101 22 106 64 96 89C87 111 40 110 28 87C16 61 30 22 65 21Z");
      oval(64, 52, 16, 19, "#6f4542");
      oval(64, 53, 10, 13, "#3d3340");
      line("M36 61C44 43 47 36 63 34M40 87Q65 102 89 83", "#ffedb8", 2.6);
      break;
    case "comb":
      grain(shape("M25 87L22 57Q22 25 54 26L89 32Q104 38 103 54L97 79 90 75 89 58 86 85 79 83 78 58 75 90 68 88 68 56 64 93 58 92 56 56 52 93 45 91 44 58 40 90 33 89 32 63 31 88Z"), 91, 2);
      line("M30 50Q46 25 93 43M37 47Q55 38 83 44", "#fbe3a7", 2);
      dot(55, 44, 3); dot(74, 45, 2.2);
      break;
    case "carving":
      grain(shape("M30 97C16 77 29 62 50 58L57 44 69 47 75 28 85 39 89 21 99 40 100 66Q91 83 74 82L71 96 90 101 80 109 35 107Z"), 106, 3);
      line("M32 89Q42 69 61 71M43 83Q55 77 62 83M78 54L83 49", "#f5cf9d", 2);
      dot(86, 57, 2.6, "#472f2c");
      break;
    case "bell":
      shape("M56 39C39 32 46 20 61 18C75 18 84 33 71 39L67 36Q74 26 62 26Q53 27 59 36Z", "#dca34e");
      grain(shape("M46 38Q61 32 80 39Q87 48 87 74L100 91Q69 108 28 91L41 73Q40 52 46 38Z"), 130, 4);
      line("M44 74Q67 87 87 75M35 89Q65 100 92 88M51 48Q63 44 74 48", "#fff3b3", 2);
      oval(64, 98, 9, 6, "#96604c");
      break;
    case "pendant":
      line("M46 34Q47 16 70 18Q90 18 81 40", "#944941", 5);
      shape("M65 30C86 36 99 54 97 72C98 89 76 104 61 107C46 106 27 91 29 69C28 52 42 34 65 30Z");
      shape("M65 43Q86 55 81 72Q77 88 62 94Q53 91 49 79Q39 69 45 56Z", accent, "#5c7c5e");
      line("M61 81C50 79 52 64 61 69C74 73 78 58 66 52", "#e7eac8", 2.4);
      break;
    case "amber":
      jewel("M30 68Q25 51 41 37L53 25 82 30 100 45 105 74 92 97 63 106 39 91Z", "M34 65L55 45 86 47 96 73 81 91 52 87ZM53 27L55 45M82 30L86 47M39 92L52 87M96 73L105 74");
      line("M60 85Q71 74 68 59M67 69L59 63M69 73L78 66", "#6b4732bb", 2.3);
      break;
    case "seal":
      shape("M35 69L78 56 98 66 98 94 55 109 34 96Z");
      shape("M34 71L55 82 98 66 78 54Z", accent);
      shape("M52 67L50 45Q47 34 57 28Q59 17 67 22Q72 20 78 27Q90 28 85 44L82 58 69 68Z");
      line("M63 35L73 35M65 41L75 41M56 89L86 79M58 96L88 86", "#ffdab0", 1.8);
      break;
    case "censer":
      shape("M35 74L26 60Q22 52 30 49L42 51M92 54L102 49Q109 52 102 61L92 73", "#a16442");
      shape("M40 90L35 105 43 107 53 94M77 93L86 107 93 103 90 86", "#93604a");
      shape("M28 67Q66 54 101 67L92 85Q85 100 63 98Q43 99 32 85Z");
      shape("M31 64Q46 45 61 45Q54 34 65 32Q76 33 70 44Q88 49 99 64Q70 74 31 64Z", accent);
      line("M54 32C49 27 58 22 57 15M76 27Q84 20 79 13", "#a39480", 1.8);
      break;
    case "talisman":
      line("M55 29Q46 20 59 16Q72 14 70 30", "#a35040", 4);
      grain(shape("M41 31L83 25 91 88 80 105 48 110 36 96Z"), 120, 8);
      line("M49 47L77 43M57 52L72 63 53 70 76 74 66 83 79 89M54 92L76 98", "#8b3f37", 3);
      break;
    case "diadem":
      shape("M24 77Q39 71 36 45L52 66 64 30 78 63 94 43Q94 68 104 75L98 94Q64 107 30 94Z");
      jewel("M64 48L76 62 69 78 57 78 53 62Z", "M55 62L74 62M64 51L61 74","M59 62L64 52");
      line("M31 84Q64 97 98 83", "#fff0a4", 3);
      glint(97, 28, 6); glint(29, 53, 5);
      break;
    case "pebble":
      grain(shape("M22 72Q26 45 50 39Q67 31 91 45Q107 55 103 76Q90 96 62 97Q34 99 22 72Z"), 170, 5);
      line("M31 72Q50 52 82 51M32 83Q69 92 94 73", "#f3e2c5", 2);
      break;
    case "glass":
      jewel("M39 30L89 37 100 61 73 101 29 80 31 54Z", "M41 33L52 56 91 39M52 56L73 101M31 55L52 56 100 61", "M37 59L42 45");
      break;
    case "pearl":
      shape("M25 79Q33 49 70 54Q100 48 104 82Q96 102 62 107Q36 104 25 79Z", "#d6ab84");
      line("M30 79L63 100 38 67M51 60L65 100 91 65M65 100L97 79", "#ffe0ad", 2);
      oval(64, 58, 24, 24, shade);
      oval(57, 49, 6, 4, "#fff8db", -.35);
      dot(54, 46, 2);
      break;
    case "crystal":
      jewel("M38 94L34 44 47 26 59 43 61 80 64 51 76 34 92 49 96 92 76 105Z", "M47 29L49 91M76 36L77 102M36 44L57 43M67 53L92 49", "M40 49L43 73M82 54L86 76");
      break;
    case "agate":
      grain(shape("M26 66Q19 53 37 43Q58 30 82 31Q100 32 104 53Q113 84 86 96Q48 108 31 83Z"), 92, 12);
      line("M37 63Q38 49 58 46Q86 35 94 54Q105 78 81 87Q53 96 41 78ZM49 64Q67 48 83 56Q97 75 76 78Q57 88 49 64Z", "#fff0c7", 3);
      line("M59 65Q69 57 78 63Q82 74 68 73Z", "#e7a782", 4);
      break;
    case "amethyst":
      jewel("M22 92L30 64 36 49 47 68 49 44 63 18 76 40 79 64 91 46 106 66 105 96 76 111Z", "M36 52L38 94M63 21L65 103M92 49L92 100M49 44L76 40M79 64L105 68", "M53 46L61 28M96 70L101 83");
      break;
    case "opal":
      grain(shape("M25 71Q22 46 56 32Q86 25 99 50Q111 78 86 95Q61 109 34 91Z"), 125, 14);
      line("M39 69Q51 35 87 49M40 79Q65 55 94 68M54 90Q70 79 86 78", "#efffdae0", 4);
      line("M43 73Q60 57 80 61M58 86L77 77", "#f5acb3c9", 3);
      break;
    case "jade":
      jewel("M32 46L54 25 82 25 101 49 91 89 72 103 47 96 25 74Z", "M32 46L58 49 82 25M58 49L72 103M58 49L101 49M47 96L43 72 25 74", "M56 34L75 33M34 58L30 72");
      line("M45 70Q50 58 62 67T83 65", "#e7f2bc", 3);
      break;
    case "fluorite":
      jewel("M30 45L58 29 88 44 91 76 65 96 32 78ZM60 50L83 37 105 49 103 77 78 93 58 81Z", "M31 46L61 61 88 45M61 61L65 96M58 51L79 64 104 49M79 64L78 93", "M43 47L58 38M83 50L91 48");
      break;
    case "moonstone":
      jewel("M79 19Q49 27 48 55Q53 81 85 83Q98 80 105 69Q101 95 82 105Q48 119 28 89Q8 58 32 33Q52 12 79 19Z", "M38 40L32 63 44 88 65 98 86 91M44 88L57 77", "M40 30Q25 48 29 69");
      glint(82, 50, 10);
      break;
    case "prism":
      jewel("M63 15L103 51 93 86 64 111 30 87 23 50Z", "M63 15L66 48 103 51M66 48L23 50M66 48L80 72 64 111M80 72L93 86M66 48L48 76 30 87M48 76L64 111", "M43 38L58 24M29 55L36 65");
      line("M84 56L94 56M79 61L90 64", "#ffd8b6", 2);
      break;
    case "lotusGem":
      shape("M22 81Q40 66 49 77Q43 61 30 52Q48 46 59 63Q53 36 65 23Q82 43 72 64Q88 50 101 55Q91 67 83 81Q99 71 108 79Q93 104 65 105Q39 102 22 81Z");
      jewel("M63 46L80 66 72 88 54 87 48 67Z", "M49 67L80 66M63 47L62 87", "M54 65L62 54");
      line("M31 82L53 95M98 79L80 94", "#ffedce", 2);
      glint(31, 39, 6); glint(95, 29, 5);
      break;
    case "petal":
      shape("M41 98C15 77 38 40 69 38Q80 22 93 32Q108 61 84 88Q66 102 41 98Z");
      line("M39 96Q53 74 88 41M49 85Q62 86 73 79", "#ffebc5", 2);
      break;
    case "bud":
      line("M59 107Q57 83 67 63", "#62876b", 4);
      shape("M58 93Q34 91 26 74Q51 71 59 93Z", "#7c976c");
      shape("M61 81Q87 80 99 65Q80 62 61 81Z", "#a7aa71");
      shape("M62 74Q33 61 47 39L64 25Q80 20 89 41Q88 65 62 74Z");
      line("M57 61Q51 46 62 37M69 66Q85 56 82 43", "#ffeece", 2.5);
      break;
    case "blossom":
      bloom(5, 37, 18, 10, .38);
      break;
    case "sprig":
      line("M40 110Q53 66 78 29", "#547761", 4);
      for (const d of ["M52 77Q20 80 29 54Q48 55 52 77Z", "M61 61Q46 42 55 30Q73 38 61 61Z", "M64 63Q82 40 102 49Q93 68 64 63Z", "M46 93Q67 69 85 81Q71 99 46 93Z"]) shape(d);
      line("M38 61L49 74M82 53L69 61M55 89L73 83", "#fff0bb", 1.5);
      break;
    case "feather":
      shape("M31 108Q29 89 44 72L40 65Q63 29 97 21Q105 31 93 63L76 82 64 79Q44 103 31 108Z");
      line("M28 109Q51 78 95 30M50 78L48 67M58 69L58 56M63 63L81 63M73 53L88 53", "#fff2ca", 1.6);
      break;
    case "rose":
      bloom(7, 40, 21, 12);
      bloom(5, 26, 17, 6, .34);
      line("M57 63Q51 52 65 50Q78 55 68 63Q64 67 60 60", "#fff0c8", 2.2);
      break;
    case "camellia":
      bloom(8, 39, 17, 10, .11);
      bloom(8, 24, 12, 9, .48);
      break;
    case "orchid":
      shape("M64 66Q25 55 23 34Q45 13 64 51Q73 26 104 28Q114 51 68 66Z");
      shape("M63 55Q46 54 39 85Q43 108 65 102Q93 104 89 84Q77 60 63 55Z");
      line("M64 63L38 36M67 61L99 37M57 91Q53 76 64 69Q80 87 71 94", "#fff0c8", 1.8);
      dot(64, 67, 5, "#efcf80");
      break;
    case "maple":
      grain(shape("M63 20L73 44 89 31 87 55 111 53 99 70 108 82 82 88 79 100 64 91 50 101 47 88 22 83 32 73 20 53 46 55 43 32 56 44Z"), 125, 3);
      line("M64 109L63 33M63 80L96 67M63 78L32 64M62 65L47 46M64 66L82 49", "#ffdbac", 2);
      break;
    case "goldPetal":
      grain(shape("M39 100Q16 79 38 48Q58 47 87 23Q106 51 84 84Q58 106 39 100Z"), 111, 5);
      line("M38 105Q55 71 86 40M54 81L47 63M60 75L77 79M66 66L65 51", "#ffef99", 2.2);
      glint(98, 71, 6);
      break;
    case "flowerMoon":
      shape("M77 21Q39 30 44 59Q50 82 73 83Q93 83 102 66Q100 99 73 108Q42 114 25 91Q8 63 27 37Q49 14 77 21Z");
      bloom(5, 20, 10, 6, .3);
      glint(88, 41, 5); glint(34, 98, 4);
      break;
    case "spiritFlower":
      bloom(6, 45, 16, 13, .45);
      bloom(6, 28, 12, 9, .8);
      glint(25, 39, 7); glint(100, 79, 7); glint(85, 22, 5);
      break;
  }

  if (locked) {
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "#58614f";
    ctx.fillRect(0, 0, 128, 128);
    ctx.globalCompositeOperation = "source-over";
  }
}

export default function OddityItemArt({ item, locked = false, className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvas.current) drawItem(canvas.current, item, locked); }, [item, locked]);
  return <canvas ref={canvas} className={className} width={256} height={256} aria-hidden="true" style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />;
}
