/****** Basit, şık UI + canlı JSON API ******/
const API_URL = 'https://script.google.com/macros/s/AKfycbwxoqSvwWMYeZO2Oj4mNm8yZppFMrhPZl9K25NN89Q2zTGmuAU1ucoaitc0rM_FbzkU/exec'; // ← buraya Web App (exec) URL'ni koy

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
const byKey = new Map(); // "s:a" → {sure,ayet,meal,aciklama,last}
let lastUpdated = null;

document.addEventListener('DOMContentLoaded', async () => {
  $('#backBtn').addEventListener('click', () => goHome());
  $('#searchBox').addEventListener('input', () => renderSurah(currentSurah));
  await loadAll(); // ilk yüklemede hepsini al
  renderHome();
});

async function loadAll(){
  const url = `${API_URL}?route=all`;
  const res = await fetch(url, { cache:'no-store' });
  const j = await res.json();
  byKey.clear();
  for (const x of j.rows) byKey.set(`${x.sure}:${x.ayet}`, x);
  lastUpdated = j.lastUpdated || null;
  $('#lastUpdated').textContent = lastUpdated || '—';
}

/* ------------ Home (sûre listesi) ------------ */
function renderHome(){
  const list = $('#surahList');
  $('#surahView').hidden = true;
  list.hidden = false;

  // breadcrumb
  $('#crumbs').innerHTML = `Ana sayfa`;

  const fr = document.createDocumentFragment();
  for (let s=1; s<=114; s++){
    // tamamlanan ayet sayısı
    let done = 0;
    for (let a=1; a<=AYAHS[s]; a++) if (byKey.has(`${s}:${a}`)) done++;

    const btn = document.createElement('button');
    btn.className = 'surah-btn' + (done>0 ? ' done' : '');
    btn.innerHTML = `${s} - ${NAMES[s]}${done>0 ? `<span class="sub">${done}/${AYAHS[s]} tamamlandı</span>`:''}`;
    btn.onclick = () => openSurah(s);
    fr.appendChild(btn);
  }
  list.replaceChildren(fr);
}

/* ------------ Sûre görünümü ------------ */
function openSurah(s){
  currentSurah = s;

  // listeyi tamamen gizle, sûre görünümünü göster
  const list = document.querySelector('#surahList');
  const view = document.querySelector('#surahView');
  list.hidden = true;
  list.style.display = 'none';
  view.hidden = false;
  view.style.display = '';

  // başlık & breadcrumb
  document.querySelector('#surahTitle').textContent = `${s} - ${NAMES[s]}`;
  document.querySelector('#crumbs').innerHTML =
    `<a href="#" onclick="return goHome()">Ana sayfa</a> › ${s} - ${NAMES[s]}`;

  // en üste kaydır
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

  renderSurah(s);
}


function renderSurah(s){
  const q = ($('#searchBox').value || '').trim().toLowerCase();
  const wrap = $('#ayahList');
  const fr = document.createDocumentFragment();

  for (let a=1; a<=AYAHS[s]; a++){
    const rec = byKey.get(`${s}:${a}`);
    const has = !!rec;
    const text = rec ? (rec.meal || '') : '';
    const note = rec ? (rec.aciklama || '') : '';

    if (q && !(text.toLowerCase().includes(q) || note.toLowerCase().includes(q))) continue;

    const card = document.createElement('div');
    card.className = 'ayah-card';
    card.innerHTML = has
      ? `<h3>${s}:${a}</h3><p dir="auto">${escapeHTML(text)}</p>${note ? `<div class="note" dir="auto">${linkify(escapeHTML(note))}</div>`:''}`
      : `<h3>${s}:${a}</h3><p class="note">Bu ayetin meali henüz girilmemiş.</p>`;
    fr.appendChild(card);
  }
  wrap.replaceChildren(fr);
}

function goHome(){
  currentSurah = null;
  renderHome();
  return false;
}

/* ------------ Yardımcılar ------------ */
function linkify(txt){
  // [[2:255]] veya [[2:255-257]]
  return txt.replace(/\[\[\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*\]\]/g,
    (m, s, a1, a2)=>{
      s=+s; a1=+a1; a2=a2?+a2:null;
      return a2
        ? `<a href="#" onclick="openSurah(${s}); setTimeout(()=>document.querySelector('.ayah-card h3:contains(${s}:${a1})'),0)">${s}:${a1}-${a2}</a>`
        : `<a href="#" onclick="openSurah(${s});">${s}:${a1}</a>`;
    });
}
function escapeHTML(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
