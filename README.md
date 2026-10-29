# Oyun Platformu v0.9.1 — Tombala düzeltmesi

Bu güncelleme v0.9 üzerine kuruludur. İlk tamamlanan çinko aşaması sunucuda bir kere kazandırılır; aynı çekiliş sayısını 30 saniyelik pencerede tamamlayan oyuncular eşit kazanır. 30 saniyede işaretlenmeyen rakamlar kazanma şartına dahil edilmez. Kart sayısı 1/2/4/8/12 olarak oyun öncesinde seçilir. Sohbet masaüstünde sabit yan panel, mobilde açılır düğmedir.

**Bilerek etkinleştirilmedi:** Üyelik, yönetici ve moderatör yetkileri, VIP/Elit, gerçek puan cüzdanı, puanla kart satın alma ve ücretli hediyeler. Bu servisler kimlik doğrulama, PostgreSQL bağlantısı ve denetlenebilir para benzeri puan defteri olmadan güvenli değildir. Oda puanları görsel bilgilendirmedir.

Test: `npm test`. Sunucu: `npm start`; Coolify mevcut Dockerfile kaynağını redeploy edin. Sunucu belleğindeki açık masalar yeniden başlatmada kaybolur.


## Okey kural düzeltmesi (v1.0 ara güncelleme)

- Gerçek okey, eksik herhangi bir sayı/renk taşının yerine geçen joker olarak doğrulanır.
- Sahte okey sadece o elin gerçek okey taşının normal renk/sayı değerini temsil eder; göstergeyi temsil etmez.
- 12-13-1 seri kontrolü desteklenir; 13-1-2 gibi devamlar kabul edilmez.
- 7 çift ve 3+ taşlık perler sunucuda denetlenir.
- Kodun Tombala / lobi / mevcut ekran dosyaları bu ara güncellemede değiştirilmemiştir.

Henüz eksikler: Eşli oyun, botlar, AFK ve yeniden bağlanmada sunucu kalıcılığı, sesli sohbet, gelişmiş yönetim paneli, güvenli üyelik ve tam çevrimiçi oyun protokolü. Bunlar hazır veya test edildi diye varsayılmamalıdır.
