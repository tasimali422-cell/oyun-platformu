# Oyun Platformu v0.2 — canlı masa odaları (demo)

Node.js 22, WebSocket (`ws`) ve HTML/CSS/JS ile hazırlanmış erken sürüm.

## Özellikler
- Canlı lobi, altı oyun kartı ve masa oluşturma
- Masa detayına girme, oyuncu koltukları, oda içi sohbet
- Masa sahibinin en az iki kişiyle demo oturumunu başlatması
- Telefon ve masaüstü için uyumlu tasarım
- `/health` sağlık kontrolü ve Dockerfile (3000 portu)

## Sınırlar
Oyun motorları/taş dağıtma, gerçek kayıt/giriş, moderasyon, veritabanı entegrasyonu ve Redis henüz yoktur. Odalar, oyuncu adları ve sohbet bellektedir; konteyner yeniden başlayınca silinir. Oyuncu adı doğrulanmış hesap değildir. Demo ortamında kişisel bilgi paylaşmayın. Bu sürüm üretimde herkese açık topluluk yayını için uygun değildir.

## Coolify güncelleme
`main` kök dizininde Dockerfile olmalı. Coolify mevcut Public Git Repository uygulamasında **Redeploy** yapın; yeni kaynak oluşturmayın. `/health` 200 döner.
