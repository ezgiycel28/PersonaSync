from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from enum import Enum

class StudyCategoryEnum(str, Enum):
    LESSON = "lesson"
    PROJECT = "project"
    READING = "reading"
    HOMEWORK = "homework"
    PERSONAL = "personal"
    OTHER = "other"

class PomodoroStatusEnum(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

# Pomodoro başlatma
class PomodoroStart(BaseModel):
    duration_minutes: int = 25
    category: StudyCategoryEnum = StudyCategoryEnum.OTHER

# Pomodoro tamamlama/iptal
class PomodoroEnd(BaseModel):
    note: Optional[str] = None  # İsteğe bağlı

# Pomodoro response
class PomodoroResponse(BaseModel):
    id: int
    user_id: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: int
    status: str
    category: str
    note: Optional[str] = None

    class Config:
        from_attributes = True

# Günlük/haftalık istatistikler için
class PomodoroStats(BaseModel):
    total_sessions: int
    completed_sessions: int
    cancelled_sessions: int
    total_minutes: int
    category_breakdown: dict

# Pomodoro listesi
class PomodoroHistory(BaseModel):
    sessions: List[PomodoroResponse]
    stats: PomodoroStats