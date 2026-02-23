"""
PersonaSync — Gemini AI Service
================================
Google Gemini API ile iletişim kuran merkezi servis katmanı.
Tüm AI Koç operasyonları bu servis üzerinden geçer.

Özellikler:
- Retry mekanizması (geçici API hatalarında otomatik tekrar)
- Rate limiting koruması (üstel geri çekilme)
- Yapılandırılmış JSON çıktı parsing ve doğrulama
- Detaylı hata yönetimi ve loglama
- Model seçimi: Flash (hız) ↔ Pro (kalite)
"""

import os
import json
import time
import logging
from typing import Optional, Any

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from google.api_core.exceptions import (
    ResourceExhausted,
    ServiceUnavailable,
    DeadlineExceeded,
    GoogleAPIError,
)

# ──────────────────────────────────────────────
# Logger
# ──────────────────────────────────────────────
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Sabitler
# ──────────────────────────────────────────────
PRIMARY_MODEL   = "gemini-2.5-flash-lite" 
FALLBACK_MODEL  = "gemini-2.5-pro"    # Haftalık rapor — daha güçlü analiz
MAX_RETRIES     = 1        
RETRY_DELAY_SEC = 1.0      

SAFETY_SETTINGS = {
    HarmCategory.HARM_CATEGORY_HARASSMENT:        HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH:        HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT:  HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT:  HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
}

# Öneri ve motivasyon üretimi için parametreler
GENERATION_CONFIG = genai.GenerationConfig(
    temperature=0.75,      # Yaratıcı ama tutarlı
    top_p=0.90,
    top_k=40,
    max_output_tokens=2048,
)

# Haftalık rapor için daha az rastgelelik — analitik içerik
REPORT_GENERATION_CONFIG = genai.GenerationConfig(
    temperature=0.40,
    top_p=0.85,
    top_k=30,
    max_output_tokens=3072,
)


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
# Ana Servis Sınıfı
# ──────────────────────────────────────────────
class GeminiService:
    """
    PersonaSync için Gemini API wrapper.

    Singleton olarak tasarlanmıştır. `get_gemini_service()` fonksiyonu
    üzerinden erişin — doğrudan instantiate etmeyin.

    Örnek kullanım (FastAPI endpoint içinde):
        gemini = get_gemini_service()

        # Ham metin üretimi
        text = gemini.generate("Kullanıcı için bir motivasyon cümlesi yaz.")

        # Yapılandırılmış JSON üretimi
        data = gemini.generate_json(
            prompt="...",
            expected_keys=["technique", "reason", "steps"]
        )
    """

    def __init__(self):
        self._primary_model: Optional[genai.GenerativeModel] = None
        self._fallback_model: Optional[genai.GenerativeModel] = None
        self._initialize()

    # ──────────────────────────────────────
    # Başlatma
    # ──────────────────────────────────────
    def _initialize(self) -> None:
        """API anahtarını .env'den oku ve modelleri yapılandır."""
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "GEMINI_API_KEY ortam değişkeni bulunamadı. "
                "backend/.env dosyasına GEMINI_API_KEY=... satırını ekleyin."
            )

        genai.configure(api_key=api_key)
        system = self._build_system_instruction()

        self._primary_model = genai.GenerativeModel(
            model_name=PRIMARY_MODEL,
            generation_config=GENERATION_CONFIG,
            safety_settings=SAFETY_SETTINGS,
            system_instruction=system,
        )

        self._fallback_model = genai.GenerativeModel(
            model_name=FALLBACK_MODEL,
            generation_config=REPORT_GENERATION_CONFIG,
            safety_settings=SAFETY_SETTINGS,
            system_instruction=system,
        )

        logger.info(
            "GeminiService başarıyla başlatıldı. "
            f"Primary: {PRIMARY_MODEL} | Fallback: {FALLBACK_MODEL}"
        )

    @staticmethod
    def _build_system_instruction() -> str:
        """
        Tüm Gemini isteklerine eklenen temel sistem talimatı.
        Modelin PersonaSync koçu olarak davranmasını sağlar.
        """
        return """Sen PersonaSync'in yapay zeka destekli kişisel verimlilik koçusun.

        Kullanıcıların çalışma verilerini ve kişilik profillerini analiz ederek onlara 
        özgü, somut ve motive edici Türkçe öneriler sunmak senin temel görevin.

        DAVRANIM KURALLARI:
        1. Her zaman Türkçe yanıt ver.
        2. Samimi, sıcak ve destekleyici ol — robotik bir dil kullanma.
        3. Kullanıcının adını kullan, kişisel ve özel hissettir.
        4. Somut teknikler öner: Pomodoro varyasyonları, Feynman Tekniği, Active Recall,
        Spaced Repetition, Mind Mapping, Cornell Notu, Interleaving vb.
        5. "Daha çok çalış", "odaklan" gibi genel tavsiyelerden kaçın.
        6. Başarısızlıkları eleştirme; gelişim fırsatı olarak yeniden çerçevele.
        7. En fazla 3 öneri sun — çok seçenek kişiyi bunaltır.
        8. JSON formatı istendiğinde SADECE JSON döndür, hiçbir ekstra metin ekleme."""

    # ──────────────────────────────────────
    # Ham Metin Üretimi
    # ──────────────────────────────────────
    def generate(self, prompt: str, use_pro: bool = False) -> str:
        """
        Gemini'ye prompt gönder, string yanıt al.

        Args:
            prompt: Gönderilecek metin
            use_pro: True ise Pro model kullan (haftalık rapor için)

        Returns:
            Model yanıtı (string)

        Raises:
            GeminiBlockedError, GeminiRateLimitError, GeminiTimeoutError,
            GeminiServiceError
        """
        model = self._fallback_model if use_pro else self._primary_model
        model_name = FALLBACK_MODEL if use_pro else PRIMARY_MODEL

        logger.info(
            f"Gemini isteği — model: {model_name}, "
            f"prompt: {len(prompt)} karakter"
        )

        last_error: Exception = GeminiServiceError("Bilinmeyen hata.")

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = model.generate_content(prompt)

                # Güvenlik filtresi ve boş yanıt kontrolü
                if not response.candidates:
                    raise GeminiBlockedError(
                        "Model yanıt üretemedi — güvenlik filtresi veya boş yanıt."
                    )

                finish_reason = response.candidates[0].finish_reason.name
                if finish_reason == "SAFETY":
                    raise GeminiBlockedError(
                        "Yanıt güvenlik filtresi tarafından engellendi."
                    )

                text = response.text.strip()
                logger.info(f"Yanıt alındı — {len(text)} karakter")
                return text

            except GeminiBlockedError:
                raise  # Retry'a gerek yok, direkt fırlat

            except ResourceExhausted as e:
                wait = RETRY_DELAY_SEC * (2 ** (attempt - 1))
                last_error = GeminiRateLimitError(
                    f"API istek limiti aşıldı (deneme {attempt}/{MAX_RETRIES}). "
                    f"{wait:.0f}s bekleniyor."
                )
                logger.warning(f"Rate limit — {wait}s bekleniyor (deneme {attempt})")
                time.sleep(wait)

            except (ServiceUnavailable, DeadlineExceeded) as e:
                wait = RETRY_DELAY_SEC * attempt
                last_error = GeminiTimeoutError(
                    f"Gemini servisi geçici olarak kullanılamıyor "
                    f"(deneme {attempt}/{MAX_RETRIES}). {wait:.0f}s bekleniyor."
                )
                logger.warning(f"Servis hatası — {wait}s bekleniyor (deneme {attempt})")
                time.sleep(wait)

            except GoogleAPIError as e:
                last_error = GeminiServiceError(f"Gemini API hatası: {e}")
                logger.error(f"API hatası (deneme {attempt}): {e}")
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY_SEC)

            except Exception as e:
                last_error = GeminiServiceError(f"Beklenmeyen hata: {e}")
                logger.exception(f"Beklenmeyen Gemini hatası (deneme {attempt}): {e}")
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY_SEC)

        raise last_error

    # ──────────────────────────────────────
    # Yapılandırılmış JSON Üretimi
    # ──────────────────────────────────────
    def generate_json(
        self,
        prompt: str,
        expected_keys: list[str],
        use_pro: bool = False,
    ) -> dict[str, Any]:
        """
        Gemini'den JSON formatında yapılandırılmış veri al.
        Prompt'a JSON talimatı otomatik eklenir.

        Args:
            prompt: İstek metni (JSON talimatı otomatik eklenir)
            expected_keys: Yanıtta bulunması zorunlu anahtarlar
            use_pro: True ise Pro model kullan

        Returns:
            Parse edilmiş Python dict

        Raises:
            GeminiParseError: JSON geçersizse veya zorunlu key eksikse
        """
        json_suffix = (
            "\n\n[FORMAT TALİMATI] Yanıtını SADECE geçerli JSON olarak ver. "
            "Markdown (```json), açıklama veya başka metin EKLEME. "
            "Yanıt doğrudan { karakteriyle başlamalı, } ile bitmeli."
        )

        raw = self.generate(prompt + json_suffix, use_pro=use_pro)
        return self._parse_and_validate_json(raw, expected_keys)

    def _parse_and_validate_json(
        self,
        raw_text: str,
        expected_keys: list[str],
    ) -> dict[str, Any]:
        """
        Ham metni JSON olarak parse et ve zorunlu anahtarları doğrula.
        Model bazen markdown içinde JSON dönebilir, bunu temizler.
        """
        cleaned = raw_text.strip()

        # Markdown bloğu temizleme: ```json ... ``` veya ``` ... ```
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            inner = [
                line for line in lines
                if not line.strip().startswith("```")
            ]
            cleaned = "\n".join(inner).strip()

        # Parse
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(
                f"JSON parse hatası — hata: {e} | "
                f"raw (ilk 300 karakter): {raw_text[:300]}"
            )
            raise GeminiParseError(
                f"Model geçersiz JSON döndürdü: {e}"
            ) from e

        # Zorunlu key doğrulama
        missing = [k for k in expected_keys if k not in data]
        if missing:
            raise GeminiParseError(
                f"JSON yanıtında eksik alanlar: {missing}. "
                f"Mevcut alanlar: {list(data.keys())}"
            )

        logger.info(f"JSON doğrulandı — keys: {list(data.keys())}")
        return data

    # ──────────────────────────────────────
    # Sağlık Kontrolü
    # ──────────────────────────────────────
    def health_check(self) -> dict[str, Any]:
        """
        Servisin aktif olup olmadığını test eder.
        GET /health endpoint'i tarafından çağrılır.
        """
        try:
            response = self.generate(
                "Sadece 'Aktif' kelimesini döndür.",
                use_pro=False,
            )
            return {
                "status": "healthy",
                "model": PRIMARY_MODEL,
                "response_sample": response[:50],
            }
        except Exception as e:
            logger.error(f"Health check başarısız: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
            }


# ──────────────────────────────────────────────
# Singleton & Dependency Injection
# ──────────────────────────────────────────────
_instance: Optional[GeminiService] = None


def get_gemini_service() -> GeminiService:
    """
    GeminiService singleton'ını döndürür.
    FastAPI endpoint'lerinde Depends() ile kullanım için tasarlanmıştır.

    Örnek:
        @router.post("/daily-advice")
        def get_advice(gemini: GeminiService = Depends(get_gemini_service)):
            return gemini.generate_json(...)

    NOT: Uygulama ilk başladığında GEMINI_API_KEY okunur.
    Anahtar yoksa EnvironmentError fırlatılır ve uygulama başlamaz.
    """
    global _instance
    if _instance is None:
        _instance = GeminiService()
    return _instance

