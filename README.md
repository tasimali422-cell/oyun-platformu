# Oyun Platformu v0.5 (geliştirme sürümü)

- Klasik Okey masalarında **0 puan başlangıcı**, -20/-30 kayıp limiti.
- Elde geçerli taş dizilimi denetimi, normal bitiş / okey atarak bitiş için -2 / -4 rakip cezası (kazanan +6 / +12; sıfır toplamlı transfer).
- Final durumunda kaybeden sayısına göre toplam 8 puan dağıtımı: 1 kaybeden -8; diğerleri +4/+2/+2. 2 kaybeden -4/-4, kazananlar +4/+4. 3 kaybeden kaybedenler arasında en yüksek puanlı -4, diğerleri -2/-2, kazanan +8.

## Önemli sınırlar

**Bu sürüm tam Okey değildir.** Gösterge gösterme cezasının oyuncu tarafından sunucu tarafında kontrollü bildirimi henüz eklenmedi. İşleyen taş/çift bitme kural varyantları ve turnuva sistemi tamamlanmadı. Masalar ve puanlar RAM'dedir; uygulama yeniden dağıtıldığında kaybolabilir. İlk sürümleri yalnızca test kullanıcılarıyla kullanın. WebSocket kimliği henüz güvenli üyelik sistemi değildir.

Kod testleri: `npm test`.

Dockerfile, server.js, scoring.js, package.json ve `public` dosyalarını GitHub deposunun köküne ekleyin; Coolify mevcut uygulamadan Redeploy.
