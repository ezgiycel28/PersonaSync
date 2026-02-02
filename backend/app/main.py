from fastapi import FastAPI
from app.api import auth, users
from app.core.database import engine, Base

# Tabloları oluştur
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="PersonaSync API",
    description="Kişisel verimlilik ve öğrenme koçu API",
    version="0.1.0"
)

# Router'ları ekle
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])

@app.get("/")
def root():
    return {"message": "PersonaSync API çalışıyor!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}