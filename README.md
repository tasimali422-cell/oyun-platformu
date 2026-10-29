# Oyun Platformu v1.4 — Mülk Turu

Bu ZIP, mevcut `tasimali422-cell/oyun-platformu` GitHub deposuna yüklenmek üzere hazırlanmış **tam kaynak kod paketidir**. ZIP'i olduğu gibi yüklemeyin; içindekileri deponun **ana dizinine**, `public` klasörünü de aynı klasörde kalacak şekilde yerleştirin. GitHub'da **Commit changes**, Coolify'da `oyun-platformu-web` uygulamasında **Redeploy** yapın. PostgreSQL ve Redis servislerini değiştirmeyin.

## Yenilikler
- Oyun masası açıldığında, oyun başlamasını beklemeden sol site menüsü gizlenir; masadan çıkılınca geri gelir.
- Yeni masa açma formunda **Okey**, **Tombala** ve **Mülk Turu** ayarları birbirinden ayrılmıştır.
- Langırt yerine **Mülk Turu** adlı özgün çevrimiçi mülk edinme/strateji oyunu eklendi. Bu, Monopoly markasının/tahtasının birebir kopyası değildir.
- 40 kareli özgün şehir tahtası; **2–6 gerçek oyuncu**; 1000, 1500 veya 2000M başlangıç parası; kriptografik zar.
- Çift zar sonrası tekrar tur, art arda üç çiftte hapis, 50M ile hapisten çıkış / kart / çift zar.
- Mülk alma; vazgeçildiğinde 20/30/45 sn açık artırma; teklif verme; mülk kirası.
- Renk grubunun tamamına sahip olunca dengeli inşaat; en fazla 4 ev ardından otel.
- İpotek ve geri ödeme; oyuncular arası mülk/para takası, karşılıklı onay.
- Borç ve iflas; son kalan oyuncu kazanır.
- Oyunculara açık masa sohbeti ve önceki özel mesaj fonksiyonu korunur.

## Test ve sınırlar
`npm install` ardından `npm test` ile oyun motoru testlerini çalıştırabilirsiniz. Node.js 22+ gerekir. Bu pakette **23 otomatik test** geçmiştir. Gerçek iki cihazlı WebSocket/arayüz testi Coolify üzerinde henüz yapılmadı.

**Veriler geçici:** Oyun masaları, mülkler ve işlem geçmişi hâlen uygulama belleğinde tutulur ve redeploy ile silinebilir. Mülk Turu yalnızca sanal **oyun parası** kullanır; gerçek para veya nakde çevrilebilen ödül yoktur. Bu yeni oyun için PostgreSQL / Redis kalıcılığı henüz eklenmedi.

**Not:** 101 Okey, Kelime Oyunu ve Bilardo, önceki sürümde de henüz oynanabilir oyun motorları değildi. Mülk Turu onları tamamlanmış hâle getirmez.
