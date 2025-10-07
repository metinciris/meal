/*** Kitap (Mushaf) Sırası – Minimal Kurulum
 *  Form alanları: Sure No, Ayet Başlangıç, Ayet Bitiş (ops.), Meal Metni, Açıklama/Not
 *  Email/tarih/sıralama yok. Nüzul ve varyantlar web tarafında ele alınacak.
 ***/

const CFG = {
  SHEET_NORMALIZED: 'Normalized',
  SHEET_INDEX: 'Index',
  MENU: 'Meal Sistem',
  FORM_TITLE: 'Kuran Meal Girişi (Kitap Sırası)',
  PROP_ENTRIES_NAME: 'ENTRIES_SHEET_NAME',
  PROP_INDEX_POS: 'INDEX_WRITE_POS'
};

// 1–114 sure ayet sayıları (index 1=Fâtiha; [0] boş)
const AYAHS_PER_SURAH = [0,
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,
  59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,
  52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,
  21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6
];

/* ========== MENÜ ========== */
function onOpen() { createMenu_(); }
function createMenu_() {
  SpreadsheetApp.getUi()
    .createMenu(CFG.MENU)
    .addItem('Kurulum (Formu oluştur + bağla)', 'setupBookOrder')
    .addItem('Index’i Oluştur (parçalı)', 'buildIndexChunked')
    .addItem('Index durumunu güncelle', 'refreshIndex')
    .addSeparator()
    .addItem('Son form yanıtını normalize et', 'normalizeLastEntry')
    .addItem('Tüm Entries → Normalized yeniden kur', 'rebuildNormalizedFromEntries')
    .addSeparator()
    .addItem('Baştan Sıfırla', 'resetProject')
    .addToUi();
}

/* ========== KURULUM ========== */
// Yeni Form oluşturur, bu tabloya bağlar; Normalized ve Index başlıklarını hazırlar.
function setupBookOrder() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Form
  const form = FormApp.create(CFG.FORM_TITLE);
  form.setDescription(makeFormDescription_());
  form.setCollectEmail(false);
  form.setAllowResponseEdits(true);
  form.setLimitOneResponsePerUser(true);
  try { form.setRequireLogin(true); } catch (e) { /* kişisel hesapta yoksa sorun değil */ }

  form.addTextItem().setTitle('Sure No').setHelpText('1–114').setRequired(true);
  form.addTextItem().setTitle('Ayet Başlangıç').setHelpText('örn. 255').setRequired(true);
  form.addTextItem().setTitle('Ayet Bitiş (opsiyonel)').setHelpText('boşsa başlangıçla aynı');
  form.addParagraphTextItem().setTitle('Meal Metni').setRequired(true);
  form.addParagraphTextItem()
      .setTitle('Açıklama / Not (opsiyonel)')
      .setHelpText('İç link yazımı: [[2:255]] veya [[2:255-257]]');

  // Yanıtlar bu Sheet’e
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // Yanıt sayfasının gerçek adını bul ve kaydet (yeniden adlandırma yok → çakışma yok)
  Utilities.sleep(1200);
  const resp = findEntriesSheet_(ss);
  if (!resp) throw new Error('Form yanıt sayfası bulunamadı.');
  PropertiesService.getScriptProperties().setProperty(CFG.PROP_ENTRIES_NAME, resp.getName());

  // Normalized & Index başlık
  getOrCreateSheet_(ss, CFG.SHEET_NORMALIZED, ['Key','Sure','Ayet','Meal','Açıklama','LastUpdatedISO']);
  getOrCreateSheet_(ss, CFG.SHEET_INDEX, ['Sure','Ayet','HasMeal','LastUpdatedISO']);

  ensureSubmitTrigger_(ss);

  const editUrl = form.getEditUrl();
  const liveUrl = form.getPublishedUrl();
  Logger.log('Form düzenleme linki: ' + editUrl);
  Logger.log('Form kullanıcı linki: ' + liveUrl);
  SpreadsheetApp.getUi().alert(
    'Form oluşturuldu ve bu tabloya bağlandı.\n\n' +
    'Düzenleme: ' + editUrl + '\n' +
    'Kullanıcı linki: ' + liveUrl + '\n\n' +
    'Menüden "Index’i Oluştur (parçalı)" → tamamlayın, sonra deneme yanıtı girin.'
  );
}

/* ========== SIFIRLAMA ========== */
function resetProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  deleteSheetIfExists_(ss, CFG.SHEET_NORMALIZED);
  deleteSheetIfExists_(ss, CFG.SHEET_INDEX);
  PropertiesService.getScriptProperties().deleteProperty(CFG.PROP_ENTRIES_NAME);
  PropertiesService.getScriptProperties().deleteProperty(CFG.PROP_INDEX_POS);
  SpreadsheetApp.getUi().alert('Sıfırlandı. "Kurulum" ile tekrar başlatabilirsiniz.');
}

/* ========== YARDIMCILAR ========== */
function getOrCreateSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  } else {
    sh.clear(); // tertemiz başla
  }
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  return sh;
}

function deleteSheetIfExists_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (sh) ss.deleteSheet(sh);
}

function ensureSubmitTrigger_(ss) {
  const t = ScriptApp.getProjectTriggers().filter(x => x.getHandlerFunction()==='onFormSubmitHandler');
  if (!t.length) {
    ScriptApp.newTrigger('onFormSubmitHandler').forSpreadsheet(ss).onFormSubmit().create();
  }
}

function findEntriesSheet_(ss) {
  // Başlıklara göre (TR/EN) yanıt sayfası tespiti
  const must = ['Sure No','Ayet Başlangıç','Meal Metni'];
  for (const sh of ss.getSheets()) {
    const lc = Math.max(1, sh.getLastColumn());
    const head = sh.getRange(1,1,1,lc).getValues()[0].map(v => (v||'').toString().trim());
    const ok = must.every(h => head.includes(h));
    if (ok) return sh;
  }
  // Yine bulunamazsa isme göre kaba tahmin
  return ss.getSheets().find(sh => /^Form (Yanıtları|Responses)/i.test(sh.getName())) || null;
}

function getEntriesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const saved = PropertiesService.getScriptProperties().getProperty(CFG.PROP_ENTRIES_NAME);
  if (saved) {
    const sh = ss.getSheetByName(saved);
    if (sh) return sh;
  }
  return findEntriesSheet_(ss);
}

/* ========== FORM SUBMIT ========== */
// Her yeni yanıtı ayet bazına “normalize” eder (aralık girdiyse böler) ve Index’i günceller.
function onFormSubmitHandler(e) {
  processEntry_(e.namedValues);
  refreshIndex();
}

/* ========== NORMALIZE ========== */
function processEntry_(namedValues, silent=false) {
  const get = k => (namedValues[k] || '').toString().trim();
  const sure = parseInt(get('Sure No'), 10);
  const a1 = parseInt(get('Ayet Başlangıç'), 10);
  const a2s = get('Ayet Bitiş (opsiyonel)');
  const a2 = a2s ? parseInt(a2s, 10) : a1;
  const meal = get('Meal Metni');
  const acik = get('Açıklama / Not (opsiyonel)');

  if (!sure || sure<1 || sure>114) throw new Error('Sure No 1–114 olmalı');
  const maxA = AYAHS_PER_SURAH[sure];
  const start = Math.max(1, Math.min(a1, a2));
  const end   = Math.min(maxA, Math.max(a1, a2));

  const ss = SpreadsheetApp.getActive();
  const norm = ss.getSheetByName(CFG.SHEET_NORMALIZED) ||
               getOrCreateSheet_(ss, CFG.SHEET_NORMALIZED, ['Key','Sure','Ayet','Meal','Açıklama','LastUpdatedISO']);

  // Mevcut anahtarları (Key=sure:ayet) topla
  const all = norm.getRange(1,1,Math.max(1,norm.getLastRow()), norm.getLastColumn()).getValues();
  const head = all[0]; const rows = all.slice(1);
  const idx = {
    Key: head.indexOf('Key')+1,
    Sure: head.indexOf('Sure')+1,
    Ayet: head.indexOf('Ayet')+1,
    Meal: head.indexOf('Meal')+1,
    Acik: head.indexOf('Açıklama')+1,
    Last: head.indexOf('LastUpdatedISO')+1
  };
  const key2row = new Map();
  rows.forEach((r,i)=>{ const k=r[idx.Key-1]; if (k) key2row.set(k, i+2); });

  const nowIso = new Date().toISOString();
  const toAppend = [];
  for (let a=start; a<=end; a++) {
    const key = `${sure}:${a}`;
    const vals = [key, sure, a, meal, acik, nowIso];
    if (key2row.has(key)) {
      norm.getRange(key2row.get(key), 1, 1, vals.length).setValues([vals]);
    } else {
      toAppend.push(vals);
    }
  }
  if (toAppend.length) {
    norm.getRange(norm.getLastRow()+1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
  }
  if (!silent) Logger.log(`Normalize: ${sure}:${start}-${end}`);
}

/* ========== INDEX GÜNCELLE ========== */
function refreshIndex() {
  const ss = SpreadsheetApp.getActive();
  const norm = ss.getSheetByName(CFG.SHEET_NORMALIZED);
  const idx = ss.getSheetByName(CFG.SHEET_INDEX);
  if (!norm || !idx) return;

  const nRows = Math.max(0, norm.getLastRow()-1);
  const nAll = nRows ? norm.getRange(2,1,nRows,norm.getLastColumn()).getValues() : [];
  const latest = new Map(); // "s:a" -> lastISO
  nAll.forEach(r => {
    const s=r[1], a=r[2], last=r[5]||'';
    if (!s||!a) return;
    const k=`${s}:${a}`;
    const prev = latest.get(k);
    latest.set(k, (!prev || last>prev) ? last : prev);
  });

  const count = Math.max(0, idx.getLastRow()-1);
  if (!count) return;
  const vals = idx.getRange(2,1,count,4).getValues();
  for (let i=0;i<count;i++){
    const s=vals[i][0], a=vals[i][1], k=`${s}:${a}`;
    if (latest.has(k)) { vals[i][2]='1'; vals[i][3]=latest.get(k); }
    else { vals[i][2]=''; /* boş */ }
  }
  idx.getRange(2,1,count,4).setValues(vals);
}

/* ========== INDEXİ PARÇALI YAZ (İLK KURULUM) ========== */
function buildIndexChunked() {
  const ss = SpreadsheetApp.getActive();
  const idx = ss.getSheetByName(CFG.SHEET_INDEX) ||
              getOrCreateSheet_(ss, CFG.SHEET_INDEX, ['Sure','Ayet','HasMeal','LastUpdatedISO']);

  // Tüm (sure,ayet) çiftleri
  const PAIRS = [];
  for (let s = 1; s <= 114; s++) {
    for (let a = 1; a <= AYAHS_PER_SURAH[s]; a++) {
      PAIRS.push([s, a, '', '']);
    }
  }

  const props = PropertiesService.getScriptProperties();
  let pos = parseInt(props.getProperty(CFG.PROP_INDEX_POS) || '0', 10);
  const currentRows = Math.max(0, idx.getLastRow() - 1);
  if (currentRows === 0 && pos > 0) pos = 0;

  const CHUNK_SIZE = 1200;
  const end = Math.min(PAIRS.length, pos + CHUNK_SIZE);
  const slice = PAIRS.slice(pos, end);

  if (!slice.length) {
    SpreadsheetApp.getUi().alert('Index tamamlandı.');
    return;
  }

  if (pos === 0 && currentRows === 0) {
    idx.getRange(2, 1, slice.length, 4).setValues(slice);
  } else {
    idx.getRange(idx.getLastRow() + 1, 1, slice.length, 4).setValues(slice);
  }

  // ⇩⇩ HATA DÜZELTİLDİ ⇩⇩
  props.setProperty(CFG.PROP_INDEX_POS, String(end));

  SpreadsheetApp.getUi().alert(`Index yazılıyor: ${end}/${PAIRS.length}. Tekrar çalıştırarak tamamlayın.`);
}

/* ========== TOPLU YENİDEN KUR (opsiyonel) ========== */
function rebuildNormalizedFromEntries() {
  const ss = SpreadsheetApp.getActive();
  const entries = getEntriesSheet_();
  if (!entries) { SpreadsheetApp.getUi().alert('Yanıt sayfası bulunamadı.'); return; }

  const norm = ss.getSheetByName(CFG.SHEET_NORMALIZED) ||
               getOrCreateSheet_(ss, CFG.SHEET_NORMALIZED, ['Key','Sure','Ayet','Meal','Açıklama','LastUpdatedISO']);
  if (norm.getLastRow()>1) norm.getRange(2,1,norm.getLastRow()-1,norm.getLastColumn()).clearContent();

  const dataRows = Math.max(0, entries.getLastRow()-1);
  if (!dataRows) { SpreadsheetApp.getUi().alert('Entries boş.'); return; }

  const headers = entries.getRange(1,1,1,entries.getLastColumn()).getValues()[0];
  for (let r=2; r<=entries.getLastRow(); r++){
    const row = entries.getRange(r,1,1,headers.length).getValues()[0];
    const named = {}; headers.forEach((h,i)=>named[h]=row[i]);
    processEntry_(named, /*silent*/ true);
  }
  refreshIndex();
}

/* ========== FORM AÇIKLAMASI (sûre listesi dahil) ========== */
function makeFormDescription_() {
  const base = [
    'Bu form kitap (Mushaf) sırasına göre meal girişleri içindir.',
    'İç link yazımı (açıklama alanı): [[2:255]] veya [[2:255-257]]',
    '',
    'Alanlar:',
    '• Sure No: 1–114',
    '• Ayet Başlangıç / Ayet Bitiş (opsiyonel)',
    '• Meal Metni',
    '• Açıklama / Not (opsiyonel)',
    '',
    'Sûre numarası → adı:'
  ].join('\n');
  return base + '\n' + surahLegend_();
}

function surahLegend_() {
  const names = [
    '', '1 Fâtiha','2 Bakara','3 Âl-i İmrân','4 Nisâ','5 Mâide','6 En’âm','7 A’râf','8 Enfâl',
    '9 Tevbe','10 Yûnus','11 Hûd','12 Yûsuf','13 Ra’d','14 İbrâhîm','15 Hicr','16 Nahl','17 İsrâ',
    '18 Kehf','19 Meryem','20 Tâhâ','21 Enbiyâ','22 Hac','23 Mü’minûn','24 Nûr','25 Furkân',
    '26 Şuarâ','27 Neml','28 Kasas','29 Ankebût','30 Rûm','31 Lokmân','32 Secde','33 Ahzâb',
    '34 Sebe','35 Fâtır','36 Yâsîn','37 Sâffât','38 Sâd','39 Zümer','40 Mü’min (Gâfir)',
    '41 Fussilet','42 Şûrâ','43 Zuhruf','44 Duhân','45 Câsiye','46 Ahkâf','47 Muhammed','48 Fetih',
    '49 Hucurât','50 Kâf','51 Zâriyât','52 Tûr','53 Necm','54 Kamer','55 Rahmân','56 Vâkıa',
    '57 Hadîd','58 Mücâdele','59 Haşr','60 Mümtehine','61 Saf','62 Cuma','63 Münâfikûn','64 Tegâbün',
    '65 Talâk','66 Tahrîm','67 Mülk','68 Kalem','69 Hâkka','70 Meâric','71 Nûh','72 Cin',
    '73 Müzzemmil','74 Müddessir','75 Kıyâme','76 İnsan','77 Mürselât','78 Nebe','79 Nâziât',
    '80 Abese','81 Tekvîr','82 İnfitar','83 Mutaffifîn','84 İnşikâk','85 Bürûc','86 Târık','87 A’lâ',
    '88 Gâşiye','89 Fecr','90 Beled','91 Şems','92 Leyl','93 Duha','94 İnşirah','95 Tîn','96 Alak',
    '97 Kadr','98 Beyyine','99 Zilzâl','100 Âdiyât','101 Kâria','102 Tekâsür','103 Asr','104 Hümeze',
    '105 Fîl','106 Kureyş','107 Mâûn','108 Kevser','109 Kâfirûn','110 Nasr','111 Tebbet','112 İhlâs',
    '113 Felâk','114 Nâs'
  ];
  const out=[]; let row=[];
  for (let i=1;i<=114;i++){ row.push(names[i]); if (row.length===6 || i===114){ out.push('• '+row.join(' — ')); row=[]; } }
  return out.join('\n');
}
