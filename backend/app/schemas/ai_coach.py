"""
PersonaSync — AI Koç Pydantic Şemaları
========================================
Frontend ↔ Backend arasındaki AI Koç veri sözleşmeleri.

Tasarım ilkeleri:
- Her şema tek bir sorumluluğa sahip
- Tüm alanlar açıklamalı (Field description) — API dokümantasyonu için
- Optional alanlar varsayılan değerli
- Enum'lar string tabanlı — frontend uyumluluğu
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from enum import Enum


# ──────────────────────────────────────────────
# Enum'lar
# ──────────────────────────────────────────────

class MotivationTrigger(str, Enum):
    """
    Motivasyon mesajının hangi durumda tetiklendiğini belirtir.
    Gemini prompt'u bu bilgiye göre uyarlanır.
    """
    LOW_PERFORMANCE  = "low_performance"   # Günlük hedefin altında
    HIGH_CANCEL_RATE = "high_cancel_rate"  # Yüksek iptal oranı
    USER_REQUEST     = "user_request"      # Kullanıcı manuel istedi
    STREAK_BROKEN    = "streak_broken"     # Çalışma serisi bozuldu
    GOAL_ACHIEVED    = "goal_achieved"     # Günlük hedef aşıldı (kutlama)


class StudyCategory(str, Enum):
    """Pomodoro seansı kategorileri — models/pomodoro.py ile senkron."""
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
    """
    POST /api/ai/daily-advice
    Frontend'den günlük öneri isteği. Çoğu alan opsiyonel —
    backend mevcut DB verisini kullanarak doldurabilir.
    """
    # Eğer frontend ekstra bağlam göndermek isterse
    extra_context: Optional[str] = Field(
        default=None,
        max_length=300,
        description="Kullanıcının bugün odaklanmak istediği özel bir konu (opsiyonel)",
        examples=["Bugün sadece matematik çalışmak istiyorum"]
    )


class WeeklyReportRequest(BaseModel):
    """
    POST /api/ai/weekly-report
    Kaç günlük veri üzerinden rapor oluşturulacağını belirtir.
    """
    days: int = Field(
        default=7,
        ge=3,
        le=30,
        description="Rapor için geriye gidilecek gün sayısı (3-30 arası)",
        examples=[7, 14]
    )


class MotivationRequest(BaseModel):
    """
    POST /api/ai/motivation
    Motivasyon mesajı isteği.
    """
    trigger: MotivationTrigger = Field(
        default=MotivationTrigger.USER_REQUEST,
        description="Motivasyon mesajının tetikleyici nedeni"
    )
    user_note: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Kullanıcının ek mesajı veya bugün hissettikleri (opsiyonel)",
        examples=["Bugün çok yorgunum, başlayamıyorum"]
    )


class FeedbackRequest(BaseModel):
    """
    POST /api/ai/feedback
    Kullanıcının bir AI önerisine verdiği geri bildirim.
    Feedback loop mekanizmasının girdisi.
    """
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
    rejection_reason: Optional[str] = Field(
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
        # liked=False iken rejection_reason zorunlu değil ama teşvik edilir
        # Zorunlu yaparsak UX bozulur, bu yüzden sadece logluyoruz
        return v


class SessionSummaryRequest(BaseModel):
    """
    POST /api/ai/session-summary
    Pomodoro seansı tamamlandığında anlık AI geri bildirimi için.
    """
    session_id: int = Field(
        ...,
        description="Tamamlanan pomodoro seans ID'si",
        examples=[42]
    )


# ──────────────────────────────────────────────
# YANIT ŞEMALARI (Response)
# ──────────────────────────────────────────────

class DailyAdviceResponse(BaseModel):
    """
    Günlük AI koçluk önerisi yanıtı.
    Gemini'nin ürettiği JSON doğrudan bu şemaya map edilir.
    """
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

    # Meta bilgiler — frontend'de cache ve zaman damgası için
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


class WeeklyReportResponse(BaseModel):
    """
    Haftalık koçluk raporu yanıtı.
    Pro model ile üretilir.
    """
    week_summary: str = Field(
        description="Haftanın kısa genel özeti (2-3 cümle)"
    )
    strengths: list[str] = Field(
        description="Bu hafta iyi giden alanlar",
        min_length=1,
        max_length=4
    )
    improvements: list[str] = Field(
        description="Gelecek hafta geliştirilebilecek alanlar",
        min_length=1,
        max_length=4
    )
    highlight: str = Field(
        description="Haftanın en önemli başarısı veya dikkat çeken noktası"
    )
    next_week_focus: str = Field(
        description="Gelecek hafta için öncelikli odak alanı ve somut hedef"
    )
    technique_recommendation: str = Field(
        description="Gelecek hafta için önerilen çalışma tekniği"
    )
    technique_reason: str = Field(
        description="Teknik önerisinin kişisel açıklaması"
    )
    motivational_closing: str = Field(
        description="Haftayı kapatan motive edici kapanış mesajı"
    )

    # İstatistik özeti — frontend'de grafik için
    stats_snapshot: Optional[dict] = Field(
        default=None,
        description="Raporun dayandığı istatistik özeti (frontend grafikleri için)"
    )
    period_days: int = Field(
        default=7,
        description="Raporun kapsadığı gün sayısı"
    )
    generated_at: datetime = Field(
        default_factory=datetime.utcnow,
        description="Raporun üretildiği UTC zamanı"
    )

    class Config:
        from_attributes = True


class MotivationResponse(BaseModel):
    """
    Motivasyon mesajı yanıtı.
    Kısa ve hızlı — Flash model.
    """
    title: str = Field(
        description="Mesaj başlığı (emoji + kısa başlık)",
        examples=["💪 Devam Et!", "🎯 Hedefe Az Kaldı!"]
    )
    message: str = Field(
        description="Ana motivasyon mesajı (2-4 cümle, kişisel)"
    )
    action: str = Field(
        description="Hemen yapılabilecek 1 somut adım"
    )
    reminder: str = Field(
        description="Hedefe bağlayan kısa hatırlatıcı"
    )
    trigger: MotivationTrigger = Field(
        description="Bu mesajı tetikleyen durum"
    )
    generated_at: datetime = Field(
        default_factory=datetime.utcnow
    )

    class Config:
        from_attributes = True


class FeedbackResponse(BaseModel):
    """
    Feedback kaydı yanıtı.
    Feedback beğenmeme ise alternatif teknik önerisi de döner.
    """
    success: bool = Field(description="Geri bildirimin başarıyla kaydedildiği")
    message: str = Field(description="Kullanıcıya gösterilecek onay mesajı")
    feedback_id: int = Field(description="Kaydedilen feedback'in DB ID'si")

    # Beğenilmeme durumunda alternatif öneri
    alternative: Optional["AlternativeTechniqueResponse"] = Field(
        default=None,
        description="liked=False ise Gemini'nin ürettiği alternatif teknik önerisi"
    )

    class Config:
        from_attributes = True


class AlternativeTechniqueResponse(BaseModel):
    """
    Reddedilen teknik yerine önerilen alternatif.
    FeedbackResponse içinde döner.
    """
    technique: str = Field(description="Yeni önerilen teknik adı")
    why_different: str = Field(description="Reddedilen teknikten nasıl farklı")
    why_suits_you: str = Field(description="Kullanıcıya neden uygun")
    steps: list[str] = Field(description="Uygulama adımları", min_length=1, max_length=5)
    try_suggestion: str = Field(description="Bugün nasıl denenebileceğine dair somut senaryo")

    class Config:
        from_attributes = True


# Forward reference çözümü
FeedbackResponse.model_rebuild()


class SessionSummaryResponse(BaseModel):
    """
    Pomodoro seansı tamamlanınca üretilen anlık AI geri bildirimi.
    """
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
    SPRINTER = "kısa_mesafeci"  # Hızlı, yoğun çalışma
    MARATHONER = "maratoncu"    # Uzun süreli, istikrarlı çalışma

class PersonalityProfile(BaseModel):
    """Kullanıcının kişilik ve öğrenme profilini tanımlar."""
    learning_style: LearningStyle = Field(..., description="Kullanıcının baskın öğrenme stili")
    work_tendency: WorkTendency = Field(..., description="Kullanıcının çalışma zamanı ve yoğunluk tercihi")
    core_values: list[str] = Field(default_factory=list, description="Kullanıcıyı motive eden temel değerler")
    stress_level: int = Field(default=5, ge=1, le=10, description="Kullanıcının genel stres beyanı (1-10)")

class BehaviorMetrics(BaseModel):
    """Son dönemdeki (örn. son 7 gün) çalışma davranış istatistikleri."""
    total_study_time_minutes: int = Field(..., ge=0, description="Toplam kaydedilen çalışma süresi (dakika)")
    completed_tasks_count: int = Field(..., ge=0, description="Tamamlanan görev sayısı")
    average_focus_duration: float = Field(..., ge=0.0, description="Pomodoro başına ortalama odaklanma süresi (dakika)")
    most_productive_hour: Optional[int] = Field(None, ge=0, le=23, description="En fazla görevin tamamlandığı günün saati (0-23)")
    interruption_count: int = Field(default=0, ge=0, description="Çalışma sırasında bölünme veya mola sayısı")

class CoachResponse(BaseModel):
    """AI Koç tarafından üretilen yapılandırılmış yanıt."""
    optimal_study_schedule: str = Field(..., description="Kullanıcı verilerine göre önerilen en uygun çalışma saatleri ve düzeni")
    personalized_strategy: str = Field(..., description="Kullanıcının öğrenme stiline özgü teknikler ve taktikler")
    motivational_insight: str = Field(..., description="Veriye dayalı, kişiselleştirilmiş ve motive edici içgörü mesajı")


# ──────────────────────────────────────────────
# YARDIMCI ŞEMALAR
# ──────────────────────────────────────────────

class AIHealthResponse(BaseModel):
    """GET /api/ai/health — Gemini servis sağlık kontrolü."""
    status: str = Field(description="'healthy' veya 'unhealthy'")
    model: Optional[str] = Field(default=None, description="Kullanılan model adı")
    error: Optional[str] = Field(default=None, description="Hata varsa açıklaması")
    checked_at: datetime = Field(default_factory=datetime.utcnow)