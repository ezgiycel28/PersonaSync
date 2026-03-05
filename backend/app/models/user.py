"""
PersonaSync — User Modeli (GÜNCELLENMİŞ)
==========================================
Değişiklik: ai_feedbacks relationship eklendi.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from datetime import datetime
from app.core.database import Base
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)

    # Profil bilgileri
    age = Column(Integer, nullable=True)
    occupation = Column(String, nullable=True)
    goal = Column(String, nullable=True)
    daily_study_target = Column(Integer, nullable=True)
    is_profile_complete = Column(Boolean, default=False)
    
    # AI Kişilik Özellikleri
    # NOTE: These columns were added after initial schema creation.
    # On existing databases, run a migration (e.g. Alembic) or recreate the DB
    # to add these columns before running the application.
    learning_style = Column(String, nullable=True) # English token: visual, auditory, kinesthetic, reading_writing, mixed
    work_tendency = Column(String, nullable=True) # English token: morning_lark, night_owl, sprinter, marathoner
    core_values = Column(String, nullable=True) # Comma separated values
    stress_level = Column(Integer, default=5)

    created_at = Column(DateTime, default=datetime.utcnow)

    # İlişkiler
    pomodoro_sessions = relationship("PomodoroSession", back_populates="user")
    ai_feedbacks = relationship("AIFeedback", back_populates="user")  