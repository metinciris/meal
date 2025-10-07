/*** Toplu Yapıştır: "1- metin" biçimli bloktan ayetleri içe aktar ***/

// Menüye buton
function onOpen() {
  try { createMenu_(); } catch (e) {} // zaten varsa sorun değil
  SpreadsheetApp.getUi()
    .createMenu('Meal Sistem')
    .addItem('Toplu Yapıştır (Sûre)', 'openBulkDialog')
    .addToUi();
}

// Basit dialog
function openBulkDialog() {
  var html = HtmlService.createHtmlOutput(`
    <style>
      body{font:14px system-ui;padding:10px}
      input,textarea,button{font:inherit}
      textarea{width:100%;height:360px}
      .row{margin:8px 0}
    </style>
    <div>
      <div class="row">
        <label>Sûre No (1–114):
          <input id="surah" type="number" min="1" max="114" style="width:80px">
        </label>
      </div>
      <div class="row">
        <p>Metni aşağıya yapıştır (ör. <code>1- ...</code>, <code>2- ...</code>, satır başında ayet no):</p>
        <textarea id="bulk"></textarea>
      </div>
      <div class="row">
        <button onclick="run()">İçe aktar</button>
        <span id="msg" style="margin-left:8px;color:#0a7"></span>
      </div>
    </div>
    <script>
      function run(){
        const s = +document.getElementById('surah').value;
        const t = document.getElementById('bulk').value || '';
        document.getElementById('msg').textContent = 'İşleniyor...';
        google.script.run.withSuccessHandler(function(res){
          document.getElementById('msg').textContent = res.ok
            ? ('Tamam: ' + res.count + ' ayet eklendi/güncellendi.')
            : ('Hata: ' + (res.error||''));
        }).bulkImportFromText(s, t);
      }
    </script>
  `).setWidth(540).setHeight(520);
  SpreadsheetApp.getUi().showModalDialog(html, 'Toplu Yapıştır (Sûre)');
}

/**
 * Yapıştırılan metni parse et, Normalized'a yaz, Index'i güncelle.
 * @param {number} surahNo 1..114
 * @param {string} raw block text
 */
function bulkImportFromText(surahNo, raw) {
  try {
    if (!(surahNo>=1 && surahNo<=114)) throw new Error('Sûre No 1–114 olmalı.');
    raw = (raw || '').replace(/\r/g,'').trim();
    if (!raw) throw new Error('Metin boş.');

    // satırları gez: "^\s*(\d{1,3})\s*[-–—\.]\s*(.*)$" → ayet başı
    const lines = raw.split('\n');
    const items = []; // {ayet, meal}
    let curAyah = null, buf = [];
    const headRe = /^\s*(\d{1,3})\s*[-–—\.]\s*(.*)$/;

    const flush = () => {
      if (curAyah==null) return;
      const text = buf.join(' ').replace(/\s+/g,' ').trim();
      items.push({ ayet: curAyah, meal: text });
      buf = [];
    };

    for (let i=0; i<lines.length; i++){
      const ln = lines[i].trimEnd();
      const m = ln.match(headRe);
      if (m) {
        // yeni ayet başı
        flush();
        curAyah = parseInt(m[1],10);
        const first = (m[2] || '').trim();
        buf = first ? [first] : [];
      } else {
        const t = ln.trim();
        if (t.length) buf.push(t); // boş satırları yoksay
      }
    }
    flush();

    if (!items.length) throw new Error('Ayet başı deseni bulunamadı. (Örn: "1- Metin")');

    // Yaz: Normalized upsert
    const ss = SpreadsheetApp.getActive();
    const norm = ss.getSheetByName('Normalized') ||
      ss.insertSheet('Normalized').setFrozenRows(1);
    if (norm.getLastRow()<1) {
      norm.getRange(1,1,1,6).setValues([['Key','Sure','Ayet','Meal','Açıklama','LastUpdatedISO']]);
      norm.setFrozenRows(1);
    }

    // mevcut satırları anahtara göre indexle
    const lastRow = Math.max(1, norm.getLastRow());
    const all = norm.getRange(1,1,lastRow,norm.getLastColumn()).getValues();
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
    let count = 0;

    items.forEach(it => {
      const a = it.ayet;
      const k = `${surahNo}:${a}`;
      const vals = [k, surahNo, a, it.meal, '', nowIso];
      if (key2row.has(k)) {
        norm.getRange(key2row.get(k), 1, 1, vals.length).setValues([vals]);
      } else {
        toAppend.push(vals);
      }
      count++;
    });

    if (toAppend.length) {
      norm.getRange(norm.getLastRow()+1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
    }

    // Index'i güncelle
    if (typeof refreshIndex === 'function') refreshIndex();

    return { ok:true, count };
  } catch (err) {
    return { ok:false, error: String(err) };
  }
}
