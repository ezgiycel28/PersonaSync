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
    occupation = Column(String, nullable=True)  # Meslek/okul
    goal = Column(String, nullable=True)  # Hedef (YKS, KPSS, vs.)
    daily_study_target = Column(Integer, nullable=True)  # Günlük hedef (dakika)
    is_profile_complete = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    pomodoro_sessions = relationship("PomodoroSession", back_populates="user")