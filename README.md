# Oyun Platformu v0.6 — kontrollü test sürümü

Yeni: iki sıralı ıstaka, seri/per sıralama, yerdeki atık taşlar, gösterge ve otomatik süreli hamle.

## Sınırlamalar
- Seri/per otomatik sıralama **görsel basit sıralamadır**, kurallara uygun gruplama garantisi vermez.
- Yeniden bağlanma 5 dakika içinde aynı tarayıcı oturumuyla denenir. Veri henüz PostgreSQL/Redis'e yazılmıyor, sunucu yeniden başlatılınca masalar sıfırlanır.
- Gösterge gösterme şimdilik -1 masa puanına işler.
- 1–30 arası masa puanı seçilir ve oyuncular bu puanla başlar. Genel profil puanı henüz yoktur.
- Tam klasik Okey, süre aşımı ceza kuralları ve yarışma sonucunun veri tabanına yazılması geliştirme aşamasındadır.
- Oyun içi dört oyuncuyla test edin; canlı halka açık lansman için hazır değildir.

Kurulum: GitHub'a dosyaları kök dizinden yükleyin, Coolify mevcut uygulamasından Redeploy yapın. `npm test` puan testi çalıştırır. `/health` sağlık yanıtıdır.
