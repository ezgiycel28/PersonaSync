from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum

class PomodoroStatus(str, enum.Enum):
    ACTIVE = "active"          # Şu an çalışıyor
    COMPLETED = "completed"    # Başarıyla tamamlandı (füze fırlatıldı!)
    CANCELLED = "cancelled"    # Yarıda bırakıldı (başarısız fırlatma)

class StudyCategory(str, enum.Enum):
    LESSON = "lesson"
    PROJECT = "project"
    READING = "reading"
    HOMEWORK = "homework"
    PERSONAL = "personal"
    OTHER = "other"

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
    
    # İlişki
    user = relationship("User", back_populates="pomodoro_sessions")