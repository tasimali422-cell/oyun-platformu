# Arena Club v2.0 — Üyelik, Salonlar, Sohbet ve Yönetim Scripti

Bu, `oyun-platformu` v1.5 Kızma Birader ZIP'i baz alınarak hazırlanmış **tam kaynak kodu paketidir**. Mevcut oyun motorları (`ludo.js`, `mulk.js`, `tombala.js`, `scoring.js`, `public/app.js`) değiştirilmedi. Eski oyun uygulaması `/` adresinde çalışmaya devam eder, yeni Arena Club platformu `/club` adresindedir.

## Kurulum — daha önce Node.js kullanmamış kullanıcı için

1. **İlk olarak** mevcut GitHub deponun ve Coolify projenin yedeğini al. Mümkünse önce ayrı bir test uygulamasında dene. ZIP'in içindeki dosyaları bilgisayarına çıkar; ZIP'in kendisini GitHub'a yükleme.
2. GitHub `tasimali422-cell/oyun-platformu` deposunda ana dizine bu paketin **içindeki dosyaları** yükle. `server.js`, `Dockerfile`, `package.json`, `club/` ve `public/` deponun kökünde olmalı. GitHub `Commit changes` yap.
3. Coolify > `oyun-platformu-web` > **Environment Variables** > **+ Add** ile şu iki **yeni** değişkeni oluştur:
   - **Name** `ARENA_CLUB_ADMIN_EMAIL` — **Value** yönetici olarak kullanacağın e-posta adresi
   - **Name** `ARENA_CLUB_ADMIN_PASSWORD` — **Value** senin seçeceğin, en az 12 karakterli güçlü, benzersiz yönetici şifresi
   - Bunların ikisi de **Runtime: Available in the container** olmalı. Build time kapatılabilir. Şifreyi kimseyle paylaşma veya ekran görüntüsünde gösterme. Mevcut `ARENA_SSO_SECRET` ve `ARENA_WP_ORIGIN` değişkenlerini **silme**; eski WordPress bağlantısı bunları kullanıyor.
4. **Önemli — kalıcı kullanıcı verileri:** Coolify > aynı uygulama > **Configuration > Persistent Storage > Add > Volume Mount** menüsünü aç. Bir **Name** belirle (`arena-club-data` gibi); **Destination Path** alanına **`/app/data`** gir ve kaydet. Bu, üye kayıtlarının, fotoğrafların, VIP ayarlarının, salonların ve moderasyon kayıtlarının redeploy sırasında kaybolmaması için zorunludur. Yeni veriyi oluşturmadan önce volume'u hazırla. Uygulama container'ında `/app/data` klasörüne yazma izni bulunmalıdır.
5. Coolify'da **Redeploy** yap. `Running` olduktan sonra `https://oyuna.top/health` adresinde `{"ok":true}` görmelisin.
6. **Yeni siteyi aç:** `https://oyuna.top/club` (kendi alan adın farklıysa ona göre değiştir). Sağ üstten yönetici e-posta/şifrenle giriş yap.
7. **Yönetim** menüsünden salonları aç, masa sayısını belirle, üyelere VIP/ELITE/moderatör ata, onayları işle, duyuru yayımla ve turnuvaları ayarla. İlk kurulumda 40 masalık bir Kızma Birader salonu otomatik görünür.
8. Başka bir tarayıcı veya telefonda **Üye Ol** ile normal hesap oluştur. Salona gir, masa seç ve masa sohbetini dene. VIP seviyesini yönetici panelinden vererek VIP sohbetini kontrol et.

**NOT:** Yönetici hesabı yalnızca hiç yönetici yoksa ilk açılışta oluşturulur. Kullanıcı verileri kalıcı volume'a yazıldıktan ve giriş doğrulandıktan sonra `ARENA_CLUB_ADMIN_PASSWORD` değişkenini kaldırabilirsin; bu mevcut yöneticinin şifresini değiştirmez. Sonra yönetici paneline giriş yapmak için oluşturduğun şifreyi kullan. Yönetici şifresini profilindeki **Şifre değiştir** alanından değiştirebilirsin.

## Dosya yapısı

```
server.js               → Mevcut oyun motoru + yeni API/WebSocket bağlantısı
club/platform.js        → Üyelik, onay, salon, masa, sohbet, yönetim, turnuva API'leri
club/platform.test.js   → Yeni fonksiyon testleri
public/club.html        → Yeni Arena Club ana sayfa ve uygulama
public/club.css         → Masaüstü + mobil tasarım
public/club.js          → Üye, salon, masa ve admin arayüzü
public/index.html       → Mevcut oyun arayüzü (yeni salona menü linki eklendi)
public/app.js           → Mevcut oyun arayüzü, değişmedi
ludo.js, mulk.js, tombala.js, scoring.js, arena-auth.js → Mevcut motorlar
Dockerfile              → club klasörünü kopyalıyor, /app/data klasörünü oluşturuyor
```

## Eklenen gerçek özellikler

- Yeni Arena Club üyelik, kayıt, giriş ve çıkış; güvenli şifre hash'i (scrypt); HttpOnly oturum cookie; isteklere CSRF koruması.
- Üye profilinde görünen ad, bio, e-posta, VIP/ELITE renkli/kalın özel isim, puan, galibiyet, üyelik bitişi; profil değişikliğinde yönetici onayı.
- Normal üyeye **1 avatar**, VIP/ELITE'ye **avatar dahil 4 fotoğraf**; fotoğraflar yöneticinin onayından önce herkese açılmaz.
- Yönetici rol/tier atama, süreli VIP/ELITE, manuel puan/galibiyet/haftalık puan yönetimi.
- Yöneticinin yeni salon ekleme/silme, salon başına 1–200 masa belirleme; varsayılan 40 masa; VIP/ELITE üyeye süreli salon yöneticiliği verme; kiralık salon sahibi en fazla 40 masa kullanarak salonunu yeniden adlandırabilir.
- Masa sahibinin oyun türü/oyuncu sayısı/el sayısı/başlangıç puanı/hamle süresi/izleyici/özel mesaj ayarlarını belirlemesi.
- Oyun bazlı ayarlar: Kızma Birader 1 maç, Tavla 3/5 el, 101 Okey/Batak 1/3/5/7/9/11 el, Klasik/Eşli Okey 10/20/30 puan. Okey puanları ayarların açıklamasında 1/2/4/8 olarak gösterilir. **Bu kurallar henüz canlı oyun motorlarına bağlanmadığı için puan/hamleleri etkilemez.**
- VIP/ELITE salon sohbeti yalnız yetkili üyelere görünür. Yönetici/moderatör duyuruları herkese görünür.
- Masadaki oyuncu ve izin verilen izleyiciler için oyun alanının hemen altında **iki satır yüksekliğinde masa sohbeti**; geçmiş kaydırılabilir.
- Masa içi özel mesajlaşma, kullanıcı profili gizlilik ayarı, masa sahibi engeli. Eşli Okey'de aynı takımdaki oyuncular için masa engeli istisnası; **kişisel mesaj alma yasağı daima korunur**.
- Şikâyet bildirme, moderatör inceleme, yönetici/moderatör süreli hesap yasağı. Moderatör diğer moderatörleri/yöneticileri yasaklayamaz.
- Turnuva oluşturma ve katılma; yönetici manuel maç sonuç onayı, doğrulamadan sonra VIP/ELITE ödülü; haftalık liderlik tablosu.
- `data/club.json` ve `data/club-media/` altında kayıt; tek Node.js uygulamasında çalışma, yeni Redis/PostgreSQL bağımlılığı yok.

## Şu an bilinçli olarak eksik bırakılanlar

1. **Yeni salon masasındaki oyunlar oynanamaz.** Kızma Birader, Tavla, Batak, Okey vb. canlı motorlarını sonraki aşamada bu salona bağlayacağız. `/` adresindeki eski oyun motorları değiştirilmedi ve ayrı çalışır. Masada açıkça oyun motorunun bağlı olmadığı gösterilir.
2. **Yeni Club üyeliği WordPress üyeliğinden bağımsızdır.** Var olan WordPress üyelerinin otomatik taşınması veya tek oturum bağlantısı henüz yok. WordPress hesabı/kayıtları silinmez.
3. Para alma, otomatik salon kiralama ödemeleri, otomatik maç sonucu doğrulaması, gerçek oyun puanı dağıtımı, otomatik ödül doğrulaması **yoktur**. Turnuva sonuçlarını yönetici manuel doğrular; sonuç doğrulandıktan sonra üyelik ödülü gerçek veri kaydına işlenir.
4. E-posta doğrulaması / otomatik şifre sıfırlama e-postası, anti-spam CAPTCHA, çoklu sunucu veri replikasyonu, otomatik veritabanı yedekleme henüz yoktur. Üretim ölçeğinde PostgreSQL'e geçiş önerilir.
5. Veri depolaması tek işlem için **JSON tabanlıdır**. Kişisel veriler için **kalıcı volume + düzenli harici yedek** şarttır. Aynı volume'u birden fazla çalışan uygulamaya aynı anda yazdırma. Masa oturumları ve canlı masa sohbeti **sunucu yeniden başlatılınca sıfırlanır**. Salonlar, kullanıcılar, VIP bilgileri, moderasyon, turnuva ve duyurular korunur.
6. Tam gerçek tarayıcı ve gerçek WebSocket uçtan uca testi bu ortamda yürütülemedi. Otomatik API/oyun testleri başarılı olsa da Coolify üzerinde farklı cihazlardan test etmeden üretime açık sayma.

## Teknik ve güvenlik

- Node.js 22+, `ws` bağımlılığı değişmedi.
- Platform HTTP API `/api/club/*`, platform WS `/club/ws`; eski oyun WS `/` ve eski HTTP içerik yapısı aynı kaldı.
- API CSRF başlığı `X-Club-CSRF`, origin doğrulaması, oturum cookie, giriş/kayıt hız sınırlama, sunucu tarafı rol ve chat izin kontrolleri.
- Şifreler scrypt + benzersiz salt ile hash olarak saklanır. Kullanıcının oturum tokenı depoda SHA-256 hash halinde tutulur.
- Resimler izin kontrolüyle API üzerinden servis edilir; yükleme boyutu 1 MB, tür JPG/PNG/WebP, onay öncesi herkese açık değil.
- **Test:** `npm install && npm test` (mevcut 36 oyuna yönelik + 16 yeni toplam 52 test).

### Korunması gereken mevcut sistemler

- `ludo.js`, `mulk.js`, `tombala.js`, `scoring.js`, testleri ve eski `public/app.js` aynen korunur.
- Eski WordPress köprüsünün ortam değişkenleri (`ARENA_SSO_SECRET`, `ARENA_WP_ORIGIN`) silinmez.
- Veritabanı sıfırlama veya sunucudan mevcut oyun dosyalarını silme işlemi yoktur.
