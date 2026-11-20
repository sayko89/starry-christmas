import { zonedTime } from './astro.js';
import { computeSky, loadData } from './sky.js';
import { Q, runQuiz, snowText } from './quiz.js';
import { drawFinale } from './finale.js';

const T = {
  tr: {
    name: 'Kime?', namePh: 'Sevgili Ayşe', message: 'Mesaj', city: 'Şehir', cityPh: 'Şehir ara…',
    locate: 'Konumumu kullan', occasion: 'Gece', christmas: 'Noel · 25 Aralık',
    newyear: 'Yılbaşı · 1 Ocak', year: 'Yıl', greeting: 'Başlık', lines: 'Takımyıldız çizgileri',
    names: 'İsimler', download: 'PNG indir', share: 'Linki kopyala', edit: 'Düzenle', editTitle: 'Kartı düzenle',
    copied: 'Link kopyalandı!', unknownCity: 'Bu şehri listede bulamadım, listeden seçin.', locating: 'Konum alınıyor…',
    greet: { christmas: 'Mutlu Noeller', newyear: 'Mutlu Yıllar' },
    defaultMsg: {
      christmas: 'Noel gecesi tam gece yarısı, başımızın üstündeki gökyüzü.',
      newyear: 'Yeni yılın ilk anında başımızın üstündeki gökyüzü.',
    },
    ns: ['K', 'G'], ew: ['D', 'B'], moon: 'Ay',
    compass: ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'],
    dirs: ['kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı'],
    info: (x) => [
      `${x.visible} yıldız şu an ufkun üstünde · ${x.naked} tanesi çıplak gözle görülür`,
      `Katalog: HYG, 61.816 yıldız · Samanyolu: Gaia EDR3`,
      x.moon ? `Ay: %${x.moon.lit} aydınlık · ${x.moon.alt}° yükseklikte, ${x.moon.dir}` : 'Ay şu an ufkun altında',
      x.star ? `${x.star.name}: ${x.star.mag} kadir · ${x.star.alt}° yükseklikte, ${x.star.dir}` : '',
      `Bakış: ${x.view.dir} · ${x.view.alt}° yukarı`,
    ].filter(Boolean),
    hideWords: 'Yazıları gizle', showWords: 'Yazıları göster',
    starLabel: (n) => `✦ ${n}`,
    star: (n, kind) => (kind === 'planet' ? `Gecenin en parlak ışığı: ${n}` : `Gecenin Noel yıldızı: ${n}`),
    credit: 'Yıldızlar: HYG (Hipparcos, Yale, Gliese) · Samanyolu: Gaia EDR3, Kevinmloch (CC BY-SA) · Ay ve gezegenler: astronomy-engine',
    replay: 'Baştan izle',
  },
  en: {
    name: 'To', namePh: 'Dear Emma', message: 'Message', city: 'City', cityPh: 'Search a city…',
    locate: 'Use my location', occasion: 'Night', christmas: 'Christmas · 25 Dec',
    newyear: 'New Year · 1 Jan', year: 'Year', greeting: 'Greeting', lines: 'Constellation lines',
    names: 'Names', download: 'Download PNG', share: 'Copy link', edit: 'Edit', editTitle: 'Edit the card',
    copied: 'Link copied!', unknownCity: "I couldn't find that city — please pick one from the list.", locating: 'Finding you…',
    greet: { christmas: 'Merry Christmas', newyear: 'Happy New Year' },
    defaultMsg: {
      christmas: 'The sky above us at midnight on Christmas night.',
      newyear: 'The sky above us in the first moment of the new year.',
    },
    ns: ['N', 'S'], ew: ['E', 'W'], moon: 'Moon',
    compass: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
    dirs: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'],
    info: (x) => [
      `${x.visible} stars above the horizon right now · ${x.naked} visible to the naked eye`,
      `Catalogue: HYG, 61,816 stars · Milky Way: Gaia EDR3`,
      x.moon ? `Moon: ${x.moon.lit}% lit · ${x.moon.alt}° up, ${x.moon.dir}` : 'The Moon is below the horizon',
      x.star ? `${x.star.name}: magnitude ${x.star.mag} · ${x.star.alt}° up, ${x.star.dir}` : '',
      `Looking ${x.view.dir} · ${x.view.alt}° up`,
    ].filter(Boolean),
    hideWords: 'Hide words', showWords: 'Show words',
    starLabel: (n) => `✦ ${n}`,
    star: (n, kind) => (kind === 'planet' ? `Brightest light of the night: ${n}` : `Your Christmas star: ${n}`),
    credit: 'Stars: HYG (Hipparcos, Yale, Gliese) · Milky Way: Gaia EDR3, Kevinmloch (CC BY-SA) · Moon and planets: astronomy-engine',
    replay: 'Watch again',
  },
};

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function defaultYear(occasion, today = new Date()) {
  const y = today.getFullYear();
  const pastChristmas = today.getMonth() === 11 && today.getDate() > 25;
  const christmasYear = pastChristmas ? y + 1 : y;
  return occasion === 'newyear' ? (today.getMonth() === 0 && today.getDate() === 1 ? y : christmasYear + 1) : christmasYear;
}

const params = new URLSearchParams(location.search);
const shared = params.has('place');
const state = {
  lang: ['tr', 'en'].includes(params.get('lang')) ? params.get('lang')
    : (navigator.language || 'tr').toLowerCase().startsWith('en') ? 'en' : 'tr',
  name: params.get('name') ?? '',
  message: params.get('msg'),
  greeting: params.get('greet') || '',
  place: params.get('place') || 'Samsun, Türkiye',
  lat: +(params.get('lat') ?? 41.28),
  lon: +(params.get('lon') ?? 36.34),
  tz: params.get('tz') || 'Europe/Istanbul',
  occasion: params.get('occ') === 'newyear' ? 'newyear' : 'christmas',
  year: +(params.get('year') || 0),
  lines: params.get('lines') !== '0',
  names: params.get('names') !== '0',
  placeChosen: shared,
};
if (!state.year) state.year = defaultYear(state.occasion);

let catalogue = null;
const cityIndex = new Map();
let sky = null;          // the sky for the current settings (alt/az of everything)
let intro = null;        // the 3D scene
let quiz = null;
let finaleShown = false;

const t = () => T[state.lang];

function moment() {
  return state.occasion === 'newyear' ? { y: state.year, m: 1, d: 1 } : { y: state.year, m: 12, d: 25 };
}

function computeCurrentSky() {
  const { y, m, d } = moment();
  sky = computeSky({ date: zonedTime(y, m, d, 0, 0, state.tz), lat: state.lat, lon: state.lon }, catalogue);
  return sky;
}

function cardText() {
  const L = t();
  const { y, m, d } = moment();
  const day = new Intl.DateTimeFormat(state.lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
  const coord = `${Math.abs(state.lat).toFixed(2)}°${L.ns[state.lat >= 0 ? 0 : 1]} ${Math.abs(state.lon).toFixed(2)}°${L.ew[state.lon >= 0 ? 0 : 1]}`;
  const b = sky?.brightest;
  return {
    lang: state.lang,
    greeting: state.greeting || L.greet[state.occasion],
    name: state.name,
    message: state.message ?? L.defaultMsg[state.occasion],
    place: state.place,
    when: `${day} · 00:00 · ${coord}`,
    star: b ? L.star(state.lang === 'tr' ? b.tr : b.name, b.kind) : '',
  };
}

/**
 * Where to point the camera. Every direction (azimuth every 6°, pitch every 4°) is scored on what
 * would show in the sky above the words: the Christmas star (required), the Moon, and how much of
 * the Milky Way. The best one wins. Returns the azimuth and the camera's pitch.
 */
function viewTarget(s) {
  const D = Math.PI / 180;
  const aspect = innerWidth / innerHeight;
  const v = (intro ? intro.wideFov(aspect) : 80) * D;
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect);
  const tv = Math.tan(v / 2), th = Math.tan(h / 2);
  const dir = (alt, az) => [Math.cos(alt * D) * Math.sin(az * D), Math.sin(alt * D), -Math.cos(alt * D) * Math.cos(az * D)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const star = s.brightest && s.brightest.alt > 3 ? dir(s.brightest.alt, s.brightest.az) : null;
  const moon = s.moon && s.moon.alt > 2 ? dir(s.moon.alt, s.moon.az) : null;
  const TOP = innerWidth < 700 ? 0.22 : 0.18, BOTTOM = innerWidth < 700 ? 0.56 : 0.54; // between the data panel and the words
  let best = null;
  for (let az = 0; az < 360; az += 6) {
    for (let pitch = 2; pitch <= 64; pitch += 4) {
      const fwd = dir(pitch, az);
      const right = [Math.cos(az * D), 0, Math.sin(az * D)];
      const up = [-Math.sin(pitch * D) * Math.sin(az * D), Math.cos(pitch * D), Math.sin(pitch * D) * Math.cos(az * D)];
      // where a direction lands on screen: [x 0..1, y 0..1], or null if behind
      const screen = (d) => {
        const z = dot(d, fwd);
        if (z <= 0.05) return null;
        return [0.5 + dot(d, right) / z / (2 * th), 0.5 - dot(d, up) / z / (2 * tv)];
      };
      const inBand = (d, margin = 0.06) => {
        const p = d && screen(d);
        return p && p[0] > margin && p[0] < 1 - margin && p[1] > TOP && p[1] < BOTTOM;
      };
      if (star && !inBand(star, 0.12)) continue;
      let score = star ? 100 : 0;
      if (moon && inBand(moon)) score += 45;
      // the Milky Way: sample the band of the screen, score points near the galactic plane
      let mw = 0;
      for (let gx = 0.08; gx < 1; gx += 0.14) {
        for (let gy = TOP; gy < BOTTOM; gy += 0.07) {
          const sx = (gx - 0.5) * 2 * th, sy = (0.5 - gy) * 2 * tv;
          const d = [fwd[0] + right[0] * sx + up[0] * sy, fwd[1] + right[1] * sx + up[1] * sy, fwd[2] + right[2] * sx + up[2] * sy];
          const n = Math.hypot(...d);
          const alt = Math.asin(d[1] / n) / D;
          if (alt < 5) continue;
          const az2 = Math.atan2(d[0], -d[2]) / D;
          const b = s.galLat(alt, az2);
          mw += Math.exp(-((b / 14) ** 2)) * Math.min(1, alt / 25);
        }
      }
      score += mw * 1.6;
      // a little horizon at the bottom gives the sky a place
      if (pitch * D - v / 2 < -2 * D) score += 6;
      if (!best || score > best.score) best = { score, az, pitch };
    }
  }
  if (best) return { az: best.az, alt: best.pitch };
  return { az: s.lat >= 0 ? 180 : 0, alt: 25 };
}

function skyOptions() {
  return { lang: state.lang, moonName: t().moon, starLabel: t().starLabel, compass: t().compass };
}

let lastView = null;

/** The numbers behind the picture, for the panel in the corner and the PNG. */
function infoLines() {
  if (!sky || !lastView) return [];
  const L = t();
  const nf = new Intl.NumberFormat(state.lang);
  const dirOf = (az) => L.dirs[Math.round((((az % 360) + 360) % 360) / 45) % 8];
  const b = sky.brightest;
  return L.info({
    visible: nf.format(sky.visibleCount), naked: nf.format(sky.nakedEye),
    moon: sky.moon && sky.moon.alt > 0 ? { lit: Math.round(sky.moon.fraction * 100), alt: Math.round(sky.moon.alt), dir: dirOf(sky.moon.az) } : null,
    star: b ? { name: state.lang === 'tr' ? b.tr : b.name, mag: nf.format(Math.round(b.mag * 10) / 10), alt: Math.round(b.alt), dir: dirOf(b.az) } : null,
    view: { dir: dirOf(lastView.az), alt: Math.round(lastView.alt) },
  });
}

function fillInfo() {
  const el = $('sky-info');
  el.textContent = '';
  infoLines().forEach((line, i) => {
    const p = document.createElement('p');
    p.textContent = line;
    if (i === 0) p.className = 'lead';
    el.appendChild(p);
  });
}

const small = () => innerWidth < 700;

// --- The final sky and the words underneath ---------------------------------------------------------

function fillFinaleText(animate) {
  const x = cardText();
  if (animate && !reduceMotion) snowText($('f-greeting'), x.greeting, { delay: 0.1 });
  else $('f-greeting').textContent = x.greeting;
  $('f-name').textContent = x.name;
  $('f-message').textContent = x.message;
  $('f-place').textContent = x.place.toLocaleUpperCase(state.lang);
  $('f-when').textContent = x.when.toLocaleUpperCase(state.lang);
  $('f-star').textContent = x.star;
  $('f-name').hidden = !x.name;
  $('f-message').hidden = !x.message;
}

/** Turn to the chosen sky, let the names appear, then write the card underneath. */
async function showFinale({ fresh = true } = {}) {
  finaleShown = true;
  updateURL();
  computeCurrentSky();
  const finale = $('finale');
  if (!intro) { // no 3D: just the words
    fillFinaleText(false);
    $('download').hidden = true;
    finale.hidden = false;
    finale.classList.add('shown');
    return;
  }
  $('stage').classList.add('finale-on');
  intro.setMarks({ shown: false, lines: state.lines, names: state.names });
  finale.hidden = true;
  finale.classList.remove('shown');
  intro.setSky(sky, { ...skyOptions(), fade: fresh });
  intro.setGain(small() ? 1.4 : 1);
  const target = viewTarget(sky);
  lastView = target;
  await new Promise((r) => setTimeout(r, fresh && !reduceMotion ? 700 : 0));
  await intro.turnTo(target.az, target.alt, fresh ? 5 : 2.5);
  intro.setMarks({ shown: true, maxY: 0.94 });
  fillInfo();
  $('stage').classList.add('info-on');
  // let the sky and its names be seen on their own first, longer on a phone
  await new Promise((r) => setTimeout(r, reduceMotion ? 0 : small() ? 3800 : 2200));
  fillFinaleText(true);
  finale.hidden = false;
  requestAnimationFrame(() => finale.classList.add('shown'));
  fitLabels();
}

/** Keep the sky's names above the words at the bottom. */
function fitLabels() {
  if (!intro || $('finale').hidden) return;
  if ($('stage').classList.contains('words-hidden')) { intro.setMarks({ maxY: 0.94 }); return; }
  const top = $('finale').querySelector('.f-text').getBoundingClientRect().top;
  intro.setMarks({ maxY: Math.max(0.3, (top - 12) / innerHeight) });
}
addEventListener('resize', fitLabels);

/** Settings that move the sky (place, night, year) re-run the turn; words update in place. */
function refreshSky() {
  computeCurrentSky();
  intro.setSky(sky, { ...skyOptions(), fade: true });
  const target = viewTarget(sky);
  lastView = target;
  intro.turnTo(target.az, target.alt, 3);
  fillFinaleText(false);
  fillInfo();
  updateURL();
}

function refreshWords() {
  fillFinaleText(false);
  fitLabels();
  updateURL();
}

function updateURL() {
  if (!finaleShown) return;
  const p = new URLSearchParams({
    lang: state.lang, place: state.place, lat: (+state.lat).toFixed(3), lon: (+state.lon).toFixed(3), tz: state.tz,
    occ: state.occasion, year: state.year,
  });
  if (state.name) p.set('name', state.name);
  if (state.message !== null) p.set('msg', state.message);
  if (state.greeting) p.set('greet', state.greeting);
  if (!state.lines) p.set('lines', '0');
  if (!state.names) p.set('names', '0');
  try {
    history.replaceState(null, '', `${location.pathname}?${p}`);
  } catch {
    // some embedded viewers do not allow changing the address
  }
}

// --- Form in the drawer ------------------------------------------------------------------------------

function translate() {
  const L = t();
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = L[el.dataset.t]; });
  $('name').placeholder = L.namePh;
  $('city').placeholder = L.cityPh;
  $('greeting').placeholder = L.greet[state.occasion];
  $('message').placeholder = L.defaultMsg[state.occasion];
  $('message').value = state.message ?? L.defaultMsg[state.occasion];
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === state.lang));
  document.querySelectorAll('[data-q]').forEach((el) => { el.textContent = Q[state.lang][el.dataset.q]; });
  $('replay').href = `./?lang=${state.lang}`;
  $('toggle-words').textContent = $('stage').classList.contains('words-hidden') ? L.showWords : L.hideWords;
}

function fillForm() {
  $('name').value = state.name;
  $('greeting').value = state.greeting;
  $('city').value = state.place;
  $('occasion').value = state.occasion;
  $('year').value = state.year;
  $('lines').checked = state.lines;
  $('names').checked = state.names;
  translate();
}

function nearestCity(lat, lon) {
  let best = null, bestD = Infinity;
  for (const c of catalogue.cities) {
    const d = (c[2] - lat) ** 2 + ((c[3] - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function locate(done, fail = () => {}) {
  if (!navigator.geolocation) return fail(new Error('Geolocation is not available'));
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    const c = nearestCity(lat, lon);
    Object.assign(state, { lat, lon, tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      place: c ? `${c[0]}, ${c[1]}` : state.place, placeChosen: 'geo' });
    done(state.place);
  }, fail);
}

const status = (text) => { $('status').textContent = text; };

function download() {
  const W = 1200, H = 1800;
  const shot = intro.snapshot(W, H);
  drawFinale(shot.canvas.getContext('2d'), W, H, shot.labels, { ...cardText(), info: infoLines() });
  const slug = state.place.split(',')[0].toLocaleLowerCase('tr').normalize('NFKD').replace(/[^a-z0-9]+/g, '-');
  shot.canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `starry-christmas-${slug}-${state.year}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
}

function bind() {
  const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
  on('name', 'input', (e) => { state.name = e.target.value; refreshWords(); });
  on('message', 'input', (e) => { state.message = e.target.value; refreshWords(); });
  on('greeting', 'input', (e) => { state.greeting = e.target.value; refreshWords(); });
  on('lines', 'change', (e) => { state.lines = e.target.checked; intro?.setMarks({ lines: state.lines }); updateURL(); });
  on('names', 'change', (e) => { state.names = e.target.checked; intro?.setMarks({ names: state.names }); updateURL(); });
  on('year', 'change', (e) => { state.year = Math.max(1900, Math.min(2100, +e.target.value || state.year)); refreshSky(); });
  on('occasion', 'change', (e) => {
    state.occasion = e.target.value;
    state.year = defaultYear(state.occasion);
    $('year').value = state.year;
    if (state.message !== null && Object.values(T).some((L) => Object.values(L.defaultMsg).includes(state.message))) state.message = null;
    translate();
    refreshSky();
  });
  on('city', 'change', (e) => {
    const c = cityIndex.get(e.target.value.trim().toLocaleLowerCase('tr'));
    status(c ? '' : t().unknownCity);
    if (!c) return;
    Object.assign(state, { place: `${c[0]}, ${c[1]}`, lat: c[2], lon: c[3], tz: c[4] });
    refreshSky();
  });
  on('locate', 'click', () => {
    status(t().locating);
    locate(() => { $('city').value = state.place; status(''); refreshSky(); }, (err) => status(err.message));
  });
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => {
    state.lang = b.dataset.lang;
    translate();
    quiz?.refresh();
    if (finaleShown) {
      intro.setSky(sky, { ...skyOptions(), fade: false });
      refreshWords();
      fillInfo();
    }
  }));
  on('download', 'click', download);
  on('share', 'click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      status(t().copied);
    } catch {
      status(location.href);
    }
  });
  on('edit', 'click', () => {
    const d = $('drawer');
    d.hidden = !d.hidden;
    $('stage').classList.toggle('editing', !d.hidden);
    if (!d.hidden) $('name').focus({ preventScroll: true });
  });
  on('toggle-words', 'click', () => {
    const hidden = $('stage').classList.toggle('words-hidden');
    $('toggle-words').textContent = hidden ? t().showWords : t().hideWords;
    fitLabels();
  });
  on('drawer-close', 'click', () => { $('drawer').hidden = true; $('stage').classList.remove('editing'); });
}

async function start() {
  catalogue = await loadData();
  const list = $('cities');
  for (const c of catalogue.cities) {
    const label = `${c[0]}, ${c[1]}`;
    cityIndex.set(label.toLocaleLowerCase('tr'), c);
    if (!cityIndex.has(c[0].toLocaleLowerCase('tr'))) cityIndex.set(c[0].toLocaleLowerCase('tr'), c);
    const opt = document.createElement('option');
    opt.value = label;
    list.appendChild(opt);
  }
  await Promise.all(['400 128px "Great Vibes"', 'italic 400 46px "Playfair Display"', '700 20px "Playfair Display"',
    '400 28px "Playfair Display"', '600 22px Inter', '400 19px Inter'].map((f) => document.fonts.load(f, 'ĞğŞşİıÖöÜüÇç')));
  fillForm();
  bind();
  startStage();
}

// The opening flight, then the questions, then the real sky of the chosen place and night.
async function startStage() {
  const stage = $('stage');
  stage.hidden = false;
  document.body.classList.add('ready');
  const skip = $('skip');
  quiz = runQuiz(stage, {
    lang: () => state.lang,
    state,
    cities: cityIndex,
    year: () => defaultYear('christmas'),
    defaultMessage: () => t().defaultMsg[state.occasion],
    locate: (cb) => locate(cb),
    onDone() {
      if (!params.get('year')) state.year = defaultYear(state.occasion);
      fillForm();
      setTimeout(() => { $('quiz').hidden = true; }, 400);
      showFinale();
    },
  });
  try {
    const { createIntro } = await import('./intro.js');
    intro = createIntro($('sky3d'), { reducedMotion: reduceMotion, labelRoot: $('sky-labels'), startAtEnd: shared });
    // the sky during the flight is already the real one, for the default place and night
    intro.setSky(computeCurrentSky(), { ...skyOptions(), fade: false });
    skip.addEventListener('click', () => intro.skip());
    intro.onEnd(() => {
      skip.classList.add('gone');
      if (shared) showFinale({ fresh: false });
      else setTimeout(() => quiz.showWelcome(), reduceMotion ? 0 : 400);
    });
  } catch (err) {
    console.warn('3D scene unavailable:', err);
    skip.classList.add('gone');
    stage.classList.add('no-webgl');
    quiz.showWelcome();
  }
}

start();
