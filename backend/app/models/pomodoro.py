from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum

class PomodoroStatus(str, enum.Enum):
    ACTIVE = "active"          # Şu an çalışıyor
    COMPLETED = "completed"    # Başarıyla tamamlandı (füze fırlatıldı!)
    CANCELLED = "cancelled"    # Yarıda bırakıldı (başarısız fırlatma)

class StudyCategory(str, enum.Enum):
    LESSON = "lesson"           # Ders
    PROJECT = "project"         # Proje
    READING = "reading"         # Okuma
    HOMEWORK = "homework"       # Ödev
    PERSONAL = "personal"       # Kişisel Gelişim
    OTHER = "other"             # Diğer

class PomodoroSession(Base):
    __tablename__ = "pomodoro_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Zaman bilgileri
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=25)  # Varsayılan 25 dakika
    
    # Durum ve kategori
    status = Column(String, default=PomodoroStatus.ACTIVE)
    category = Column(String, default=StudyCategory.OTHER)
    
    # İsteğe bağlı not
    note = Column(String, nullable=True)
    
    # Füze sistemi için
    rocket_type = Column(String, default="basic")  # İleride farklı roket tipleri
    
    # İlişki
    user = relationship("User", back_populates="pomodoro_sessions")