from fastapi import FastAPI

app = FastAPI(
    title="PersonaSync API",
    description="Kişisel verimlilik ve öğrenme koçu API",
    version="0.1.0"
)

@app.get("/")
def root():
    return {"message": "PersonaSync API çalışıyor!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}