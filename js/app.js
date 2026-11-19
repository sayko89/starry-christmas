import { zonedTime } from './astro.js';
import { computeSky, loadData } from './sky.js';
import { H, W, drawCard, drawLights } from './card.js';

const T = {
  tr: {
    title: 'Yıldızlı Noel Kartı',
    subtitle: 'Şehrinin üzerindeki gerçek gökyüzü, Noel gecesi tam gece yarısı — bir yılbaşı süsünün içinde.',
    name: 'Kime?', namePh: 'Sevgili Ayşe', message: 'Mesaj', city: 'Şehir', cityPh: 'Şehir ara…',
    locate: 'Konumumu kullan', occasion: 'Gece', christmas: 'Noel · 25 Aralık',
    newyear: 'Yılbaşı · 1 Ocak', year: 'Yıl', greeting: 'Başlık', lines: 'Takımyıldız çizgileri',
    names: 'İsimler', download: 'PNG olarak indir', share: 'Linki kopyala', copied: 'Link kopyalandı!',
    unknownCity: 'Bu şehri listede bulamadım, listeden seçin.', locating: 'Konum alınıyor…',
    greet: { christmas: 'Mutlu Noeller', newyear: 'Mutlu Yıllar' },
    defaultMsg: {
      christmas: 'Noel gecesi tam gece yarısı, başımızın üstündeki gökyüzü.',
      newyear: 'Yeni yılın ilk anında başımızın üstündeki gökyüzü.',
    },
    compass: ['K', 'D', 'G', 'B'], ns: ['K', 'G'], ew: ['D', 'B'],
    star: (n, kind) => (kind === 'planet' ? `Gecenin en parlak ışığı: ${n}` : `Gecenin Noel yıldızı: ${n}`),
    credit: 'Yıldız verisi: Hipparcos / d3-celestial · Ay ve gezegenler: astronomy-engine',
  },
  en: {
    title: 'Starry Christmas Card',
    subtitle: 'The real sky over your city at midnight on Christmas night — inside a Christmas bauble.',
    name: 'To', namePh: 'Dear Emma', message: 'Message', city: 'City', cityPh: 'Search a city…',
    locate: 'Use my location', occasion: 'Night', christmas: 'Christmas · 25 Dec',
    newyear: 'New Year · 1 Jan', year: 'Year', greeting: 'Greeting', lines: 'Constellation lines',
    names: 'Names', download: 'Download PNG', share: 'Copy link', copied: 'Link copied!',
    unknownCity: "I couldn't find that city — please pick one from the list.", locating: 'Finding you…',
    greet: { christmas: 'Merry Christmas', newyear: 'Happy New Year' },
    defaultMsg: {
      christmas: 'The sky above us at midnight on Christmas night.',
      newyear: 'The sky above us in the first moment of the new year.',
    },
    compass: ['N', 'E', 'S', 'W'], ns: ['N', 'S'], ew: ['E', 'W'],
    star: (n, kind) => (kind === 'planet' ? `Brightest light of the night: ${n}` : `Your Christmas star: ${n}`),
    credit: 'Star data: Hipparcos / d3-celestial · Moon and planets: astronomy-engine',
  },
};

const $ = (id) => document.getElementById(id);
const canvas = $('card');
const ctx = canvas.getContext('2d');
const base = document.createElement('canvas');
base.width = W;
base.height = H;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function defaultYear(occasion, today = new Date()) {
  const y = today.getFullYear();
  const pastChristmas = today.getMonth() === 11 && today.getDate() > 25;
  const christmasYear = pastChristmas ? y + 1 : y;
  return occasion === 'newyear' ? (today.getMonth() === 0 && today.getDate() === 1 ? y : christmasYear + 1) : christmasYear;
}

const params = new URLSearchParams(location.search);
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
};
if (!state.year) state.year = defaultYear(state.occasion);

let catalogue = null;
let cityIndex = new Map();
let current = null; // last computed sky

function t() { return T[state.lang]; }

function moment() {
  return state.occasion === 'newyear'
    ? { y: state.year, m: 1, d: 1 }
    : { y: state.year, m: 12, d: 25 };
}

function textFor(sky) {
  const L = t();
  const { y, m, d } = moment();
  const day = new Intl.DateTimeFormat(state.lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
  const coord = `${Math.abs(state.lat).toFixed(2)}°${L.ns[state.lat >= 0 ? 0 : 1]} ${Math.abs(state.lon).toFixed(2)}°${L.ew[state.lon >= 0 ? 0 : 1]}`;
  const star = sky.brightest ? L.star(state.lang === 'tr' ? sky.brightest.tr : sky.brightest.name, sky.brightest.kind) : '';
  return {
    lang: state.lang,
    greeting: state.greeting || L.greet[state.occasion],
    name: state.name,
    message: state.message ?? L.defaultMsg[state.occasion],
    place: state.place,
    when: `${day} · 00:00 · ${coord}`,
    star,
  };
}

function render() {
  if (!catalogue) return;
  const { y, m, d } = moment();
  const date = zonedTime(y, m, d, 0, 0, state.tz);
  current = computeSky({ date, lat: state.lat, lon: state.lon }, catalogue);
  drawCard(base.getContext('2d'), {
    sky: current, lines: state.lines, names: state.names, lang: state.lang,
    compass: t().compass, text: textFor(current),
  });
  paint(performance.now());
  updateURL();
}

// Each bulb fades in and out at its own pace; every few seconds a wave chases along the wire.
const phases = Array.from({ length: 64 }, (_, i) => [(i * 2.399) % (Math.PI * 2), 0.6 + ((i * 7) % 5) * 0.18]);
function levels(time) {
  const s = time / 1000;
  return phases.map(([p, speed], i) => {
    const twinkle = 0.55 + 0.45 * Math.sin(s * speed * 2 + p);
    const chase = Math.max(0, Math.cos((i / 28) * Math.PI * 2 - s * 2.2)) ** 6;
    return Math.min(1, twinkle * 0.8 + chase * 0.6);
  });
}

function paint(time) {
  ctx.drawImage(base, 0, 0);
  drawLights(ctx, reduceMotion ? null : levels(time));
}

function loop(time) {
  paint(time);
  requestAnimationFrame(loop);
}

function updateURL() {
  const p = new URLSearchParams({
    lang: state.lang, place: state.place, lat: state.lat.toFixed(3), lon: state.lon.toFixed(3), tz: state.tz,
    occ: state.occasion, year: state.year,
  });
  if (state.name) p.set('name', state.name);
  if (state.message !== null) p.set('msg', state.message);
  if (state.greeting) p.set('greet', state.greeting);
  if (!state.lines) p.set('lines', '0');
  if (!state.names) p.set('names', '0');
  history.replaceState(null, '', `${location.pathname}?${p}`);
}

// --- Form -----------------------------------------------------------------------------------

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

function bind() {
  const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
  on('name', 'input', (e) => { state.name = e.target.value; render(); });
  on('message', 'input', (e) => { state.message = e.target.value; render(); });
  on('greeting', 'input', (e) => { state.greeting = e.target.value; render(); });
  on('lines', 'change', (e) => { state.lines = e.target.checked; render(); });
  on('names', 'change', (e) => { state.names = e.target.checked; render(); });
  on('year', 'change', (e) => { state.year = Math.max(1900, Math.min(2100, +e.target.value || state.year)); render(); });
  on('occasion', 'change', (e) => {
    state.occasion = e.target.value;
    state.year = defaultYear(state.occasion);
    $('year').value = state.year;
    if (state.message !== null && Object.values(T).some((L) => Object.values(L.defaultMsg).includes(state.message))) state.message = null;
    translate();
    render();
  });
  on('city', 'change', (e) => {
    const c = cityIndex.get(e.target.value.trim().toLocaleLowerCase('tr'));
    $('status').textContent = c ? '' : t().unknownCity;
    if (!c) return;
    Object.assign(state, { place: `${c[0]}, ${c[1]}`, lat: c[2], lon: c[3], tz: c[4] });
    render();
  });
  on('locate', 'click', () => {
    $('status').textContent = t().locating;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const c = nearestCity(lat, lon);
      Object.assign(state, { lat, lon, tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        place: c ? `${c[0]}, ${c[1]}` : state.place });
      $('city').value = state.place;
      $('status').textContent = '';
      render();
    }, (err) => { $('status').textContent = err.message; });
  });
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => {
    state.lang = b.dataset.lang;
    translate();
    render();
  }));
  on('download', 'click', () => {
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const o = out.getContext('2d');
    o.drawImage(base, 0, 0);
    drawLights(o, null);
    const slug = state.place.split(',')[0].toLocaleLowerCase('tr').normalize('NFKD').replace(/[^a-z0-9]+/g, '-');
    out.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `starry-christmas-${slug}-${state.year}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  });
  on('share', 'click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $('status').textContent = t().copied;
    } catch {
      $('status').textContent = location.href;
    }
  });
}

async function start() {
  canvas.width = W;
  canvas.height = H;
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
  render();
  document.body.classList.add('ready');
  if (!reduceMotion) requestAnimationFrame(loop);
}

start();
