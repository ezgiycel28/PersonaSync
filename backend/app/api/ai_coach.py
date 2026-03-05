"""
PersonaSync — AI Koç API Endpoint'leri
========================================
Google Gemini destekli kişisel verimlilik koçu endpoint'leri.

Bu modül, frontend'den gelen istekleri karşılar, gerekli verileri veritabanından toplar
ve PersonaSync AI Engine'i tetikleyerek kişiselleştirilmiş yanıtlar üretir.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.pomodoro import PomodoroSession, PomodoroStatus
from app.services.gemini_service import (
    PersonaSyncAIEngine,
    get_ai_engine,
    GeminiServiceError,
    GeminiRateLimitError,
)
from app.schemas.ai_coach import (
    CoachResponse,
    PersonalityProfile,
    BehaviorMetrics,
    LearningStyle,
    WorkTendency,
    DailyAdviceRequest
)

# ──────────────────────────────────────────────
# Router & Logger
# ──────────────────────────────────────────────
router = APIRouter(prefix="/ai", tags=["AI Coach"])
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Yardımcı Fonksiyonlar
# ──────────────────────────────────────────────
_LEARNING_STYLE_MAP = {
    "visual": LearningStyle.VISUAL,
    "auditory": LearningStyle.AUDITORY,
    "kinesthetic": LearningStyle.KINESTHETIC,
    "reading_writing": LearningStyle.READING_WRITING,
    "mixed": LearningStyle.MIXED,
}

_WORK_TENDENCY_MAP = {
    "morning_lark": WorkTendency.MORNING_LARK,
    "night_owl": WorkTendency.NIGHT_OWL,
    "sprinter": WorkTendency.SPRINTER,
    "marathoner": WorkTendency.MARATHONER,
}

def _get_learning_style(user_style: Optional[str]) -> LearningStyle:
    if not user_style:
        return LearningStyle.VISUAL
    # Try English key mapping first, then fall back to enum value (Turkish)
    normalized = user_style.strip().lower()
    if normalized in _LEARNING_STYLE_MAP:
        return _LEARNING_STYLE_MAP[normalized]
    try:
        return LearningStyle(user_style)
    except ValueError:
        return LearningStyle.VISUAL

def _get_work_tendency(user_tendency: Optional[str]) -> WorkTendency:
    if not user_tendency:
        return WorkTendency.MORNING_LARK
    # Try English key mapping first, then fall back to enum value (Turkish)
    normalized = user_tendency.strip().lower()
    if normalized in _WORK_TENDENCY_MAP:
        return _WORK_TENDENCY_MAP[normalized]
    try:
        return WorkTendency(user_tendency)
    except ValueError:
        return WorkTendency.MORNING_LARK

# ──────────────────────────────────────────────
# Endpoint'ler
# ──────────────────────────────────────────────

@router.post("/daily-advice", response_model=CoachResponse)
async def get_daily_advice(
    request: Optional[DailyAdviceRequest] = Body(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    engine: PersonaSyncAIEngine = Depends(get_ai_engine)
):
    """
    Kullanıcının günlük verimlilik stratejisini oluşturur.
    Veritabanındaki profil ve son 7 günlük aktivite verilerini kullanır.
    """
    try:
        # 1. Profil Verisini Hazırla
        core_vals = []
        if current_user.core_values:
            # Virgülle ayrılmış string ise listeye çevir
            if isinstance(current_user.core_values, str):
                core_vals = [v.strip() for v in current_user.core_values.split(",") if v.strip()]
            
        profile = PersonalityProfile(
            learning_style=_get_learning_style(getattr(current_user, 'learning_style', None)),
            work_tendency=_get_work_tendency(getattr(current_user, 'work_tendency', None)),
            core_values=core_vals,
            stress_level=getattr(current_user, 'stress_level', 5) or 5
        )

        # 2. Çalışma Verilerini Hazırla (Son 7 Gün)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        sessions = db.query(PomodoroSession).filter(
            PomodoroSession.user_id == current_user.id,
            PomodoroSession.started_at >= seven_days_ago
        ).all()

        # Engine için ham log formatına çevir
        raw_logs = []
        for s in sessions:
            if hasattr(s.status, 'value'):
                status_str = s.status.value
            else:
                status_str = str(s.status)
                
            raw_logs.append({
                "duration_minutes": s.duration_minutes,
                "status": status_str,
                "start_time": s.started_at,
                "interruptions": 0 # Gelecekte eklenebilir
            })
        
        # Engine içinde metrics hesapla
        metrics = engine.preprocess_data(raw_logs)

        # 3. AI Koç'tan Tavsiye İste
        logger.info(f"AI Tavsiyesi isteniyor - User: {current_user.id}")
        extra_context = request.extra_context if request else None
        advice = await engine.generate_coaching_advice(profile, metrics, extra_context=extra_context)
        
        return advice

    except GeminiRateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI servisi şu an çok yoğun. Lütfen 1 dakika sonra tekrar deneyin."
        )
    except GeminiServiceError as e:
        logger.error(f"AI Servis Hatası: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI servisine şu anda bağlanılamıyor. Lütfen daha sonra tekrar deneyin."
        )
    except Exception as e:
        logger.exception(f"Beklenmeyen Hata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Sunucu tarafında bir hata oluştu."
        )

@router.get("/health")
def health_check():
    """Servis sağlık kontrolü."""
    return {"status": "active", "service": "PersonaSync AI Engine"}
