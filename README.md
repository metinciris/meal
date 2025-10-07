# meal
Kuran Meal — Google Sheets + Apps Script + GitHub Pages (PWA)

Canlı örnek: **[https://metinciris.github.io/meal/](https://metinciris.github.io/meal/)**

Bu repo; Kur’an meallerini **Google Form → Google Sheets** üzerinden toplayıp, **Apps Script Web API** ile JSON olarak sunar ve **GitHub Pages** üstünde **PWA** (install edilebilir web uygulaması) olarak gösterir.

> Kaynaklar:
>
> * Kodlar (Apps Script):
>
>   * `tablolar_apps/book_order_setup.gs`
>   * `tablolar_apps/bulk_import.gs`
> * Frontend: bu repo kök dizinindeki `index.html`, `styles.css`, `app.js` (+ PWA dosyaları)

---

## 0) Hızlı kurulum yolları

* **Yol A – Fork/Copy:** Bu repoyu **Fork**’layın ya da “**Use this template**” ile kendi hesabınıza kopyalayın.
* **Yol B – ZIP:** “Code → Download ZIP” ile indirip kendi repounuza yükleyin.

> Sonra, aşağıdaki adımları izleyin: Google Sheets + Apps Script + Web App → `API_URL`’yi `app.js` içine yaz → GitHub Pages’i aç → bitti.

---

## 1) Google Sheets ve Form (veri tabanı)

1. **Yeni bir Google Sheet** oluşturun.

   * İlk sayfa adlarını kendiniz belirleyebilirsiniz; sistem **Normalized** adlı sayfayı kullanır.
   * `Normalized` sayfasının **başlıkları** şöyle olmalı:

     ```
     Key | Sure | Ayet | Meal | Açıklama | LastUpdatedISO
     ```

     * `Key`: `Sure:Ayet` (örn. `3:4`)
     * `Sure`: 1..114
     * `Ayet`: ilgili ayet numarası
     * `Meal`: meal metni
     * `Açıklama`: notlar / iç linkler (`[[2:255]]` gibi)
     * `LastUpdatedISO`: ISO tarih (Apps Script doldurur)

2. (Opsiyonel) **Google Form** açın → yanıt hedefini bu Sheet’e bağlayın.

   * Basit alanlar: `Sure`, `Ayet`, `Meal` (+ opsiyonel `Açıklama`).
   * Dilerseniz sadece **sahip** doldurabilecek şekilde kısıtlayın (Form ayarlarından).
   * Bizim akışta zorunlu değil; bulk import da mevcut.

---

## 2) Apps Script: otomasyon & Web API

Sheet içinde **Extensions → Apps Script** deyin, aşağıdaki dosyaları ekleyin:

* `book_order_setup.gs` (index ve temel kurulum fonksiyonları)
* `bulk_import.gs` (Toplu Yapıştır aracı: “1- … 2- …” bloklarını ayete çevirir)
* **Ek olarak** şu mini API dosyasını ekleyin (eğer yoksa):

```javascript
/** api.gs — Normalized → JSON Web API */
const API_CFG = { SHEET_ID: SpreadsheetApp.getActiveSpreadsheet().getId(), SHEET_NAME: 'Normalized' };

function doGet(e) {
  const ss = SpreadsheetApp.openById(API_CFG.SHEET_ID);
  const sh = ss.getSheetByName(API_CFG.SHEET_NAME);
  if (!sh) return ContentService.createTextOutput('{"error":"Normalized yok"}').setMimeType(ContentService.MimeType.JSON);

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return ContentService.createTextOutput('{"rows":[],"lastUpdated":null}').setMimeType(ContentService.MimeType.JSON);

  const head = values[0];
  const ix = name => head.indexOf(name);
  const I = { Sure: ix('Sure'), Ayet: ix('Ayet'), Meal: ix('Meal'), Acik: ix('Açıklama'), Last: ix('LastUpdatedISO') };

  // En güncel kayıt: aynı (Sure:Ayet) için Last büyük olanı al
  const latest = new Map();
  for (let i=1;i<values.length;i++){
    const r = values[i];
    const s = +r[I.Sure], a = +r[I.Ayet];
    if (!s || !a) continue;
    const key = `${s}:${a}`;
    const obj = { sure:s, ayet:a, meal:String(r[I.Meal]||''), aciklama:String(r[I.Acik]||''), last:String(r[I.Last]||'') };
    const prev = latest.get(key);
    if (!prev || (obj.last && obj.last > prev.last)) latest.set(key, obj);
  }
  const rows = [...latest.values()];
  const lastUpdated = rows.reduce((m,x)=> m && m>x.last ? m : x.last, null);

  return ContentService.createTextOutput(JSON.stringify({ rows, lastUpdated }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 2.1 Toplu Yapıştır (tek tek form doldurmaya gerek yok)

* Sheet açılınca menüde **Meal Sistem → Toplu Yapıştır (Sûre)** gelir.
* Bir diyalog açılır: Sûre No (1–114) girin → alana metni **blok halinde** yapıştırın:

  ```
  1- İlk ayetin meali...
  2- İkinci ayetin meali...
  3- ...
  ```

  * “numara + ayraç” ile başlayan satırlar ayet başı kabul edilir (`-`, `–`, `—`, `.` destekli).
  * Numara olmayan satırlar **üstteki ayete eklenir** (paragraf birleştirme).
* “İçe aktar” deyin; `Normalized`’a yazılır ve **varsa aynı ayete overwrite** eder.

### 2.2 Web App olarak yayınla

* Apps Script → **Deploy → New deployment → Web app**

  * **Execute as:** *Me*
  * **Who has access:** *Anyone*
* Çıkan **/exec** ile biten URL’yi kopyalayın. (Örn. `https://script.google.com/macros/s/.../exec`)

---

## 3) Frontend (GitHub Pages)

1. Bu repoyu kendi hesabınıza alın (Fork/Template).
2. `app.js` içinde **`API_URL`** değişkenine **/exec** URL’nizi yazın:

   ```js
   const API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```
3. **GitHub Pages**’i açın:
   Repo → Settings → Pages → **Branch: `main`**, `/ (root)` → **Save**
   Yayınlandığında sayfanız: `https://<kullanici>.github.io/<repo>/`

### 3.1 Telaffuz sözlüğü (opsiyonel)

* `data/tts-dict.json` oluşturun:

  ```json
  {
    "replacements": [
      ["Âl-i", "Ali"],
      ["Yûnus", "Yunus"],
      ["Mü’min", "Mümin"],
      ["Rahmân", "Rahman"]
    ]
  }
  ```
* Okuyucu (Web Speech API) metni bu sözlüğe göre normalize eder.

---

## 4) PWA (Uygulama gibi yüklenebilir)

PWA görünmesi için **3 dosya** ve doğru bağlantılar gerekir:

1. **`manifest.webmanifest`** (kök dizinde)

```json
{
  "name": "Kuran Meal",
  "short_name": "Meal",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#111827",
  "theme_color": "#111827",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

2. **`sw.js`** (kök dizinde — basit bir servis işçisi)

```js
/* very small SW: cache-first for assets, network-first for API */
const CACHE = 'meal-v1';
const ASSETS = [
  './', './index.html', './styles.css', './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // API istekleri (network-first)
  if (url.href.includes('/macros/s/')) {
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
    return;
  }
  // Diğer her şey: cache-first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
```

3. **`index.html`** içine linkler ve SW kaydı

```html
<!-- <head> içinde: -->
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<meta name="theme-color" content="#111827">
<!-- (iOS için) -->
<link rel="apple-touch-icon" href="icons/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">

<!-- </body> kapanışından önce veya app.js içinde: -->
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
</script>
```

> **İkonlar:** `icons/icon-192.png`, `icons/icon-512.png` ve opsiyonel `icons/maskable-512.png` dosyalarını gerçekten koymalısınız (şeffaf PNG önerilir).
> **MIME tipleri:** GitHub Pages `manifest.webmanifest` için doğru `Content-Type` gönderir; dosya adının `.webmanifest` olduğuna dikkat edin.

### PWA görünmüyorsa (Checklist)

* [ ] `manifest.webmanifest` dosyası var ve **`index.html` içinde linklenmiş**.
* [ ] `sw.js` var ve **kayıt** ediliyor.
* [ ] **HTTPS** (GitHub Pages bunu sağlar).
* [ ] En az **192×192** ve **512×512** PNG ikonlar gerçekten mevcut.
* [ ] `start_url` / `scope` yolları doğru (`./`).
* [ ] Tarayıcıda **Uygulama yüklenebilir** uyarısı için sayfayı bir iki kez açıp etkileşime girin. (Chrome: URL çubuğundaki “Yükle” simgesi)
* [ ] iOS’ta “Ana Ekrana Ekle” için `apple-touch-icon` ve `display=standalone` gerekir (manifest + meta’lar tamam).
* [ ] Değişiklik sonrası **hard refresh** yapın (Ctrl+F5 / Cmd+Shift+R) ve **eski SW’yi kaldırın** (DevTools → Application → Service Workers → Unregister).

---

## 5) Özellikler (kısaca)

* **Kitap (Mushaf) sırası** görünümü
* **Sadece meali olan ayetler** sûrede listelenir (boşlar gizli)
* **İç link söz dizimi**: `[[2:255]]` veya `[[2:255-257]]`
* **Ayet numarası rozeti**: gizli; hover/tıkla görünür
* **Toplu yapıştır** (sûre bazında): tek seferde onlarca ayet
* **TTS (Tarayıcı okuma)**: Sırayla oku, **Play / Pause / Stop**, **Hız** ayarı, **telaffuz sözlüğü**
* **PWA**: offline önbellekleme, install edilebilir

---

## 6) SSS / Sorun Giderme

* **“API çalışıyor ama site veri çekmiyor”**

  * Apps Script **Web app** olarak yayınlandı mı? `/exec` ile biten link mi?
  * Erişim “**Anyone**” mı? (Kurumsal Workspace kısıtlıysa yöneticiye sorun.)
* **Toplu Yapıştır “desen bulunamadı”**

  * Satırlar “`1- …`”, “`2 - …`”, “`3. …`” gibi **numara + ayraç** ile başlamalı.
* **PWA görünmüyor**

  * Manifest/ikon/servis worker linkleri doğru mu?
  * İkon PNG’leri gerçekten doğru boyutta ve doğru dizinde mi?
  * Hard refresh + eski SW’yi unregister yaptınız mı?

---

## 7) Lisans / Katkı

* Kendi içerik lisansınızı ekleyin (örn. MIT).
* PR’lar ve öneriler memnuniyetle.

---

### Notlar size özel

* Şu an canlı demo: **[https://metinciris.github.io/meal/](https://metinciris.github.io/meal/)**
* Apps Script dosyalarınız:

  * `book_order_setup.gs` — index ve sayfa hazırlıkları
  * `bulk_import.gs` — “Toplu Yapıştır (Sûre)” diyaloğu
* İsterseniz `manifest.webmanifest`, `sw.js` ve `icons/` klasörünü ekleyin; **PWA** anında “uygulama gibi” yüklenir.

