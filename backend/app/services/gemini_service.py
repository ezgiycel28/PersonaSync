"""
PersonaSync — PersonaSync AI Engine
================================
AI Koç operasyonlarının merkezi motoru.
Gemini API ve Pandas kullanarak veriye dayalı koçluk hizmeti sunar.
"""

import os
import json
import logging
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime
import pandas as pd

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold, GenerationConfig
from google.api_core.exceptions import (
    ResourceExhausted,
    ServiceUnavailable,
    DeadlineExceeded,
    GoogleAPIError,
)
from app.schemas.ai_coach import PersonalityProfile, BehaviorMetrics, CoachResponse, LearningStyle, WorkTendency
from dotenv import load_dotenv

load_dotenv()

# ──────────────────────────────────────────────
# Logger
# ──────────────────────────────────────────────
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Özel Hata Sınıfları
# ──────────────────────────────────────────────
class GeminiServiceError(Exception):
    """Gemini servisine özgü temel hata."""
    pass

class GeminiRateLimitError(GeminiServiceError):
    """API istek limiti aşıldı."""
    pass

class GeminiTimeoutError(GeminiServiceError):
    """İstek zaman aşımına uğradı."""
    pass

class GeminiParseError(GeminiServiceError):
    """Model çıktısı beklenen formatta değil."""
    pass

class GeminiBlockedError(GeminiServiceError):
    """İçerik güvenlik filtresi tarafından engellendi."""
    pass

# ──────────────────────────────────────────────
# PersonaSync AI Engine (Kişisel Koç)
# ──────────────────────────────────────────────
class PersonaSyncAIEngine:
    """
    PersonaSync Verimlilik Koçu Motoru.
    Kullanıcı verilerini analiz eder, strateji belirler ve kişiselleştirilmiş içerik üretir.
    Gemini API (google-generativeai) üzerine kuruludur.
    """

    def __init__(self):
        self._model = None
        self._api_key = os.getenv("GEMINI_API_KEY")
        if not self._api_key:
            # Environment variable yoksa, hata fırlatmadan önce loglayalım
            # Bu durum development ortamında graceful fail için yararlı olabilir
            logger.error("GEMINI_API_KEY bulunamadı.")
            # raise EnvironmentError("GEMINI_API_KEY environment variable not set")
        
        if self._api_key:
            genai.configure(api_key=self._api_key)
        
        # Güvenlik Ayarları
        self._safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        }

        # Model Konfigürasyonu (Structured Output için response_schema)
        self._generation_config = GenerationConfig(
            temperature=0.7,
            top_p=0.95,
            top_k=40,
            max_output_tokens=4096,
            response_mime_type="application/json",
            response_schema=CoachResponse
        )

        if self._api_key:
            self._model = genai.GenerativeModel(
                model_name="gemini-1.5-flash", # Hız ve maliyet dengesi
                generation_config=self._generation_config,
                safety_settings=self._safety_settings,
                system_instruction=self._build_system_instruction()
            )

    def _build_system_instruction(self) -> str:
        """
        AI Koçun persona ve kurallarını içeren sistem talimatını oluşturur.
        """
        return """
        ROLE: PersonaSync Productivity Coach
        GÖREV: Kullanıcının kişilik özelliklerini ve çalışma verilerini analiz ederek, ona özel, veriye dayalı ve motive edici verimlilik stratejileri geliştirmek.

        # GİRDİ ANALİZİ:
        Sana iki tür veri verilecek:
        1. "profile": Kullanıcının öğrenme stili (Görsel, İşitsel vb.), çalışma eğilimi (Sabahçı, Gececi), değerleri ve stres seviyesi.
        2. "metrics": Son döneme ait çalışma istatistikleri (Odak süresi, tamamlanan görevler, bölünmeler).

        # KOÇLUK PRENSİPLERİ (KURALLAR):
        1. ASLA GENEL GEÇER TAVSİYE VERME: "Daha çok çalış", "Mola ver" gibi cümleler yasak. Bunun yerine: "Verilerine göre 25. dakikada odağın düşüyor, bu yüzden 20/5 tekniğini dene."
        2. KİŞİLİK UYUMU:
           - Görsel öğrenenler için: Renk kodları, zihin haritaları, şemalar öner.
           - İşitsel öğrenenler için: Konuyu sesli anlatma, tartışma grupları öner.
           - Sabahçılar için: En zor görevleri 09:00-11:00 arasına planla.
           - Gececiler için: Gece sessizliğinde derin çalışma (Deep Work) stratejileri öner.
        3. VERİYE DAYALI KONUŞ: "Geçen hafta en verimli saatin 14:00'tü, bu saati proje çalışmalarına ayır." şeklinde veriyi kanıt olarak kullan.
        4. MOTİVASYON FORMATI: Kullanıcının 'core_values' (temel değerleri) ile hedeflerini bağdaştır. Eğer stres seviyesi yüksekse (>7), sakinleştirici ve küçük adımlar öner. Düşükse meydan okuyucu ol.
        5. DİL ve TON: Türkçe. Profesyonel, destekleyici, net ve samimi.

        # ÇIKTI FORMATI:
        Yanıtın KESİNLİKLE 'CoachResponse' şemasına uygun geçerli bir JSON olmalıdır.
        """

    @staticmethod
    def preprocess_data(raw_logs: List[Dict[str, Any]]) -> BehaviorMetrics:
        """
        Ham çalışma loglarını analiz edip özet metrikler çıkarır.
        
        Args:
            raw_logs: Liste halinde dict kayıtlar. Örn:
                      [{'duration_minutes': 25, 'status': 'completed', 'start_time': '2023-10-01T10:00:00', 'interruptions': 0}, ...]
        """
        if not raw_logs:
            # Veri yoksa sıfırlanmış metrikler döndür
            return BehaviorMetrics(
                total_study_time_minutes=0,
                completed_tasks_count=0,
                average_focus_duration=0.0,
                most_productive_hour=None,
                interruption_count=0
            )

        try:
            df = pd.DataFrame(raw_logs)

            # Sütun isimlerini normalize etme (örnek olarak duration_minutes bekliyoruz ama duration da olabilir)
            if 'duration' in df.columns and 'duration_minutes' not in df.columns:
                df['duration_minutes'] = df['duration']
            
            # Gerekli sütun kontrolleri ve default değerler
            expected_cols = {
                'duration_minutes': 0, 
                'interruptions': 0, 
                'status': 'unknown',
                'start_time': None
            }
            
            for col, default_val in expected_cols.items():
                if col not in df.columns:
                    df[col] = default_val

            # Sayısal dönüşümler
            df['duration_minutes'] = pd.to_numeric(df['duration_minutes'], errors='coerce').fillna(0)
            df['interruptions'] = pd.to_numeric(df['interruptions'], errors='coerce').fillna(0)

            # 1. Toplam Çalışma Süresi
            total_time = int(df['duration_minutes'].sum())

            # 2. Tamamlanan Görev Sayısı
            completed_tasks = int(df[df['status'] == 'completed'].shape[0])

            # 3. Ortalama Odak Süresi (Sadece tamamlanan veya kayda değer seanslar)
            focus_df = df[df['duration_minutes'] > 5] # 5 dk altı gürültü olabilir
            avg_focus = float(focus_df['duration_minutes'].mean()) if not focus_df.empty else 0.0

            # 4. En Verimli Saat Aralığı
            most_prod_hour = None
            if df['start_time'].notna().any():
                try:
                    # Datetime çevrimi
                    temp_df = df.copy()
                    temp_df['start_time'] = pd.to_datetime(temp_df['start_time'], errors='coerce')
                    temp_df = temp_df.dropna(subset=['start_time'])
                    
                    # Sadece 'completed' olanların saati daha anlamlıdır
                    completed_times = temp_df[temp_df['status'] == 'completed']
                    if not completed_times.empty:
                        most_prod_hour = int(completed_times['start_time'].dt.hour.mode()[0])
                    elif not temp_df.empty:
                        # Eğer tamamlanan yoksa, başlanan saatlere bak
                        most_prod_hour = int(temp_df['start_time'].dt.hour.mode()[0])
                except Exception as e:
                    logger.warning(f"Zaman analizi hatası: {e}")

            # 5. Kesinti/Bölünme Sayısı
            interruption_count = int(df['interruptions'].sum())

            return BehaviorMetrics(
                total_study_time_minutes=total_time,
                completed_tasks_count=completed_tasks,
                average_focus_duration=round(avg_focus, 2),
                most_productive_hour=most_prod_hour,
                interruption_count=interruption_count
            )

        except Exception as e:
            logger.error(f"Veri ön işleme hatası: {e}")
            # Hata durumunda boş metrik dön
            return BehaviorMetrics(
                total_study_time_minutes=0,
                completed_tasks_count=0,
                average_focus_duration=0.0,
                most_productive_hour=None,
                interruption_count=0
            )

    async def generate_coaching_advice(
        self, 
        profile: PersonalityProfile, 
        metrics: BehaviorMetrics
    ) -> CoachResponse:
        """
        API çağrısını yapar ve yapılandırılmış koçluk önerisi döndürür.
        """
        if not self._api_key or not self._model:
             raise GeminiServiceError("API sunucusu başlatılamadı (API Key eksik).")

        try:
            # Prompt için veriyi hazırla
            # Pydantic model_dump_json() veya model_dump() kullanılabilir
            profile_json = profile.model_dump_json()
            metrics_json = metrics.model_dump_json()

            user_prompt = f"""
            Lütfen aşağıdaki kullanıcı verilerini analiz et ve koçluk planını oluştur:
            
            [USER PROFILE]:
            {profile_json}
            
            [BEHAVIOR METRICS (LAST 7 DAYS)]:
            {metrics_json}
            """

            # Asenkron istek
            response = await self._model.generate_content_async(user_prompt)
            
            # Yanıtı çözümle
            # Gemini response_schema ile JSON döndürmeyi garanti eder, ama yine de validate edelim.
            return CoachResponse.model_validate_json(response.text)

        except (ResourceExhausted, ServiceUnavailable, DeadlineExceeded) as e:
            logger.error(f"Gemini API Geçici Hatası: {e}")
            raise GeminiRateLimitError("Servis şu an çok yoğun, lütfen kısa süre sonra tekrar deneyin.")
            
        except GoogleAPIError as e:
            logger.error(f"Gemini API Hatası: {e}")
            raise GeminiServiceError("AI Koç servisinde bir bağlantı sorunu oluştu.")
            
        except Exception as e:
            logger.exception(f"Beklenmeyen Hata: {e}")
            raise GeminiServiceError(f"Beklenmeyen bir hata oluştu: {str(e)}")

# ──────────────────────────────────────────────
# Test Bloğu (Mock Data ile Verifikasyon)
# ──────────────────────────────────────────────
if __name__ == "__main__":
    async def main():
        print("--- PersonaSync AI Engine Başlatılıyor ---")
        
        # 1. Mock Data (Ham Loglar)
        raw_logs = [
            {'duration_minutes': 45, 'status': 'completed', 'start_time': '2023-10-27T09:00:00', 'interruptions': 0},
            {'duration_minutes': 25, 'status': 'interrupted', 'start_time': '2023-10-27T10:00:00', 'interruptions': 2},
            {'duration_minutes': 50, 'status': 'completed', 'start_time': '2023-10-28T09:15:00', 'interruptions': 1},
            {'duration_minutes': 30, 'status': 'completed', 'start_time': '2023-10-28T14:00:00', 'interruptions': 0},
        ]
        
        # 2. Preprocessing Testi
        engine = PersonaSyncAIEngine()
        print("\n[1] Veri Ön İşleme (Preprocessing)...")
        metrics = engine.preprocess_data(raw_logs)
        print(f"   -> Hesaplanan Metrikler: {metrics}")

        # 3. Profil Oluşturma
        profile = PersonalityProfile(
            learning_style=LearningStyle.VISUAL,
            work_tendency=WorkTendency.MORNING_LARK,
            core_values=["disiplin", "öğrenme"],
            stress_level=3
        )

        # 4. Gemini Entegrasyon Testi
        if os.getenv("GEMINI_API_KEY"):
            print("\n[2] Gemini API ile Tavsiye Üretiliyor...")
            try:
                advice = await engine.generate_coaching_advice(profile, metrics)
                print("\n✅ AI Koç Yanıtı:")
                print(f"📅 Program: {advice.optimal_study_schedule}")
                print(f"🧠 Strateji: {advice.personalized_strategy}")
                print(f"💡 Motivasyon: {advice.motivational_insight}")
            except Exception as e:
                print(f"❌ API Hatası: {e}")
        else:
            print("\n⚠️ API Key eksik olduğu için canlı istek atlanıyor.")

    asyncio.run(main())


_instance: Optional[PersonaSyncAIEngine] = None

def get_ai_engine() -> PersonaSyncAIEngine:
    global _instance
    if _instance is None:
        _instance = PersonaSyncAIEngine()
    return _instance
