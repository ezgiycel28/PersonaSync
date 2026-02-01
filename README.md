# PersonaSync

Yapay zeka destekli kişisel verimlilik ve öğrenme koçu mobil uygulaması.

## Teknolojiler

- **Frontend:** React Native (Expo)
- **Backend:** Python FastAPI
- **Database:** PostgreSQL
- **AI:** (Belirlenecek)
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

### 2. Backend'i başlat
```bash
docker-compose up --build
```
İlk seferde biraz bekleyin, gerekli dosyaları indiriyor.

### 3. Yeni terminal aç, frontend'i kur
```bash
cd frontend
npm install
npx expo start
```

### 4. Telefonda test et
- Expo Go uygulamasını aç
- Terminaldeki QR kodu tara
- Uygulama açılacak!

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