// Draws the card on a 1200 × 1800 canvas: a garland of Christmas lights, a glass bauble
// hanging from a red ribbon with the real sky inside it, and the greeting underneath.
//
// drawCard() paints everything except the glow of the bulbs onto a base canvas;
// drawLights() adds the bulbs on top, so the preview can twinkle cheaply every frame.

export const W = 1200;
export const H = 1800;

const BALL = { x: 600, y: 760, r: 420 };   // the bauble
const SKY_R = 392;                          // the sky inside the gold rim

export const COLORS = {
  night: '#0a1628', red: '#c8102e', redDeep: '#8e0b20', green: '#1f6b45', greenDeep: '#0f3d27',
  gold: '#e8c063', goldDeep: '#a8782c', cream: '#f6efe1',
};
const BULBS = ['#ff4b4b', '#ffd25c', '#47e08f', '#5fb2ff', '#ff8ad1'];

// Small seeded random generator, so the preview and the download look identical.
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function goldGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, '#fff1bf');
  g.addColorStop(0.45, COLORS.gold);
  g.addColorStop(0.55, '#c9973f');
  g.addColorStop(1, '#f6dc8e');
  return g;
}

// --- Background --------------------------------------------------------------------------

function background(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d2138');
  g.addColorStop(0.55, '#0a1628');
  g.addColorStop(1, '#07101d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // warm glow behind the bauble
  const glow = ctx.createRadialGradient(BALL.x, BALL.y, BALL.r * 0.6, BALL.x, BALL.y, BALL.r * 1.6);
  glow.addColorStop(0, 'rgba(232,192,99,0.10)');
  glow.addColorStop(1, 'rgba(232,192,99,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // falling snow
  const rand = rng(2026);
  for (let i = 0; i < 170; i++) {
    const x = rand() * W, y = rand() * H, s = rand();
    ctx.fillStyle = `rgba(255,255,255,${0.12 + s * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + s * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // a few larger flakes, kept away from the bauble and the text
  for (let placed = 0, tries = 0; placed < 12 && tries < 500; tries++) {
    const x = rand() * W, y = 160 + rand() * (H - 360), size = 7 + rand() * 9, a = 0.18 + rand() * 0.2;
    if (Math.hypot(x - BALL.x, y - BALL.y) < BALL.r + 40) continue;
    if (y > 1180 && x > 200 && x < W - 200) continue;
    snowflake(ctx, x, y, size, a);
    placed++;
  }
}

function snowflake(ctx, x, y, size, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -size);
    ctx.moveTo(0, -size * 0.6); ctx.lineTo(-size * 0.25, -size * 0.8);
    ctx.moveTo(0, -size * 0.6); ctx.lineTo(size * 0.25, -size * 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

// --- Garland of lights ---------------------------------------------------------------------

/** Points along the wire: four sagging scallops across the top of the card. */
export function bulbPositions() {
  const out = [];
  const spans = 4, perSpan = 7, top = 48, sag = 70;
  for (let s = 0; s < spans; s++) {
    const x0 = -20 + (s * (W + 40)) / spans, x1 = -20 + ((s + 1) * (W + 40)) / spans;
    for (let i = 0; i < perSpan; i++) {
      const t = (i + 0.5) / perSpan;
      const x = x0 + (x1 - x0) * t;
      const y = top + sag * 4 * t * (1 - t);
      const slope = (sag * 4 * (1 - 2 * t)) / (x1 - x0);
      out.push({ x, y, angle: Math.atan(slope), color: BULBS[(s * perSpan + i) % BULBS.length] });
    }
  }
  return out;
}

function wire(ctx) {
  const spans = 4, top = 48, sag = 70;
  ctx.strokeStyle = '#173b2a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let s = 0; s < spans; s++) {
    const x0 = -20 + (s * (W + 40)) / spans, x1 = -20 + ((s + 1) * (W + 40)) / spans;
    ctx.moveTo(x0, top);
    ctx.quadraticCurveTo((x0 + x1) / 2, top + sag * 2, x1, top);
  }
  ctx.stroke();
}

function bulb(ctx, b, on) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  // socket
  ctx.fillStyle = '#2a4a37';
  ctx.fillRect(-6, -2, 12, 13);
  // glass
  ctx.translate(0, 26);
  const g = ctx.createRadialGradient(-3, -4, 1, 0, 0, 16);
  g.addColorStop(0, on > 0.5 ? '#ffffff' : b.color);
  g.addColorStop(0.35, b.color);
  g.addColorStop(1, shade(b.color, 0.55));
  ctx.globalAlpha = 0.55 + 0.45 * on;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function bulbGlow(ctx, b, on) {
  const tip = [b.x - Math.sin(b.angle) * 26, b.y + Math.cos(b.angle) * 26];
  const g = ctx.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], 60);
  g.addColorStop(0, hexA(b.color, 0.55 * on));
  g.addColorStop(1, hexA(b.color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(tip[0] - 60, tip[1] - 60, 120, 120);
}

/** Draw the bulbs. `levels[i]` (0..1) is how brightly bulb i shines; omit for all on. */
export function drawLights(ctx, levels) {
  const bulbs = bulbPositions();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  bulbs.forEach((b, i) => bulbGlow(ctx, b, levels ? levels[i] : 1));
  ctx.restore();
  bulbs.forEach((b, i) => bulb(ctx, b, levels ? levels[i] : 1));
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.round(v * k);
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// --- Ribbon, bow and holly ------------------------------------------------------------------

function ribbon(ctx) {
  const top = 150, bottom = BALL.y - BALL.r - 70;
  const g = ctx.createLinearGradient(BALL.x - 14, 0, BALL.x + 14, 0);
  g.addColorStop(0, COLORS.redDeep);
  g.addColorStop(0.5, '#e0233f');
  g.addColorStop(1, COLORS.redDeep);
  ctx.fillStyle = g;
  ctx.fillRect(BALL.x - 11, top, 22, bottom - top);
  bow(ctx, BALL.x, top + 6);
}

function bow(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  const loop = (dir) => {
    const g = ctx.createLinearGradient(0, -40, dir * 90, 40);
    g.addColorStop(0, '#e0233f');
    g.addColorStop(1, COLORS.redDeep);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(dir * 40, -70, dir * 110, -40, dir * 80, 8);
    ctx.bezierCurveTo(dir * 60, 30, dir * 20, 18, 0, 0);
    ctx.fill();
    // tails
    ctx.beginPath();
    ctx.moveTo(dir * 4, 6);
    ctx.lineTo(dir * 42, 78);
    ctx.lineTo(dir * 30, 70);
    ctx.lineTo(dir * 22, 84);
    ctx.lineTo(dir * -4, 10);
    ctx.fill();
  };
  loop(-1);
  loop(1);
  ctx.fillStyle = '#b30f2a';
  ctx.beginPath();
  ctx.ellipse(0, 2, 15, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function holly(ctx, x, y, scale = 1, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * flip, scale);
  const leaf = (angle) => {
    ctx.save();
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, 80, 0);
    g.addColorStop(0, COLORS.green);
    g.addColorStop(1, COLORS.greenDeep);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    // a spiky holly edge: alternating bumps on both sides
    const n = 4, len = 84;
    for (let i = 1; i <= n; i++) ctx.quadraticCurveTo((len * (i - 0.5)) / n, -26, (len * i) / n, i === n ? 0 : -12);
    for (let i = n - 1; i >= 0; i--) ctx.quadraticCurveTo((len * (i + 0.5)) / n, 26, (len * i) / n, i === 0 ? 0 : 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(len - 8, 0);
    ctx.stroke();
    ctx.restore();
  };
  leaf(-0.35);
  leaf(-2.6);
  leaf(-1.45);
  for (const [bx, by] of [[-8, -6], [10, -10], [2, 8]]) {
    const g = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, 12);
    g.addColorStop(0, '#ff7a7a');
    g.addColorStop(1, '#a1001b');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// --- The bauble ------------------------------------------------------------------------------

function cap(ctx) {
  const w = 130, h = 70, x = BALL.x - w / 2, y = BALL.y - BALL.r - 52;
  // hanging loop
  ctx.strokeStyle = goldGradient(ctx, BALL.x - 30, y - 60, BALL.x + 30, y);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(BALL.x, y - 18, 22, 26, 0, Math.PI, 0);
  ctx.stroke();
  // crown
  ctx.fillStyle = goldGradient(ctx, x, 0, x + w, 0);
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,50,10,0.45)';
  ctx.lineWidth = 3;
  for (let i = 1; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * i) / 7, y + 8);
    ctx.lineTo(x + (w * i) / 7, y + h - 8);
    ctx.stroke();
  }
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

function rim(ctx) {
  const { x, y, r } = BALL;
  // shadow under the bauble
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#0b1a2e';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // gold ring
  ctx.fillStyle = goldGradient(ctx, x - r, y - r, x + r, y + r);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x, y, SKY_R, 0, Math.PI * 2, true);
  ctx.fill();
  // degree ticks
  ctx.strokeStyle = 'rgba(70,45,10,0.55)';
  for (let d = 0; d < 360; d += 5) {
    const a = (d * Math.PI) / 180;
    const len = d % 45 === 0 ? 12 : d % 15 === 0 ? 8 : 4;
    ctx.lineWidth = d % 45 === 0 ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(a) * (SKY_R + 2), y - Math.cos(a) * (SKY_R + 2));
    ctx.lineTo(x + Math.sin(a) * (SKY_R + 2 + len), y - Math.cos(a) * (SKY_R + 2 + len));
    ctx.stroke();
  }
  // thin red enamel lines on both edges of the ring
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r - 1.5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, SKY_R + 1, 0, Math.PI * 2); ctx.stroke();
}

function glassShine(ctx) {
  const { x, y } = BALL;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, SKY_R, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createRadialGradient(x - 170, y - 200, 10, x - 170, y - 200, 260);
  g.addColorStop(0, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - SKY_R, y - SKY_R, SKY_R * 2, SKY_R * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x, y, SKY_R - 30, Math.PI * 1.08, Math.PI * 1.32);
  ctx.stroke();
  // a little red tint at the edge, like coloured glass
  const edge = ctx.createRadialGradient(x, y, SKY_R * 0.82, x, y, SKY_R);
  edge.addColorStop(0, 'rgba(200,16,46,0)');
  edge.addColorStop(1, 'rgba(200,16,46,0.12)');
  ctx.fillStyle = edge;
  ctx.fillRect(x - SKY_R, y - SKY_R, SKY_R * 2, SKY_R * 2);
  ctx.restore();
}

// --- The sky ---------------------------------------------------------------------------------

function sky(ctx, s, opts) {
  const { x, y } = BALL;
  const R = SKY_R - 4;
  const P = ([px, py]) => [x + px * R, y + py * R];
  // Labels are placed in order of importance and skipped if they would overlap one already placed.
  const placed = [];
  const fits = (bx, by, bw, bh) => {
    if (Math.hypot(bx + bw / 2 - x, by + bh / 2 - y) > SKY_R - 30) return false;
    if (placed.some(([px, py, pw, ph]) => bx < px + pw && bx + bw > px && by < py + ph && by + bh > py)) return false;
    placed.push([bx, by, bw, bh]);
    return true;
  };
  const label = (text, lx, ly, font, color, align = 'left') => {
    ctx.font = font;
    const w = ctx.measureText(text).width, h = parseInt(font.match(/(\d+)px/)[1], 10);
    const bx = align === 'center' ? lx - w / 2 : lx;
    if (!fits(bx - 3, ly - h, w + 6, h + 6)) return false;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, lx, ly);
    return true;
  };

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, SKY_R, 0, Math.PI * 2);
  ctx.clip();

  const g = ctx.createRadialGradient(x, y, 0, x, y, SKY_R);
  g.addColorStop(0, '#11294a');
  g.addColorStop(1, '#071225');
  ctx.fillStyle = g;
  ctx.fillRect(x - SKY_R, y - SKY_R, SKY_R * 2, SKY_R * 2);

  // Milky Way: five nested brightness levels
  ctx.fillStyle = 'rgba(200,215,255,0.045)';
  for (const level of s.milkyway) {
    ctx.beginPath();
    for (const ring of level) {
      ring.forEach((p, i) => (i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))));
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }

  if (opts.lines) {
    ctx.strokeStyle = 'rgba(232,192,99,0.42)';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    for (const line of s.lines) {
      ctx.beginPath();
      line.forEach((p, i) => (i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))));
      ctx.stroke();
    }
  }

  // stars, faintest first so bright ones sit on top
  for (let i = s.stars.length - 1; i >= 0; i--) {
    const st = s.stars[i];
    const [px, py] = P([st.x, st.y]);
    const size = Math.max(0.7, 0.55 + 0.62 * Math.pow(Math.max(0, 6.3 - st.mag), 1.2));
    const [r, gg, b] = st.color;
    if (st.mag < 2.2) {
      const glow = ctx.createRadialGradient(px, py, 0, px, py, size * 4);
      glow.addColorStop(0, `rgba(${r},${gg},${b},0.45)`);
      glow.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(px - size * 4, py - size * 4, size * 8, size * 8);
    }
    ctx.fillStyle = `rgb(${r},${gg},${b})`;
    ctx.globalAlpha = Math.min(1, 0.35 + (6.5 - st.mag) * 0.16);
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (st.mag < 1.2) sparkle(ctx, px, py, size * 3.4, `rgba(${r},${gg},${b},0.8)`);
  }

  for (const p of s.planets) {
    const [px, py] = P(p.xy);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,192,99,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.stroke();
    if (opts.names) label(opts.lang === 'tr' ? p.tr : p.en, px + 14, py + 6, 'italic 700 17px "Playfair Display"', COLORS.gold);
  }

  if (s.moon) {
    const [mx, my] = P(s.moon.xy);
    drawMoon(ctx, mx, my, 17, s.moon);
    fits(mx - 22, my - 22, 44, 44);
  }

  if (s.brightest) {
    const [px, py] = P(s.brightest.xy);
    sparkle(ctx, px, py, 34, 'rgba(255,236,170,0.95)');
    ctx.strokeStyle = 'rgba(255,236,170,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    ctx.stroke();
    if (opts.names && s.brightest.kind === 'star') {
      label(s.brightest.name, px + 20, py - 10, 'italic 700 17px "Playfair Display"', 'rgba(255,236,170,0.95)');
    }
  }

  if (opts.names) {
    for (const st of s.stars) {
      if (!st.name || st.mag > 1.3 || st.alt < 5 || (s.brightest && st.name === s.brightest.name)) continue;
      const [px, py] = P([st.x, st.y]);
      label(st.name, px + 9, py - 7, 'italic 400 16px "Playfair Display"', 'rgba(246,239,225,0.82)');
    }
    for (const l of s.labels) {
      if (l.rank > 1) continue;
      const text = (opts.lang === 'tr' ? l.tr : l.en).toLocaleUpperCase(opts.lang);
      const [px, py] = P(l.xy);
      ctx.font = '600 13px Inter';
      const w = text.length * 2.2 + ctx.measureText(text).width;
      if (!fits(px - w / 2 - 3, py - 14, w + 6, 20)) continue;
      ctx.fillStyle = 'rgba(246,239,225,0.42)';
      letterSpaced(ctx, text, px, py, 2.2);
    }
  }

  // compass letters just inside the rim: north at the top, east on the LEFT (we are looking up)
  ctx.font = '700 22px "Playfair Display"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.gold;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  const cr = SKY_R - 24;
  [[0, -1], [-1, 0], [0, 1], [1, 0]].forEach(([dx, dy], i) => ctx.fillText(opts.compass[i], x + dx * cr, y + dy * cr));
  ctx.shadowBlur = 0;
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

/** A four-pointed Christmas-star sparkle. */
function sparkle(ctx, x, y, len, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (const [l, w, rot] of [[len, len * 0.09, 0], [len * 0.55, len * 0.06, Math.PI / 4]]) {
    ctx.save();
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -l); ctx.lineTo(w, -w); ctx.lineTo(l, 0); ctx.lineTo(w, w);
    ctx.lineTo(0, l); ctx.lineTo(-w, w); ctx.lineTo(-l, 0); ctx.lineTo(-w, -w);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawMoon(ctx, x, y, r, moon) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(moon.sunAngle);
  const glow = ctx.createRadialGradient(0, 0, r, 0, 0, r * 3);
  glow.addColorStop(0, 'rgba(255,248,220,0.25)');
  glow.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-r * 3, -r * 3, r * 6, r * 6);
  ctx.fillStyle = '#22314a';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  // lit half faces the Sun (+x), then a half-ellipse adds or removes light for the phase
  const f = moon.fraction;
  ctx.fillStyle = '#fff6da';
  ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.fill();
  ctx.fillStyle = f > 0.5 ? '#fff6da' : '#22314a';
  ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(2 * f - 1) * r, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function letterSpaced(ctx, text, x, y, spacing) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (widths.length - 1);
  let cx = x - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  [...text].forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = align;
}

// --- Text and snow at the bottom ------------------------------------------------------------

function wrapLines(ctx, text, width, max) {
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

function texts(ctx, t) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let y = 1338;

  ctx.font = '400 128px "Great Vibes"';
  ctx.fillStyle = goldGradient(ctx, 300, y - 100, 900, y);
  ctx.shadowColor = 'rgba(232,192,99,0.35)';
  ctx.shadowBlur = 24;
  ctx.fillText(t.greeting, W / 2, y);
  ctx.shadowBlur = 0;

  if (t.name) {
    y += 70;
    ctx.font = 'italic 400 46px "Playfair Display"';
    ctx.fillStyle = COLORS.cream;
    ctx.fillText(t.name, W / 2, y);
  }
  if (t.message) {
    if (!t.name) y += 26;
    ctx.font = '400 28px "Playfair Display"';
    ctx.fillStyle = 'rgba(246,239,225,0.82)';
    for (const line of wrapLines(ctx, t.message, 860, 2)) {
      y += 44;
      ctx.fillText(line, W / 2, y);
    }
  }

  y += 50;
  // divider: line · star · line
  ctx.strokeStyle = 'rgba(232,192,99,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 170, y); ctx.lineTo(W / 2 - 24, y);
  ctx.moveTo(W / 2 + 24, y); ctx.lineTo(W / 2 + 170, y);
  ctx.stroke();
  sparkle(ctx, W / 2, y, 14, COLORS.gold);

  ctx.fillStyle = COLORS.gold;
  ctx.font = '600 22px Inter';
  y += 46;
  letterSpaced(ctx, t.place.toLocaleUpperCase(t.lang), W / 2, y, 4);
  ctx.font = '400 19px Inter';
  ctx.fillStyle = 'rgba(246,239,225,0.75)';
  y += 34;
  letterSpaced(ctx, t.when.toLocaleUpperCase(t.lang), W / 2, y, 2.5);
  if (t.star) {
    y += 38;
    ctx.font = 'italic 400 22px "Playfair Display"';
    ctx.fillStyle = 'rgba(255,236,170,0.9)';
    ctx.fillText(t.star, W / 2, y);
  }
}

function snowDrift(ctx) {
  const base = H - 70;
  ctx.fillStyle = '#e9f0f8';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, base);
  for (let x = 0; x <= W; x += 100) {
    ctx.quadraticCurveTo(x + 50, base - 22 - 14 * Math.sin(x / 130), x + 100, base);
  }
  ctx.lineTo(W, H);
  ctx.fill();
  const g = ctx.createLinearGradient(0, base - 30, 0, H);
  g.addColorStop(0, 'rgba(160,190,220,0)');
  g.addColorStop(1, 'rgba(160,190,220,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, base - 30, W, 100);
  tree(ctx, 95, base + 8, 150);
  tree(ctx, 185, base + 14, 100);
  tree(ctx, W - 100, base + 8, 160);
  tree(ctx, W - 200, base + 16, 95);
}

function tree(ctx, x, y, h) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#4b2e1a';
  ctx.fillRect(-h * 0.05, -h * 0.08, h * 0.1, h * 0.1);
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const w = h * (0.42 - i * 0.1), top = -h * (0.42 + i * 0.25), bottom = -h * (0.06 + i * 0.25);
    ctx.fillStyle = i % 2 ? COLORS.green : '#1a5c3b';
    ctx.beginPath();
    ctx.moveTo(0, top - h * 0.12);
    ctx.lineTo(w, bottom);
    ctx.lineTo(-w, bottom);
    ctx.closePath();
    ctx.fill();
    // snow on the tier edge
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, bottom - 2, w * 0.95, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // a few lights on the tree
  const rand = rng(Math.round(x * 7 + h));
  for (let i = 0; i < 7; i++) {
    const ty = -h * (0.12 + rand() * 0.62), half = h * 0.4 * (1 + ty / (h * 0.9));
    ctx.fillStyle = BULBS[i % BULBS.length];
    ctx.beginPath();
    ctx.arc((rand() * 2 - 1) * half * 0.7, ty, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  sparkle(ctx, 0, -h * 1.0, h * 0.09, COLORS.gold);
  ctx.restore();
}

/**
 * Paint the whole card except the lit bulbs.
 * opts: { sky, lines, names, lang, compass:[N,E,S,W], text:{greeting, name, message, place, when, star, lang} }
 */
export function drawCard(ctx, opts) {
  background(ctx);
  wire(ctx);
  ribbon(ctx);
  rim(ctx);
  sky(ctx, opts.sky, opts);
  glassShine(ctx);
  cap(ctx);
  holly(ctx, BALL.x - 70, BALL.y - BALL.r - 30, 0.9, 1);
  holly(ctx, BALL.x + 70, BALL.y - BALL.r - 30, 0.9, -1);
  texts(ctx, opts.text);
  snowDrift(ctx);
}
