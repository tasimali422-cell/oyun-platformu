# Oyun Platformu v1.1 — Premium Okey masa arayüzü

Bu paket önceki v1.0 sürümündeki Node.js/WebSocket sunucusunu, Okey kural motorunu ve Tombala modülünü temel alır.

## Değişiklikler
- Klasik Okey için masa-altı sohbet paneli ve mavi-yeşil keçe + ahşap masa düzeni.
- İki raflı ahşap ıstaka üzerinde toplam 30 yuva (15 sütun x 2 satır).
- Taşların dolu veya boş yuvalara sürüklenebilmesi; mobilde taş seçip boş/dolu yuvaya dokunarak taşınabilmesi.
- Taş grupları arasında boş yuva bırakabilme; dizilimin tarayıcıda korunması.
- Çekilen / atılan taş kontrolleri, gösterge, 4 oyuncunun attığı taşlar ve kalan taş sayısı korunur.
- Tombala HTML/JS/CSS'si, puan kuralları ve sunucu veri sözleşmesi korunur.

## Sınırlar
Bu bir **canlıya yüklenebilir arayüz test sürümüdür**. Hazırlanan görseller bire bir raster görsel olarak masa zemini yapılmamıştır; işlevsel öğeler HTML/CSS ile oluşturulmuştur. Otomatik seri/per dizme basit sıralamadır; tam per çözücüsü değildir. Masa sürekliliği ve kimlik sistemi tamamlanmamıştır. Otomatik kontroller masaüstü/mobil tarayıcıda gerçek 4 oyunculu testi yerine geçmez.

## Kurulum
ZIP'in içindeki `oyun-platformu-v1.1/` klasörünün **içindeki** dosyaları GitHub deposunun **ana dizinine** yerleştirin. `public/` klasörünü olduğu gibi koruyun. Commit yapıp Coolify'da mevcut uygulamayı Redeploy edin. Yeni uygulama/veritabanı oluşturmayın.

## Kontroller
`node --check public/app.js` ve `node --test *.test.js` (17 test) başarılı.
