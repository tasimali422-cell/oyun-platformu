# Oyun Platformu — v0.1 demo

Gerçek zamanlı oda listesi ve premium mobil uyumlu lobi prototipi.

**Bu sürüm gerçek oyun, kullanıcı üyeliği veya sohbet içermez.** Açılan deneme masaları bellektedir ve sunucu yeniden başlarsa silinir. Redis ve PostgreSQL henüz uygulamaya bağlanmaz.

## Coolify kurulumu

1. Bu dosyaları GitHub deponun kök dizinine yükle.
2. Coolify > Project > production > New Resource > Public Git Repository.
3. Depo URL'ni yapıştır, `main` dalını seç. Build Pack `Dockerfile`, Dockerfile konumu `./Dockerfile`.
4. Uygulama portunu `3000` olarak ayarla ve domain olarak `https://seovua.com` ekle.
5. Coolify Proxy ve DNS/HTTPS doğru yapılandırılmışsa Deploy'a bas. `/health` adresi `{"ok":true}` döndürmeli.

## Yerel çalıştırma

Node.js 22+ ile `npm install` ve `npm start`. Uygulama `http://localhost:3000` adresinde çalışır.

## Güvenlik notları

Bu sürümde kimlik doğrulama yoktur: lobi yalnızca geliştirme ve kapalı test içindir, gerçek kullanıcı hizmetine açılmamalıdır. Veritabanı şifrelerini repoya koyma. PostgreSQL ve Redis'i özel erişimde tut. Prod öncesi kullanıcı hesapları, oran sınırlama, moderasyon, giriş kontrolü, yedekleme ve durum kalıcılığı eklenmelidir.
