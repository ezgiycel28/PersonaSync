"""
PersonaSync — AI Koç Prompt Şablonları
=======================================
Gemini'ye gönderilecek tüm prompt şablonları bu dosyada merkezi olarak yönetilir.

Tasarım ilkeleri:
- Her prompt fonksiyonu tip-güvenli parametreler alır
- Prompt'lar Gemini'nin system instruction'ıyla uyumlu yazılmıştır
- JSON çıktı beklenen prompt'lar beklenen anahtarları döndürür
- Kullanıcı verisi minimum düzeyde Gemini'ye gönderilir (gizlilik)
"""

from dataclasses import dataclass, field
from typing import Optional


# ──────────────────────────────────────────────
# Veri Yapıları — Prompt Parametreleri
# ──────────────────────────────────────────────

@dataclass
class UserProfile:
    """
    Gemini prompt'larına gönderilecek kullanıcı profili.
    Sadece AI koçluk için gerekli alanları içerir.
    Hassas veriler (email, şifre) bu yapıya asla eklenmez.
    """
    first_name: str                      # Kişisel hitap için
    goal: str                            # YKS, KPSS, Kariyer Gelişimi vb.
    occupation: str                      # Üniversite öğrencisi, Yazılımcı vb.
    daily_target_minutes: int            # Günlük çalışma hedefi (dk)
    age: Optional[int] = None            # Opsiyonel — yaş grubuna göre uyarlama


@dataclass
class DailyStats:
    """Bugünün pomodoro istatistikleri."""
    completed_sessions: int              # Tamamlanan pomodoro sayısı
    cancelled_sessions: int              # İptal edilen pomodoro sayısı
    total_minutes_today: int             # Bugün çalışılan toplam dakika
    category_breakdown: dict             # {"ders": 3, "proje": 1, "okuma": 2}
    active_minutes_goal: int             # Günlük hedef (tekrar — hesaplamada kullanılır)


@dataclass
class WeeklyStats:
    """Son 7 günün pomodoro istatistikleri."""
    total_sessions: int
    completed_sessions: int
    cancelled_sessions: int
    total_minutes: int
    daily_breakdown: dict                # {"2025-01-20": 90, "2025-01-21": 45, ...}
    category_breakdown: dict             # {"ders": 12, "proje": 5, ...}
    best_day_minutes: int                # Haftanın en verimli günü (dk)
    worst_day_minutes: int               # Haftanın en düşük günü (dk)
    streak_days: int                     # Arka arkaya çalışılan gün sayısı


@dataclass
class FeedbackHistory:
    """
    Kullanıcının geçmişte verdiği geri bildirimler.
    Feedback loop için Gemini'ye bağlam olarak gönderilir.
    """
    liked_techniques: list[str] = field(default_factory=list)    # Beğenilen teknikler
    disliked_techniques: list[str] = field(default_factory=list) # Reddedilen teknikler
    last_suggested_technique: Optional[str] = None               # Son önerilen teknik


# ──────────────────────────────────────────────
# Yardımcı Fonksiyonlar
# ──────────────────────────────────────────────

def _format_category_breakdown(breakdown: dict) -> str:
    """
    {"ders": 3, "proje": 1} → "Ders: 3 seans, Proje: 1 seans"
    """
    if not breakdown:
        return "Henüz kategori verisi yok."

    category_names = {
        "lesson":   "Ders",
        "project":  "Proje",
        "reading":  "Okuma",
        "homework": "Ödev",
        "personal": "Kişisel Gelişim",
        "other":    "Diğer",
    }

    parts = []
    for key, count in breakdown.items():
        name = category_names.get(key, key.capitalize())
        parts.append(f"{name}: {count} seans")
    return ", ".join(parts)


def _format_liked_techniques(techniques: list[str]) -> str:
    if not techniques:
        return "Henüz beğenilen teknik yok."
    return ", ".join(techniques)


def _format_disliked_techniques(techniques: list[str]) -> str:
    if not techniques:
        return "Henüz reddedilen teknik yok."
    return ", ".join(techniques)


def _calculate_completion_rate(completed: int, total: int) -> str:
    if total == 0:
        return "Veri yok"
    rate = (completed / total) * 100
    return f"%{rate:.0f}"


def _assess_performance_level(
    completed: int,
    cancelled: int,
    total_minutes: int,
    target_minutes: int,
) -> str:
    """
    Günlük performansı seviyeye dönüştür.
    Gemini'ye sayı vermek yerine anlamlı bir bağlam veriyoruz.
    """
    if total_minutes == 0 and completed == 0:
        return "Bugün henüz hiç çalışma yapılmamış"

    goal_ratio = total_minutes / target_minutes if target_minutes > 0 else 0
    cancel_ratio = cancelled / (completed + cancelled) if (completed + cancelled) > 0 else 0

    if goal_ratio >= 1.0 and cancel_ratio < 0.2:
        return "Hedefin üzerinde, çok başarılı bir gün"
    elif goal_ratio >= 0.7 and cancel_ratio < 0.3:
        return "Hedefe yakın, iyi bir gün"
    elif goal_ratio >= 0.4:
        return "Hedefin altında, orta düzey performans"
    elif cancel_ratio > 0.5:
        return "Yüksek iptal oranı, odaklanma güçlüğü yaşanıyor"
    else:
        return "Düşük performans, motivasyon desteği gerekiyor"


# ──────────────────────────────────────────────
# PROMPT 1 — Günlük Çalışma Önerisi
# ──────────────────────────────────────────────

def build_daily_advice_prompt(
    profile: UserProfile,
    today_stats: DailyStats,
    feedback: FeedbackHistory,
) -> tuple[str, list[str]]:
    """
    Kullanıcının bugünkü verilerine göre kişisel çalışma tekniği önerisi.

    Returns:
        (prompt_metni, beklenen_json_anahtarları)

    Beklenen JSON çıktısı:
    {
        "technique": "Teknik adı",
        "why_this_works": "Bu teknik sana neden uygun (kişisel, samimi)",
        "steps": ["Adım 1", "Adım 2", "Adım 3"],
        "duration_suggestion": "25 dakika çalış, 5 dakika mola",
        "motivational_note": "Seni motive eden kısa bir not",
        "category_focus": "Bugün en çok hangi kategoriye odaklanmalısın"
    }
    """
    performance = _assess_performance_level(
        today_stats.completed_sessions,
        today_stats.cancelled_sessions,
        today_stats.total_minutes_today,
        profile.daily_target_minutes,
    )

    categories = _format_category_breakdown(today_stats.category_breakdown)
    liked = _format_liked_techniques(feedback.liked_techniques)
    disliked = _format_disliked_techniques(feedback.disliked_techniques)
    completion_rate = _calculate_completion_rate(
        today_stats.completed_sessions,
        today_stats.completed_sessions + today_stats.cancelled_sessions,
    )

    remaining_minutes = max(
        0, profile.daily_target_minutes - today_stats.total_minutes_today
    )

    prompt = f"""
Kullanıcı Profili:
- İsim: {profile.first_name}
- Hedef: {profile.goal}
- Meslek/Okul: {profile.occupation}
- Günlük Çalışma Hedefi: {profile.daily_target_minutes} dakika
{f"- Yaş: {profile.age}" if profile.age else ""}

Bugünkü Çalışma Verileri:
- Tamamlanan Pomodoro: {today_stats.completed_sessions} seans
- İptal Edilen Pomodoro: {today_stats.cancelled_sessions} seans
- Tamamlama Oranı: {completion_rate}
- Bugün Çalışılan Süre: {today_stats.total_minutes_today} dakika
- Hedefe Kalan Süre: {remaining_minutes} dakika
- Kategori Dağılımı: {categories}
- Genel Performans Değerlendirmesi: {performance}

Geçmiş Teknik Tercihleri (Feedback Loop):
- Daha Önce Beğenilen Teknikler: {liked}
- Daha Önce Reddedilen Teknikler: {disliked}
- Son Önerilen Teknik: {feedback.last_suggested_technique or "İlk öneri"}

GÖREV:
{profile.first_name} için bugün için EN UYGUN çalışma tekniğini belirle.

Reddedilen tekniklerden ({disliked}) KESİNLİKLE önerme.
Beğenilen teknikler varsa benzer yaklaşımları tercih et.
Performans durumu "{performance}" göz önünde bulundurarak hem gerçekçi hem de motive edici ol.

Yanıtını aşağıdaki JSON formatında ver:
{{
    "technique": "Teknik adı (örn: Pomodoro 25/5, Feynman Tekniği, Active Recall)",
    "why_this_works": "Bu tekniğin {profile.first_name} için neden doğru seçim olduğunu 2-3 cümleyle açıkla. Kişisel ve samimi ol.",
    "steps": ["Adım 1 (somut ve kısa)", "Adım 2", "Adım 3"],
    "duration_suggestion": "Bugün için önerilen çalışma-mola düzeni",
    "motivational_note": "Bugünkü performansına göre {profile.first_name}'e özel 1-2 cümlelik motive edici not",
    "category_focus": "Bugün hangi kategoriye öncelik vermeli ve neden (1 cümle)"
}}
""".strip()

    expected_keys = [
        "technique",
        "why_this_works",
        "steps",
        "duration_suggestion",
        "motivational_note",
        "category_focus",
    ]

    return prompt, expected_keys


# ──────────────────────────────────────────────
# PROMPT 2 — Haftalık İlerleme Raporu
# ──────────────────────────────────────────────

def build_weekly_report_prompt(
    profile: UserProfile,
    weekly_stats: WeeklyStats,
    feedback: FeedbackHistory,
) -> tuple[str, list[str]]:
    """
    7 günlük veriyi analiz edip kapsamlı haftalık koçluk raporu üretir.
    Pro model ile kullanılması önerilir (use_pro=True).

    Beklenen JSON çıktısı:
    {
        "week_summary": "Haftanın genel özeti (2-3 cümle)",
        "strengths": ["Güçlü yön 1", "Güçlü yön 2"],
        "improvements": ["Gelişim alanı 1", "Gelişim alanı 2"],
        "highlight": "Haftanın en önemli başarısı",
        "next_week_focus": "Gelecek hafta öncelikli odak alanı",
        "technique_recommendation": "Gelecek hafta için teknik önerisi",
        "technique_reason": "Neden bu teknik (kişisel açıklama)",
        "motivational_closing": "Haftayı kapatan motive edici mesaj"
    }
    """
    categories = _format_category_breakdown(weekly_stats.category_breakdown)
    liked = _format_liked_techniques(feedback.liked_techniques)
    disliked = _format_disliked_techniques(feedback.disliked_techniques)

    weekly_completion_rate = _calculate_completion_rate(
        weekly_stats.completed_sessions,
        weekly_stats.total_sessions,
    )

    weekly_goal_minutes = profile.daily_target_minutes * 7
    goal_achievement = (
        (weekly_stats.total_minutes / weekly_goal_minutes * 100)
        if weekly_goal_minutes > 0 else 0
    )

    # Günlük dağılım — en verimli/en düşük gün
    daily_info = ""
    if weekly_stats.daily_breakdown:
        daily_lines = [f"  {day}: {mins} dakika" for day, mins in weekly_stats.daily_breakdown.items()]
        daily_info = "Günlük Dağılım:\n" + "\n".join(daily_lines)

    prompt = f"""
Kullanıcı Profili:
- İsim: {profile.first_name}
- Hedef: {profile.goal}
- Meslek/Okul: {profile.occupation}
- Günlük Çalışma Hedefi: {profile.daily_target_minutes} dakika
- Haftalık Hedef: {weekly_goal_minutes} dakika

Bu Haftanın Verileri:
- Toplam Pomodoro: {weekly_stats.total_sessions} seans
- Tamamlanan: {weekly_stats.completed_sessions} seans
- İptal Edilen: {weekly_stats.cancelled_sessions} seans
- Haftalık Tamamlama Oranı: {weekly_completion_rate}
- Toplam Çalışma Süresi: {weekly_stats.total_minutes} dakika
- Haftalık Hedefe Ulaşma: %{goal_achievement:.0f}
- En Verimli Gün: {weekly_stats.best_day_minutes} dakika
- En Düşük Gün: {weekly_stats.worst_day_minutes} dakika
- Aktif Seri (Streak): {weekly_stats.streak_days} gün üst üste çalışma
- Kategori Dağılımı: {categories}
{daily_info}

Teknik Geçmişi:
- Beğenilen Teknikler: {liked}
- Reddedilen Teknikler: {disliked}

GÖREV:
{profile.first_name}'in geçen haftasını kapsamlı biçimde analiz et.
Gerçek verilere dayalı, dürüst ama yapıcı bir değerlendirme yap.
Eleştiri değil, gelişim fırsatı dili kullan.
Gelecek hafta için somut ve uygulanabilir bir yön belirle.
Reddedilen tekniklerden ({disliked}) KESİNLİKLE önerme.

Yanıtını aşağıdaki JSON formatında ver:
{{
    "week_summary": "Haftanın kısa ve samimi genel özeti (2-3 cümle, {profile.first_name}'e hitap et)",
    "strengths": ["Bu hafta iyi gittiğin şey 1", "İyi gittiğin şey 2"],
    "improvements": ["Gelecek hafta geliştirebileceğin alan 1", "Geliştirebileceğin alan 2"],
    "highlight": "Haftanın tek en önemli başarısı veya dikkat çeken olumlu noktası",
    "next_week_focus": "Gelecek hafta {profile.first_name} için en öncelikli odak alanı ve hedef (somut)",
    "technique_recommendation": "Gelecek hafta için önerilen çalışma tekniği",
    "technique_reason": "Bu tekniği neden öneriyorsun, haftanın verileriyle nasıl bağlantılı (kişisel)",
    "motivational_closing": "{profile.first_name}'e haftayı kapatan, içten ve motive edici bir kapanış mesajı"
}}
""".strip()

    expected_keys = [
        "week_summary",
        "strengths",
        "improvements",
        "highlight",
        "next_week_focus",
        "technique_recommendation",
        "technique_reason",
        "motivational_closing",
    ]

    return prompt, expected_keys


# ──────────────────────────────────────────────
# PROMPT 3 — Motivasyon Mesajı
# ──────────────────────────────────────────────

def build_motivation_prompt(
    profile: UserProfile,
    today_stats: DailyStats,
    trigger: str = "low_performance",
) -> tuple[str, list[str]]:
    """
    Düşük performans, iptal artışı veya kullanıcı talebi durumunda
    kişiselleştirilmiş motivasyon mesajı üretir.

    Args:
        trigger:
            "low_performance"  — Günlük hedefin altında
            "high_cancel_rate" — İptal oranı yüksek
            "user_request"     — Kullanıcı manuel olarak istedi
            "streak_broken"    — Seri bozuldu
            "goal_achieved"    — Hedef tamamlandı (kutlama)

    Beklenen JSON çıktısı:
    {
        "title": "Kısa başlık (emoji ile)",
        "message": "Ana motivasyon mesajı (2-4 cümle)",
        "action": "Şu an hemen yapabileceğin 1 somut adım",
        "reminder": "Hedefe bağlayan kısa bir hatırlatıcı"
    }
    """
    trigger_context = {
        "low_performance": (
            f"Bugün {today_stats.total_minutes_today} dakika çalıştı, "
            f"hedefi {profile.daily_target_minutes} dakikaydı. "
            "Henüz hedefe ulaşmadı, motivasyon desteğine ihtiyaç var."
        ),
        "high_cancel_rate": (
            f"Bugün {today_stats.cancelled_sessions} seans iptal etti, "
            f"sadece {today_stats.completed_sessions} seans tamamladı. "
            "Odaklanmakta güçlük çekiyor, nazikçe yeniden yönlendir."
        ),
        "user_request": (
            f"Bugün {today_stats.total_minutes_today} dakika çalıştı. "
            "Motivasyon desteği istedi — güçlendirici bir mesaj ver."
        ),
        "streak_broken": (
            "Çalışma serisi bozuldu. Yeniden başlamak için cesaretlendirici bir mesaj ver. "
            "Seriyi kaybetmeyi küçümseme, devam etmeyi öne çıkar."
        ),
        "goal_achieved": (
            f"Bugün {today_stats.total_minutes_today} dakika çalışarak "
            f"günlük hedefini ({profile.daily_target_minutes} dk) aştı! "
            "Kutlama ve yarın için ilham verici bir mesaj ver."
        ),
    }.get(trigger, "Genel motivasyon desteği isteniyor.")

    prompt = f"""
Kullanıcı Profili:
- İsim: {profile.first_name}
- Hedef: {profile.goal}
- Meslek/Okul: {profile.occupation}
- Günlük Hedef: {profile.daily_target_minutes} dakika

Durum: {trigger_context}

GÖREV:
{profile.first_name} için bu duruma özel, samimi ve güçlendirici bir motivasyon mesajı yaz.
- Klişe motivasyon sözlerinden kaçın ("Her gün yeni bir fırsat!" gibi).
- Mesaj {profile.first_name}'in hedefi ({profile.goal}) ile bağlantılı olsun.
- Somut bir sonraki adım öner.
- 150 kelimeyi geçme — kısa ve etkili ol.

Yanıtını aşağıdaki JSON formatında ver:
{{
    "title": "Mesaj başlığı (ilgili bir emoji ile, örn: 💪 Devam Et!)",
    "message": "{profile.first_name}'e özel ana motivasyon mesajı (2-4 cümle, samimi ve içten)",
    "action": "Şu an hemen yapabileceği 1 somut ve küçük adım",
    "reminder": "{profile.goal} hedefine bağlayan kısa bir hatırlatıcı (1 cümle)"
}}
""".strip()

    expected_keys = ["title", "message", "action", "reminder"]
    return prompt, expected_keys


# ──────────────────────────────────────────────
# PROMPT 4 — Negatif Feedback Sonrası Alternatif
# ──────────────────────────────────────────────

def build_alternative_technique_prompt(
    profile: UserProfile,
    rejected_technique: str,
    rejection_reason: Optional[str],
    feedback: FeedbackHistory,
) -> tuple[str, list[str]]:
    """
    Kullanıcı bir tekniği reddettiğinde (👎) alternatif öneri üretir.
    Bu prompt feedback loop'un kalbidir.

    Beklenen JSON çıktısı:
    {
        "technique": "Yeni teknik adı",
        "why_different": "Reddedilen teknikten nasıl farklı",
        "why_suits_you": "Sana neden uygun (kişisel)",
        "steps": ["Adım 1", "Adım 2", "Adım 3"],
        "try_suggestion": "Bu tekniği nasıl denemeli (somut senaryo)"
    }
    """
    reason_text = f"Reddetme nedeni: {rejection_reason}" if rejection_reason else "Reddetme nedeni belirtilmedi."
    all_rejected = list(set(feedback.disliked_techniques + [rejected_technique]))
    liked = _format_liked_techniques(feedback.liked_techniques)

    prompt = f"""
Kullanıcı Profili:
- İsim: {profile.first_name}
- Hedef: {profile.goal}
- Meslek/Okul: {profile.occupation}

Feedback Durumu:
- Az önce Reddedilen Teknik: "{rejected_technique}"
- {reason_text}
- Daha Önce Reddedilen Tüm Teknikler: {", ".join(all_rejected)}
- Beğenilen Teknikler: {liked}

GÖREV:
{profile.first_name} "{rejected_technique}" tekniğini beğenmedi.
Bu teknikten tamamen farklı bir yaklaşım öner.

KESİNLİKLE şunları önerme: {", ".join(all_rejected)}
Beğenilen teknikler varsa ({liked}) benzer mantıkta ilerle ama aynısını önerme.

Yanıtını aşağıdaki JSON formatında ver:
{{
    "technique": "Tamamen farklı bir teknik adı",
    "why_different": "{rejected_technique} tekniğinden nasıl farklı olduğunu 1-2 cümleyle açıkla",
    "why_suits_you": "Bu tekniğin {profile.first_name} için, özellikle {profile.goal} hedefi için neden iyi bir seçim olduğunu açıkla",
    "steps": ["Nasıl uygulanır — Adım 1 (somut)", "Adım 2", "Adım 3"],
    "try_suggestion": "{profile.first_name}'in bu tekniği bugün nasıl deneyebileceğine dair somut bir senaryo (1-2 cümle)"
}}
""".strip()

    expected_keys = [
        "technique",
        "why_different",
        "why_suits_you",
        "steps",
        "try_suggestion",
    ]

    return prompt, expected_keys


# ──────────────────────────────────────────────
# PROMPT 5 — Çalışma Seansı Özeti (Seans Sonrası)
# ──────────────────────────────────────────────

def build_session_summary_prompt(
    profile: UserProfile,
    session_duration_minutes: int,
    session_category: str,
    session_note: Optional[str],
    today_stats: DailyStats,
) -> tuple[str, list[str]]:
    """
    Bir pomodoro seansı tamamlandığında anlık geri bildirim üretir.
    Kısa ve hızlı — Flash model ile kullanılır.

    Beklenen JSON çıktısı:
    {
        "reaction": "Seansa verilen kısa tepki (emoji + 1 cümle)",
        "progress_note": "Günlük hedefe olan ilerleme hakkında not",
        "next_step": "Şimdi ne yapmalı (mola mı, devam mı, strateji değişikliği mi)"
    }
    """
    category_names = {
        "lesson":   "Ders",
        "project":  "Proje",
        "reading":  "Okuma",
        "homework": "Ödev",
        "personal": "Kişisel Gelişim",
        "other":    "Diğer",
    }
    cat_display = category_names.get(session_category, session_category)

    remaining = max(0, profile.daily_target_minutes - today_stats.total_minutes_today)
    progress_pct = min(100, int(today_stats.total_minutes_today / profile.daily_target_minutes * 100)) if profile.daily_target_minutes > 0 else 0

    note_text = f'Seans notu: "{session_note}"' if session_note else "Seans notu yok."

    prompt = f"""
{profile.first_name} {session_duration_minutes} dakikalık bir {cat_display} seansını tamamladı.
{note_text}

Günlük İlerleme:
- Bugün toplam: {today_stats.total_minutes_today} dakika / {profile.daily_target_minutes} dakika hedef
- İlerleme: %{progress_pct}
- Hedefe kalan: {remaining} dakika
- Tamamlanan toplam seans: {today_stats.completed_sessions}

Hedef: {profile.goal}

GÖREV:
Seans tamamlama için kısa, samimi ve enerji veren bir geri bildirim ver.
Çok uzun yazma — hızlı ve motive edici ol.

Yanıtını aşağıdaki JSON formatında ver:
{{
    "reaction": "Seansı tamamlama için kısa tepki (emoji + 1 cümle, enerjik)",
    "progress_note": "Günlük hedefteki ilerleme hakkında samimi 1 cümle",
    "next_step": "Şu an için somut öneri: mola süresi, bir sonraki seans konusu veya günü bitir (1-2 cümle)"
}}
""".strip()

    expected_keys = ["reaction", "progress_note", "next_step"]
    return prompt, expected_keys