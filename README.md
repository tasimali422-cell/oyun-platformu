# Oyun Platformu v1.2 — Masa yerleşimi

Bu paket mevcut v1.1 kaynaklarının tam güncel halidir. Tombala ve sunucu kuralları korunur.

- Dört oyuncu, kendi koltuğuna göre alt / sağ / üst / sol konumlarında gösterilir.
- Her oyuncunun yalnızca son attığı taş kendi tarafında görünür; geçmiş taşlar sunucuda tutulmaya devam eder.
- Çekilecek taşların görsel destesi ve sayaç merkezde, gösterge ayrıca ortadadır.
- 30 yuvalı, iki raflı ıstaka oyun masasının içine yerleştirildi.
- Masa sohbeti masanın altındadır.

## Kurulum
ZIP'i açın, içindeki dosyaları GitHub deposunun köküne mevcut dosyaların üzerine yükleyin. `public` klasörünün yapısını koruyun. Commit changes → Coolify Redeploy.

## Sınırlar
Bu bir arayüz/yerleşim güncellemesidir. Online dört oyuncu ile gerçek mobil ve masaüstü tarayıcı testi henüz yapılmadı. Yeni üyelik veya puan veritabanı entegrasyonu içermez. Sadece son atılan taşı gösteren UI, önceki atılan taşların server verisini silmez.
