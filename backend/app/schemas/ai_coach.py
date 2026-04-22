"""
PersonaSync — AI Koç Pydantic Şemaları
========================================
Frontend ↔ Backend arasındaki AI Koç veri sözleşmeleri.
"""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from enum import Enum


# ──────────────────────────────────────────────
# Enum'lar
# ──────────────────────────────────────────────

class MotivationTrigger(str, Enum):
    LOW_PERFORMANCE  = "low_performance"
    HIGH_CANCEL_RATE = "high_cancel_rate"
    USER_REQUEST     = "user_request"
    STREAK_BROKEN    = "streak_broken"
    GOAL_ACHIEVED    = "goal_achieved"


class StudyCategory(str, Enum):
    LESSON   = "lesson"
    PROJECT  = "project"
    READING  = "reading"
    HOMEWORK = "homework"
    PERSONAL = "personal"
    OTHER    = "other"


# ──────────────────────────────────────────────
# İSTEK ŞEMALARI (Request)
# ──────────────────────────────────────────────

class DailyAdviceRequest(BaseModel):
    extra_context: str | None = Field(
        default=None,
        max_length=300,
        description="Kullanıcının bugün odaklanmak istediği özel bir konu (opsiyonel)",
        examples=["Bugün sadece matematik çalışmak istiyorum"]
    )


class WeeklyReportRequest(BaseModel):
    days: int = Field(
        default=7,
        ge=3,
        le=30,
        description="Rapor için geriye gidilecek gün sayısı (3-30 arası)",
        examples=[7, 14]
    )


class MotivationRequest(BaseModel):
    trigger: MotivationTrigger = Field(
        default=MotivationTrigger.USER_REQUEST,
        description="Motivasyon mesajının tetikleyici nedeni"
    )
    user_note: str | None = Field(
        default=None,
        max_length=200,
        description="Kullanıcının ek mesajı veya bugün hissettikleri (opsiyonel)",
        examples=["Bugün çok yorgunum, başlayamıyorum"]
    )


class FeedbackRequest(BaseModel):
    technique: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Geri bildirim verilen teknik adı",
        examples=["Pomodoro 25/5", "Feynman Tekniği"]
    )
    liked: bool = Field(
        ...,
        description="True = beğendi (👍), False = beğenmedi (👎)"
    )
    rejection_reason: str | None = Field(
        default=None,
        max_length=300,
        description="Beğenilmeme nedeni — liked=False ise doldurulabilir",
        examples=["25 dakika çok uzun geliyor"]
    )
    advice_type: str = Field(
        default="daily",
        description="Hangi öneri türüne geri bildirim: 'daily', 'weekly', 'alternative'",
        examples=["daily", "weekly"]
    )

    @field_validator("rejection_reason")
    @classmethod
    def rejection_reason_required_when_disliked(cls, v, info):
        return v


class SessionSummaryRequest(BaseModel):
    session_id: int = Field(
        ...,
        description="Tamamlanan pomodoro seans ID'si",
        examples=[42]
    )


# ──────────────────────────────────────────────
# YANIT ŞEMALARI (Response)
# ──────────────────────────────────────────────

class DailyAdviceResponse(BaseModel):
    technique: str = Field(
        description="Önerilen çalışma tekniğinin adı",
        examples=["Pomodoro 25/5", "Feynman Tekniği", "Active Recall"]
    )
    why_this_works: str = Field(
        description="Bu tekniğin kullanıcıya neden uygun olduğunun kişisel açıklaması"
    )
    steps: list[str] = Field(
        description="Tekniğin uygulanma adımları (somut, kısa)",
        min_length=1,
        max_length=5
    )
    duration_suggestion: str = Field(
        description="Bugün için önerilen çalışma-mola düzeni",
        examples=["25 dakika çalış, 5 dakika mola — 4 seans yap"]
    )
    motivational_note: str = Field(
        description="Kullanıcıya özel motive edici not"
    )
    category_focus: str = Field(
        description="Bugün hangi kategoriye öncelik vermeli"
    )
    generated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Önerinin üretildiği UTC zamanı"
    )
    model_used: str = Field(
        default="gemini-2.5-flash",
        description="Kullanılan Gemini modeli"
    )

    class Config:
        from_attributes = True
        protected_namespaces = ()


class WeeklyReportResponse(BaseModel):
    week_summary: str = Field(description="Haftanın kısa genel özeti (2-3 cümle)")
    strengths: list[str] = Field(description="Bu hafta iyi giden alanlar", min_length=1, max_length=4)
    improvements: list[str] = Field(description="Gelecek hafta geliştirilebilecek alanlar", min_length=1, max_length=4)
    highlight: str = Field(description="Haftanın en önemli başarısı veya dikkat çeken noktası")
    next_week_focus: str = Field(description="Gelecek hafta için öncelikli odak alanı ve somut hedef")
    technique_recommendation: str = Field(description="Gelecek hafta için önerilen çalışma tekniği")
    technique_reason: str = Field(description="Teknik önerisinin kişisel açıklaması")
    motivational_closing: str = Field(description="Haftayı kapatan motive edici kapanış mesajı")
    stats_snapshot: dict | None = Field(default=None, description="Raporun dayandığı istatistik özeti")
    period_days: int = Field(default=7, description="Raporun kapsadığı gün sayısı")
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class MotivationResponse(BaseModel):
    title: str = Field(description="Mesaj başlığı (emoji + kısa başlık)", examples=["💪 Devam Et!"])
    message: str = Field(description="Ana motivasyon mesajı (2-4 cümle, kişisel)")
    action: str = Field(description="Hemen yapılabilecek 1 somut adım")
    reminder: str = Field(description="Hedefe bağlayan kısa hatırlatıcı")
    trigger: MotivationTrigger = Field(description="Bu mesajı tetikleyen durum")
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class AlternativeTechniqueResponse(BaseModel):
    technique: str = Field(description="Yeni önerilen teknik adı")
    why_different: str = Field(description="Reddedilen teknikten nasıl farklı")
    why_suits_you: str = Field(description="Kullanıcıya neden uygun")
    steps: list[str] = Field(description="Uygulama adımları", min_length=1, max_length=5)
    try_suggestion: str = Field(description="Bugün nasıl denenebileceğine dair somut senaryo")

    class Config:
        from_attributes = True


class FeedbackResponse(BaseModel):
    success: bool = Field(description="Geri bildirimin başarıyla kaydedildiği")
    message: str = Field(description="Kullanıcıya gösterilecek onay mesajı")
    feedback_id: int = Field(description="Kaydedilen feedback'in DB ID'si")
    alternative: AlternativeTechniqueResponse | None = Field(
        default=None,
        description="liked=False ise Gemini'nin ürettiği alternatif teknik önerisi"
    )

    class Config:
        from_attributes = True


class SessionSummaryResponse(BaseModel):
    reaction: str = Field(description="Seans tamamlama tepkisi (emoji + 1 cümle)")
    progress_note: str = Field(description="Günlük hedefteki ilerleme notu")
    next_step: str = Field(description="Bir sonraki adım önerisi")
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# PersonaSync AI Engine Modelleri (Kişisel Koç)
# ──────────────────────────────────────────────

class LearningStyle(str, Enum):
    VISUAL = "görsel"
    AUDITORY = "işitsel"
    KINESTHETIC = "kinestetik"
    READING_WRITING = "okuma_yazma"
    MIXED = "karma"


class WorkTendency(str, Enum):
    MORNING_LARK = "sabahçı"
    NIGHT_OWL = "gececi"
    SPRINTER = "kısa_mesafeci"
    MARATHONER = "maratoncu"


class PersonalityProfile(BaseModel):
    learning_style: LearningStyle = Field(..., description="Kullanıcının baskın öğrenme stili")
    work_tendency: WorkTendency = Field(..., description="Kullanıcının çalışma zamanı ve yoğunluk tercihi")
    core_values: list[str] = Field(default_factory=list, description="Kullanıcıyı motive eden temel değerler")
    stress_level: int = Field(default=5, ge=1, le=10, description="Kullanıcının genel stres beyanı (1-10)")


class BehaviorMetrics(BaseModel):
    total_study_time_minutes: int = Field(..., ge=0)
    completed_tasks_count: int = Field(..., ge=0)
    average_focus_duration: float = Field(..., ge=0.0)
    most_productive_hour: int | None = Field(None, ge=0, le=23)
    interruption_count: int = Field(default=0, ge=0)


class CoachResponse(BaseModel):
    optimal_study_schedule: str = Field(..., description="Önerilen en uygun çalışma saatleri ve düzeni")
    personalized_strategy: str = Field(..., description="Öğrenme stiline özgü teknikler ve taktikler")
    motivational_insight: str = Field(..., description="Kişiselleştirilmiş motive edici içgörü mesajı")


# ──────────────────────────────────────────────
# YARDIMCI ŞEMALAR
# ──────────────────────────────────────────────

class AIHealthResponse(BaseModel):
    status: str = Field(description="'healthy' veya 'unhealthy'")
    model: str | None = Field(default=None, description="Kullanılan model adı")
    error: str | None = Field(default=None, description="Hata varsa açıklaması")
    checked_at: datetime = Field(default_factory=datetime.utcnow)