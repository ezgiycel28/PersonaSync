"""
PersonaSync — AI Koç API Endpoint'leri
========================================
Google Gemini destekli kişisel verimlilik koçu endpoint'leri.

Endpoint'ler:
    POST /api/ai/daily-advice      — Günlük kişisel çalışma önerisi
    POST /api/ai/weekly-report     — Haftalık koçluk raporu
    POST /api/ai/motivation        — Motivasyon mesajı
    POST /api/ai/feedback          — Öneri geri bildirimi + alternatif
    POST /api/ai/session-summary   — Seans tamamlama özeti
    GET  /api/ai/health            — Gemini servis sağlık kontrolü

Her endpoint:
    1. JWT token ile kullanıcıyı doğrular
    2. Pomodoro ve profil verisini DB'den çeker
    3. Uygun prompt'u doldurur
    4. Gemini'ye gönderir, yanıtı parse eder
    5. Yapılandırılmış yanıt döner
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User
from app.models.pomodoro import PomodoroSession, PomodoroStatus
from app.models.ai_feedback import AIFeedback          # ADIM 9'da oluşturulacak
from app.services.gemini_service import (
    GeminiService,
    get_gemini_service,
    GeminiServiceError,
    GeminiRateLimitError,
    GeminiParseError,
    GeminiBlockedError,
)
from app.core.prompts import (
    UserProfile,
    DailyStats,
    WeeklyStats,
    FeedbackHistory,
    build_daily_advice_prompt,
    build_weekly_report_prompt,
    build_motivation_prompt,
    build_alternative_technique_prompt,
    build_session_summary_prompt,
)
from app.schemas.ai_coach import (
    DailyAdviceRequest,
    DailyAdviceResponse,
    WeeklyReportRequest,
    WeeklyReportResponse,
    MotivationRequest,
    MotivationResponse,
    FeedbackRequest,
    FeedbackResponse,
    AlternativeTechniqueResponse,
    SessionSummaryRequest,
    SessionSummaryResponse,
    AIHealthResponse,
)

# ──────────────────────────────────────────────
# Router & Logger
# ──────────────────────────────────────────────
router = APIRouter(prefix="/ai", tags=["AI Coach"])
security = HTTPBearer()
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Auth Dependency — Mevcut pomodoro.py ile aynı pattern
# ──────────────────────────────────────────────
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """JWT token'dan kullanıcıyı çek ve doğrula."""
    token = credentials.credentials
    payload = verify_token(token)

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz token: user_id bulunamadı",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı",
        )

    return user


# ──────────────────────────────────────────────
# Yardımcı Fonksiyonlar — DB'den veri hazırlama
# ──────────────────────────────────────────────
def _build_user_profile(user: User) -> UserProfile:
    """
    User modelinden Gemini prompt'u için UserProfile oluştur.
    Hassas alanlar (email, password) bu yapıya asla eklenmez.
    """
    first_name = (user.full_name or "Kullanıcı").split()[0]

    return UserProfile(
        first_name=first_name,
        goal=user.goal or "Genel Kişisel Gelişim",
        occupation=user.occupation or "Belirtilmemiş",
        daily_target_minutes=user.daily_study_target or 60,
        age=user.age,
    )


def _get_today_stats(user_id: int, db: Session) -> DailyStats:
    """Bugünün (UTC) pomodoro istatistiklerini DB'den çek."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    sessions = (
        db.query(PomodoroSession)
        .filter(
            PomodoroSession.user_id == user_id,
            PomodoroSession.started_at >= today_start,
        )
        .all()
    )

    completed = [s for s in sessions if s.status == PomodoroStatus.COMPLETED]
    cancelled = [s for s in sessions if s.status == PomodoroStatus.CANCELLED]

    # Kategori dağılımı
    category_breakdown: dict[str, int] = {}
    for s in completed:
        category_breakdown[s.category] = category_breakdown.get(s.category, 0) + 1

    return DailyStats(
        completed_sessions=len(completed),
        cancelled_sessions=len(cancelled),
        total_minutes_today=sum(s.duration_minutes for s in completed),
        category_breakdown=category_breakdown,
        active_minutes_goal=0,  # _build_user_profile'dan doldurulacak
    )


def _get_weekly_stats(user_id: int, days: int, db: Session) -> WeeklyStats:
    """Son N günün pomodoro istatistiklerini DB'den çek."""
    since = datetime.utcnow() - timedelta(days=days)

    sessions = (
        db.query(PomodoroSession)
        .filter(
            PomodoroSession.user_id == user_id,
            PomodoroSession.started_at >= since,
        )
        .all()
    )

    completed = [s for s in sessions if s.status == PomodoroStatus.COMPLETED]
    cancelled = [s for s in sessions if s.status == PomodoroStatus.CANCELLED]

    # Kategori dağılımı
    category_breakdown: dict[str, int] = {}
    for s in completed:
        category_breakdown[s.category] = category_breakdown.get(s.category, 0) + 1

    # Günlük dağılım
    daily_breakdown: dict[str, int] = {}
    for s in completed:
        day_key = s.started_at.strftime("%Y-%m-%d")
        daily_breakdown[day_key] = daily_breakdown.get(day_key, 0) + s.duration_minutes

    daily_values = list(daily_breakdown.values())
    best_day = max(daily_values) if daily_values else 0
    worst_day = min(daily_values) if daily_values else 0

    # Streak hesaplama (arka arkaya aktif gün)
    streak = _calculate_streak(user_id, db)

    return WeeklyStats(
        total_sessions=len(sessions),
        completed_sessions=len(completed),
        cancelled_sessions=len(cancelled),
        total_minutes=sum(s.duration_minutes for s in completed),
        daily_breakdown=daily_breakdown,
        category_breakdown=category_breakdown,
        best_day_minutes=best_day,
        worst_day_minutes=worst_day,
        streak_days=streak,
    )


def _calculate_streak(user_id: int, db: Session) -> int:
    """
    Bugünden geriye giderek kaç gün üst üste pomodoro tamamlanmış hesaplar.
    """
    streak = 0
    check_date = datetime.utcnow().date()

    for _ in range(30):  # Max 30 gün kontrol et
        day_start = datetime.combine(check_date, datetime.min.time())
        day_end = day_start + timedelta(days=1)

        count = (
            db.query(func.count(PomodoroSession.id))
            .filter(
                PomodoroSession.user_id == user_id,
                PomodoroSession.status == PomodoroStatus.COMPLETED,
                PomodoroSession.started_at >= day_start,
                PomodoroSession.started_at < day_end,
            )
            .scalar()
        )

        if count and count > 0:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    return streak


def _get_feedback_history(user_id: int, db: Session) -> FeedbackHistory:
    """
    Kullanıcının geçmiş AI geri bildirimlerini DB'den çek.
    Feedback loop için Gemini'ye bağlam olarak gönderilir.
    """
    feedbacks = (
        db.query(AIFeedback)
        .filter(AIFeedback.user_id == user_id)
        .order_by(AIFeedback.created_at.desc())
        .limit(20)  # Son 20 geri bildirim yeterli
        .all()
    )

    liked = [f.technique for f in feedbacks if f.liked]
    disliked = [f.technique for f in feedbacks if not f.liked]

    # Tekrar edenleri temizle, sırayı koru
    liked_unique = list(dict.fromkeys(liked))
    disliked_unique = list(dict.fromkeys(disliked))

    last_technique = feedbacks[0].technique if feedbacks else None

    return FeedbackHistory(
        liked_techniques=liked_unique[:5],      # Son 5 beğenilen
        disliked_techniques=disliked_unique[:5], # Son 5 reddedilen
        last_suggested_technique=last_technique,
    )


def _handle_gemini_error(e: Exception) -> HTTPException:
    """
    Gemini hata türlerine göre uygun HTTP hatası döndür.
    Kullanıcıya teknik hata detayı gösterilmez.
    """
    if isinstance(e, GeminiRateLimitError):
        logger.warning(f"Gemini rate limit: {e}")
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI koç şu an yoğun. Lütfen birkaç saniye sonra tekrar deneyin.",
        )
    elif isinstance(e, GeminiParseError):
        logger.error(f"Gemini parse hatası: {e}")
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI koç geçersiz yanıt döndürdü. Lütfen tekrar deneyin.",
        )
    elif isinstance(e, GeminiBlockedError):
        logger.warning(f"Gemini blocked: {e}")
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="İstek işlenemedi. Lütfen farklı bir şekilde deneyin.",
        )
    else:
        logger.exception(f"Beklenmeyen Gemini hatası: {e}")
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI koç şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
        )


# ──────────────────────────────────────────────
# ENDPOINT 1 — Günlük Çalışma Önerisi
# ──────────────────────────────────────────────
@router.post(
    "/daily-advice",
    response_model=DailyAdviceResponse,
    summary="Günlük kişisel çalışma önerisi al",
    description="""
    Kullanıcının profili ve bugünkü pomodoro verisine göre
    Google Gemini'nin kişiselleştirilmiş çalışma tekniği önerisi döner.
    
    - Geçmişte reddedilen teknikler asla önerilmez
    - Beğenilen tekniklere yakın öneriler önceliklidir
    - Günlük performans durumuna göre ton ayarlanır
    """,
)
def get_daily_advice(
    request: DailyAdviceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    gemini: GeminiService = Depends(get_gemini_service),
) -> DailyAdviceResponse:
    """Günlük kişisel çalışma önerisi."""

    logger.info(f"Günlük öneri isteği — user_id: {current_user.id}")

    # Veri hazırlama
    profile = _build_user_profile(current_user)
    today_stats = _get_today_stats(current_user.id, db)
    today_stats.active_minutes_goal = profile.daily_target_minutes
    feedback = _get_feedback_history(current_user.id, db)

    # Extra context varsa prompt'a ekle
    if request.extra_context:
        profile.goal = f"{profile.goal} (Bugünkü odak: {request.extra_context})"

    # Prompt oluştur ve Gemini'ye gönder
    try:
        prompt, expected_keys = build_daily_advice_prompt(profile, today_stats, feedback)
        raw = gemini.generate_json(prompt=prompt, expected_keys=expected_keys, use_pro=False)
    except (GeminiServiceError, GeminiRateLimitError, GeminiParseError, GeminiBlockedError) as e:
        raise _handle_gemini_error(e)

    logger.info(f"Günlük öneri üretildi — user_id: {current_user.id}, teknik: {raw.get('technique')}")

    return DailyAdviceResponse(
        technique=raw["technique"],
        why_this_works=raw["why_this_works"],
        steps=raw["steps"],
        duration_suggestion=raw["duration_suggestion"],
        motivational_note=raw["motivational_note"],
        category_focus=raw["category_focus"],
    )


# ──────────────────────────────────────────────
# ENDPOINT 2 — Haftalık Koçluk Raporu
# ──────────────────────────────────────────────
@router.post(
    "/weekly-report",
    response_model=WeeklyReportResponse,
    summary="Haftalık AI koçluk raporu üret",
    description="""
    Son 7 günün (varsayılan) pomodoro verisini analiz ederek
    kapsamlı haftalık koçluk raporu üretir.
    
    - Güçlü yönler ve gelişim alanları
    - Haftanın özeti ve öne çıkan başarı
    - Gelecek hafta için teknik önerisi
    - Kişiselleştirilmiş kapanış mesajı
    
    Not: Bu endpoint Pro model kullanır, yanıt 3-5 saniye sürebilir.
    """,
)
def get_weekly_report(
    request: WeeklyReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    gemini: GeminiService = Depends(get_gemini_service),
) -> WeeklyReportResponse:
    """Haftalık koçluk raporu."""

    logger.info(f"Haftalık rapor isteği — user_id: {current_user.id}, days: {request.days}")

    # Veri hazırlama
    profile = _build_user_profile(current_user)
    weekly_stats = _get_weekly_stats(current_user.id, request.days, db)
    feedback = _get_feedback_history(current_user.id, db)

    # Yeterli veri var mı?
    if weekly_stats.total_sessions < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Son {request.days} günde yeterli çalışma verisi bulunamadı. "
                   "Rapor oluşturmak için en az 1 pomodoro seansı tamamlayın.",
        )

    # İstatistik özeti — frontend grafikleri için
    stats_snapshot = {
        "total_sessions": weekly_stats.total_sessions,
        "completed_sessions": weekly_stats.completed_sessions,
        "cancelled_sessions": weekly_stats.cancelled_sessions,
        "total_minutes": weekly_stats.total_minutes,
        "completion_rate": round(
            weekly_stats.completed_sessions / weekly_stats.total_sessions * 100, 1
        ) if weekly_stats.total_sessions > 0 else 0,
        "daily_breakdown": weekly_stats.daily_breakdown,
        "category_breakdown": weekly_stats.category_breakdown,
        "streak_days": weekly_stats.streak_days,
        "best_day_minutes": weekly_stats.best_day_minutes,
    }

    # Prompt oluştur — Pro model ile gönder
    try:
        prompt, expected_keys = build_weekly_report_prompt(profile, weekly_stats, feedback)
        raw = gemini.generate_json(prompt=prompt, expected_keys=expected_keys, use_pro=True)
    except (GeminiServiceError, GeminiRateLimitError, GeminiParseError, GeminiBlockedError) as e:
        raise _handle_gemini_error(e)

    logger.info(f"Haftalık rapor üretildi — user_id: {current_user.id}")

    return WeeklyReportResponse(
        week_summary=raw["week_summary"],
        strengths=raw["strengths"],
        improvements=raw["improvements"],
        highlight=raw["highlight"],
        next_week_focus=raw["next_week_focus"],
        technique_recommendation=raw["technique_recommendation"],
        technique_reason=raw["technique_reason"],
        motivational_closing=raw["motivational_closing"],
        stats_snapshot=stats_snapshot,
        period_days=request.days,
    )


# ──────────────────────────────────────────────
# ENDPOINT 3 — Motivasyon Mesajı
# ──────────────────────────────────────────────
@router.post(
    "/motivation",
    response_model=MotivationResponse,
    summary="Kişiselleştirilmiş motivasyon mesajı al",
    description="""
    Belirtilen tetikleyici duruma göre kişiselleştirilmiş
    motivasyon mesajı üretir.
    
    Tetikleyiciler:
    - `low_performance`: Günlük hedefin altında
    - `high_cancel_rate`: Yüksek iptal oranı
    - `user_request`: Kullanıcı manuel istedi
    - `streak_broken`: Seri bozuldu
    - `goal_achieved`: Hedef tamamlandı (kutlama)
    """,
)
def get_motivation(
    request: MotivationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    gemini: GeminiService = Depends(get_gemini_service),
) -> MotivationResponse:
    """Kişiselleştirilmiş motivasyon mesajı."""

    logger.info(
        f"Motivasyon isteği — user_id: {current_user.id}, trigger: {request.trigger}"
    )

    # Veri hazırlama
    profile = _build_user_profile(current_user)
    today_stats = _get_today_stats(current_user.id, db)
    today_stats.active_minutes_goal = profile.daily_target_minutes

    # Kullanıcı notu varsa profile ekle
    if request.user_note:
        profile.goal = f"{profile.goal} (Not: {request.user_note})"

    # Prompt oluştur ve Gemini'ye gönder
    try:
        prompt, expected_keys = build_motivation_prompt(
            profile=profile,
            today_stats=today_stats,
            trigger=request.trigger.value,
        )
        raw = gemini.generate_json(prompt=prompt, expected_keys=expected_keys, use_pro=False)
    except (GeminiServiceError, GeminiRateLimitError, GeminiParseError, GeminiBlockedError) as e:
        raise _handle_gemini_error(e)

    logger.info(f"Motivasyon mesajı üretildi — user_id: {current_user.id}")

    return MotivationResponse(
        title=raw["title"],
        message=raw["message"],
        action=raw["action"],
        reminder=raw["reminder"],
        trigger=request.trigger,
    )


# ──────────────────────────────────────────────
# ENDPOINT 4 — Geri Bildirim Kaydet + Alternatif
# ──────────────────────────────────────────────
@router.post(
    "/feedback",
    response_model=FeedbackResponse,
    summary="Öneri geri bildirimi kaydet",
    description="""
    Kullanıcının bir AI önerisine verdiği 👍/👎 geri bildirimini kaydeder.
    
    - `liked=True` → Geri bildirim kaydedilir
    - `liked=False` → Geri bildirim kaydedilir + Gemini alternatif teknik önerir
    
    Bu veriler feedback loop'u besler:
    reddedilen teknikler bir daha önerilmez.
    """,
)
def submit_feedback(
    request: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    gemini: GeminiService = Depends(get_gemini_service),
) -> FeedbackResponse:
    """Geri bildirim kaydet, beğenilmediyse alternatif üret."""

    logger.info(
        f"Feedback — user_id: {current_user.id}, "
        f"teknik: {request.technique}, liked: {request.liked}"
    )

    # DB'ye kaydet
    feedback_record = AIFeedback(
        user_id=current_user.id,
        technique=request.technique,
        liked=request.liked,
        rejection_reason=request.rejection_reason,
        advice_type=request.advice_type,
    )
    db.add(feedback_record)
    db.commit()
    db.refresh(feedback_record)

    # Beğenildi — sadece onayla
    if request.liked:
        return FeedbackResponse(
            success=True,
            message=f"'{request.technique}' tekniği beğeni listene eklendi! 👍",
            feedback_id=feedback_record.id,
            alternative=None,
        )

    # Beğenilmedi — Gemini'den alternatif teknik al
    logger.info(f"Alternatif teknik üretiliyor — reddedilen: {request.technique}")

    profile = _build_user_profile(current_user)
    feedback_history = _get_feedback_history(current_user.id, db)

    alternative: Optional[AlternativeTechniqueResponse] = None

    try:
        prompt, expected_keys = build_alternative_technique_prompt(
            profile=profile,
            rejected_technique=request.technique,
            rejection_reason=request.rejection_reason,
            feedback=feedback_history,
        )
        raw = gemini.generate_json(prompt=prompt, expected_keys=expected_keys, use_pro=False)

        alternative = AlternativeTechniqueResponse(
            technique=raw["technique"],
            why_different=raw["why_different"],
            why_suits_you=raw["why_suits_you"],
            steps=raw["steps"],
            try_suggestion=raw["try_suggestion"],
        )
        logger.info(f"Alternatif teknik üretildi: {raw.get('technique')}")

    except (GeminiServiceError, GeminiRateLimitError, GeminiParseError, GeminiBlockedError) as e:
        # Alternatif üretilemese bile feedback kaydedildi, hata fırlatma
        logger.error(f"Alternatif teknik üretilemedi: {e}")

    return FeedbackResponse(
        success=True,
        message=f"Geri bildirim alındı. '{request.technique}' bir daha önerilmeyecek.",
        feedback_id=feedback_record.id,
        alternative=alternative,
    )


# ──────────────────────────────────────────────
# ENDPOINT 5 — Seans Tamamlama Özeti
# ──────────────────────────────────────────────
@router.post(
    "/session-summary",
    response_model=SessionSummaryResponse,
    summary="Tamamlanan seans için anlık AI geri bildirimi",
    description="""
    Bir pomodoro seansı tamamlandığında çağrılır.
    Kullanıcıya anlık, kısa ve motive edici geri bildirim döner.
    """,
)
def get_session_summary(
    request: SessionSummaryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    gemini: GeminiService = Depends(get_gemini_service),
) -> SessionSummaryResponse:
    """Seans tamamlama özeti."""

    # Seansı DB'den çek
    session = (
        db.query(PomodoroSession)
        .filter(
            PomodoroSession.id == request.session_id,
            PomodoroSession.user_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pomodoro seansı bulunamadı.",
        )

    if session.status != PomodoroStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seans henüz tamamlanmamış. Önce seansı tamamlayın.",
        )

    # Veri hazırlama
    profile = _build_user_profile(current_user)
    today_stats = _get_today_stats(current_user.id, db)
    today_stats.active_minutes_goal = profile.daily_target_minutes

    # Prompt oluştur
    try:
        prompt, expected_keys = build_session_summary_prompt(
            profile=profile,
            session_duration_minutes=session.duration_minutes,
            session_category=session.category,
            session_note=session.note,
            today_stats=today_stats,
        )
        raw = gemini.generate_json(prompt=prompt, expected_keys=expected_keys, use_pro=False)
    except (GeminiServiceError, GeminiRateLimitError, GeminiParseError, GeminiBlockedError) as e:
        raise _handle_gemini_error(e)

    logger.info(
        f"Seans özeti üretildi — user_id: {current_user.id}, "
        f"session_id: {request.session_id}"
    )

    return SessionSummaryResponse(
        reaction=raw["reaction"],
        progress_note=raw["progress_note"],
        next_step=raw["next_step"],
    )


# ──────────────────────────────────────────────
# ENDPOINT 6 — Sağlık Kontrolü
# ──────────────────────────────────────────────
@router.get(
    "/health",
    response_model=AIHealthResponse,
    summary="Gemini AI servis sağlık kontrolü",
    description="Gemini API bağlantısının aktif olup olmadığını kontrol eder.",
)
def ai_health_check(
    gemini: GeminiService = Depends(get_gemini_service),
) -> AIHealthResponse:
    """Gemini servis sağlık kontrolü — auth gerektirmez."""
    result = gemini.health_check()
    return AIHealthResponse(
        status=result["status"],
        model=result.get("model"),
        error=result.get("error"),
    )