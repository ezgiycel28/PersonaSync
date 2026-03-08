"""
PersonaSync — AI Feedback Modeli
==================================
Kullanıcıların AI önerilerine verdikleri geri bildirimleri saklar.
Feedback loop mekanizmasının veritabanı katmanı.

Bu tablo:
- Beğenilen/reddedilen teknikleri kaydeder
- _get_feedback_history() tarafından okunarak Gemini prompt'una bağlam sağlar
- Reddedilen teknikler bir daha önerilmez (negatif feedback loop)
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class AIFeedback(Base):
    __tablename__ = "ai_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Geri bildirim verilen teknik
    technique = Column(String(100), nullable=False)

    # True = 👍 beğendi, False = 👎 beğenmedi
    liked = Column(Boolean, nullable=False)

    # Beğenilmeme nedeni (opsiyonel, kullanıcının yazdığı)
    rejection_reason = Column(Text, nullable=True)

    # Hangi öneri türüne geri bildirim: 'daily', 'weekly', 'alternative'
    advice_type = Column(String(20), default="daily", nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # İlişki
    user = relationship("User", back_populates="ai_feedbacks")

    def __repr__(self):
        status = "👍" if self.liked else "👎"
        return f"<AIFeedback user={self.user_id} {status} '{self.technique}'>"