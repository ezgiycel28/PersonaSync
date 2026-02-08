from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, users, pomodoro
from app.core.database import engine, Base

# Tabloları oluştur
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PersonaSync API",
    description="Kişisel verimlilik ve öğrenme koçu API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router'ları ekle
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(pomodoro.router, prefix="/api", tags=["Pomodoro"])

@app.get("/")
def root():
    return {"message": "PersonaSync API çalışıyor!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}