# Oyun Platformu v0.7 — Tombala test sürümü

Bu sürüm v0.6'nın Okey dosyalarını olduğu gibi tutarak **Tombala modülü** ekler.

- 2–300 kişilik canlı test odası (300 sınırı ilk VPS için güvenlik amaçlıdır; test edilmeden artırmayın)
- 1–12 ücretsiz dijital kart, 3×9 / 15 sayı, 5 sayı/satır
- `crypto.randomInt` ile 1–90 tekrarsız rastgele çekiliş
- Otomatik veya manuel işaretleme; kazananı manuel işaretlemeden bağımsız olarak sunucu doğrular
- 1 çinko = herhangi bir tamamlanmış satır; 2 çinko = iki satır; Tombala = üç satır
- Aynı top çekildiğinde tamamlanan bütün kartlara eşzamanlı kazanma hakkı
- Çekilen toplar geçmişi, büyük sayı göstergesi, mevcut masa sohbeti
- 3/5/7 saniye sayı çekme aralığı masa sahibi tarafından seçilir

**Sınırlar:** Gerçek para, satın alma veya maddi ödül bulunmaz. Masalar ve kazanma geçmişi RAM'de; yeniden başlatılınca sıfırlanır. Okey bu sürümde değiştirilmedi. Otomatik seslendirme ve gerçek 3D küre henüz yoktur; sayı küresi CSS ile gösterilir. Manuel işaretleme görseldir, kazananı çekilen sayılar belirler. Oyun başlarken kart dağıtılır, kart seçimi oynarken yapılamaz. Her yeni el otomatik başlatılmaz.

## Dağıtım
GitHub `main` deposundaki dosyaları aynı dizinlere yükleyin. **Yeni eklenen `tombala.js` ve `tombala.test.js` dosyaları ana dizinde olmalı.** `Dockerfile` bu modülü kopyalar. Coolify'da mevcut uygulamada Redeploy yapın; PostgreSQL ve Redis'i değiştirmeyin.

## Test
`npm install && npm test`. İki ayrı tarayıcı penceresinden Tombala masasına girin; kart sayısını başlatmadan ayarlayın ve masa sahibi olarak başlatın. Çekilişi takip edin, kartlar üzerinde işaretleri ve kazanma mesajlarını kontrol edin.
