// The welcome screen and the four questions shown over the starry sky.
// Each question arrives letter by letter, drifting down like snowflakes.

const QUICK_CITIES = ['İstanbul', 'Ankara', 'İzmir', 'Samsun'];

export const Q = {
  tr: {
    kicker: (y) => `Noel ${y}`,
    headline: 'Bu Noel, ona gökyüzünü hediye et.',
    sub: 'Sevdiğin birinin şehrinin üzerindeki gerçek yıldızlarla, ona özel bir Noel kartı.',
    start: 'Başla', skip: 'Geç', back: 'Geri', next: 'Devam', finish: 'Kartımı oluştur',
    steps: [
      { q: 'Bu kartı kime hazırlıyoruz?', hint: 'Boş da bırakabilirsin.' },
      { q: 'Hangi şehrin gökyüzü olsun?', hint: 'Listeden seç ya da konumunu kullan.' },
      { q: 'Hangi gece?', hint: 'Tam gece yarısındaki gökyüzü çizilecek.' },
      { q: 'Ona ne söylemek istersin?', hint: 'Kartın altına yazılacak.' },
    ],
    christmas: ['Noel gecesi', '25 Aralık · 00:00'], newyear: ['Yılbaşı gecesi', '1 Ocak · 00:00'],
    locate: 'Konumumu kullan', pickCity: 'Listeden bir şehir seç.',
  },
  en: {
    kicker: (y) => `Christmas ${y}`,
    headline: 'This Christmas, give them the sky.',
    sub: 'A card made of the real stars above the city of someone you love.',
    start: 'Start', skip: 'Skip', back: 'Back', next: 'Next', finish: 'Make my card',
    steps: [
      { q: 'Who is this card for?', hint: 'You can leave it empty.' },
      { q: "Whose city's sky should it be?", hint: 'Pick from the list or use your location.' },
      { q: 'Which night?', hint: 'We draw the sky at exactly midnight.' },
      { q: 'What would you like to tell them?', hint: 'It goes at the bottom of the card.' },
    ],
    christmas: ['Christmas night', '25 Dec · 00:00'], newyear: ["New Year's Eve", '1 Jan · 00:00'],
    locate: 'Use my location', pickCity: 'Pick a city from the list.',
  },
};

const $ = (sel, root = document) => root.querySelector(sel);

/** Write `text` into `el` as letters that fall like snow and settle. */
export function snowText(el, text, { delay = 0 } = {}) {
  el.textContent = '';
  el.setAttribute('aria-label', text);
  const words = text.split(' ');
  let i = 0;
  words.forEach((word, w) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.setAttribute('aria-hidden', 'true');
    for (const ch of word) {
      const c = document.createElement('span');
      c.className = 'flake';
      c.textContent = ch;
      c.style.setProperty('--d', `${delay + i * 0.035 + Math.random() * 0.45}s`);
      c.style.setProperty('--x', `${(Math.random() - 0.5) * 80}px`);
      c.style.setProperty('--r', `${(Math.random() - 0.5) * 120}deg`);
      span.appendChild(c);
      i++;
    }
    el.appendChild(span);
    if (w < words.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return delay + i * 0.035 + 0.45 + 1.1; // when the last letter has landed
}

/**
 * Run the welcome screen and the questions.
 * ctx: { lang, state, cities (Map of lower-case label -> row), year(), onLang(lang), locate(cb), onDone() }
 */
export function runQuiz(root, ctx) {
  let step = -1;
  const L = () => Q[ctx.lang()];

  const welcome = $('#welcome', root);
  const quiz = $('#quiz', root);
  const qTitle = $('#q-title', root);
  const qHint = $('#q-hint', root);
  const body = $('#q-body', root);
  const back = $('#q-back', root);
  const next = $('#q-next', root);
  const dots = [...root.querySelectorAll('.ornaments i')];

  function showWelcome() {
    const l = L();
    $('#w-kicker', root).textContent = l.kicker(ctx.year());
    snowText($('#w-title', root), l.headline, { delay: 0.2 });
    $('#w-sub', root).textContent = l.sub;
    $('#w-start', root).textContent = l.start;
    welcome.hidden = false;
    welcome.classList.remove('leaving');
    requestAnimationFrame(() => welcome.classList.add('shown'));
  }

  function input(type, attrs) {
    const el = document.createElement(type);
    Object.assign(el, attrs);
    return el;
  }

  function cityRow(value) {
    return ctx.cities.get(value.trim().toLocaleLowerCase('tr'));
  }

  function validate() {
    if (step === 1) next.disabled = !cityRow($('#q-city', root)?.value || '');
  }

  function renderStep() {
    const l = L(), s = ctx.state;
    quiz.classList.remove('shown');
    void quiz.offsetWidth; // restart the entrance animation
    quiz.classList.add('shown');
    const landed = snowText(qTitle, l.steps[step].q);
    qHint.textContent = l.steps[step].hint;
    body.style.setProperty('--appear', `${Math.min(landed, 1.6)}s`);
    body.textContent = '';
    dots.forEach((d, i) => d.classList.toggle('done', i <= step));
    back.textContent = l.back;
    back.hidden = step === 0;
    next.textContent = step === 3 ? l.finish : l.next;
    next.disabled = false;

    if (step === 0) {
      const el = input('input', { id: 'q-name', value: s.name, placeholder: ctx.lang() === 'tr' ? 'Sevgili Ayşe' : 'Dear Emma',
        maxLength: 40, autocomplete: 'off' });
      el.addEventListener('input', () => { s.name = el.value; });
      body.append(el);
    } else if (step === 1) {
      const el = input('input', { id: 'q-city', value: s.placeChosen ? s.place : '', autocomplete: 'off',
        placeholder: ctx.lang() === 'tr' ? 'Şehir ara…' : 'Search a city…' });
      el.setAttribute('list', 'cities');
      el.addEventListener('input', validate);
      el.addEventListener('change', validate);
      const chips = document.createElement('div');
      chips.className = 'chips';
      for (const name of QUICK_CITIES) {
        const b = input('button', { type: 'button', className: 'chip', textContent: name });
        b.addEventListener('click', () => { el.value = `${name}, Türkiye`; validate(); });
        chips.append(b);
      }
      const loc = input('button', { type: 'button', className: 'chip locate', textContent: l.locate });
      loc.addEventListener('click', () => ctx.locate((label) => { el.value = label; s.placeChosen = 'geo'; validate(); }));
      chips.append(loc);
      body.append(el, chips);
      validate();
    } else if (step === 2) {
      const wrap = document.createElement('div');
      wrap.className = 'choices';
      for (const occ of ['christmas', 'newyear']) {
        const [title, sub] = l[occ];
        const b = input('button', { type: 'button', className: `choice ${occ}` });
        b.innerHTML = '<span class="bauble" aria-hidden="true"></span><b></b><small></small>';
        b.querySelector('b').textContent = title;
        b.querySelector('small').textContent = sub;
        b.setAttribute('aria-pressed', s.occasion === occ);
        b.addEventListener('click', () => {
          s.occasion = occ;
          wrap.querySelectorAll('.choice').forEach((c) => c.setAttribute('aria-pressed', c === b));
        });
        b.addEventListener('dblclick', go);
        wrap.append(b);
      }
      body.append(wrap);
    } else {
      const el = input('textarea', { id: 'q-msg', rows: 3, maxLength: 140, value: s.message ?? ctx.defaultMessage() });
      el.addEventListener('input', () => { s.message = el.value; });
      body.append(el);
    }
    setTimeout(() => body.querySelector('input, textarea, .choice[aria-pressed="true"]')?.focus({ preventScroll: true }), 900);
  }

  function go() {
    if (step === 1) {
      const el = $('#q-city', root);
      const row = cityRow(el.value);
      if (!row) return;
      if (ctx.state.placeChosen !== 'geo' || el.value !== ctx.state.place) {
        Object.assign(ctx.state, { place: `${row[0]}, ${row[1]}`, lat: row[2], lon: row[3], tz: row[4], placeChosen: true });
      }
    }
    if (step === 3) {
      quiz.classList.add('leaving');
      ctx.onDone();
      return;
    }
    leaveThen(() => { step++; renderStep(); });
  }

  function leaveThen(fn) {
    quiz.classList.add('leaving');
    setTimeout(() => { quiz.classList.remove('leaving'); fn(); }, 380);
  }

  $('#w-start', root).addEventListener('click', () => {
    welcome.classList.add('leaving');
    setTimeout(() => {
      welcome.hidden = true;
      quiz.hidden = false;
      step = 0;
      renderStep();
    }, 450);
  });
  next.addEventListener('click', go);
  back.addEventListener('click', () => leaveThen(() => { step--; renderStep(); }));
  quiz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      if (!next.disabled) go();
    }
  });

  return {
    showWelcome,
    /** Re-render the visible screen in the current language. */
    refresh() {
      if (!welcome.hidden) showWelcome();
      if (!quiz.hidden && step >= 0) renderStep();
    },
  };
}
