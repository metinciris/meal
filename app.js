/**************** app.js — canlı JSON API + sade & şık arayüz ****************/
/*  Yapı:
    - API_URL: Apps Script Web App (/exec) adresin
    - Ana sayfa: Sûre listesi (tamamlananlar yeşil), tıklayınca sûre görünümü
    - Sûre görünümü: Sadece meali olan ayetler, numara gizli rozet (hover/tıkla görünür)
    - Arama: Sûre içinde meal + açıklama alanında filtreler
    - İç link: [[3:4]] tıklanınca sûreyı açar, ilgili ayete kaydırır ve numarayı kısa süre gösterir
    - Yükleniyor katmanı: İlk yüklemede overlay
*/

const API_URL = 'PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE'; // ← /exec ile biten Web App URL

// Sûre adları
const NAMES = [
  '', 'Fâtiha','Bakara','Âl-i İmrân','Nisâ','Mâide','En’âm','A’râf','Enfâl','Tevbe','Yûnus','Hûd',
  'Yûsuf','Ra’d','İbrâhîm','Hicr','Nahl','İsrâ','Kehf','Meryem','Tâhâ','Enbiyâ','Hac','Mü’minûn',
  'Nûr','Furkân','Şuarâ','Neml','Kasas','Ankebût','Rûm','Lokmân','Secde','Ahzâb','Sebe','Fâtır',
  'Yâsîn','Sâffât','Sâd','Zümer','Mü’min (Gâfir)','Fussilet','Şûrâ','Zuhruf','Duhân','Câsiye',
  'Ahkâf','Muhammed','Fetih','Hucurât','Kâf','Zâriyât','Tûr','Necm','Kamer','Rahmân','Vâkıa',
  'Hadîd','Mücâdele','Haşr','Mümtehine','Saf','Cuma','Münâfikûn','Tegâbün','Talâk','Tahrîm','Mülk',
  'Kalem','Hâkka','Meâric','Nûh','Cin','Müzzemmil','Müddessir','Kıyâme','İnsan','Mürselât','Nebe',
  'Nâziât','Abese','Tekvîr','İnfitar','Mutaffifîn','İnşikâk','Bürûc','Târık','A’lâ','Gâşiye','Fecr',
  'Beled','Şems','Leyl','Duha','İnşirah','Tîn','Alak','Kadr','Beyyine','Zilzâl','Âdiyât','Kâria',
  'Tekâsür','Asr','Hümeze','Fîl','Kureyş','Mâûn','Kevser','Kâfirûn','Nasr','Tebbet','İhlâs',
  'Felâk','Nâs'
];

// Ayet sayıları
const AYAHS = [0,7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
 112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,
 60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,
 36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

const $ = s => document.querySelector(s);
const byKey = new Map();            // "s:a" → {sure,ayet,meal,aciklama,last}
let lastUpdated = null;
let currentSurah = null;

document.addEventListener('DOMContentLoaded', async () => {
  // UI event’leri
  $('#backBtn')?.addEventListener('click', () => goHome());
  $('#searchBox')?.addEventListener('input', () => currentSurah ? renderSurah(currentSurah) : null);

  // İlk yüklemede overlay göster
  showLoading(true);
  try {
    await loadAll();
    renderHome();
  } finally {
    showLoading(false);
  }
});

/* ===================== DATA ===================== */

async function loadAll(){
  const res = await fetch(`${API_URL}?route=all`, { cache:'no-store' });
  if (!res.ok) throw new Error('API hata: ' + res.status);
  const j = await res.json();
  byKey.clear();
  for (const x of j.rows) byKey.set(`${x.sure}:${x.ayet}`, x);
  lastUpdated = j.lastUpdated || null;
  $('#lastUpdated').textContent = lastUpdated || '—';
}

/* ===================== HOME (sûre listesi) ===================== */

function renderHome(){
  const list = $('#surahList');
  const view = $('#surahView');
  view.hidden = true; view.style.display = 'none';
  list.hidden = false; list.style.display = '';
  $('#crumbs').textContent = 'Ana sayfa';

  const fr = document.createDocumentFragment();
  for (let s=1; s<=114; s++){
    let done = 0;
    for (let a=1; a<=AYAHS[s]; a++){
      if (byKey.has(`${s}:${a}`)) done++;
    }
    const btn = document.createElement('button');
    btn.className = 'surah-btn' + (done>0 ? ' done' : '');
    btn.innerHTML = `${s} - ${NAMES[s]}${done>0 ? `<span class="sub">${done}/${AYAHS[s]} tamamlandı</span>`:''}`;
    btn.onclick = () => openSurah(s);
    fr.appendChild(btn);
  }
  list.replaceChildren(fr);
}

/* ===================== SÛRE GÖRÜNÜMÜ ===================== */

function openSurah(s){
  currentSurah = s;

  const list = $('#surahList');
  const view = $('#surahView');
  list.hidden = true;  list.style.display = 'none';
  view.hidden = false; view.style.display = '';

  $('#surahTitle').textContent = `${s} - ${NAMES[s]}`;
  $('#crumbs').innerHTML = `<a href="#" onclick="return goHome()">Ana sayfa</a> › ${s} - ${NAMES[s]}`;

  window.scrollTo({ top: 0, behavior: 'auto' });
  renderSurah(s);
}

function renderSurah(s){
  const q = ($('#searchBox')?.value || '').trim().toLowerCase();
  const wrap = $('#ayahList');
  const fr = document.createDocumentFragment();

  for (let a = 1; a <= AYAHS[s]; a++) {
    const rec = byKey.get(`${s}:${a}`);
    if (!rec) continue; // meali olmayan ayeti hiç gösterme

    const text = rec.meal || '';
    const note = rec.aciklama || '';

    if (q && !(text.toLowerCase().includes(q) || note.toLowerCase().includes(q))) continue;

    const card = document.createElement('div');
    card.className = 'ayah-card';
    card.id = `a-${s}-${a}`;

    // numara rozeti (gizli; hover/tıkla görünür)
    const num = document.createElement('span');
    num.className = 'anum';
    num.textContent = `${s}:${a}`;
    card.appendChild(num);

    // içerik – başta numarayı göstermiyoruz
    card.insertAdjacentHTML('beforeend',
      `<p dir="auto">${escapeHTML(text)}</p>` +
      (note ? `<div class="note" dir="auto">${linkify(escapeHTML(note))}</div>` : '')
    );

    // karta tıklayınca numarayı kısa süre göster
    card.addEventListener('click', (ev) => {
      if (ev.target.tagName === 'A') return; // iç link tıklandıysa karışma
      card.classList.add('shownum');
      setTimeout(()=>card.classList.remove('shownum'), 1600);
    });

    fr.appendChild(card);
  }

  wrap.replaceChildren(fr);
}

function goHome(){
  currentSurah = null;
  renderHome();
  return false;
}

/* ===================== YARDIMCILAR ===================== */

function showLoading(v){
  const el = $('#loading');
  if (!el) return;
  el.classList.toggle('show', !!v);
}

// [[3:4]]/[[3:4-6]] iç linkleri
function linkify(txt){
  return txt.replace(/\[\[\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*\]\]/g,
    (m, s, a1, a2)=>{
      s = +s; a1 = +a1;
      // hedefe kaydır + numarayı kısa süre göster
      const js = `
        openSurah(${s});
        setTimeout(()=>{
          const el = document.getElementById('a-${s}-${a1}');
          if (el){
            el.classList.add('shownum');
            el.scrollIntoView({behavior:'smooth',block:'start'});
            setTimeout(()=>el.classList.remove('shownum'), 1800);
          }
        }, 120);
        return false;`;
      return `<a href="#" onclick="${js}">${s}:${a2 ? `${a1}-${a2}` : a1}</a>`;
    });
}

function escapeHTML(s){
  return s.replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
