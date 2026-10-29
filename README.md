# Oyun Platformu v0.9 — Tombala oda ayarları (test sürümü)

Mevcut v0.8 kodunun üstüne kurulmuştur; Okey kurallarına dokunulmadı.

- Masa sahibi 5–120 saniye sayı çekme aralığı seçer. Sayı işaretleme süresi **30 saniye** olarak kalır. 5 saniyelik aralıkta birden fazla sayı için açık işaretleme penceresi bulunabilir.
- Masa sahibi 2–24 oyuncu sınırı belirler.
- Kart başı test puanı, birinci/ikinci çinko ve Tombala için **gösterim amaçlı** puan değerleri belirler. Bunlar lobi listesinde ve oyun odasında gösterilir.
- **Bu sürüm gerçek kredi bakiyesi, üyelik, ödeme, admin, hediye ya da ödül transferi yapmaz.** Hesap cüzdanı ve admin yetkileri için PostgreSQL, güvenli oturum ve işlem defteri gerekir.
- Manuel işaretleme süresi v0.8'deki gibi 30 saniyedir. Önceki sürümde kazanma denetimi çekilen sayılara göre yapılmaktadır; kullanıcı işaretlerine göre sonuç doğrulaması ayrıca geliştirilecektir.
- Uygulama yeniden başlatılırsa aktif masalar silinir.

Test: `npm install && npm test`. Coolify için mevcut Dockerfile ile deploy edin.
