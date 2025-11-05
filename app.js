/**************** app.js — canlı JSON API + TTS ****************/
const API_URL = 'https://script.google.com/macros/s/AKfycbwxoqSvwWMYeZO2Oj4mNm8yZppFMrhPZl9K25NN89Q2zTGmuAU1ucoaitc0rM_FbzkU/exec';

const NAMES=[ '', 'Fâtiha','Bakara','Âl-i İmrân','Nisâ','Mâide','En’âm','A’râf','Enfâl','Tevbe','Yûnus','Hûd',
  'Yûsuf','Ra’d','İbrâhîm','Hicr','Nahl','İsrâ','Kehf','Meryem','Tâhâ','Enbiyâ','Hac','Mü’minûn',
  'Nûr','Furkân','Şuarâ','Neml','Kasas','Ankebût','Rûm','Lokmân','Secde','Ahzâb','Sebe','Fâtır',
  'Yâsîn','Sâffât','Sâd','Zümer','Mü’min (Gâfir)','Fussilet','Şûrâ','Zuhruf','Duhân','Câsiye',
  'Ahkâf','Muhammed','Fetih','Hucurât','Kâf','Zâriyât','Tûr','Necm','Kamer','Rahmân','Vâkıa',
  'Hadîd','Mücâdele','Haşr','Mümtehine','Saf','Cuma','Münâfikûn','Tegâbün','Talâk','Tahrîm','Mülk',
  'Kalem','Hâkka','Meâric','Nûh','Cin','Müzzemmil','Müddessir','Kıyâme','İnsan','Mürselât','Nebe',
  'Nâziât','Abese','Tekvîr','İnfitar','Mutaffifîn','İnşikâk','Bürûc','Târık','A’lâ','Gâşiye','Fecr',
  'Beled','Şems','Leyl','Duha','İnşirah','Tîn','Alak','Kadr','Beyyine','Zilzâl','Âdiyât','Kâria',
  'Tekâsür','Asr','Hümeze','Fîl','Kureyş','Mâûn','Kevser','Kâfirûn','Nasr','Tebbet','İhlâs','Felâk','Nâs' ];
const AYAHS=[0,7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

const BESMELE_TEXT=`Hepimizi ve her birimizi daima bağrına basan ve ilişkisini asla kesmeyen, her zaman iyiliğimize meyilli doğanın, can veren o gücün! Adına`;

const $=s=>document.querySelector(s);
const byKey=new Map();
let lastUpdated=null, currentSurah=null;

/* ==== TTS ==== */
const tts={
  synth: window.speechSynthesis || null,
  voice: null,
  rate: 0.8,
  queue: [],
  idx: -1,
  playing: false,
  paused: false,
  dict: { replacements: [] }
};

/* ===== Boot ===== */
document.addEventListener('DOMContentLoaded', async () => {
  $('#backBtn')?.addEventListener('click', () => { ttsStop(); return goHome(); });

  // TTS UI (tek tuş)
  $('#ttsToggle')?.addEventListener('click', onTtsToggle);
  $('#ttsRate')?.addEventListener('input', e => { tts.rate = parseFloat(e.target.value || '0.8'); });

  // Yüzen Durdur
  $('#ttsFloatStop')?.addEventListener('click', () => ttsStop(true));

  showLoading(true);
  try {
    await Promise.all([ loadAll(), initTTS(), loadTTSDict() ]);
    renderHome();
  } catch(e){
    console.error(e); alert('Veri yüklenemedi.');
  } finally {
    showLoading(false);
  }
});

/* ===== Data ===== */
async function loadAll(){
  const res = await fetch(`${API_URL}?route=all`, {cache:'no-store'});
  if (!res.ok) throw new Error('API hata: '+res.status);
  const j = await res.json();
  byKey.clear();
  for (const x of j.rows) byKey.set(`${x.sure}:${x.ayet}`, x);
  lastUpdated = j.lastUpdated || null;

  const homeLast = $('#homeLast');
  if (homeLast) homeLast.textContent = formatTRDate(lastUpdated) || '—';
}

/* ===== Home ===== */
function renderHome(){
  const list=$('#surahList'), view=$('#surahView');
  view.hidden=true; view.style.display='none';
  list.hidden=false; list.style.display='';
  const crumbs=$('#crumbs'); if (crumbs) crumbs.textContent='Ana sayfa';

  const homeLast=$('#homeLast'); if (homeLast) homeLast.textContent=formatTRDate(lastUpdated) || '—';

  const fr=document.createDocumentFragment();
  for (let s=1;s<=114;s++){
    let done=0;
    for (let a=1;a<=AYAHS[s];a++) if (byKey.has(`${s}:${a}`)) done++;
    const btn=document.createElement('button');
    btn.className='surah-btn'+(done>0?' done':'');
    btn.innerHTML=`${s} - ${NAMES[s]}${done>0?`<span class="sub">${done}/${AYAHS[s]} tamamlandı</span>`:''}`;
    btn.onclick=()=>{ ttsStop(); openSurah(s); };
    fr.appendChild(btn);
  }
  list.replaceChildren(fr);
}

/* ===== Gruplama (aynı meal, ardışık ayet) ===== */
const _norm=s=>String(s||'').trim().replace(/\s+/g,' ');
function groupSameMealsInSurah(s){
  const groups=[]; let cur=null;
  for (let a=1;a<=AYAHS[s];a++){
    const rec=byKey.get(`${s}:${a}`); if (!rec || !_norm(rec.meal)) continue;
    if (cur && cur.sure===s && cur.to+1===a && _norm(cur.meal)===_norm(rec.meal)){
      cur.to=a; if (!cur.aciklama && rec.aciklama) cur.aciklama=rec.aciklama;
    } else { if (cur) groups.push(cur); cur={sure:s,from:a,to:a,meal:rec.meal,aciklama:rec.aciklama||''}; }
  }
  if (cur) groups.push(cur);
  return groups;
}
const formatRange=g=>g.from===g.to?`${g.sure}:${g.from}`:`${g.sure}:${g.from}–${g.to}`;

/* ===== Surah View ===== */
function openSurah(s){
  currentSurah=s;
  $('#surahList').hidden=true;  $('#surahList').style.display='none';
  $('#surahView').hidden=false; $('#surahView').style.display='';
  const ttl=$('#surahTitle'); if (ttl) ttl.textContent=`${s} - ${NAMES[s]}`;
  const crumbs=$('#crumbs'); if (crumbs) crumbs.innerHTML=`<a href="#" onclick="return goHome()">Ana sayfa</a> › ${s} - ${NAMES[s]}`;
  window.scrollTo({top:0,behavior:'auto'});
  renderSurah(s);
}

function renderSurah(s){
  const wrap=$('#ayahList'); const fr=document.createDocumentFragment();

  if (s!==1){
    const b=document.createElement('div');
    b.className='ayah-card basmala';
    b.innerHTML=`<p dir="auto" class="bsm-text">${escapeHTML(BESMELE_TEXT)}</p>`;
    fr.appendChild(b);
  }

  const groups=groupSameMealsInSurah(s);
  for (const g of groups){
    const card=document.createElement('div'); card.className='ayah-card'; card.id=`a-${s}-${g.from}`;

    const num=document.createElement('span'); num.className='anum'; num.textContent=formatRange(g); card.appendChild(num);
    const text=document.createElement('p'); text.setAttribute('dir','auto'); text.textContent=g.meal||''; card.appendChild(text);

    if (g.aciklama && _norm(g.aciklama)){
      const note=document.createElement('div'); note.className='note'; note.setAttribute('dir','auto');
      note.innerHTML=linkify(escapeHTML(g.aciklama)); card.appendChild(note);
    }

    // gizli anchorlar
    for (let a=g.from;a<=g.to;a++){
      if (a===g.from) continue;
      const anchor=document.createElement('span');
      anchor.id=`a-${s}-${a}`; anchor.style.position='relative'; anchor.style.top='-64px';
      anchor.style.display='block'; anchor.style.height='0'; anchor.style.visibility='hidden';
      card.appendChild(anchor);
    }

    // karta tıklayınca o karttan başlat
    card.addEventListener('click',(ev)=>{
      if (ev.target.tagName==='A') return;
      ttsPlayFromElement(card);
      card.classList.add('shownum');
      setTimeout(()=>card.classList.remove('shownum'),1600);
    });

    fr.appendChild(card);
  }

  wrap.replaceChildren(fr);
  ttsStop(false);
}

/* ===== TTS ===== */
async function initTTS(){
  if (!tts.synth) return;
  const pick=()=>{const vs=tts.synth.getVoices(); tts.voice=vs.find(v=>/tr[-_]?TR/i.test(v.lang))||vs[0]||null;};
  pick(); if (speechSynthesis && speechSynthesis.onvoiceschanged!==undefined) speechSynthesis.onvoiceschanged=pick;
}
async function loadTTSDict(){
  try{ const res=await fetch('data/tts-dict.json',{cache:'no-store'});
    if (res.ok){ const j=await res.json(); if (j && Array.isArray(j.replacements)) tts.dict.replacements=j.replacements; }
  }catch(_){}
}
function buildTTSQueueForSurah(s){
  const cards=[...document.querySelectorAll('#ayahList .ayah-card')].filter(el=>!el.classList.contains('basmala'));
  const q=[]; for (const el of cards){ const p=el.querySelector('p'); if (!p) continue;
    const text=normalizeForTTS(p.innerText||p.textContent||''); if (!text.trim()) continue;
    q.push({id:el.id,text,el}); }
  return q;
}
function normalizeForTTS(text){
  let out=(text||'').toString();
  for (const [from,to] of (tts.dict.replacements||[])){ if (!from) continue; const re=new RegExp(escapeReg(from),'g'); out=out.replace(re,to); }
  return out;
}
function escapeReg(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

/* --- Tek tuş: Oynat/Duraklat/Devam --- */
function onTtsToggle(){
  if (!tts.synth){ alert('Tarayıcı TTS desteği bulunamadı.'); return; }

  // hiç oynamıyorsa → başlat
  if (!tts.playing){
    tts.queue=buildTTSQueueForSurah(currentSurah);
    if (!tts.queue.length){ alert('Okunacak ayet bulunamadı.'); return; }
    tts.idx=-1; tts.playing=true; tts.paused=false;
    updateTTSButtons();
    nextUtterance();
    return;
  }

  // oynuyorsa ve duraklatılmamışsa → duraklat
  if (!tts.paused){
    try{ tts.synth.pause(); }catch(_){}
    tts.paused=true;
    updateTTSButtons();
    return;
  }

  // duraklatılmışsa → devam et
  try{ tts.synth.resume(); }catch(_){}
  tts.paused=false;
  updateTTSButtons();
}

/* --- Durdur --- */
function ttsStop(resetButtons=true){
  if (tts.synth){ try{ tts.synth.cancel(); }catch(_){ } }
  unmarkReading();
  tts.playing=false; tts.paused=false; tts.idx=-1; tts.queue=[];
  if (resetButtons) updateTTSButtons();
}

/* --- Belirli karttan başlat --- */
function ttsPlayFromElement(el){
  if (!tts.synth){ alert('Tarayıcı TTS desteği bulunamadı.'); return; }
  const q=buildTTSQueueForSurah(currentSurah);
  const idx=q.findIndex(it=>it.el===el);
  if (idx===-1) return;

  if (tts.synth.speaking || tts.synth.paused){ try{ tts.synth.cancel(); }catch(_){} }
  tts.queue=q; tts.idx=idx-1; tts.playing=true; tts.paused=false;
  updateTTSButtons();
  nextUtterance();
}

/* --- Akış --- */
function nextUtterance(){
  if (!tts.playing) return;
  tts.idx++;
  if (tts.idx>=tts.queue.length){ ttsStop(true); return; }

  const item=tts.queue[tts.idx];
  const u=new SpeechSynthesisUtterance(item.text);
  u.lang=(tts.voice&&tts.voice.lang)||'tr-TR';
  u.voice=tts.voice||null;
  u.rate=tts.rate||0.8;
  u.pitch=1.0;

  unmarkReading();
  item.el.classList.add('reading');
  item.el.scrollIntoView({behavior:'smooth',block:'center'});

  u.onend=()=> nextUtterance();
  u.onerror=()=> nextUtterance();

  tts.synth.speak(u);
  updateTTSButtons();
}

function unmarkReading(){
  document.querySelectorAll('.ayah-card.reading').forEach(el=>el.classList.remove('reading'));
}

function updateTTSButtons(){
  const toggle=$('#ttsToggle');
  const floatStop=$('#ttsFloatStop');

  // Toggle metni
  if (toggle){
    let label='▶︎ Oynat', pressed='false';
    if (tts.playing && !tts.paused){ label='⏸︎ Duraklat'; pressed='true'; }
    else if (tts.playing && tts.paused){ label='▶︎ Devam'; pressed='false'; }
    toggle.textContent=label;
    toggle.setAttribute('aria-pressed', pressed);
  }

  // Yüzen Durdur görünürlüğü
  if (floatStop){
    floatStop.hidden = !tts.playing;
  }
}

/* ===== Nav & Util ===== */
function goHome(){ currentSurah=null; ttsStop(true); renderHome(); return false; }

function showLoading(v){
  const overlay=$('#loading'); if (overlay) overlay.classList.toggle('show', !!v);
  const legacy=$('#loading-state'); if (legacy) legacy.hidden=!v;
  if (v){ const empty=$('#empty-state'), error=$('#error-state'); if (empty) empty.hidden=true; if (error) error.hidden=true; }
}

function linkify(txt){
  return (txt||'').replace(/\[\[\s*(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*\]\]/g,
  (m,s,a1,a2)=>{
    s=+s; a1=+a1; a2=a2?+a2:null;
    const js=`
      ttsStop(true);
      openSurah(${s});
      setTimeout(()=>{
        const el=document.getElementById('a-${s}-${a1}');
        if (el){
          el.classList?.add?.('shownum');
          el.scrollIntoView({behavior:'smooth',block:'start'});
          setTimeout(()=>el.classList?.remove?.('shownum'),1800);
        }
      },120);
      return false;`;
    return `<a href="#" onclick="${js}">${s}:${a2?`${a1}-${a2}`:a1}</a>`;
  });
}

function escapeHTML(s){
  return (s||'').toString().replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function formatTRDate(s){
  if (!s) return ''; const d=new Date(s); if (isNaN(d)) return String(s);
  return d.toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'});
}
