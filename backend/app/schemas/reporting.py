from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, List


class WeeklyReportStats(BaseModel):
    """Haftalık istatistikler"""
    total_sessions: int
    completed_sessions: int
    cancelled_sessions: int
    total_minutes: int
    category_breakdown: Dict[str, int]  # {"lesson": 300, "project": 150}
    daily_breakdown: Dict[str, int]     # {"2026-02-03": 60, "2026-02-04": 90}
    goal_achievement: float             # Hedef başarı yüzdesi


class WeeklyReportResponse(BaseModel):
    """Haftalık rapor response"""
    id: int
    user_id: int
    week_start: datetime
    week_end: datetime
    created_at: datetime
    stats: WeeklyReportStats
    ai_message: Optional[str] = None
    is_viewed: bool
    
    class Config:
        from_attributes = True


class WeeklyReportList(BaseModel):
    """Kullanıcının tüm raporları"""
    reports: List[WeeklyReportResponse]
    total_count: int


class GenerateReportRequest(BaseModel):
    """Manuel rapor oluşturma isteği"""
    week_start: Optional[datetime] = None  # Belirtilmezse son hafta
    week_end: Optional[datetime] = None