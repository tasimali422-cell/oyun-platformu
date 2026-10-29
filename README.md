# Oyun Platformu v0.3 — Okey temel taş demosu

Güncelleme: v0.2 üzerine 4 kişilik Klasik Okey deneme eli (106 taş oluşturma, 15/14 taş dağıtma, sırayla taş çekme ve atma) eklendi. Diğer oyunlar lobi demosu olmaya devam eder.

## Önemli sınırlar
- Bu sürüm **tam Okey oyunu değildir**: gösterge/okey belirleme, per/geçerli el kontrolü, bitiş, ceza, skor, taş açma animasyonları henüz yapılmadı.
- Demo Okey eli için **4 ayrı aktif tarayıcı/oyuncu** gerekiyor. Her istemci yalnız kendi taşlarını alır. Oyun verileri sunucu belleğinde geçicidir.
- Gerçek üyelik, kimlik doğrulama, kalıcı sohbet, moderasyon ve veritabanı bağlantısı yoktur. Test ortamıdır.
- `GET /health` basit sağlık yanıtı verir. Kişisel veriler, şifreler depoya yüklenmemelidir.

## Güncelleme
ZIP içindeki dosyaları GitHub deponuzun köküne, `public/` klasörünü de aynı şekilde yükleyerek önceki dosyalarla değiştirin; mevcut Coolify uygulamasından Redeploy yapın. PostgreSQL ve Redis servislerine dokunmayın.
