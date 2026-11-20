type CatCard = { day: string; seconds: number; preview?: string };

function readPreview(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const preview = new Image();
    preview.onload = () => resolve(preview);
    preview.onerror = reject;
    preview.src = source;
  });
}

function drawPaw(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.beginPath();
  context.moveTo(-22, 14);
  context.bezierCurveTo(-23, 4, -11, -6, 0, -6);
  context.bezierCurveTo(11, -6, 23, 4, 22, 14);
  context.bezierCurveTo(20, 25, 7, 21, 0, 19);
  context.bezierCurveTo(-7, 21, -20, 25, -22, 14);
  context.fill();
  for (const [toeX, toeY, tilt] of [[-23, -13, -0.45], [-8, -25, -0.15], [8, -25, 0.15], [23, -13, 0.45]]) {
    context.beginPath();
    context.ellipse(toeX, toeY, 6.5, 10, tilt, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

export async function downloadTempleCatCard({ day, seconds, preview }: CatCard) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1200;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("暂时无法制作分享卡。");
  const chinese = '"PingFang SC","Microsoft YaHei",system-ui,sans-serif';

  context.fillStyle = "#213e36";
  context.fillRect(0, 0, 900, 1200);
  context.strokeStyle = "#a9986b";
  context.lineWidth = 2;
  context.strokeRect(34, 34, 832, 1132);
  context.strokeStyle = "#5d7965";
  context.strokeRect(43, 43, 814, 1114);

  context.fillStyle = "#dfcb94";
  context.font = `600 28px ${chinese}`;
  context.fillText("云间寺 · 寻猫小记", 72, 113);
  context.fillStyle = "#f9efdb";
  context.font = `700 61px ${chinese}`;
  context.fillText("我找回了金铃", 70, 206);

  const image = preview ? await readPreview(preview).catch(() => null) : null;
  const frame = { x: 71, y: 256, width: 758, height: 590 };
  context.save();
  context.beginPath();
  context.roundRect(frame.x, frame.y, frame.width, frame.height, 24);
  context.clip();
  const light = context.createLinearGradient(0, 256, 0, 846);
  light.addColorStop(0, "#f2e5c3");
  light.addColorStop(1, "#c7cfad");
  context.fillStyle = light;
  context.fillRect(frame.x, frame.y, frame.width, frame.height);
  if (image) {
    const scale = Math.min(frame.width / image.width, frame.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, frame.x + (frame.width - width) / 2, frame.y + (frame.height - height) / 2, width, height);
  } else {
    context.strokeStyle = "#859472";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(450, 551, 171, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#52725d";
    drawPaw(context, 450, 551, 4);
  }
  context.restore();

  context.fillStyle = "#f9efdb";
  context.font = `700 43px ${chinese}`;
  context.fillText("你能找到那只猫吗？", 72, 929);
  context.fillStyle = "#dfcb94";
  context.font = `500 27px ${chinese}`;
  const time = Math.max(1, Math.round(seconds));
  const elapsed = time < 60 ? `${time} 秒` : `${Math.floor(time / 60)} 分 ${time % 60} 秒`;
  context.fillText(`${day.replaceAll("-", "/")}  ·  用时 ${elapsed}`, 72, 988);

  context.save();
  context.translate(758, 1017);
  context.rotate(-0.12);
  context.fillStyle = "#823d31";
  context.fillRect(-65, -65, 130, 130);
  context.strokeStyle = "#d5a77f";
  context.strokeRect(-58, -58, 116, 116);
  context.fillStyle = "#f2d3a4";
  drawPaw(context, 0, -2, 1.4);
  context.restore();

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("分享卡暂时无法保存。");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `云间寺寻猫-${day}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
