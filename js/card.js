// Draws the card on a 1200 × 1800 canvas as a painted winter night: a snowy pine forest in
// moonlight, a sleigh with its reindeer waiting by a lantern in a clearing — and above them the
// real sky over the chosen city at midnight, framed the way you would see it standing there.
//
// drawCard() paints everything except the things that flicker (lantern, fairy lights);
// drawLights() adds those on top, so the preview can animate them cheaply every frame.

export const W = 1200;
export const H = 1800;

const HORIZON = 1175;       // y of altitude 0 straight ahead (hidden behind the trees)
const CENTER_ALT = 38;      // the altitude in the middle of the view
const SCALE = 565;          // pixels per unit of the stereographic projection (≈110° across)
const RAD = Math.PI / 180;

export const COLORS = {
  gold: '#e8c063', cream: '#f6efe1', red: '#c8102e',
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

// --- Framing the sky -------------------------------------------------------------------------

/**
 * Which way the card looks: towards the Moon if it is up, otherwise towards the Christmas star,
 * otherwise towards the celestial equator (south in the north, north in the south).
 */
export function viewAzimuth(sky) {
  if (sky.moon && sky.moon.alt > 6 && sky.moon.alt < 72) return sky.moon.az;
  if (sky.brightest && sky.brightest.alt < 75) return sky.brightest.az;
  return sky.lat >= 0 ? 180 : 0;
}

/** Stereographic projection about (az0, CENTER_ALT): returns [x, y] on the card. */
export function projector(az0) {
  const a0 = CENTER_ALT * RAD, s0 = Math.sin(a0), c0 = Math.cos(a0);
  // pin the horizon straight ahead to HORIZON
  const yHorizon = (2 / (1 + c0)) * -s0; // projection y of (alt 0, az0); negative = below centre
  const cy = HORIZON + yHorizon * SCALE;
  return (alt, az) => {
    const a = alt * RAD, d = (az - az0) * RAD;
    const cosc = s0 * Math.sin(a) + c0 * Math.cos(a) * Math.cos(d);
    const k = 2 / (1 + Math.max(-0.95, cosc));
    const x = k * Math.cos(a) * Math.sin(d);
    const y = k * (c0 * Math.sin(a) - s0 * Math.cos(a) * Math.cos(d));
    return [W / 2 + x * SCALE, cy - y * SCALE];
  };
}

// --- Sky ---------------------------------------------------------------------------------------

function skyBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, '#050b1a');
  g.addColorStop(0.55, '#0c1a33');
  g.addColorStop(0.85, '#1d3150');
  g.addColorStop(1, '#3a5274');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HORIZON + 40);
}

function drawSky(ctx, s, opts, P) {
  const fade = (alt) => Math.max(0, Math.min(1, (alt + 1) / 12)); // stars dim near the horizon

  // Milky Way: soft blobs on a small scratch canvas, scaled up so they melt into a glow
  const k = 0.2;
  const mw = document.createElement('canvas');
  mw.width = W * k;
  mw.height = HORIZON * k;
  const m = mw.getContext('2d');
  for (const pt of s.milkyway) {
    const [x, y] = P(pt.alt, pt.az);
    if (x < -80 || x > W + 80 || y < -80 || y > HORIZON + 40) continue;
    const r = 46 * k, gx = x * k, gy = y * k;
    const g = m.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, `rgba(200,214,255,${0.03 * pt.w * fade(pt.alt)})`);
    g.addColorStop(1, 'rgba(200,214,255,0)');
    m.fillStyle = g;
    m.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mw, 0, 0, W, HORIZON);
  ctx.restore();

  if (opts.lines) {
    ctx.save();
    ctx.strokeStyle = 'rgba(232,192,99,0.2)';
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';
    for (const line of s.lines) {
      ctx.beginPath();
      line.forEach((p, i) => {
        const [x, y] = P(p.alt, p.az);
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }

  for (let i = s.stars.length - 1; i >= 0; i--) {
    const st = s.stars[i];
    const [x, y] = P(st.alt, st.az);
    if (x < -20 || x > W + 20 || y < -20 || y > HORIZON + 10) continue;
    const size = Math.max(0.6, 0.5 + 0.55 * Math.pow(Math.max(0, 6.3 - st.mag), 1.18));
    const [r, g, b] = st.color;
    const a = fade(st.alt);
    if (st.mag < 2.4) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 4.5);
      glow.addColorStop(0, `rgba(${r},${g},${b},${0.42 * a})`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - size * 5, y - size * 5, size * 10, size * 10);
    }
    ctx.globalAlpha = a * Math.min(1, 0.32 + (6.5 - st.mag) * 0.16);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (st.mag < 1.0 && a > 0.5) sparkle(ctx, x, y, size * 3.6, `rgba(${r},${g},${b},0.75)`);
  }
}

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

function drawMoon(ctx, s, P) {
  const m = s.moon;
  const [x, y] = P(m.alt, m.az);
  if (y > HORIZON - 20 || x < -60 || x > W + 60) return;
  const r = 38;
  // halo through the cold air
  for (const [rr, a] of [[r * 7, 0.08], [r * 3.2, 0.16], [r * 1.6, 0.28]]) {
    const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, rr);
    g.addColorStop(0, `rgba(225,235,255,${a})`);
    g.addColorStop(1, 'rgba(225,235,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  // the disc with some maria
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#fdfcf6');
  g.addColorStop(1, '#d9dbe0');
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.fillStyle = 'rgba(120,128,145,0.28)';
  for (const [mx, my, mr] of [[-0.25, -0.2, 0.32], [0.2, -0.3, 0.22], [0.05, 0.1, 0.26], [-0.35, 0.25, 0.18], [0.35, 0.3, 0.14]]) {
    ctx.beginPath();
    ctx.ellipse(mx * r, my * r, mr * r, mr * r * 0.8, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // shadow for the phase: the lit limb faces the Sun
  const [sx, sy] = s.sun ? P(s.sun.alt, s.sun.az) : [x + 1, y];
  ctx.rotate(Math.atan2(sy - y, sx - x));
  const f = m.fraction;
  ctx.fillStyle = 'rgba(10,18,36,0.94)';
  ctx.beginPath();
  ctx.arc(0, 0, r + 1, Math.PI / 2, Math.PI * 1.5); // dark half (away from the Sun)
  ctx.ellipse(0, 0, Math.abs(2 * f - 1) * r, r + 1, 0, Math.PI * 1.5, Math.PI / 2, f > 0.5);
  ctx.fill();
  ctx.restore();
}

function skyLabels(ctx, s, opts, P, az0) {
  const placed = [];
  const fits = (x, y, w, h) => {
    if (x < 50 || x + w > W - 50 || y < 50 || y + h > HORIZON - 120) return false;
    if (placed.some(([px, py, pw, ph]) => x < px + pw && x + w > px && y < py + ph && y + h > py)) return false;
    placed.push([x, y, w, h]);
    return true;
  };
  const label = (text, x, y, font, color) => {
    ctx.font = font;
    const w = ctx.measureText(text).width, h = parseInt(font.match(/(\d+)px/)[1], 10);
    if (!fits(x - 3, y - h, w + 6, h + 6)) return;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(text, x, y);
  };
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  if (s.moon) {
    const [x, y] = P(s.moon.alt, s.moon.az);
    placed.push([x - 60, y - 60, 120, 120]);
  }
  if (s.brightest) {
    const [x, y] = P(s.brightest.alt, s.brightest.az);
    sparkle(ctx, x, y, 34, 'rgba(255,236,170,0.95)');
    ctx.strokeStyle = 'rgba(255,236,170,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.stroke();
    if (opts.names) label(opts.lang === 'tr' ? s.brightest.tr : s.brightest.name, x + 22, y - 12, 'italic 700 20px "Playfair Display"', 'rgba(255,236,170,0.95)');
    placed.push([x - 30, y - 30, 60, 60]);
  }
  for (const p of s.planets) {
    const [x, y] = P(p.alt, p.az);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    if (opts.names && !(s.brightest && s.brightest.name === p.en)) label(opts.lang === 'tr' ? p.tr : p.en, x + 12, y + 6, 'italic 700 17px "Playfair Display"', COLORS.gold);
  }
  if (opts.names) {
    for (const st of s.stars) {
      if (!st.name || st.mag > 1.5 || st.alt < 8 || (s.brightest && st.name === s.brightest.name)) continue;
      const [x, y] = P(st.alt, st.az);
      label(st.name, x + 9, y - 7, 'italic 400 16px "Playfair Display"', 'rgba(246,239,225,0.8)');
    }
    for (const l of s.labels) {
      if (l.rank > 1) continue;
      const text = (opts.lang === 'tr' ? l.tr : l.en).toLocaleUpperCase(opts.lang);
      const [x, y] = P(l.alt, l.az);
      ctx.font = '600 13px Inter';
      const w = ctx.measureText(text).width + text.length * 2.2;
      if (!fits(x - w / 2 - 3, y - 14, w + 6, 20)) continue;
      ctx.fillStyle = 'rgba(246,239,225,0.45)';
      letterSpaced(ctx, text, x, y, 2.2);
    }
  }
  // compass points just above the treeline
  ctx.font = '600 14px Inter';
  ctx.fillStyle = 'rgba(246,239,225,0.55)';
  for (let i = 0; i < 8; i++) {
    const d = ((i * 45 - az0 + 540) % 360) - 180;
    if (Math.abs(d) > 52) continue;
    const [x] = P(0, i * 45);
    letterSpaced(ctx, opts.compass[i], x, 1048, 3);
    ctx.fillRect(x - 0.75, 1056, 1.5, 8);
  }
  ctx.restore();
}

// --- Landscape ----------------------------------------------------------------------------------

/** A snowy fir: drooping tiers of branches from the bottom up, clumps of snow resting on them. */
function pine(ctx, x, base, h, w, rand, { color = '#0f1e2e', snow = 'rgba(205,218,236,0.9)', light = -1, lean = 0 } = {}) {
  const tiers = Math.max(5, Math.round(h / 30));
  ctx.fillStyle = '#1b130e';
  ctx.fillRect(x - w * 0.03, base - h * 0.08, w * 0.06, h * 0.1);
  const shadeSnow = snow.replace(/[\d.]+\)$/, (a) => `${parseFloat(a) * 0.55})`);
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const cx = x + lean * h * t;
    const ty = base - h * 0.06 - h * 0.92 * t;                       // bottom of this tier
    const tw = ((w / 2) * Math.pow(1 - t, 0.9) + 3) * (0.86 + rand() * 0.28);
    const th = (h / tiers) * 2.1;
    const top = ty - th;
    // body: a soft triangle whose lower edge droops in a few uneven swags
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.bezierCurveTo(cx + tw * 0.3, top + th * 0.3, cx + tw * 0.8, ty - th * 0.1, cx + tw, ty + th * 0.12);
    const swags = 2 + Math.round(tw / 45);
    for (let k = swags; k > -swags; k--) {
      const x1 = cx + (tw * k) / swags, x2 = cx + (tw * (k - 1)) / swags;
      ctx.quadraticCurveTo((x1 + x2) / 2, ty + th * (0.12 + rand() * 0.16), x2, ty - th * (0.02 + rand() * 0.08));
    }
    ctx.bezierCurveTo(cx - tw * 0.8, ty - th * 0.1, cx - tw * 0.3, top + th * 0.3, cx, top);
    ctx.fill();
    // a few needle tufts sticking out of the edge
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, tw / 40);
    for (let k = 0; k < 4; k++) {
      const side = k % 2 ? 1 : -1, u = 0.5 + rand() * 0.5;
      const px = cx + side * tw * u, py = top + th * (0.3 + u * 0.75);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + side * tw * 0.12, py + th * 0.08); ctx.stroke();
    }
    // snow: irregular clumps along the upper sides, fuller on the moonlit side
    for (const side of [-1, 1]) {
      ctx.fillStyle = side === light ? snow : shadeSnow;
      const clumps = 2 + Math.round(tw / 22);
      for (let c = 0; c < clumps; c++) {
        if (rand() < 0.25) continue;
        const u = 0.15 + (c / clumps) * 0.8 + rand() * 0.05;
        const px = cx + side * tw * u * 0.95, py = top + th * (0.12 + u * 0.72);
        ctx.beginPath();
        ctx.ellipse(px, py, tw * (0.1 + rand() * 0.08) + 2, th * (0.06 + rand() * 0.05) + 1.5, side * (0.25 + u * 0.35), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = snow;
    ctx.beginPath();
    ctx.ellipse(cx, top + th * 0.08, Math.max(2, tw * 0.08), Math.max(1.5, th * 0.06), 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function treeline(ctx, y, height, color, snow, rand, minW, maxW, step) {
  for (let x = -40; x < W + 40; x += step * (0.6 + rand() * 0.8)) {
    const h = height * (0.6 + rand() * 0.6);
    pine(ctx, x, y + rand() * 10, h, Math.max(minW, Math.min(maxW, h * 0.42)), rand, { color, snow });
  }
}

function landscape(ctx, rand) {
  // moonlit haze just above the horizon
  const haze = ctx.createLinearGradient(0, 980, 0, 1180);
  haze.addColorStop(0, 'rgba(110,140,185,0)');
  haze.addColorStop(1, 'rgba(110,140,185,0.35)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 980, W, 200);

  // far hills and forest, pale with distance
  ctx.fillStyle = '#2b3f5c';
  ctx.beginPath();
  ctx.moveTo(0, 1150);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 1120 - 30 * Math.sin(x / 210) - 14 * Math.sin(x / 67 + 1));
  ctx.lineTo(W, 1300);
  ctx.lineTo(0, 1300);
  ctx.fill();
  treeline(ctx, 1150, 70, '#22344f', 'rgba(150,172,205,0.55)', rand, 14, 30, 16);
  treeline(ctx, 1190, 120, '#162538', 'rgba(175,195,224,0.75)', rand, 22, 50, 24);

  // the snowy clearing
  const snow = ctx.createLinearGradient(0, 1180, 0, H);
  snow.addColorStop(0, '#b4c4dc');
  snow.addColorStop(0.25, '#93a8c6');
  snow.addColorStop(0.6, '#5a6d8c');
  snow.addColorStop(1, '#27344b');
  ctx.fillStyle = snow;
  ctx.beginPath();
  ctx.moveTo(0, 1215);
  ctx.bezierCurveTo(300, 1185, 700, 1200, W, 1190);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  // drifts with a moonlit top edge
  for (const [x0, y0, w, h] of [[-100, 1340, 620, 70], [520, 1380, 800, 90], [-60, 1460, 700, 80], [700, 1500, 600, 70]]) {
    const g = ctx.createLinearGradient(0, y0 - h, 0, y0 + h);
    g.addColorStop(0, 'rgba(210,222,240,0.55)');
    g.addColorStop(1, 'rgba(60,78,108,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + h);
    ctx.bezierCurveTo(x0 + w * 0.25, y0 - h, x0 + w * 0.7, y0 - h * 0.8, x0 + w, y0 + h);
    ctx.fill();
  }
  // the sleigh's track curving away into the clearing
  ctx.strokeStyle = 'rgba(40,55,85,0.35)';
  ctx.lineWidth = 5;
  for (const off of [0, 34]) {
    ctx.beginPath();
    ctx.moveTo(-40 + off, H);
    ctx.bezierCurveTo(260 + off, 1560, 160 + off * 0.5, 1360, 420 + off * 0.3, 1302);
    ctx.stroke();
  }
  // glitter in the snow
  for (let i = 0; i < 260; i++) {
    const x = rand() * W, y = 1200 + rand() * 500;
    ctx.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.6})`;
    ctx.fillRect(x, y, 1.6, 1.6);
  }
}

// --- Sleigh, reindeer, lantern -----------------------------------------------------------------

function reindeer(ctx, x, y, S, coat) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(S, -S); // units: up is +y
  ctx.fillStyle = coat;
  ctx.strokeStyle = coat;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // legs
  ctx.lineWidth = 0.055;
  for (const leg of [[[0.3, 0.55], [0.34, 0.3], [0.3, 0.02]], [[0.2, 0.55], [0.16, 0.3], [0.22, 0.02]],
    [[-0.3, 0.55], [-0.36, 0.28], [-0.3, 0.02]], [[-0.2, 0.55], [-0.16, 0.3], [-0.22, 0.02]]]) {
    ctx.beginPath();
    ctx.moveTo(...leg[0]); ctx.quadraticCurveTo(...leg[1], ...leg[2]);
    ctx.stroke();
  }
  // body, neck, head
  ctx.beginPath();
  ctx.ellipse(0, 0.64, 0.42, 0.18, 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.26, 0.74); ctx.lineTo(0.47, 1.0); ctx.lineTo(0.58, 0.98); ctx.lineTo(0.48, 0.74); ctx.lineTo(0.36, 0.55);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.62, 0.98, 0.13, 0.065, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.72, 0.93, 0.05, 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  // tail and ear
  ctx.beginPath(); ctx.ellipse(-0.42, 0.72, 0.06, 0.035, 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0.53, 1.07, 0.06, 0.025, 0.6, 0, Math.PI * 2); ctx.fill();
  // antlers
  ctx.lineWidth = 0.028;
  for (const [ox, oy] of [[0, 0], [0.05, -0.01]]) {
    ctx.beginPath();
    ctx.moveTo(0.57 + ox, 1.05 + oy); ctx.quadraticCurveTo(0.5 + ox, 1.3 + oy, 0.38 + ox, 1.42 + oy);
    ctx.moveTo(0.52 + ox, 1.24 + oy); ctx.lineTo(0.62 + ox, 1.36 + oy);
    ctx.moveTo(0.45 + ox, 1.35 + oy); ctx.lineTo(0.49 + ox, 1.5 + oy);
    ctx.moveTo(0.56 + ox, 1.12 + oy); ctx.lineTo(0.66 + ox, 1.18 + oy);
    ctx.stroke();
  }
  ctx.restore();
}

function sleigh(ctx, x, y, S) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(S, -S);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // runner and struts in gold
  ctx.strokeStyle = '#b58a3e';
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(-1.0, 0.1); ctx.lineTo(0.5, 0.1); ctx.bezierCurveTo(0.75, 0.1, 0.85, 0.28, 0.72, 0.42);
  ctx.moveTo(-0.6, 0.1); ctx.lineTo(-0.6, 0.34);
  ctx.moveTo(0.2, 0.1); ctx.lineTo(0.2, 0.34);
  ctx.stroke();
  // gift sack and parcels behind Santa
  ctx.fillStyle = '#4a3423';
  ctx.beginPath(); ctx.ellipse(-0.68, 0.98, 0.24, 0.2, 0.2, 0, Math.PI * 2); ctx.fill();
  for (const [gx, gy, gw, gh, c] of [[-0.95, 1.0, 0.18, 0.16, '#1f6b45'], [-0.78, 1.12, 0.16, 0.14, '#c8a040'], [-0.6, 1.08, 0.14, 0.18, '#a3122a']]) {
    ctx.fillStyle = c;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = 'rgba(240,220,170,0.8)';
    ctx.fillRect(gx + gw / 2 - 0.012, gy, 0.024, gh);
  }
  // Santa: red coat, white fur, hat with a pompom
  ctx.fillStyle = '#8e1420';
  ctx.beginPath(); ctx.ellipse(-0.3, 0.92, 0.2, 0.26, -0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e9e3d6';
  ctx.beginPath(); ctx.ellipse(-0.2, 1.08, 0.1, 0.12, 0, 0, Math.PI * 2); ctx.fill(); // beard
  ctx.fillStyle = '#c99a7e';
  ctx.beginPath(); ctx.arc(-0.22, 1.2, 0.07, 0, Math.PI * 2); ctx.fill(); // face
  ctx.fillStyle = '#8e1420';
  ctx.beginPath(); ctx.moveTo(-0.32, 1.25); ctx.lineTo(-0.12, 1.25); ctx.quadraticCurveTo(-0.3, 1.4, -0.46, 1.33); ctx.fill();
  ctx.fillStyle = '#e9e3d6';
  ctx.fillRect(-0.33, 1.23, 0.22, 0.045);
  ctx.beginPath(); ctx.arc(-0.47, 1.32, 0.04, 0, Math.PI * 2); ctx.fill();
  // body of the sleigh: deep red with a scrolled back and front, gold trim
  ctx.fillStyle = '#6e0f1b';
  ctx.beginPath();
  ctx.moveTo(-0.92, 0.34);
  ctx.bezierCurveTo(-1.02, 0.7, -1.02, 0.95, -0.86, 0.98);
  ctx.bezierCurveTo(-0.74, 0.99, -0.74, 0.86, -0.82, 0.84);
  ctx.lineTo(-0.72, 0.66);
  ctx.lineTo(0.3, 0.6);
  ctx.bezierCurveTo(0.55, 0.6, 0.68, 0.76, 0.6, 0.88);
  ctx.bezierCurveTo(0.54, 0.95, 0.46, 0.86, 0.52, 0.8);
  ctx.lineTo(0.44, 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#c9a050';
  ctx.lineWidth = 0.02;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.7, 0.48); ctx.bezierCurveTo(-0.4, 0.56, -0.1, 0.4, 0.25, 0.5);
  ctx.stroke();
  ctx.restore();
}

function lanternPost(ctx, x, base) {
  ctx.strokeStyle = '#151316';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.lineTo(x, base - 150);
  ctx.quadraticCurveTo(x, base - 172, x + 22, base - 170);
  ctx.lineTo(x + 30, base - 160);
  ctx.stroke();
  ctx.fillStyle = '#1b1712';
  ctx.fillRect(x + 20, base - 158, 22, 30);
  ctx.beginPath();
  ctx.moveTo(x + 17, base - 158); ctx.lineTo(x + 31, base - 168); ctx.lineTo(x + 45, base - 158); ctx.fill();
  // snow on the hook and the lantern roof
  ctx.fillStyle = 'rgba(220,230,244,0.9)';
  ctx.beginPath(); ctx.ellipse(x + 31, base - 163, 13, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 9, base - 170, 11, 2.5, -0.2, 0, Math.PI * 2); ctx.fill();
}

const LANTERN = { x: 361, y: 1165 };

function glowAt(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('A', a));
  g.addColorStop(1, color.replace('A', 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function clearing(ctx) {
  const base = 1306;
  // warm pool of lantern light on the snow
  ctx.save();
  ctx.translate(LANTERN.x + 40, base + 4);
  ctx.scale(1, 0.28);
  glowAt(ctx, 0, 0, 260, 'rgba(255,190,110,A)', 0.42);
  ctx.restore();
  // shadows cast away from the lantern
  ctx.fillStyle = 'rgba(25,35,60,0.35)';
  for (const [x, w] of [[470, 150], [600, 70], [690, 70], [780, 70], [870, 70]]) {
    ctx.beginPath(); ctx.ellipse(x + 20, base + 4, w, 9, 0, 0, Math.PI * 2); ctx.fill();
  }
  lanternPost(ctx, 330, base + 2);
  // back row of reindeer (further away, a little smaller and darker), then the front row
  for (let i = 0; i < 2; i++) reindeer(ctx, 660 + i * 110, base - 8, 82, '#2a1f1a');
  // reins
  ctx.strokeStyle = 'rgba(60,40,25,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(470, base - 84); ctx.quadraticCurveTo(560, base - 60, 650, base - 80);
  ctx.moveTo(470, base - 84); ctx.quadraticCurveTo(600, base - 50, 735, base - 80);
  ctx.stroke();
  sleigh(ctx, 450, base, 96);
  for (let i = 0; i < 2; i++) reindeer(ctx, 610 + i * 110, base, 90, '#3a2a20');
  // harness bells
  ctx.fillStyle = '#d9b25a';
  for (const bx of [636, 746]) { ctx.beginPath(); ctx.arc(bx, base - 66, 3, 0, Math.PI * 2); ctx.fill(); }
}

/** A small fir by the clearing, decorated with fairy lights. */
const FAIRY = (() => {
  const rand = rng(31);
  const out = [];
  const x = 1000, base = 1318, h = 190;
  for (let i = 0; i < 26; i++) {
    const t = 0.08 + (i / 26) * 0.82, y = base - h * t;
    const half = ((h * 0.42) / 2) * (1 - t) * 1.6;
    out.push([x + Math.sin(i * 2.4) * half * (0.6 + rand() * 0.35), y, BULBS[i % BULBS.length]]);
  }
  return { x, base, h, bulbs: out };
})();

/** The lantern and the fairy lights; levels[i] (0..1) is how brightly each shines, omit for all on. */
export function drawLights(ctx, levels) {
  const lv = (i) => (levels ? levels[i % levels.length] : 1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const flicker = 0.85 + 0.15 * lv(0);
  glowAt(ctx, LANTERN.x, LANTERN.y, 150, 'rgba(255,170,80,A)', 0.42 * flicker);
  glowAt(ctx, LANTERN.x, LANTERN.y, 40, 'rgba(255,220,150,A)', 0.9 * flicker);
  FAIRY.bulbs.forEach(([x, y, c], i) => {
    const n = parseInt(c.slice(1), 16);
    glowAt(ctx, x, y, 16, `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},A)`, 0.6 * lv(i + 1));
  });
  ctx.restore();
  ctx.fillStyle = '#ffe2a4';
  ctx.fillRect(LANTERN.x - 7, LANTERN.y - 11, 14, 22);
  FAIRY.bulbs.forEach(([x, y, c], i) => {
    ctx.globalAlpha = 0.5 + 0.5 * lv(i + 1);
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// --- Foreground, snowfall, text, frame ----------------------------------------------------------

function framingTrees(ctx, rand) {
  pine(ctx, FAIRY.x, FAIRY.base, FAIRY.h, 120, rand, { color: '#13263a', light: -1 });
  pine(ctx, 1110, 1330, 260, 170, rand, { color: '#102033', light: -1 });
  // the big trees in front, at the edges of the picture like in a painting
  pine(ctx, 70, 1520, 1180, 470, rand, { color: '#0b1724', snow: 'rgba(196,210,232,0.92)', light: 1, lean: 0.02 });
  pine(ctx, 1170, 1560, 980, 420, rand, { color: '#0b1724', snow: 'rgba(196,210,232,0.92)', light: -1, lean: -0.025 });
  pine(ctx, -40, 1700, 520, 260, rand, { color: '#09121d', snow: 'rgba(180,196,222,0.85)', light: 1 });
}

function snowfall(ctx, rand) {
  for (let i = 0; i < 380; i++) {
    const x = rand() * W, y = rand() * H, s = rand();
    ctx.fillStyle = `rgba(255,255,255,${0.25 + s * 0.55})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + s * s * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // a few big, out-of-focus flakes close to the "lens"
  for (let i = 0; i < 16; i++) {
    const x = rand() * W, y = rand() * H, r = 7 + rand() * 9;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
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
  // darken the foreground snow so the words read clearly
  const shade = ctx.createLinearGradient(0, 1330, 0, H);
  shade.addColorStop(0, 'rgba(8,14,28,0)');
  shade.addColorStop(0.35, 'rgba(8,14,28,0.55)');
  shade.addColorStop(1, 'rgba(8,14,28,0.88)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 1330, W, H - 1330);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let y = 1486;
  ctx.font = '400 116px "Great Vibes"';
  ctx.fillStyle = goldGradient(ctx, 300, y - 95, 900, y);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 18;
  ctx.fillText(t.greeting, W / 2, y);
  ctx.shadowColor = 'rgba(232,192,99,0.35)';
  ctx.shadowBlur = 26;
  ctx.fillText(t.greeting, W / 2, y);
  ctx.shadowBlur = 0;

  if (t.name) {
    y += 58;
    ctx.font = 'italic 400 42px "Playfair Display"';
    ctx.fillStyle = COLORS.cream;
    ctx.fillText(t.name, W / 2, y);
  }
  if (t.message) {
    if (!t.name) y += 14;
    ctx.font = '400 26px "Playfair Display"';
    ctx.fillStyle = 'rgba(246,239,225,0.85)';
    for (const line of wrapLines(ctx, t.message, 860, 2)) {
      y += 38;
      ctx.fillText(line, W / 2, y);
    }
  }
  y += 38;
  ctx.strokeStyle = 'rgba(232,192,99,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 170, y); ctx.lineTo(W / 2 - 24, y);
  ctx.moveTo(W / 2 + 24, y); ctx.lineTo(W / 2 + 170, y);
  ctx.stroke();
  sparkle(ctx, W / 2, y, 13, COLORS.gold);
  ctx.fillStyle = COLORS.gold;
  ctx.font = '600 20px Inter';
  y += 40;
  letterSpaced(ctx, t.place.toLocaleUpperCase(t.lang), W / 2, y, 4);
  ctx.font = '400 17px Inter';
  ctx.fillStyle = 'rgba(246,239,225,0.75)';
  y += 30;
  letterSpaced(ctx, t.when.toLocaleUpperCase(t.lang), W / 2, y, 2.4);
  if (t.star) {
    y += 34;
    ctx.font = 'italic 400 20px "Playfair Display"';
    ctx.fillStyle = 'rgba(255,236,170,0.92)';
    ctx.fillText(t.star, W / 2, y);
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

function holly(ctx, x, y, scale, flip) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * flip, scale);
  const leaf = (angle) => {
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = '#1f6b45';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const n = 4, len = 84;
    for (let i = 1; i <= n; i++) ctx.quadraticCurveTo((len * (i - 0.5)) / n, -26, (len * i) / n, i === n ? 0 : -12);
    for (let i = n - 1; i >= 0; i--) ctx.quadraticCurveTo((len * (i + 0.5)) / n, 26, (len * i) / n, i === 0 ? 0 : 12);
    ctx.fill();
    ctx.restore();
  };
  leaf(0.25);
  leaf(1.25);
  for (const [bx, by] of [[4, 4], [20, -2], [10, 18]]) {
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

function frame(ctx) {
  // vignette, then a fine double gold rule with holly in the top corners
  const v = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.35, W / 2, H * 0.5, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = goldGradient(ctx, 0, 0, W, H);
  ctx.lineWidth = 2.5;
  roundRect(ctx, 26, 26, W - 52, H - 52, 18);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  roundRect(ctx, 36, 36, W - 72, H - 72, 12);
  ctx.stroke();
  ctx.globalAlpha = 1;
  holly(ctx, 58, 58, 0.55, 1);
  holly(ctx, W - 58, 58, 0.55, -1);
}

/**
 * Paint the whole card except the flickering lights.
 * opts: { sky, lines, names, lang, compass:[N, NE, E, SE, S, SW, W, NW], text:{greeting, name, message, place, when, star, lang} }
 */
export function drawCard(ctx, opts) {
  const rand = rng(2512);
  const az0 = viewAzimuth(opts.sky);
  const P = projector(az0);
  skyBackground(ctx);
  drawSky(ctx, opts.sky, opts, P);
  if (opts.sky.moon) drawMoon(ctx, opts.sky, P);
  skyLabels(ctx, opts.sky, opts, P, az0);
  landscape(ctx, rand);
  clearing(ctx);
  framingTrees(ctx, rand);
  snowfall(ctx, rand);
  texts(ctx, opts.text);
  frame(ctx);
}
