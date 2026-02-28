from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class WeeklyReport(Base):
    """Haftalık rapor modeli - Her hafta kullanıcı için oluşturulur"""
    __tablename__ = "weekly_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Zaman aralığı
    week_start = Column(DateTime, nullable=False)  # Pazartesi 00:00
    week_end = Column(DateTime, nullable=False)    # Pazar 23:59
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # İstatistikler (JSON olarak saklanır)
    stats = Column(JSON, nullable=False)
    # Örnek stats yapısı:
    # {
    #     "total_sessions": 25,
    #     "completed_sessions": 20,
    #     "cancelled_sessions": 5,
    #     "total_minutes": 500,
    #     "category_breakdown": {"lesson": 300, "project": 150, "reading": 50},
    #     "daily_breakdown": {"2026-02-03": 60, "2026-02-04": 90, ...},
    #     "goal_achievement": 83.5  # Yüzde olarak hedef başarısı
    # }
    
    # AI'dan gelen motivasyon mesajı
    ai_message = Column(Text, nullable=True)
    
    # Rapor durumu
    is_viewed = Column(Integer, default=False)  # Kullanıcı gördü mü?
    
    # İlişkiler
    user = relationship("User", backref="weekly_reports")