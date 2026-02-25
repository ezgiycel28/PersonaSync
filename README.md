# PersonaSync

Yapay zeka destekli kişisel verimlilik ve öğrenme koçu mobil uygulaması.

## Teknolojiler

- **Frontend:** React Native (Expo)
- **Backend:** Python FastAPI
- **Database:** PostgreSQL
- **AI:** Google Gemini 2.5 Flash-Lite
- **DevOps:** Docker

## Gereksinimler

Başlamadan önce şunları kurun:

- Git
- Docker Desktop
- Node.js (v18+)
- Telefona: Expo Go (App Store / Play Store)

**Not:** Node.js sadece frontend (React Native) için gerekli. Backend tamamen Docker içinde çalışıyor.

## Kurulum (İlk Kez)

### 1. Repoyu klonla
```bash
git clone https://github.com/ezgiycel28/PersonaSync.git
cd PersonaSync
```

### 2. Backend .env dosyası oluştur
`backend/` klasöründe `.env` dosyası oluştur ve aşağıdaki değişkenleri doldur:

```env
DATABASE_URL=
SECRET_KEY=
GEMINI_API_KEY=
```

- `SECRET_KEY` → rastgele uzun bir string
- `GEMINI_API_KEY` → Google AI Studio'dan alabilirsin: https://aistudio.google.com/app/apikey

### 3. Backend'i başlat
```bash
docker-compose up --build
```
İlk seferde biraz bekleyin, gerekli dosyaları indiriyor.

✅ Başarılı: `http://localhost:8000/docs` adresinde Swagger açılmalı.

### 4. Yeni terminal aç, frontend'i kur
```bash
cd frontend
npm install
```

### 5. Frontend .env dosyası oluştur

`frontend/` klasöründe `.env` dosyası oluştur:
```env
EXPO_PUBLIC_API_URL=http://BILGISAYAR_IP:8000
```

**⚠️ Önemli:** `BILGISAYAR_IP` yerine kendi IP adresini yaz!

#### IP Adresini Bulma:

**Windows:**
```bash
ipconfig
```
→ "Wireless LAN adapter Wi-Fi" altındaki `IPv4 Address` (örn: 192.168.1.164)

**Mac/Linux:**
```bash
ifconfig | grep inet
```

#### Örnek .env:
```env
EXPO_PUBLIC_API_URL=http://192.168.1.164:8000
```

### 6. Frontend'i başlat
```bash
npx expo start -c
```

(`-c` flag'i cache'i temizler)

### 7. Telefonda test et

1. Telefon ve bilgisayar **aynı Wi-Fi**'a bağlı olmalı
2. Expo Go uygulamasını aç
3. Terminaldeki QR kodu tara
4. Uygulama açılacak!

## Günlük Çalışma

Her gün projeye başlarken:

**Terminal 1 - Backend:**
```bash
cd PersonaSync
docker-compose up
```

**Terminal 2 - Frontend:**
```bash
cd PersonaSync/frontend
npx expo start
```

## Proje Yapısı
```
PersonaSync/
├── frontend/          # React Native (Expo)
├── backend/           # Python FastAPI
│   └── app/
│       └── main.py
├── docs/
├── docker-compose.yml
└── README.md
```

## API Adresleri

- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs

## Sık Karşılaşılan Hatalar

### "Network request failed"
- `.env` dosyasında IP adresi doğru mu?
- Telefon ve bilgisayar aynı Wi-Fi'da mı?
- Backend çalışıyor mu?
- `npx expo start -c` ile cache temizledin mi?

### "Not Found" hatası
- API endpoint yolu doğru mu? (`/api/` prefix'i var mı?)
