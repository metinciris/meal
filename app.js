/* Minimal CSV-temelli PWA; JSON yok. */
// --- Ayet sayıları (1..114) ---
const AYAHS = [0,
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,
  59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,
  52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,
  21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6
];

// --- Veri kaynağı ---
// Yol A: direkt Google CSV → URL'yi ?csv= ile geçebilirsin.
// Yol B: repo içindeki data/normalized.csv
const params = new URLSearchParams(location.search);
const CSV_URL = params.get('csv') || 'data/normalized.csv';

const state = {
  order: 'Kitap (Mushaf) Sırası',
  records: [],   // {sure, ayet, meal, aciklama, tarih, nuzulVers, siralama, last}
  byKey: new Map(), // "s:a" -> record (sadece son günceli)
  lastUpdated: null
};

const el = sel => document.querySelector(sel);

document.addEventListener('DOMContentLoaded', () => {
  el('#orderSelect').addEventListener('change', e => {
    state.order = e.target.value;
    render();
  });
  el('#searchBox').addEventListener('input', () => render());
  el('#backBtn').addEventListener('click', () => showAllSurahs());

  loadCSV(CSV_URL).then(() => {
    render();
    // küçük bir duyuru göstermek istersen:
    // showNotice('Veriler Google Sheets üzerinden otomatik eşitlenmektedir.');
  }).catch(err => {
    showNotice('Veri yüklenemedi. İlk yükleme için internet gerekli olabilir.');
    console.error(err);
  });
});

function showNotice(msg){
  const n = el('#notice'); n.textContent = msg; n.hidden = !msg;
}

async function loadCSV(url) {
  const res = await fetch(url, {cache:'no-store'});
  if (!res.ok) throw new Error('CSV fetch failed: '+res.status);
  const text = await res.text();
  const rows = parseCSV(text);
  // Beklenen başlıklar: Key, Sure, Ayet, Sıralama, NüzulVers, Tarih, Meal, Açıklama, EditorEmail, LastUpdatedISO
  const head = rows[0];
  const idx = (name)=>head.indexOf(name);
  const data = rows.slice(1).map(r => ({
    key: r[idx('Key')],
    sure: +r[idx('Sure')],
    ayet: +r[idx('Ayet')],
    siralama: r[idx('Sıralama')] || 'Kitap (Mushaf) Sırası',
    nuzulVers: r[idx('NüzulVers')] || '',
    tarih: r[idx('Tarih')] || '',
    meal: r[idx('Meal')] || '',
    aciklama: r[idx('Açıklama')] || '',
    editor: r[idx('EditorEmail')] || '',
    last: r[idx('LastUpdatedISO')] || ''
  }));

  // Aynı sure:ayet için en güncel kaydı tut
  const latest = new Map();
  data.forEach(x => {
    const baseKey = `${x.sure}:${x.ayet}`;
    const prev = latest.get(baseKey);
    if (!prev || (x.last && x.last > prev.last)) latest.set(baseKey, x);
  });

  state.records = data; // tam liste (gerekirse)
  state.byKey = latest;
  // lastUpdated
  state.lastUpdated = [...latest.values()].reduce((m, x) => m && m> x.last ? m : x.last, null);
}

function render(){
  // Özet
  const filled = countFilledBySurah();
  const total = AYAHS.slice(1).reduce((a,b)=>a+b,0);
  const done = Object.values(filled).reduce((a,b)=>a+b,0);

  el('#stats').innerHTML =
    `<b>Toplam:</b> ${done}/${total} ayet · <b>Tamamlanma:</b> ${((done/total)*100).toFixed(1)}%`;

  // Son eklenenler (son 10)
  const recent = [...state.byKey.values()].filter(x=>x.last).sort((a,b)=> (b.last||'').localeCompare(a.last||'')).slice(0,10);
  el('#recent').innerHTML = `
    <h3>Son eklenenler</h3>
    <ol>${recent.map(x=>`<li><a href="#/${x.sure}/${x.ayet}" onclick="return routeTo(${x.sure},${x.ayet})"> ${x.sure}:${x.ayet}</a> <small class="muted">${x.tarih||x.last}</small></li>`).join('')}</ol>
  `;

  // Surah kartları
  renderSurahGrid(filled);

  // Hash route (örn. #/2/255)
  if (location.hash.startsWith('#/')) {
    const parts = location.hash.slice(2).split('/');
    const s = +parts[0], a = parts[1]? +parts[1] : null;
    if (s && s>=1 && s<=114) showSurah(s, a);
  } else {
    showAllSurahs();
  }

  el('#lastUpdated').textContent = state.lastUpdated || '—';
}

function countFilledBySurah(){
  const filled = {};
  for (let s=1;s<=114;s++) filled[s]=0;
  state.byKey.forEach((x, key) => {
    if (x.siralama === state.order) filled[x.sure] = (filled[x.sure]||0)+1;
  });
  return filled;
}

function renderSurahGrid(filled){
  const g = el('#surah-grid');
  const cards = [];
  for (let s=1;s<=114;s++){
    const done = filled[s]||0;
    const tot = AYAHS[s];
    const pct = Math.round((done/tot)*100);
    const color = pct>=100 ? '✅' : (pct>0 ? '🟢' : '⚪️');
    cards.push(`
      <div class="card">
        <h3>${color} Sure ${s}</h3>
        <div class="progress"><b style="width:${pct}%"></b></div>
        <div><span class="badge">${done}/${tot}</span></div>
        <div style="margin-top:6px">
          <button onclick="return routeTo(${s})">Görüntüle</button>
        </div>
      </div>
    `);
  }
  g.innerHTML = cards.join('');
}

function showAllSurahs(){
  el('#surah-grid').hidden = false;
  el('#surah-view').hidden = true;
  el('#ayahDetail').hidden = true;
}

function showSurah(surah, ayah=null){
  el('#surah-grid').hidden = true;
  el('#surah-view').hidden = false;
  el('#surahTitle').textContent = `Sure ${surah}`;
  const grid = el('#ayatGrid');
  const cells = [];
  for (let a=1;a<=AYAHS[surah];a++){
    const has = state.byKey.has(`${surah}:${a}`) && state.byKey.get(`${surah}:${a}`).siralama === state.order;
    cells.push(`<div class="ayat ${has?'full':''}" onclick="showAyah(${surah},${a})">${a}</div>`);
  }
  grid.innerHTML = cells.join('');
  if (ayah) showAyah(surah, ayah);
}

function showAyah(surah, ayah){
  const d = el('#ayahDetail');
  const rec = state.byKey.get(`${surah}:${ayah}`);
  if (!rec || rec.siralama !== state.order){
    d.hidden = false;
    d.innerHTML = `<h3>${surah}:${ayah}</h3><p class="muted">Bu ayetin meali henüz girilmemiş.</p>`;
    location.hash = `#/${surah}/${ayah}`;
    return;
  }
  d.hidden = false;
  d.innerHTML = `
    <h3>${surah}:${ayah}</h3>
    <p>${escapeHTML(rec.meal)}</p>
    ${rec.aciklama ? `<hr><div>${linkifyInternal(escapeHTML(rec.aciklama))}</div>` : ''}
    <p><small class="muted">${rec.tarih || rec.last} · ${rec.nuzulVers?('Nüzul vers: '+rec.nuzulVers):''}</small></p>
  `;
  location.hash = `#/${surah}/${ayah}`;
}

function routeTo(surah, ayah){
  if (surah && !ayah) location.hash = `#/${surah}`;
  if (surah && ayah) location.hash = `#/${surah}/${ayah}`;
  render();
  return false;
}

// İç link parser: [[2:255]] veya [[2:255-257]]
function linkifyInternal(text){
  return text.replace(/\[\[\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*\]\]/g, (m, s, a1, a2)=>{
    s=+s; a1=+a1; a2=a2?+a2:null;
    if (!a2) return `<a href="#/${s}/${a1}" onclick="return routeTo(${s},${a1})">${s}:${a1}</a>`;
    return `<a href="#/${s}/${a1}" onclick="return routeTo(${s},${a1})">${s}:${a1}-${a2}</a>`;
  });
}

// Basit ve güvenli CSV ayrıştırıcı
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
      else if (c === '\r'){ /* yoksay */ }
      else { cur += c; }
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function escapeHTML(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
