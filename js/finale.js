// Draws the names and the words onto a still of the final sky, for the downloadable PNG.
// The look matches the live page: names beside the stars, the greeting in gold script at the
// bottom over a dark fade, a fine gold border.

const GOLD = '#e8c063';
const CREAM = '#f6efe1';

function goldGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#fff1bf');
  g.addColorStop(0.45, GOLD);
  g.addColorStop(0.55, '#c9973f');
  g.addColorStop(1, '#f6dc8e');
  return g;
}

function letterSpaced(ctx, text, x, y, spacing) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (widths.length - 1);
  let cx = x - total / 2;
  ctx.textAlign = 'left';
  [...text].forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = 'center';
}

export function wrapLines(ctx, text, width, max) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > width && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    lines.length = max;
    lines[max - 1] = lines[max - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

const LABEL_STYLE = {
  xmas: ['italic 700 26px "Playfair Display"', '#ffe6a0'],
  moon: ['italic 400 22px "Playfair Display"', CREAM],
  planet: ['italic 700 21px "Playfair Display"', GOLD],
  star: ['italic 400 20px "Playfair Display"', 'rgba(246,239,225,0.88)'],
  const: ['600 14px Inter', 'rgba(246,239,225,0.5)'],
  compass: ['700 18px Inter', GOLD],
};

function drawLabels(ctx, labels) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 8;
  ctx.textBaseline = 'middle';
  for (const l of labels) {
    const [font, color] = LABEL_STYLE[l.kind];
    ctx.font = font;
    ctx.fillStyle = color;
    if (l.kind === 'const' || l.kind === 'compass') {
      letterSpaced(ctx, l.text, l.x, l.y, 3);
      continue;
    }
    // a thin leader from the star to its name
    const tx = l.flip ? l.x - 14 : l.x + 14, ty = l.y - 16;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(l.x + (l.flip ? -5 : 5), l.y - 5);
    ctx.lineTo(tx + (l.flip ? 3 : -3), ty + 3);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.textAlign = l.flip ? 'right' : 'left';
    ctx.fillText(l.text, tx, ty);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw labels, words and border onto a W × H still. t: {greeting, name, message, place, when, star, lang} */
export function drawFinale(ctx, W, H, labels, t) {
  drawLabels(ctx, labels);
  // the data behind the picture, top left
  if (t.info && t.info.length) {
    ctx.save();
    ctx.font = '400 17px Inter';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    t.info.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? 'rgba(232,192,99,0.9)' : 'rgba(246,239,225,0.72)';
      ctx.fillText(line, 64, 80 + i * 26);
    });
    ctx.restore();
  }

  // dark fade at the bottom so the words read clearly
  const top = H * 0.6;
  const shade = ctx.createLinearGradient(0, top, 0, H);
  shade.addColorStop(0, 'rgba(5,10,22,0)');
  shade.addColorStop(0.35, 'rgba(5,10,22,0.62)');
  shade.addColorStop(1, 'rgba(5,10,22,0.92)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, top, W, H - top);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // lay out from the bottom up so the block always fits
  ctx.font = '400 26px "Playfair Display"';
  const msg = t.message ? wrapLines(ctx, t.message, W * 0.74, 2) : [];
  const blockH = 116 + (t.name ? 60 : 0) + msg.length * 38 + 40 + 40 + 30 + (t.star ? 36 : 0);
  let y = H - 80 - blockH + 100;

  ctx.font = '400 120px "Great Vibes"';
  ctx.fillStyle = goldGradient(ctx, W * 0.25, y - 95, W * 0.75, y);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText(t.greeting, W / 2, y);
  ctx.shadowColor = 'rgba(232,192,99,0.35)';
  ctx.shadowBlur = 26;
  ctx.fillText(t.greeting, W / 2, y);
  ctx.shadowBlur = 0;
  if (t.name) {
    y += 60;
    ctx.font = 'italic 400 44px "Playfair Display"';
    ctx.fillStyle = CREAM;
    ctx.fillText(t.name, W / 2, y);
  }
  ctx.font = '400 26px "Playfair Display"';
  ctx.fillStyle = 'rgba(246,239,225,0.86)';
  for (const line of msg) {
    y += 38;
    ctx.fillText(line, W / 2, y);
  }
  y += 40;
  ctx.strokeStyle = 'rgba(232,192,99,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 170, y); ctx.lineTo(W / 2 - 22, y);
  ctx.moveTo(W / 2 + 22, y); ctx.lineTo(W / 2 + 170, y);
  ctx.stroke();
  // three small baubles in the Christmas colours
  [['#c8102e', -16], [GOLD, 0], ['#3fa66b', 16]].forEach(([c, dx]) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(W / 2 + dx, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });
  y += 40;
  ctx.font = '600 21px Inter';
  ctx.fillStyle = GOLD;
  letterSpaced(ctx, t.place.toLocaleUpperCase(t.lang), W / 2, y, 4);
  y += 30;
  ctx.font = '400 17px Inter';
  ctx.fillStyle = 'rgba(246,239,225,0.75)';
  letterSpaced(ctx, t.when.toLocaleUpperCase(t.lang), W / 2, y, 2.4);
  if (t.star) {
    y += 36;
    ctx.font = 'italic 400 22px "Playfair Display"';
    ctx.fillStyle = 'rgba(255,236,170,0.95)';
    ctx.fillText(t.star, W / 2, y);
  }

  // fine double gold border
  ctx.strokeStyle = goldGradient(ctx, 0, 0, W, H);
  ctx.lineWidth = 2.5;
  roundRect(ctx, 26, 26, W - 52, H - 52, 18);
  ctx.stroke();
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  roundRect(ctx, 36, 36, W - 72, H - 72, 12);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
