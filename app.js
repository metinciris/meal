/* app.js — Mushaf (kitap) sırasına göre basit görüntüleyici */

// 1..114 ayet sayıları
const AYAHS = [0,
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,
  59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,
  52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,
  21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6
];

const params = new URLSearchParams(location.search);
// Yol A: yayınlanmış Google CSV linkini ?csv= ile ver
// Yol B: repo içi /data/normalized.csv
const CSV_URL = params.get('csv') || 'data/normalized.csv';

const state = {
  byKey: new Map(),   // "s:a" -> {sure, ayet, meal, aciklama, last}
  lastUpdated: null
};

const $ = sel => document.querySelector(sel);

document.addEventListener('DOMContentLoaded', async () => {
  $('#backBtn').addEventListener('click', () => showAll());
  $('#searchBox').addEventListener('input', debounce(render, 150));

  try {
    await loadCSV(CSV_URL);
  } catch (e) {
    showNotice('Veri yüklenemedi. İlk yükleme için internet gerekli olabilir.');
    console.error(e);
  }
  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
});

function showNotice(msg){
  const n = $('#notice'); n.textContent = msg || ''; n.hidden = !msg;
}

async function loadCSV(url) {
  const res = await fetch(url, {cache: 'no-store'});
  if (!res.ok) throw new Error('CSV fetch failed '+res.status);
  const text = await res.text();
  const rows = parseCSV(text);

  // Beklenen başlıklar: Key, Sure, Ayet, Meal, Açıklama, LastUpdatedISO
  const head = rows[0].map(h => h.trim());
  const idx = n => head.indexOf(n);

  const recs = rows.slice(1).map(r => ({
    key: (r[idx('Key')] || '').trim(),
    sure: +r[idx('Sure')],
    ayet: +r[idx('Ayet')],
    meal: (r[idx('Meal')] || '').toString(),
    aciklama: (r[idx('Açıklama')] || '').toString(),
    last: (r[idx('LastUpdatedISO')] || '').toString()
  })).filter(x => x.sure >= 1 && x.sure <= 114 && x.ayet >= 1);

  // Aynı sure:ayet için en yeni kaydı tut
  const latest = new Map();
  for (const x of recs) {
    const k = `${x.sure}:${x.ayet}`;
    const prev = latest.get(k);
    if (!prev || (x.last && x.last > prev.last)) latest.set(k, x);
  }
  state.byKey = latest;
  state.lastUpdated = [...latest.values()].reduce((m, x) => m && m > x.last ? m : x.last, null);
}

function render(){
  renderSummary();
  renderSurahGrid();
  // basit router: #/s/ayet?
  if (location.hash.startsWith('#/')) {
    const [s, a] = location.hash.slice(2).split('/').map(Number);
    if (s >= 1 && s <= 114) showSurah(s, a || null);
  } else {
    showAll();
  }
}

function renderSummary(){
  const total = AYAHS.slice(1).reduce((a,b)=>a+b,0);
  let done = 0;
  state.byKey.forEach(() => done++);
  $('#stats').innerHTML =
    `<b>Toplam:</b> ${done}/${total} ayet · <b>Tamamlanma:</b> ${((done/total)*100).toFixed(1)}%`;
  $('#lastUpdated').textContent = state.lastUpdated || '—';

  const recent = [...state.byKey.values()].filter(x=>x.last)
    .sort((a,b)=> b.last.localeCompare(a.last))
    .slice(0,10);
  $('#recent').innerHTML = `
    <h3>Son eklenenler</h3>
    <ol>
      ${recent.map(x=>`<li><a href="#/${x.sure}/${x.ayet}" onclick="return go(${x.sure},${x.ayet})">${x.sure}:${x.ayet}</a> <small class="muted">${x.last}</small></li>`).join('')}
    </ol>
  `;
}

function renderSurahGrid(){
  const g = $('#surah-grid');
  const cards = [];
  for (let s=1; s<=114; s++){
    let filled = 0;
    for (let a=1; a<=AYAHS[s]; a++){
      if (state.byKey.has(`${s}:${a}`)) filled++;
    }
    const pct = Math.round((filled/AYAHS[s])*100);
    const emoji = pct===0 ? '⚪️' : (pct<100 ? '🟢' : '✅');
    cards.push(`
      <div class="card">
        <h3>${emoji} Sure ${s}</h3>
        <div class="progress"><b style="width:${pct}%"></b></div>
        <div><span class="badge">${filled}/${AYAHS[s]}</span></div>
        <div style="margin-top:6px">
          <button onclick="return go(${s})">Görüntüle</button>
        </div>
      </div>
    `);
  }
  g.innerHTML = cards.join('');
}

function showAll(){
  $('#surah-grid').hidden = false;
  $('#surah-view').hidden = true;
  $('#ayahDetail').hidden = true;
}

function showSurah(surah, ayah=null){
  $('#surah-grid').hidden = true;
  $('#surah-view').hidden = false;
  $('#surahTitle').textContent = `Sure ${surah}`;
  const q = ($('#searchBox').value || '').trim().toLowerCase();
  const grid = $('#ayatGrid');
  const cells = [];

  for (let a=1; a<=AYAHS[surah]; a++){
    const rec = state.byKey.get(`${surah}:${a}`);
    const has = !!rec;
    // basit arama: meal + açıklama
    const match = !q || (rec && ((rec.meal||'').toLowerCase().includes(q) || (rec.aciklama||'').toLowerCase().includes(q)));
    const cls = `ayat ${has?'full':''} ${match?'':'dim'}`;
    cells.push(`<div class="${cls}" onclick="showAyah(${surah},${a})">${a}</div>`);
  }
  grid.innerHTML = cells.join('');
  if (ayah) showAyah(surah, ayah);
}

function showAyah(surah, ayah){
  const d = $('#ayahDetail');
  const rec = state.byKey.get(`${surah}:${ayah}`);
  d.hidden = false;
  if (!rec){
    d.innerHTML = `<h3>${surah}:${ayah}</h3><p class="muted">Bu ayetin meali henüz girilmemiş.</p>`;
  } else {
    d.innerHTML = `
      <h3>${surah}:${ayah}</h3>
      <p dir="auto">${escapeHTML(rec.meal)}</p>
      ${rec.aciklama ? `<hr><div dir="auto">${linkifyInternal(escapeHTML(rec.aciklama))}</div>` : ''}
      <p><small class="muted">${rec.last || ''}</small></p>
    `;
  }
  location.hash = `#/${surah}/${ayah}`;
}

function go(surah, ayah){
  if (surah && !ayah) location.hash = `#/${surah}`;
  if (surah && ayah) location.hash = `#/${surah}/${ayah}`;
  render();
  return false;
}

function linkifyInternal(text){
  // [[2:255]] veya [[2:255-257]]
  return text.replace(/\[\[\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*\]\]/g,
    (m, s, a1, a2)=>{
      s=+s; a1=+a1; a2=a2?+a2:null;
      if (!a2) return `<a href="#/${s}/${a1}" onclick="return go(${s},${a1})">${s}:${a1}</a>`;
      return `<a href="#/${s}/${a1}" onclick="return go(${s},${a1})">${s}:${a1}-${a2}</a>`;
    });
}

// Basit CSV ayrıştırıcı (tırnaklı alanları da destekler)
function parseCSV(str){
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i=0;i<str.length;i++){
    const c = str[i], n = str[i+1];
    if (inQ){
      if (c === '"' && n === '"'){ cur += '"'; i++; }
      else if (c === '"'){ inQ = false; }
      else { cur += c; }
    } else {
      if (c === '"'){ inQ = true; }
      else if (c === ','){ row.push(cur); cur=''; }
      else if (c === '\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
      else if (c === '\r'){ /* ignore */ }
      else { cur += c; }
    }
  }
  if (cur.length || row.length){ row.push(cur); rows.push(row); }
  return rows;
}

function escapeHTML(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
