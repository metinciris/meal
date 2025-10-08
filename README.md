# Kuran’ın Gölgesinde — Meal Paylaşım Sistemi

**Ayhan KIRMIZI’nın *Kuran’ın Gölgesinde* eserinden faydalanılmıştır.**

Basitçe: Mealleri **Google Sheets**’te tut, **Apps Script Web API** ile JSON olarak sun, **GitHub Pages (PWA)** ile şık bir arayüzde göster.
Canlı örnek: **[https://metinciris.github.io/meal/](https://metinciris.github.io/meal/)**

---

## Özellikler (kısa)

* Kitap (mushaf) sırası görünümü
* Sadece meali olan ayetler listelenir (boşlar gizlenir)
* Sûre içinde **besmele kartı** (Fâtiha hariç)
* **Toplu yapıştır** ile tek seferde onlarca ayet ekleme (1- …, 2- … biçimi)
* İstersen **Google Form** ile tek tek giriş
* İç link desteği: `[[2:255]]`, `[[2:255-257]]`
* **TTS** (tarayıcıdan sesli okuma): Başlat/Durdur, hız (0.5–1.2), telaffuz sözlüğü
* **PWA** (install edilebilir): offline önbellek, ikon/splash

---

## Hızlı Başla (Fork/Copy)

1. Bu repoyu **Fork**la veya “**Use this template**” ile kendi hesabına kopyala.
2. Aşağıdaki **Kurulum** adımlarını uygula (Google Sheet + Apps Script + Web App).
3. `app.js` içindeki `API_URL`’ye kendi **/exec** adresini yaz.
4. GitHub Pages’i aç: **Settings → Pages → Branch: `main`**.

---

## Kurulum — Adım Adım (hiçbir şeyi atlamadan)

### 1) Google Sheet’i oluştur

* Google Drive → **Yeni → Google E-Tablolar** (boş sayfa).
* Bir sayfayı **Normalized** olarak adlandır (yoksa eklenecek).
* Başlık satırı şöyle olmalı:

  ```
  Key | Sure | Ayet | Meal | Açıklama | LastUpdatedISO
  ```

  * **Key** = `Sure:Ayet` (örn. `3:4`)
  * **Sure** = 1..114
  * **Ayet** = ayet no
  * **Meal** = meal metni
  * **Açıklama** = not/yorum/iç link
  * **LastUpdatedISO** = ISO tarih (Apps Script yazar)

> İpucu: Henüz boş bırakman sorun değil; birazdan Apps Script dosyaları gerekli sayfaları ve başlıkları zaten hazırlar.

---

### 2) Apps Script’i ekle (iki dosya)

Sheet açıkken **Extensions → Apps Script**:

* Bu klasörden iki dosyayı ekle:

  * `tablolar_apps/book_order_setup.gs`
  * `tablolar_apps/bulk_import.gs`
    *(script editöründe **New file** diyerek isimleri aynen verip içeriklerini yapıştır)*

> Bu iki dosya; **menüleri ekler**, **Normalized**’ı hazırlar, **Toplu Yapıştır** penceresini sunar ve indeksleri yeniler.

---

### 3) Basit Web API (JSON çıkış) dosyasını ekle

Apps Script’te **yeni dosya** oluştur, adını `api.gs` koy ve içeriği aynen yapıştır:

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

  const latest = new Map(); // aynı ayette en günceli seç
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

> **Kendi tablonun adresini nereye yazacağım?**
> Yukarıda `SHEET_ID` otomatik olarak **aktif dosyadan** alınıyor. Eğer farklı bir dosyayı okumak istersen: `SHEET_ID: 'SENİN_SHEET_ID’` şeklinde **elle** yazabilirsin.
> `SENİN_SHEET_ID` = Sheet URL’inde `/d/` ile `/edit` arasındaki uzun ID.

---

### 4) Web App olarak yayınla (çok kritik)

Apps Script → **Deploy → New deployment → Web app**

* **Execute as:** **Me**
* **Who has access:** **Anyone**
* **Deploy** → çıkan URL’yi kopyala (şu biçimde biter: `.../exec`)

> Not: Kurumsal Workspace’te “Anyone” seçeneği yoksa yöneticiden dış erişim izni iste veya bir proxy kullan.

---

### 5) GitHub Pages (frontend) — API URL’ini bağla

* Repo’yu kendi hesabına **fork**la veya template olarak oluştur.
* **`app.js`** içinde en üstteki `API_URL`’i kendi **/exec** adresinle değiştir:

  ```js
  const API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
  ```
* **Settings → Pages → Branch: `main`** → Kaydet.

> **PWA istiyorsan** kökte `manifest.webmanifest`, `sw.js` ve `icons/` (192/512 PNG) dosyaları bulunmalı; `index.html` içinde manifest linki ve service worker kaydı olmalı. (Bu repo örneğinde var.)

---

## Meali ekleme yolları

### A) Toplu yapıştır (önerilir — hızlı)

Sheet açık → **Meal Sistem → Toplu Yapıştır (Sûre)**

* Açılan pencerede **Sûre No (1–114)** yaz.
* Büyük metni **blok halinde** yapıştır:

  ```
  1- Birinci ayetin meali...
  2- İkinci ayetin meali...
  3- ...
  ```

  * `1-`, `2 -`, `3.`, `4 —` gibi varyantlar **ayet başı** sayılır.
  * Numara olmayan satırlar **üstteki ayete eklenir** (paragraf birleştirir).
* **İçe aktar** → `Normalized` sayfasına yazar (varsa üzerine günceller).

### B) Google Form (tek tek, daha kontrollü)

* Basit bir form oluştur (Sürê No, Ayet No, Meal, [Açıklama]).
* **Yanıtlar** sekmesinden bu **Sheet’e bağla**.
* Form ayarlarından “sadece ben doldurabilirim”/“kurum içi” gibi kısıtlar koyabilirsin.

> Uygulama tarafında yalnızca **API’nin döndürdüğü mealler** görünür; yani ister formdan, ister toplu yapıştırdan gelsin, `Normalized`’a düşmesi yeterlidir.

---

## Kendi tablonun adresi/ID’si nereye yazılıyor?

* **API tarafı**: `api.gs`’de varsayılan olarak **aktif Sheet** kullanılır (hiçbir şey yapmasan da olur). Başka bir Sheet’i hedeflemek istersen:

  ```js
  const API_CFG = { SHEET_ID: 'BURAYA_SENİN_SHEET_ID', SHEET_NAME: 'Normalized' };
  ```

  Sheet ID, Sheet URL’inde `/d/` ile `/edit` arasındaki uzun metindir.

* **Web (site) tarafı**: Sadece **`app.js` → `API_URL`**.

  ```js
  const API_URL = 'https://script.google.com/macros/s/.../exec';
  ```

  Bunu kendi Web App `/exec` linkinle değiştirmen **şart**.

---

## PWA (opsiyonel ama tavsiye)

* `manifest.webmanifest` içindeki `start_url` ve `scope` değerleri `"./"` olmalı.
* `index.html` `<head>`’de:

  ```html
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#111827">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  ```
* `sw.js` kayıt:

  ```html
  <script>
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  </script>
  ```
* İkonlar: `icons/icon-192.png`, `icons/icon-512.png` (PNG, kare).

---

## Sık karşılaşılan hatalar & çözümler

* **Site açılıyor ama veri gelmiyor**

  * Apps Script **Web app** değil; link `googleusercontent.com/macros/echo` gibi → **Yanlış**.
  * Doğru olan: `https://script.google.com/macros/s/.../exec` ve **Who has access: Anyone**.
  * `app.js` içindeki `API_URL` güncel mi? (Eski link/yanlış kopya olabilir.)

* **Toplu yapıştır “Desen bulunamadı”**

  * Satırlar **numara + ayraç** ile başlamalı: `1-`, `2 -`, `3.`, `4 —`…
  * Paragrafın devamı numarasız satırla gelebilir (aynı ayete eklenir).

* **PWA “yüklenebilir değil”**

  * `manifest.webmanifest` linklenmemiş veya `sw.js` kayıt olmamış olabilir.
  * İkon PNG’leri gerçekten dizinde var mı? Boyutlar 192 ve 512 mi?
  * Değişiklik sonrası **hard refresh** (Ctrl+F5 / Cmd+Shift+R) ve gerekirse SW **Unregister**.

* **Kurumsal hesapta “Anyone” seçeneği yok**

  * Workspace yöneticin dış erişimi kısıtlamıştır. İzin iste veya küçük bir **proxy** (Cloudflare Workers/Vercel) kullan.

* **Okuma telaffuzu tuhaf**

  * `data/tts-dict.json` oluştur ve yazım→okunuş dönüşümlerini ekle:

    ```json
    { "replacements": [["Yûnus","Yunus"],["Mü’min","Mümin"]] }
    ```

> **İpucu:** Takıldığın noktada hatayı/ekran görüntüsünü vererek **yapay zekâ** (ör. ChatGPT) ile hızlıca yardım isteyebilirsin; özellikle Apps Script yetki/dağıtım hatalarına net çözümler öneriyor.

---

## Geliştirme notları

* Sûre sayfasında **besmele kartı** Fâtiha hariç otomatik gelir.
* Sesli okuma: **Başlat/Durdur**, hız (0.5–1.2, varsayılan 0.8), ayete tıklayınca **o ayetten** itibaren okur ve devam eder.
* İç link (`[[s:a]]`) tıklanınca ilgili ayete scroll eder ve numara rozetini anlık gösterir.

---

## Lisans / Katkı

* Bu depoyu kopyalayıp kendi sisteminizi kurabilirsiniz.
* PR’lar ve öneriler memnuniyetle.

> Sorun yaşarsanız, hatayı olduğu gibi (mesaj/metin) paylaşın; buradaki adımlara göre **tam yerini** söyleyeyim (Apps Script mi, manifest mi, API_URL mi?) ve birlikte düzeltelim.


