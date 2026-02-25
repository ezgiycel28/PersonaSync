"""
PersonaSync API — main.py (GÜNCELLENMİŞ)
==========================================
AI Koç router'ı eklendi.
Değişiklikler:
  - app.include_router(ai_coach.router ...) eklendi
  - startup event ile GeminiService erken başlatılıyor
  - /health endpoint'i Gemini durumunu da içeriyor
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api import auth, users, pomodoro
from app.api import ai_coach                          # ← YENİ
from app.core.database import engine, Base
from app.services.gemini_service import get_gemini_service  # ← YENİ


# ──────────────────────────────────────────────
# Startup / Shutdown (lifespan)
# ──────────────────────────────────────────────
# Şu şekilde değiştir:
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Gemini API key'in varlığını kontrol et ama API'ye istek atma
    if not os.getenv("GEMINI_API_KEY"):
        raise EnvironmentError("GEMINI_API_KEY tanımlı değil!")
    print("✅ Backend başlatıldı. Gemini lazy-load aktif.")
    yield

# ──────────────────────────────────────────────
# FastAPI Uygulaması
# ──────────────────────────────────────────────
app = FastAPI(
    title="PersonaSync API",
    description="""
    ## PersonaSync — Yapay Zeka Destekli Kişisel Verimlilik Koçu API

    ### Modüller
    - **Auth** — Kayıt, giriş, JWT token yönetimi
    - **Users** — Kullanıcı profili yönetimi
    - **Pomodoro** — Pomodoro seans takibi ve istatistikleri
    - **AI Coach** — Google Gemini destekli kişisel koçluk önerileri
    """,
    version="0.2.0",
    lifespan=lifespan,
)


# ──────────────────────────────────────────────
# CORS Middleware
# ──────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # Production'da spesifik domain'e kısıtla
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Router'lar
# ──────────────────────────────────────────────
app.include_router(auth.router,      prefix="/api/auth", tags=["Auth"])
app.include_router(users.router,     prefix="/api/users", tags=["Users"])
app.include_router(pomodoro.router,  prefix="/api", tags=["Pomodoro"])
app.include_router(ai_coach.router,  prefix="/api", tags=["AI Coach"])   # ← YENİ


# ──────────────────────────────────────────────
# Temel Endpoint'ler
# ──────────────────────────────────────────────
@app.get("/", tags=["Root"])
def root():
    return {
        "message": "PersonaSync API çalışıyor! 🚀",
        "version": "0.2.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Root"])
def health_check():
    """API ve Gemini servis durumu."""
    gemini = get_gemini_service()
    gemini_status = gemini.health_check()

    return {
        "api_status": "healthy",
        "ai_coach_status": gemini_status["status"],
        "version": "0.2.0",
    }