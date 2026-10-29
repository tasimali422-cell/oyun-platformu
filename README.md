# Oyun Platformu v0.9.1 — Tombala düzeltmesi

Bu güncelleme v0.9 üzerine kuruludur. İlk tamamlanan çinko aşaması sunucuda bir kere kazandırılır; aynı çekiliş sayısını 30 saniyelik pencerede tamamlayan oyuncular eşit kazanır. 30 saniyede işaretlenmeyen rakamlar kazanma şartına dahil edilmez. Kart sayısı 1/2/4/8/12 olarak oyun öncesinde seçilir. Sohbet masaüstünde sabit yan panel, mobilde açılır düğmedir.

**Bilerek etkinleştirilmedi:** Üyelik, yönetici ve moderatör yetkileri, VIP/Elit, gerçek puan cüzdanı, puanla kart satın alma ve ücretli hediyeler. Bu servisler kimlik doğrulama, PostgreSQL bağlantısı ve denetlenebilir para benzeri puan defteri olmadan güvenli değildir. Oda puanları görsel bilgilendirmedir.

Test: `npm test`. Sunucu: `npm start`; Coolify mevcut Dockerfile kaynağını redeploy edin. Sunucu belleğindeki açık masalar yeniden başlatmada kaybolur.
