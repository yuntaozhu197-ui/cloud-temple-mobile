import { useEffect, useRef } from "react";
import "./oddities-art.css";

type Merchant = "squirrel" | "koi" | "tit";
type Paint = (ctx: CanvasRenderingContext2D) => void;
type Brush = string | CanvasGradient;

function path(ctx: CanvasRenderingContext2D, shape: string, color: Brush, edge?: string, width = 2) {
  const drawing = new Path2D(shape);
  ctx.fillStyle = color;
  ctx.fill(drawing);
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = width;
    ctx.stroke(drawing);
  }
  return drawing;
}

function stroke(ctx: CanvasRenderingContext2D, shape: string, ink: string, weight = 1) {
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = weight;
  ctx.stroke(new Path2D(shape));
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: Brush, angle = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function wash(ctx: CanvasRenderingContext2D, x: number, y: number, endX: number, endY: number, first: string, last: string) {
  const gradient = ctx.createLinearGradient(x, y, endX, endY);
  gradient.addColorStop(0, first);
  gradient.addColorStop(1, last);
  return gradient;
}

function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function stipple(ctx: CanvasRenderingContext2D, width: number, height: number, seed: number, count: number, ink: string, scale: number) {
  const random = seeded(seed);
  ctx.fillStyle = ink;
  for (let n = 0; n < count; n++) {
    const radius = .4 + random() * scale;
    ctx.fillRect(random() * width, random() * height, radius, radius * (.38 + random()));
  }
}

function Painting({ className, width, height, paint }: { className?: string; width: number; height: number; paint: Paint }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    paint(ctx);
  }, [width, height, paint]);
  return <canvas ref={ref} className={className} width={width} height={height} aria-hidden="true" />;
}

function mountain(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, color: Brush) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  path(ctx, "M-90 155 Q-22 102 30 67 Q62 53 104 18 Q126 -1 162 28 Q214 66 248 85 Q288 105 349 160Z", color);
  ctx.restore();
}

function stone(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / 50, height / 24);
  path(ctx, "M-25 1Q-23-10-11-13Q-2-16 9-12Q22-10 25 1Q22 10 4 13Q-15 14-25 7Z", "#858c68");
  path(ctx, "M-25 1Q-23-10-11-13Q-3-16 9-12Q22-10 25 1Q13 6 1 5Q-15 8-25 1Z", wash(ctx, 0, -11, 2, 16, "#ddd2a4", "#a6a281"));
  stroke(ctx, "M-21 1Q-13-8-5-8M6 1L13-4", "#f5e2aa80", 1.2);
  ctx.restore();
}

function lotus(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, flower: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  oval(ctx, 0, 3, 29, 9, "#254c426b", -.06);
  path(ctx, "M-31 0Q-29-10-7-13Q12-16 30-8L9-1L31 1Q23 12-1 13Q-24 12-31 0Z", wash(ctx, -10, -10, 18, 13, "#8ba26e", "#416b53"));
  stroke(ctx, "M-23 1Q-8 7 7 1L-7-9M7 1L-8 9", "#d7d39765", 1.1);
  if (flower) {
    path(ctx, "M-12-12Q-21-23-14-32Q-6-30 0-20Q6-32 14-33Q20-25 13-13Q6-5-3-7Z", "#b96261");
    path(ctx, "M-5-9Q-19-13-27-26Q-12-29-3-19Q-6-24 0-36Q8-30 7-20Q16-28 25-23Q18-11 7-8Z", wash(ctx, 0, -32, 0, -8, "#fae3c8", "#d89186"));
    stroke(ctx, "M0-30Q4-21 3-15M-19-22Q-8-20-5-14M17-20L10-14", "#fdf2d3b0", 1.8);
    oval(ctx, 2, -13, 4, 3, "#e7b961");
  }
  ctx.restore();
}

function lantern(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  oval(ctx, 5, 2, 45, 9, "#555b473b", -.05);
  path(ctx, "M-29-6L-20-15H21L29-6L26 1H-24Z", "#969676", "#6e775d", 1.4);
  path(ctx, "M-12-14L-7-60H9L14-14Z", "#a3a083", "#74785d", 1.2);
  path(ctx, "M-22-61L-17-90L17-90L24-61Q0-55-22-61Z", wash(ctx, -8, -78, 20, -62, "#b5aa82", "#7f8061"), "#737657", 1.5);
  path(ctx, "M-14-65L-13-84H4L6-64Z", "#595c46");
  path(ctx, "M-11-66L-8-81H1L3-66Z", "#f5bb6c");
  path(ctx, "M-29-88Q-16-96-9-106Q-2-114 8-107Q17-97 30-89Q5-81-29-88Z", "#7c8868", "#5c7056", 1.8);
  stroke(ctx, "M-24-90Q-3-87 21-91M-18-59L17-59M-4-17L1-51", "#d6cb9b8e", 1.8);
  oval(ctx, 0, -113, 5, 6, "#7d8865");
  ctx.restore();
}

function bloom(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  for (let index = 0; index < 5; index++) {
    const angle = index * Math.PI * .4 + x % 4;
    oval(ctx, Math.cos(angle) * size * .64, Math.sin(angle) * size * .64, size, size * .52, color, angle);
  }
  oval(ctx, 0, 0, size * .47, size * .44, "#e9c174");
  ctx.restore();
}

function paintCourtyard(ctx: CanvasRenderingContext2D) {
  const random = seeded(159);
  ctx.fillStyle = wash(ctx, 0, 0, 105, 700, "#f6e5bd", "#c4c094");
  ctx.fillRect(0, 0, 1200, 700);
  const sun = ctx.createRadialGradient(676, 84, 7, 676, 84, 284);
  sun.addColorStop(0, "#fff5cf");
  sun.addColorStop(1, "#fff4c000");
  oval(ctx, 676, 84, 284, 284, sun);
  oval(ctx, 682, 111, 49, 49, "#ffdf9db0");
  mountain(ctx, 383, 72, 1.42, "#c3cdb1");
  mountain(ctx, 668, 29, 1.62, "#adbfa7");
  mountain(ctx, 18, 36, 1.37, "#aabca1");
  mountain(ctx, 857, 127, 1.52, "#8da688");
  mountain(ctx, 186, 139, 1.15, "#91a685");
  mountain(ctx, 479, 159, 1.06, "#a6b18b");
  for (const [x, y, width] of [[385, 173, 170], [717, 184, 144], [539, 93, 107], [853, 120, 100]]) {
    oval(ctx, x, y, width, 7, "#faf2d09e", -.025);
    oval(ctx, x - width * .57, y + 5, width * .45, 5, "#f7efd18c");
  }

  path(ctx, "M0 320Q148 264 318 302Q445 276 594 292Q735 283 846 326Q1007 306 1200 327L1200 700H0Z", wash(ctx, 0, 284, 0, 717, "#bfc295", "#8c9b70"));
  path(ctx, "M382 288Q586 285 699 325Q822 383 1200 376L1200 700H0L0 653Q184 582 264 477Q331 337 382 288Z", wash(ctx, 342, 341, 853, 681, "#e5d5ad", "#c4b990"));

  // Courtyard wall and the cedar pavilion stay behind the playable figures.
  path(ctx, "M303 288L346 260L760 274L831 303L795 326L298 324Z", "#d4c39a");
  path(ctx, "M291 286L337 253L753 264L840 294L827 306L752 278L342 269L301 298Z", "#829477", "#728165", 2);
  for (let n = 0; n < 19; n++) {
    const x = 347 + n * 21;
    stroke(ctx, `M${x} ${256 + n * .55}l-5 13`, "#a8aa855f", 2.2);
  }
  stroke(ctx, "M335 318L558 325M589 325L680 330", "#a59b716e", 3);
  path(ctx, "M805 335L882 304L1092 318L1165 362L1115 378L825 369Z", "#8a8c67");
  path(ctx, "M835 343L890 321L1081 331L1138 361L1108 372L850 365Z", "#dfcd99");
  path(ctx, "M856 211L1075 221L1075 337L860 325Z", "#e5ca8f");
  path(ctx, "M872 238L1001 242L1001 331L875 326Z", "#936b48");
  path(ctx, "M878 244L993 246L993 324L878 320Z", "#514e35");
  path(ctx, "M1007 241L1062 244L1060 328L1008 325Z", "#d6ad74");
  for (const [x, y, h] of [[857, 227, 107], [918, 235, 98], [998, 233, 103], [1073, 226, 118], [1106, 224, 128]]) {
    path(ctx, `M${x} ${y}l10 1v${h}l-10-2Z`, wash(ctx, x, y, x + 10, y, "#a86442", "#79452e"));
    stroke(ctx, `M${x + 2} ${y + 6}v${h - 15}`, "#d1916d71", 2);
  }
  path(ctx, "M801 228Q844 223 862 192Q890 170 898 149Q962 158 1034 148Q1049 170 1077 189Q1107 222 1142 231Q1059 251 968 246Q862 244 801 228Z", wash(ctx, 960, 155, 970, 249, "#617d65", "#315747"), "#335747", 3.8);
  path(ctx, "M895 151Q879 144 889 126Q906 144 922 146Q974 151 1012 144Q1036 136 1045 128Q1051 145 1034 154Q970 169 895 151Z", "#365d4e");
  stroke(ctx, "M805 229Q843 234 876 234Q982 253 1135 232M904 153Q961 166 1028 151", "#a2ac74", 4);
  for (let n = 0; n < 19; n++) {
    const a = n / 18;
    const x = 899 + a * 135;
    const end = 814 + a * 315;
    stroke(ctx, `M${x} ${153 + Math.sin(a * Math.PI) * 10}Q${x} 180 ${end} ${229 + Math.sin(a * Math.PI) * 14}`, n % 2 ? "#abc0935e" : "#253f356e", 2.1);
  }
  for (const x of [881, 1054]) {
    stroke(ctx, `M${x} 237v22`, "#795732", 2);
    oval(ctx, x, 270, 9, 13, "#b75d47");
    oval(ctx, x - 2, 269, 5, 11, "#de9863");
    stroke(ctx, `M${x} 282v11`, "#a56844", 2);
  }

  // Organic ink marks and individual stepping stones set the scale of the grounds.
  for (let n = 0; n < 76; n++) {
    const x = random() * 1200;
    const y = 321 + random() * 379;
    oval(ctx, x, y, 3 + random() * 26, 1 + random() * 3, n % 3 ? "#9e9a7351" : "#eee1b46e", -.03);
  }
  for (const [x, y, w, h] of [[493, 330, 42, 12], [535, 350, 49, 14], [467, 376, 61, 17], [414, 407, 68, 20], [439, 439, 68, 24], [358, 480, 78, 26], [311, 522, 93, 28], [215, 569, 105, 35], [167, 625, 114, 40], [104, 690, 157, 43], [841, 393, 59, 15]]) {
    stone(ctx, x,y,w,h);
  }

  path(ctx, "M424 540Q447 470 567 433Q725 394 887 448Q985 483 981 561Q955 639 767 654Q618 676 493 628Q421 601 424 540Z", "#7a8b70");
  path(ctx, "M431 537Q469 472 578 449Q751 408 880 462Q962 493 965 554Q945 618 769 640Q624 659 494 612Q442 594 431 537Z", "#9b9e7e");
  path(ctx, "M455 539Q482 479 588 458Q751 424 859 471Q944 501 941 551Q924 607 760 627Q624 648 507 602Q462 585 455 539Z", wash(ctx, 650, 463, 715, 638, "#aac0a1", "#4d8277"));
  const pond = new Path2D("M455 539Q482 479 588 458Q751 424 859 471Q944 501 941 551Q924 607 760 627Q624 648 507 602Q462 585 455 539Z");
  ctx.save();
  ctx.clip(pond);
  path(ctx, "M460 538Q525 512 597 519T947 529Q866 568 733 546Q608 547 460 575Z", "#85bea195");
  path(ctx, "M485 603Q652 573 729 588T962 572V643H492Z", "#56897c9b");
  for (let n = 0; n < 49; n++) {
    const x = 456 + random() * 473;
    const y = 452 + random() * 177;
    const length = 5 + random() * 55;
    stroke(ctx, `M${x} ${y}q${length / 3} ${random() * 5} ${length} 1`, n % 3 === 0 ? "#fbebbb7f" : "#c5d2a179", .7 + random() * 1.2);
  }
  ctx.restore();
  for (const [x, y, w, h] of [[461, 520, 33, 19], [447, 541, 38, 21], [452, 568, 42, 23], [479, 602, 44, 24], [514, 623, 42, 25], [557, 638, 58, 23], [606, 647, 51, 25], [662, 654, 58, 23], [718, 653, 57, 20], [773, 648, 59, 22], [827, 634, 55, 24], [879, 614, 48, 23], [923, 589, 42, 26], [955, 556, 34, 20], [949, 523, 33, 20], [924, 493, 36, 19], [493, 491, 38, 18], [537, 469, 42, 18]]) stone(ctx, x, y, w, h);
  lotus(ctx, 533, 532, .96, true);
  lotus(ctx, 569, 538, .63, false);
  lotus(ctx, 602, 482, .61, false);
  lotus(ctx, 844, 523, .85, true);
  lotus(ctx, 876, 556, 1.06, false);
  lotus(ctx, 812, 595, .83, true);
  lotus(ctx, 733, 613, .56, false);

  // Layered tree bark, branches and stony edges in the near garden.
  path(ctx, "M0 466Q87 418 173 419Q237 399 332 422Q380 445 384 462Q318 505 210 525Q107 547 0 566Z", "#788965");
  path(ctx, "M0 451Q109 411 177 408Q245 396 344 425L374 452Q288 493 174 500Q111 522 0 524Z", "#9ba071");
  const trunk = path(ctx, "M85 474Q155 449 164 386Q161 311 161 284Q120 230 87 208L107 190Q153 205 189 252Q194 218 223 160L241 153Q224 204 234 225Q268 208 304 169L319 175Q292 235 244 275Q220 342 237 407Q244 438 297 452Q271 463 239 455Q203 456 193 476Q179 492 142 477Q118 488 85 474Z", wash(ctx, 116, 228, 269, 408, "#ac8357", "#72513a"), "#674e3d", 3);
  ctx.save();
  ctx.clip(trunk);
  for (const [bend, trim] of [[-39, "#624633"], [-21,"#d3a773"], [-11,"#6c4f36"], [12,"#c49562"], [21,"#4e3b2d"], [38,"#a98157"], [52,"#a58a56"]] as const) {
    stroke(ctx, `M${91 + bend} 182Q${247 + bend} 263 ${199 + bend} 337Q${180 + bend} 410 ${247 + bend} 459`, trim, 4);
  }
  stipple(ctx, 340, 495, 4007, 1220, "#fff2bf4f", 2);
  ctx.restore();
  path(ctx, "M172 366Q184 350 196 369Q199 388 185 403Q167 400 172 366Z", "#604632");
  stroke(ctx, "M178 367Q191 355 193 375Q194 387 184 397", "#b48a5b", 2.3);
  const grove = [[-2, 140, 82], [54, 114, 84], [98, 96, 87], [149, 62, 73], [204, 85, 94], [265, 99, 79], [318, 117, 80], [353, 149, 57], [273, 153, 75], [181, 125, 90], [102, 138, 83], [48, 168, 63], [151, 172, 71], [238, 159, 72]];
  for (let index = 0; index < grove.length; index++) {
    const [x, y, width] = grove[index];
    oval(ctx, x, y + 17, width, width * .52, index % 3 ? "#5c7854" : "#536c50", -.12);
    for (let n = 0; n < 55; n++) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random());
      const leafX = x + Math.cos(angle) * radius * width;
      const leafY = y + Math.sin(angle) * radius * width * .51;
      oval(ctx, leafX, leafY, 7 + random() * 20, 2.8 + random() * 8.2, ["#789262", "#607f56", "#a0a76b", "#879b66", "#b4af73", "#687f59"][Math.floor(random() * 6)], random() * .6 - .32);
    }
  }
  for (const [x, y, s] of [[79, 437, .9], [330, 451, 1.05], [1131, 479, 1.18]]) lantern(ctx,x,y,s);
  for (const [x, y, w, h] of [[48, 491, 53, 28], [78, 504, 47, 20], [108, 492, 55, 21], [324, 488, 49, 25], [351, 488, 33, 14], [1048, 482, 49, 25]]) stone(ctx, x,y,w,h);

  path(ctx, "M923 421Q951 362 1011 379Q1097 342 1200 396V576Q1139 553 1073 519Q1004 496 923 421Z", "#879c67");
  for (let n = 0; n < 65; n++) {
    const x = 939 + random() * 273;
    const y = 383 + random() * (57 + (x - 941) / 2.9);
    oval(ctx, x, y, 9 + random() * 11, 3 + random() * 7, ["#77955f", "#a4ad75", "#677f59", "#9da367"][n % 4], (random() - .5) * 2);
    if (n % 2 === 0) bloom(ctx, x, y - 4, 2.9 + random() * 4.8, ["#edbfaa", "#bd775e", "#e6b369", "#f1dfb1", "#d78e84"][n % 5]);
  }
  for (const [x, y, scale] of [[404, 464, .48], [1122, 422, .53], [761, 365, .48]]) lantern(ctx, x,y,scale);
  stipple(ctx, 1200, 700, 2003, 15800, "#62472720", 2);
  stipple(ctx, 1200, 700, 2009, 12700, "#fff6cc44", 2.5);
}

function pineCone(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, turn = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.scale(scale, scale);
  path(ctx, "M-23 22Q-38-4-11-31Q-2-39 3-42Q27-22 30 2Q34 23 18 32Q-9 39-23 22Z", "#855334", "#553e30", 2);
  for (let row = 0; row < 6; row++) {
    const py = -29 + row * 10;
    for (let column = 0; column < 3; column++) {
      const px = (column - 1) * (10 + row * 1.5) + (row % 2 ? 3 : -2);
      const size = 3.6 + row * .9;
      path(ctx, `M${px - size} ${py}q${size} -5 ${size * 2} 0q${-size} ${size * 1.9} ${-size * 2} 0Z`, column % 2 ? "#dba468" : "#c58a50");
      stroke(ctx, `M${px - size * .50} ${py}l${size * .85} 2`, "#f2c38484", 1);
    }
  }
  ctx.restore();
}

function antiqueBox(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  oval(ctx, 2, 40, 76, 13, "#4b463441");
  path(ctx, "M-61-20Q-38-34 45-30L68-13L67 29L43 42L-58 36Z", wash(ctx, -60, -30, 68, 32, "#c1794b", "#783e2e"), "#694733", 3);
  path(ctx, "M-60-20L43-14L69-14L43-33L-45-35Z", wash(ctx, -45, -35, 44, -8, "#dfaa6b", "#a75d3b"), "#704630", 2.4);
  path(ctx, "M-57-9L42-4L44 38L-55 34Z", wash(ctx, 0, -10, 2, 42, "#b87349", "#98543a"));
  path(ctx, "M43-4L66-10L65 28L44 38Z", "#6c3929");
  stroke(ctx, "M-54 0L39 7M-53 27L38 33M46 8L63 2M-52-17Q-21-13 27-12", "#f0b8749c", 2.3);
  for (const [from, to] of [[-49, -39], [24, 35]]) {
    path(ctx, `M${from} -19L${to} -19L${to} 34L${from} 33Z`, "#d6aa64", "#6c4931", 1.4);
    oval(ctx, (from + to) / 2, -4, 1.8, 1.8, "#7d5838");
    oval(ctx, (from + to) / 2, 25, 1.7, 1.7, "#7d5838");
  }
  path(ctx, "M-18-3L-9-9L0-3L-2 12L-9 17L-16 12Z", "#e7b971", "#805c34", 1.7);
  oval(ctx, -9, 5, 2.8, 3.4, "#6c5033");
  ctx.restore();
}

function roundEye(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  oval(ctx, x, y, size, size * 1.05, "#392b27", -.18);
  oval(ctx, x - size * .27, y - size * .38, size * .29, size * .31, "#fff0c8");
  oval(ctx, x + size * .26, y + size * .38, size * .12, size * .13, "#c8a575");
}

function squirrelTail(ctx: CanvasRenderingContext2D) {
  const tail = path(ctx, "M138 270Q72 279 46 242Q13 198 42 161Q62 135 53 102Q43 63 56 42Q68 22 76 24Q72 64 105 72Q151 73 155 120Q152 148 132 171Q117 194 129 217Q140 238 172 240Z", wash(ctx, 59, 81, 112, 259, "#d2844e", "#9f5637"), "#704631", 3.8);
  ctx.save();
  ctx.clip(tail);
  path(ctx, "M59 41Q42 96 76 123Q107 146 78 180Q46 223 89 251Q123 270 161 259L159 212Q99 202 120 158Q153 113 109 89Q57 78 67 27Z", "#edaa6d");
  stroke(ctx, "M58 67Q51 108 81 128Q104 153 74 193Q53 221 82 242M74 89Q91 105 111 106Q134 123 113 155M109 179Q85 231 133 249", "#fff0bf72", 3.6);
  stipple(ctx, 360, 300, 556, 680, "#67352032", 1.6);
  ctx.restore();
}

function squirrel(ctx: CanvasRenderingContext2D, blink = false) {
  if (!blink) {
    oval(ctx, 183, 267, 131, 15, "#493c2945", -.02);
    antiqueBox(ctx, 263, 225, .84);
    const coat = path(ctx, "M102 230Q104 192 143 162Q188 130 219 158Q257 188 248 228Q237 263 189 266Q150 279 113 257Z", wash(ctx, 128, 171, 205, 261, "#d78a50", "#ad633c"), "#75492e", 3.4);
    ctx.save();
    ctx.clip(coat);
    oval(ctx, 190, 216, 47, 56, wash(ctx, 176, 171, 200, 259, "#fae4b7", "#dcad74"), -.13);
    stipple(ctx, 360, 300, 1046, 1154, "#6e3a2537", 1.5);
    ctx.restore();
    oval(ctx, 135, 252, 36, 18, "#bb744e", -.05);
    oval(ctx, 201, 257, 29, 13, "#ca8954", -.05);
    path(ctx, "M133 135Q118 112 124 79Q122 61 132 57Q142 59 146 81Q154 85 162 115ZM188 109Q189 80 203 64Q221 51 220 72Q230 98 217 128Z", "#b97249", "#764930", 3);
    path(ctx, "M136 108Q131 91 132 73Q142 81 148 105ZM203 106Q201 91 213 73Q218 87 212 106Z", "#e7a38a");
    const head = path(ctx, "M114 152Q111 119 145 106Q156 91 178 103Q191 97 207 105Q236 112 243 144Q254 171 230 188Q203 201 172 195Q127 198 114 170Z", wash(ctx, 134, 100, 226, 201, "#efb173", "#c27a49"), "#784c33", 3.3);
    ctx.save();
    ctx.clip(head);
    path(ctx, "M118 153Q141 136 160 158Q181 165 195 156Q221 147 241 158L244 194H112Z", wash(ctx, 122, 146, 195, 192, "#ffebcb", "#efc795"));
    stipple(ctx, 340, 300, 6213, 1052, "#9b5c3031", 1.8);
    ctx.restore();
    oval(ctx, 132, 165, 11, 5, "#df917b92", -.09);
    oval(ctx, 221, 165, 10, 4.7, "#df917b95", .10);
    path(ctx, "M170 157Q176 153 183 157Q181 163 176 164Q172 163 170 157Z", "#623d30");
    stroke(ctx, "M176 163v7q-5 7-11 2m11-2q6 6 12 0M142 129q9-6 15-2M197 126q9-4 17 4", "#7f5136", 2.1);
    pineCone(ctx, 176, 223, 1.09, -.14);
    path(ctx, "M141 199Q132 199 131 207Q137 222 153 220Q157 215 151 207ZM214 197Q221 203 218 209Q210 223 198 221Q192 215 202 206Z", "#ebaf75", "#a0623f", 2);
    stroke(ctx, "M144 209l5 5m57-8-6 7M122 250l8-3m7 5 7-4M194 254l4-5m7 7 4-6", "#9b603e80", 1.4);
  } else {
    stroke(ctx, "M142 148q7 7 15 0m44 0q8 7 15-1", "#4b362b", 3);
  }
}

function openSquirrelEyes(ctx: CanvasRenderingContext2D) {
  roundEye(ctx, 150, 148, 8.5);
  roundEye(ctx, 208, 149, 8.5);
}

function shell(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  oval(ctx, 0, 32, 76, 11, "#264e4140");
  path(ctx, "M-67 19Q-60 9-52 6Q-73-32-50-47Q-31-62-16-36Q-8-64 9-63Q31-62 28-32Q48-52 63-32Q76-21 57 9Q68 14 68 23Q29 52-31 44Q-56 39-67 19Z", wash(ctx, 0, -65, 0, 46, "#f2d2aa", "#9e6b56"), "#885c49", 2.8);
  path(ctx, "M-63 21Q-35-2 0 2Q42 1 64 22Q39 41 0 40Q-37 40-63 21Z", wash(ctx, 0, 3, 0, 44, "#875b4c", "#deb390"));
  for (const [x, y] of [[-51,-36],[-30,-45],[-10,-48],[10,-55],[29,-43],[51,-29],[58,-12]]) stroke(ctx, `M${x} ${y}Q${x * .68} ${y + 23} ${x * .27} 0`, "#b38169", 2.5);
  stroke(ctx, "M-57-24Q-58-39-46-42M1-53Q10-59 17-51M39-32Q51-38 57-28M-52 23Q1 42 50 26", "#fff0d1bd", 2.5);
  ctx.restore();
}

function koiWater(ctx: CanvasRenderingContext2D) {
  oval(ctx, 176, 220, 136, 34, "#73a88a74", -.07);
  oval(ctx, 172, 209, 110, 26, "#b2c99e66", -.06);
  stroke(ctx, "M47 220q30 30 132 22q83-5 128-31M80 222q32 14 102 7q63-4 90-21M97 197q-36 8-31 15M242 196q53-3 57 8", "#e7e9bcda", 3.1);
  lotus(ctx, 264, 231, 1, true);
  lotus(ctx, 94, 243, .81, false);
  shell(ctx, 232, 235, .46);
}

function koi(ctx: CanvasRenderingContext2D) {
  path(ctx, "M226 109Q272 81 278 55Q287 74 286 90Q306 76 319 55Q328 92 300 124Q282 145 245 148Z", wash(ctx, 270, 83, 271, 149, "#f8d9a2", "#d98d64"), "#ac7855", 2.8);
  stroke(ctx, "M256 128q31-19 39-42M272 132q29-15 41-33M260 119q17-18 21-33", "#fff1c4a6", 2.3);
  path(ctx, "M136 118Q143 84 185 65Q193 77 185 98Q210 77 220 86Q216 115 195 133Z", "#d48a5c", "#a56c4d", 2.4);
  stroke(ctx, "M154 111q22-21 30-32M180 113q23-17 32-21", "#f4c586a0", 2.2);
  const scales = path(ctx, "M79 138Q94 113 130 112Q171 110 195 122Q216 122 251 103Q272 115 273 136Q252 168 226 180Q198 193 173 187Q132 208 93 189Q65 175 72 154Z", wash(ctx, 172, 108, 197, 186, "#f8dfb1", "#dba773"), "#9e684e", 3);
  ctx.save();
  ctx.clip(scales);
  path(ctx, "M63 117Q102 100 127 122Q142 138 126 147Q108 148 106 170Q97 187 72 178Z", wash(ctx, 79, 125, 133, 178, "#e48949", "#bb5b3d"));
  path(ctx, "M157 107Q179 111 188 125Q187 139 165 145Q144 153 163 174Q169 187 152 200L176 198Q195 175 198 163Q191 146 216 134Q224 130 217 113Z", "#d47549");
  path(ctx, "M244 103Q283 106 279 142Q271 169 224 184Q211 178 226 157Q247 152 245 134Q227 122 244 103Z", wash(ctx, 256, 111, 233, 179, "#f0a858", "#cc6143"));
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 11; col++) {
      const x = 130 + col * 12 + (row % 2 ? 5 : 0);
      const y = 121 + row * 13;
      stroke(ctx, `M${x} ${y - 4}q9 3 1 10`, "#fff3c987", 1.55);
    }
  }
  stipple(ctx, 360, 300, 6786, 1011, "#8c482334", 1.4);
  ctx.restore();
  path(ctx, "M118 176Q136 169 153 172Q158 195 129 208Q124 197 111 196Q105 192 118 176Z", wash(ctx, 122, 176, 137, 207, "#f9d19c", "#e29a6c"), "#ae7152", 2.1);
  stroke(ctx, "M121 192q20-5 25-15m-14 23q9-5 15-16M78 157q-20-9-26 2M74 162q-18-4-20 5", "#994f37", 2.0);
  stroke(ctx, "M104 128q15 5 16 19q1 11-6 19", "#a66b54", 2.3);
  roundEye(ctx, 97, 143, 7.4);
  oval(ctx, 75, 165, 7, 3.8, "#a95c48");
  oval(ctx, 132, 177, 13, 2.3, "#fee6b08f", -.27);
}

function petalBundle(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  oval(ctx, 0, 36, 70, 13, "#5d4b3538");
  path(ctx, "M-2 0Q-42 23-69 2Q-68-17-34-25Q-16-29-2 0ZM6 0Q43 22 70-2Q62-23 40-22Q19-21 6 0Z", wash(ctx, 0, -27, 0, 15, "#adad71", "#577a58"), "#637450", 2.3);
  path(ctx, "M-68 6Q-56-2-49-3Q-32 14-7 6Q11-5 25 4Q47 12 65 1Q61 26 58 28Q38 44 0 43Q-49 41-65 21Z", wash(ctx, 0, 1, 0, 47, "#e3b878", "#a4774d"), "#875f3f", 2.6);
  for (let i=0; i<7; i++) stroke(ctx, `M${-55 + i * 17} 11q0 10 ${5 - i * 1.1} 22`, "#f4d09c93", 2.1);
  stroke(ctx, "M-62 16q20 12 66 9q49-4 58-15M-58 22q30 15 67 10q29-3 49-12", "#855c3ca0", 2);
  for (const [dx, dy, size, tone] of [[-34,-6,12,"#dc927c"],[-12,-14,15,"#e9a496"],[11,-13,14,"#e9b471"],[29,-10,10,"#f6d3a8"],[46,-6,9,"#cc8072"]] as const) bloom(ctx, dx,dy,size,tone);
  path(ctx, "M-9 21Q-21 13-18 9Q-7 9 0 19Q11 4 17 11Q21 18 5 24Q6 29 12 38L3 38L-2 26L-11 39L-17 36Z", "#a75b40");
  ctx.restore();
}

function titPerch(ctx: CanvasRenderingContext2D) {
  oval(ctx, 170, 254, 127, 18, "#59472e36", -.04);
  path(ctx, "M40 240Q81 221 127 222Q168 224 204 209Q239 191 285 202L293 212Q248 216 218 231Q184 250 126 245Q81 256 42 251Z", wash(ctx, 146, 211, 156, 248, "#b78a58", "#805a3f"), "#6c5036", 2.7);
  stroke(ctx, "M55 242q42-14 93-11q27 2 61-12m9-3q44-18 61-11", "#ead09b93", 2.8);
  for (const [x, y, size, color] of [[79,224,6,"#e9b3a3"],[91,230,8,"#f0d2a5"],[259,199,7,"#edcba4"],[275,194,6,"#d68d79"],[283,208,7,"#e7aca1"]] as const) bloom(ctx, x,y,size,color);
  petalBundle(ctx, 248, 246, .55);
}

function tit(ctx: CanvasRenderingContext2D) {
  path(ctx, "M195 191Q229 195 258 174Q282 171 300 173Q289 186 274 198Q270 209 287 214Q261 222 238 217Q214 220 195 205Z", wash(ctx, 217, 180, 259, 216, "#63715a", "#323e35"), "#354036", 2.8);
  stroke(ctx, "M231 207Q251 202 275 184M233 211q22 3 39 1", "#a6956e", 1.8);
  const body = path(ctx, "M87 155Q85 118 113 106Q133 78 172 85Q206 87 225 118Q249 150 233 179Q222 219 180 224Q128 233 104 205Q87 184 87 155Z", wash(ctx, 105, 109, 192, 214, "#f7d781", "#d5a45e"), "#4e503d", 3.8);
  ctx.save();
  ctx.clip(body);
  path(ctx, "M93 153Q87 113 113 106Q136 76 172 85Q208 80 225 118Q231 130 206 150Q188 169 183 208Q164 219 154 217Q170 185 143 167Q118 169 93 153Z", wash(ctx, 126, 90, 204, 199, "#61715c", "#35463d"));
  path(ctx, "M97 144Q105 127 128 134Q144 142 158 161Q151 175 126 172Q106 169 97 144Z", "#f7e4b9");
  stroke(ctx, "M112 181q14 21 42 32m41-110q16 13 17 24", "#ebd5a587", 2.4);
  stipple(ctx, 360, 300, 963, 1150, "#68493941", 1.45);
  ctx.restore();
  roundEye(ctx, 137, 126, 8.8);
  path(ctx, "M90 146L67 157L94 160Q100 157 101 151Z", "#b17849", "#654935", 2.3);
  path(ctx, "M69 155Q51 144 36 161Q41 177 60 175Q69 174 71 163Q68 157 69 155Z", wash(ctx, 44, 149, 59, 178, "#f5c7a9", "#c27b6d"), "#ac665e", 1.8);
  stroke(ctx, "M40 166q15 2 26-8M134 217l-4 11l-11 4m11-4 10 1m47-7-4 9-10 4m10-4 9 3", "#8b653e", 2.3);
}

function titWing(ctx: CanvasRenderingContext2D) {
  path(ctx, "M176 139Q207 125 222 145Q233 165 215 196Q200 209 184 203Q194 192 179 192Q184 178 173 176Q177 164 167 162Z", wash(ctx, 174, 136, 215, 202, "#81906c", "#456151"), "#49614e", 2.8);
  stroke(ctx, "M177 161q31-22 43-12m-34 26q23-13 34-14m-29 26q16-7 24-13m-19 24q11-7 15-14", "#d8cc927d", 2.2);
}

const squirrelBody: Paint = ctx => squirrel(ctx);
const squirrelBlink: Paint = ctx => squirrel(ctx, true);
const objects: Record<Merchant, Paint> = {
  squirrel: ctx => antiqueBox(ctx, 180, 199, 1.95),
  koi: ctx => shell(ctx, 180, 179, 1.87),
  tit: ctx => petalBundle(ctx, 180, 192, 1.89),
};

export function OdditiesBackdrop({ className = "" }: { className?: string }) {
  return (
    <div className={`oddities-art-backdrop ${className}`} aria-hidden="true">
      <Painting width={1200} height={700} paint={paintCourtyard} />
      <span className="oddities-art-drift oddities-art-drift-leaf" />
      <span className="oddities-art-drift oddities-art-drift-leaf oddities-art-drift-delay" />
      <span className="oddities-art-drift oddities-art-drift-flower" />
      <span className="oddities-art-drift oddities-art-drift-flower oddities-art-drift-delay" />
      <span className="oddities-art-pond-ripple" />
      <span className="oddities-art-pond-ripple oddities-art-pond-ripple-delay" />
    </div>
  );
}

export function OdditiesMerchantArt({ merchant, interacting = false, className = "" }: { merchant: Merchant; interacting?: boolean; className?: string }) {
  return (
    <span className={`oddities-art-merchant oddities-art-merchant-${merchant}${interacting ? " oddities-art-merchant-active" : ""} ${className}`} aria-hidden="true">
      {merchant === "squirrel" && <>
        <Painting className="oddities-art-tail" width={360} height={300} paint={squirrelTail} />
        <Painting className="oddities-art-squirrel-body" width={360} height={300} paint={squirrelBody} />
        <Painting className="oddities-art-eyes-open" width={360} height={300} paint={openSquirrelEyes} />
        <Painting className="oddities-art-eyes-closed" width={360} height={300} paint={squirrelBlink} />
      </>}
      {merchant === "koi" && <>
        <Painting className="oddities-art-water" width={360} height={300} paint={koiWater} />
        <Painting className="oddities-art-fish" width={360} height={300} paint={koi} />
        <span className="oddities-art-koi-ripple" /><span className="oddities-art-koi-ripple oddities-art-koi-ripple-delay" />
        <span className="oddities-art-bubble" /><span className="oddities-art-bubble oddities-art-bubble-delay" />
      </>}
      {merchant === "tit" && <>
        <Painting width={360} height={300} paint={titPerch} />
        <span className="oddities-art-bird">
          <Painting width={360} height={300} paint={tit} />
          <Painting className="oddities-art-wing" width={360} height={300} paint={titWing} />
        </span>
        <span className="oddities-art-bird-petal" /><span className="oddities-art-bird-petal oddities-art-bird-petal-delay" />
      </>}
    </span>
  );
}

export function OdditiesArtifactArt({ merchant, className = "" }: { merchant: Merchant; className?: string }) {
  return <span className={`oddities-art-artifact ${className}`} aria-hidden="true"><Painting width={360} height={300} paint={objects[merchant]} /></span>;
}
