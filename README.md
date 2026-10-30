# Arena Club Oyun Platformu v1.5 — Kızma Birader (Ludo)

Bu paket, kullanıcının **v1.4 Mülk Turu** ZIP'i esas alınarak hazırlanmış **tam GitHub kaynak kodu** paketidir. `server.js` ve `public/app.js` mevcut lobiye sadece yeni Ludo olaylarını bağlayacak şekilde güncellendi. `tombala.js`, `mulk.js`, `scoring.js` ve mevcut oyun test dosyalarına dokunulmadı. **WordPress teması ve Core eklentisi değiştirilmiyor.**

## Dosyaları yükleme — kod bilmen gerekmiyor

1. Mevcut GitHub deponun ve Coolify uygulamanın bir yedeğini al.
2. `arena-club-oyun-platformu-v1.5-ludo.zip` dosyasını bilgisayarda açıp **içindeki dosyaları çıkar**.
3. GitHub > `tasimali422-cell/oyun-platformu` deposunun **ana dizinine** gir. ZIP içeriğindeki dosyaları buraya yükle. `public/` klasörü ana dizinde kalmalı. Yeni bir üst klasör oluşturma.
4. GitHub `Commit changes` ile kaydet. **README, Dockerfile, public/** dahil bütün paket dosyalarını güncelle; `mulk.js`, `tombala.js`, `scoring.js` aynı kalır.
5. Coolify > mevcut **oyun-platformu-web** uygulaması > **Redeploy**. Yeni hizmet, PostgreSQL veya Redis oluşturma.
6. Dağıtımdan sonra `https://oyuna.top/health` adresinin `{"ok":true}` döndürdüğünü kontrol et.
7. `https://oyuna.top/` adresinde **Kızma Birader** kartını seç. **2 oyuncu** veya **4 oyuncu** masası aç; oda kodunu arkadaşına gönder. Karşı taraf açık masalardan ya da kodla katılır. Oyuncular tamamlanınca masa sahibi **Oyunu başlat** düğmesine basar.
8. İlk denemeyi ayrı cihazlarda ve ayrı sekmelerde/oturumlarda gerçek kullanıcılarla yap.

**Önemli:** Paket dosyalarını bir klasör hâlinde GitHub'a yükleme; projenin kökünde `server.js`, `package.json`, `Dockerfile`, `ludo.js` ve `arena-auth.js` görünmeli. `public/ludo.css` ve `public/app.js` da `public` içinde olmalı.

## WordPress ile giriş (ayrı ZIP)

WordPress'te `arena-club-ludo-bridge-v1.0.zip` eklentisini etkinleştir. Otomatik olarak **Oyna > Kızma Birader** sayfasını (`/oyna/kizma-birader/`) açar; önceden aynı sayfa varsa mevcut içeriği değiştirmez, gerekirse o sayfaya `[arena_ludo]` ekle.

1. WordPress yönetim panelinden **Ayarlar > Arena Club Ludo** bölümünü aç.
2. Sunucu adresini `https://oyuna.top/` olarak bırak.
3. Ekranda gördüğün iki satırı, Coolify'da mevcut `oyun-platformu-web` uygulamasının **Environment Variables** kısmına kopyala:
   - `ARENA_SSO_SECRET`: WordPress'teki **Coolify ARENA_SSO_SECRET** alanının gizli değeri (kimseyle paylaşma).
   - `ARENA_WP_ORIGIN`: WordPress'teki **Coolify ARENA_WP_ORIGIN** değeri (ör. `https://kayseritb.org`, sonunda `/` yok).
4. Coolify'da kaydedip **Redeploy** yap.
5. WordPress'e giriş yapmış bir hesapla `/oyna/kizma-birader/` sayfasını aç. Oyuncu oyun sunucusuna **WordPress şifresi gönderilmeden** kısa ömürlü imzalı bilet ile bağlanır. Sayfayı WordPress girişinden açmazsan oyun alanı yerine giriş bağlantısı görünür.
6. İki ayrı WordPress hesabı ile iki farklı tarayıcı/cihaz kullanarak oyun testi yap. Bu modda doğrudan `oyuna.top` üzerinden misafir maçı açılamaz (sunucu hesap doğrulaması ister).

**SSO zorunlu ayarları girilmezse:** Node.js uygulaması eski misafir modunda çalışmaya devam eder. WordPress hesabıyla güvenli giriş **aktif değildir**. Bu, ilk aşamada oyunu yalnız doğrudan `oyuna.top` üzerinde denemek için kullanılabilir.

**WordPress hesabı uzaklaştırmaları:** Eklenti, uzaklaştırılmış hesaplara yeni oyun sayfası bileti üretmez; ancak oyuna daha önce girmiş bir hesabın **aktif WebSocket oturumunu anında kesme/ban senkronizasyonu** henüz yapılmadı.

## Kurallar (bu sürümde kesin tanım)

- **2 kişi:** Kırmızı ve Sarı; **4 kişi:** Kırmızı, Mavi, Sarı, Yeşil. Her renkte dört piyon.
- Masa 52 ortak dış kare + her renkte 5 bitiş şeridi + merkez bitiş. Bir piyon `0…50` ilerleyince ortak yolda, `51…55` kendi renginin bitiş yolunda, `56` tam bitiştedir.
- Başlangıç alanındaki piyon yalnızca **6** zar ile oyuna çıkar ve kendi renkteki başlangıç karesine yerleştirilir. Zar, Node.js sunucusunda `crypto.randomInt(1,7)` ile üretilir.
- Normalde zar sayısı kadar ilerlenir, **tam sayı** ile 56'ya varılmalıdır; taşan hamle geçersizdir.
- 6 atan ek zar hakkı kazanır; bir oyuncu aynı sırada **üçüncü kez art arda 6 atarsa** üçüncü 6 oynanmaz, sıra geçer.
- Hiç oynanabilir piyon yoksa zar 6 değilse sıra geçer, 6 ise ek zar atılır.
- Güvenli kareler global dış yol indeksleri **0, 8, 13, 21, 26, 34, 39, 47** (başlangıç ve yıldızlı kareler). Rakipler orada yenilmez. Diğer dış karelerde aynı kareye inince rakip piyonlar başlangıca döner. Aynı renk piyonlar üst üste gelebilir, **blokaj kuralı bu sürümde uygulanmaz**; rakip aynı karede birden çok piyona sahipse tamamı yenilir.
- Sıra eylemi için masa oluştururken seçilen **15, 20, 30, 45, 60 veya 90 saniye** bulunur. Zaman aşımı turu doğrudan geçirir; rastgele piyon oynatılmaz.
- Dört piyonunu bitiren kazanır. Oyuncu isteyerek masadan ayrılırsa elenir; diğerleri devam eder. Oyuncu bağlantısı aniden koparsa **5 dakika** koltuk ve oturum korunur, süre dolarsa elenir. Son kalan oyuncu da kazanır.
- Maç başladığında başka biri katılamaz. Bitmiş maçlarda masa sahibi yeniden başlatabilir; başlamak için seçilmiş oyuncu sayısının eksiksiz olması gerekir.

## Dosya özeti

**Yeni:** `ludo.js`, `ludo.test.js`, `arena-auth.js`, `arena-auth.test.js`, `public/ludo.css`.

**Güncellenen:** `server.js`, `public/app.js`, `public/index.html`, `Dockerfile`, `package.json`, `README.md`.

**Aynı kalan:** `mulk.js`, `mulk.test.js`, `tombala.js`, `tombala.test.js`, `tombala-prizes.test.js`, `scoring.js`, `scoring.test.js`, `public/style.css`, `.dockerignore`.

## Test ve dürüst sınırlar

- `npm test`: **36/36 test başarılı** (13 yeni Ludo/SSO testi + 23 önceki test).
- `node --check server.js`, `node --check public/app.js`: başarılı.
- PHP 8.2 sözdizimi: WordPress köprü dosyası başarılı.
- Kızma Birader tahtası Chromium'da masaüstü ve 390 px mobil görünümde görüntülendi; 225 kare ve 16 piyon kontrol edildi; tarayıcı konsolunda hata yoktu.
- **Tam WebSocket uçtan uca testi henüz yapılamadı:** test ortamında `npm install` internet erişimi nedeniyle zaman aşımına uğradı. Coolify, mevcut `ws` paketini kurarak çalıştıracaktır; iki kullanıcı ile canlı deneme yapılmalıdır.
- Sıradaki aşama: PostgreSQL kalıcılığı, puan/galibiyet/turnuva entegrasyonu, aktif WebSocket yasaklama senkronizasyonu. Bunlar bu sürümde **çalışıyor gibi gösterilmez**. Redeploy veya süreç çökmesi **aktif odaları siler**.
- Bu oyun için para, jeton veya maddi ödül sistemi yoktur.
