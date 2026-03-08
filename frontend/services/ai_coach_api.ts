/**
 * PersonaSync — AI Koç Frontend API Servisi
 * ==========================================
 * Backend AI Coach endpoint'leriyle iletişim kuran servis katmanı.
 *
 * Özellikler:
 * - Tüm TypeScript interface'leri backend şemalarıyla tam uyumlu
 * - Merkezi hata yönetimi (network, auth, rate limit, server hataları)
 * - Her fonksiyon kendi sorumluluğuna sahip (SRP)
 * - Token expire durumunda AuthError fırlatılır — AuthContext yakalayabilir
 * - Retry mantığı yok (UI'da loading state yönetimi daha sağlıklı)
 */

import { API_BASE_URL } from './api'; // Mevcut api.ts'deki base URL'yi kullan

// ─────────────────────────────────────────────
// ENUM'lar — Backend ile senkron
// ─────────────────────────────────────────────

export type MotivationTrigger =
  | 'low_performance'   // Günlük hedefin altında
  | 'high_cancel_rate'  // Yüksek iptal oranı
  | 'user_request'      // Kullanıcı manuel istedi
  | 'streak_broken'     // Seri bozuldu
  | 'goal_achieved';    // Hedef tamamlandı (kutlama)

export type StudyCategory =
  | 'lesson'
  | 'project'
  | 'reading'
  | 'homework'
  | 'personal'
  | 'other';

export type AdviceType = 'daily' | 'weekly' | 'alternative';


// ─────────────────────────────────────────────
// İSTEK TİPLERİ (Request)
// ─────────────────────────────────────────────

export interface DailyAdviceRequest {
  /** Kullanıcının bugün odaklanmak istediği konu (opsiyonel) */
  extra_context?: string;
}

export interface WeeklyReportRequest {
  /** Rapor için geriye gidilecek gün sayısı (3-30 arası, varsayılan: 7) */
  days?: number;
}

export interface MotivationRequest {
  /** Motivasyon tetikleyici nedeni (varsayılan: user_request) */
  trigger?: MotivationTrigger;
  /** Kullanıcının ek notu veya bugün hissettikleri */
  user_note?: string;
}

export interface FeedbackRequest {
  /** Geri bildirim verilen teknik adı */
  technique: string;
  /** true = 👍 beğendi, false = 👎 beğenmedi */
  liked: boolean;
  /** Beğenilmeme nedeni (liked=false ise doldurulabilir) */
  rejection_reason?: string;
  /** Hangi öneri türüne geri bildirim */
  advice_type?: AdviceType;
}

export interface SessionSummaryRequest {
  /** Tamamlanan pomodoro seans ID'si */
  session_id: number;
}


// ─────────────────────────────────────────────
// YANIT TİPLERİ (Response)
// ─────────────────────────────────────────────

export interface DailyAdvice {
  /** Önerilen çalışma tekniğinin adı */
  technique: string;
  /** Bu tekniğin kullanıcıya neden uygun olduğunun açıklaması */
  why_this_works: string;
  /** Tekniğin uygulama adımları */
  steps: string[];
  /** Bugün için önerilen çalışma-mola düzeni */
  duration_suggestion: string;
  /** Kullanıcıya özel motive edici not */
  motivational_note: string;
  /** Bugün hangi kategoriye öncelik vermeli */
  category_focus: string;
  /** Önerinin üretildiği UTC zamanı */
  generated_at: string;
  /** Kullanılan Gemini modeli */
  model_used: string;
}

export interface WeeklyReport {
  /** Haftanın kısa genel özeti */
  week_summary: string;
  /** Bu hafta iyi giden alanlar */
  strengths: string[];
  /** Gelecek hafta geliştirilebilecek alanlar */
  improvements: string[];
  /** Haftanın en önemli başarısı */
  highlight: string;
  /** Gelecek hafta için öncelikli odak */
  next_week_focus: string;
  /** Gelecek hafta için teknik önerisi */
  technique_recommendation: string;
  /** Teknik önerisinin açıklaması */
  technique_reason: string;
  /** Kapanış motivasyon mesajı */
  motivational_closing: string;
  /** İstatistik özeti — frontend grafikleri için */
  stats_snapshot: WeeklyStatsSnapshot | null;
  /** Raporun kapsadığı gün sayısı */
  period_days: number;
  /** Raporun üretildiği UTC zamanı */
  generated_at: string;
}

export interface WeeklyStatsSnapshot {
  total_sessions: number;
  completed_sessions: number;
  cancelled_sessions: number;
  total_minutes: number;
  completion_rate: number;
  daily_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  streak_days: number;
  best_day_minutes: number;
}

export interface Motivation {
  /** Mesaj başlığı (emoji + kısa başlık) */
  title: string;
  /** Ana motivasyon mesajı */
  message: string;
  /** Hemen yapılabilecek 1 somut adım */
  action: string;
  /** Hedefe bağlayan kısa hatırlatıcı */
  reminder: string;
  /** Bu mesajı tetikleyen durum */
  trigger: MotivationTrigger;
  generated_at: string;
}

export interface AlternativeTechnique {
  /** Yeni önerilen teknik adı */
  technique: string;
  /** Reddedilen teknikten nasıl farklı */
  why_different: string;
  /** Kullanıcıya neden uygun */
  why_suits_you: string;
  /** Uygulama adımları */
  steps: string[];
  /** Bugün nasıl denenebileceğine dair somut senaryo */
  try_suggestion: string;
}

export interface FeedbackResponse {
  /** Kaydın başarılı olup olmadığı */
  success: boolean;
  /** Kullanıcıya gösterilecek onay mesajı */
  message: string;
  /** Kaydedilen feedback'in DB ID'si */
  feedback_id: number;
  /** liked=false ise Gemini'nin alternatif teknik önerisi */
  alternative: AlternativeTechnique | null;
}

export interface SessionSummary {
  /** Seans tamamlama tepkisi */
  reaction: string;
  /** Günlük hedefteki ilerleme notu */
  progress_note: string;
  /** Bir sonraki adım önerisi */
  next_step: string;
  generated_at: string;
}

export interface AIHealthStatus {
  status: 'healthy' | 'unhealthy';
  model: string | null;
  error: string | null;
  checked_at: string;
}


// ─────────────────────────────────────────────
// ÖZEL HATA SINIFLARI
// ─────────────────────────────────────────────

export class AICoachError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage: string,
  ) {
    super(message);
    this.name = 'AICoachError';
  }
}

export class AICoachAuthError extends AICoachError {
  constructor() {
    super(
      'Token geçersiz veya süresi dolmuş',
      401,
      'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
    );
    this.name = 'AICoachAuthError';
  }
}

export class AICoachRateLimitError extends AICoachError {
  constructor() {
    super(
      'AI koç rate limit',
      429,
      'AI koç şu an yoğun. Birkaç saniye sonra tekrar deneyin.',
    );
    this.name = 'AICoachRateLimitError';
  }
}

export class AICoachUnavailableError extends AICoachError {
  constructor() {
    super(
      'AI koç servisi kullanılamıyor',
      503,
      'AI koç şu an kullanılamıyor. Daha sonra tekrar deneyin.',
    );
    this.name = 'AICoachUnavailableError';
  }
}


// ─────────────────────────────────────────────
// TEMEL YARDIMCI — Fetch Wrapper
// ─────────────────────────────────────────────

/**
 * AI Coach endpoint'leri için merkezi fetch fonksiyonu.
 * Tüm hata senaryolarını burada yakalar ve anlamlı hatalara dönüştürür.
 */
async function aiCoachFetch<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}/api/ai${endpoint}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers as Record<string, string> || {}),
      },
    });
  } catch (networkError) {
    // Network hatası — sunucuya hiç ulaşılamadı
    throw new AICoachError(
      `Network hatası: ${networkError}`,
      0,
      'İnternet bağlantınızı kontrol edin.',
    );
  }

  // Başarılı yanıt
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  // HTTP hata durumları
  let errorDetail = 'Bilinmeyen hata';
  try {
    const errorBody = await response.json();
    errorDetail = errorBody?.detail || errorDetail;
  } catch {
    // JSON parse başarısız — ham durum kodu kullan
  }

  switch (response.status) {
    case 401:
      throw new AICoachAuthError();

    case 429:
      throw new AICoachRateLimitError();

    case 400:
      throw new AICoachError(
        errorDetail,
        400,
        errorDetail, // 400 hataları kullanıcıya gösterilebilir
      );

    case 502:
      throw new AICoachError(
        'Gemini parse hatası',
        502,
        'AI koç geçici bir sorun yaşıyor. Lütfen tekrar deneyin.',
      );

    case 503:
      throw new AICoachUnavailableError();

    default:
      throw new AICoachError(
        `HTTP ${response.status}: ${errorDetail}`,
        response.status,
        'Bir hata oluştu. Lütfen tekrar deneyin.',
      );
  }
}


// ─────────────────────────────────────────────
// API FONKSİYONLARI
// ─────────────────────────────────────────────

/**
 * Günlük kişisel çalışma önerisi al.
 *
 * Kullanıcının bugünkü pomodoro verisi ve profili üzerinden
 * Gemini'nin kişiselleştirilmiş teknik önerisini döndürür.
 *
 * @param token - JWT access token
 * @param request - Opsiyonel ekstra bağlam (odaklanılacak konu vb.)
 * @returns DailyAdvice — teknik, adımlar, motivasyon notu
 *
 * @throws AICoachAuthError — token geçersiz/süresi dolmuş
 * @throws AICoachRateLimitError — API limiti aşıldı
 * @throws AICoachError — diğer hatalar
 *
 * @example
 * const advice = await getDailyAdvice(token);
 * console.log(advice.technique);      // "Pomodoro 25/5"
 * console.log(advice.steps);          // ["Adım 1", ...]
 */
export async function getDailyAdvice(
  token: string,
  request: DailyAdviceRequest = {},
): Promise<DailyAdvice> {
  return aiCoachFetch<DailyAdvice>('/daily-advice', token, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}


/**
 * Haftalık koçluk raporu al.
 *
 * Son 7 günün (varsayılan) verilerini analiz ederek kapsamlı
 * haftalık rapor üretir. Pro model kullanır — 3-5 saniye sürebilir.
 *
 * @param token - JWT access token
 * @param request - Kaç günlük rapor (varsayılan: 7)
 * @returns WeeklyReport — güçlü yönler, gelişim alanları, gelecek hafta önerileri
 *
 * @example
 * const report = await getWeeklyReport(token, { days: 7 });
 * console.log(report.strengths);     // ["Tutarlı çalışma serisi", ...]
 * console.log(report.stats_snapshot?.total_minutes); // 320
 */
export async function getWeeklyReport(
  token: string,
  request: WeeklyReportRequest = { days: 7 },
): Promise<WeeklyReport> {
  return aiCoachFetch<WeeklyReport>('/weekly-report', token, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}


/**
 * Kişiselleştirilmiş motivasyon mesajı al.
 *
 * Belirtilen tetikleyici duruma göre kullanıcıya özel
 * motive edici mesaj üretir.
 *
 * @param token - JWT access token
 * @param request - Tetikleyici ve opsiyonel kullanıcı notu
 * @returns Motivation — başlık, mesaj, somut adım, hatırlatıcı
 *
 * @example
 * // Yüksek iptal oranı tespit edildiğinde otomatik tetikle
 * const msg = await getMotivation(token, { trigger: 'high_cancel_rate' });
 *
 * // Kullanıcı "Motivasyon Al" butonuna bastığında
 * const msg = await getMotivation(token, {
 *   trigger: 'user_request',
 *   user_note: 'Bugün çok yorgunum'
 * });
 */
export async function getMotivation(
  token: string,
  request: MotivationRequest = { trigger: 'user_request' },
): Promise<Motivation> {
  return aiCoachFetch<Motivation>('/motivation', token, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}


/**
 * Öneri geri bildirimi gönder.
 *
 * 👍 veya 👎 geri bildirimini backend'e kaydeder.
 * liked=false ise yanıtta alternatif teknik önerisi de döner.
 *
 * @param token - JWT access token
 * @param request - Teknik adı, beğeni durumu, opsiyonel neden
 * @returns FeedbackResponse — onay mesajı + alternatif (eğer beğenilmediyse)
 *
 * @example
 * // Beğenme
 * await sendFeedback(token, {
 *   technique: 'Feynman Tekniği',
 *   liked: true,
 * });
 *
 * // Beğenmeme — yanıtta alternatif gelir
 * const result = await sendFeedback(token, {
 *   technique: 'Pomodoro 25/5',
 *   liked: false,
 *   rejection_reason: '25 dakika çok uzun geliyor'
 * });
 * if (result.alternative) {
 *   console.log(result.alternative.technique); // "10/2 Mini Pomodoro"
 * }
 */
export async function sendFeedback(
  token: string,
  request: FeedbackRequest,
): Promise<FeedbackResponse> {
  return aiCoachFetch<FeedbackResponse>('/feedback', token, {
    method: 'POST',
    body: JSON.stringify({
      advice_type: 'daily',  // Varsayılan
      ...request,
    }),
  });
}


/**
 * Tamamlanan pomodoro seansı için anlık AI özeti al.
 *
 * Seans tamamlandıktan hemen sonra çağrılır.
 * Kısa, motive edici geri bildirim + bir sonraki adım önerisi döner.
 *
 * @param token - JWT access token
 * @param sessionId - Tamamlanan pomodoro seans ID'si
 * @returns SessionSummary — tepki, ilerleme notu, sonraki adım
 *
 * @example
 * // Pomodoro tamamlandığında (complete endpoint'inden sonra)
 * const summary = await getSessionSummary(token, completedSession.id);
 * showToast(summary.reaction); // "🎉 Harika! 25 dakikayı tamamladın!"
 */
export async function getSessionSummary(
  token: string,
  sessionId: number,
): Promise<SessionSummary> {
  return aiCoachFetch<SessionSummary>('/session-summary', token, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}


/**
 * Gemini AI servisinin aktif olup olmadığını kontrol et.
 * Auth gerektirmez — loading ekranında çağrılabilir.
 *
 * @returns AIHealthStatus — 'healthy' veya 'unhealthy'
 */
export async function checkAIHealth(): Promise<AIHealthStatus> {
  const url = `${API_BASE_URL}/api/ai/health`;

  try {
    const response = await fetch(url, { method: 'GET' });
    return response.json() as Promise<AIHealthStatus>;
  } catch {
    return {
      status: 'unhealthy',
      model: null,
      error: 'Servise ulaşılamıyor',
      checked_at: new Date().toISOString(),
    };
  }
}


// ─────────────────────────────────────────────
// YARDIMCI FONKSİYONLAR — UI İçin
// ─────────────────────────────────────────────

/**
 * Hata tipine göre kullanıcıya gösterilecek mesajı döndür.
 * Alert veya Toast içinde kullanmak için.
 *
 * @example
 * try {
 *   const advice = await getDailyAdvice(token);
 * } catch (error) {
 *   Alert.alert('Hata', getAIErrorMessage(error));
 * }
 */
export function getAIErrorMessage(error: unknown): string {
  if (error instanceof AICoachError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
  }
  return 'Bir hata oluştu.';
}

/**
 * Error'ın auth hatası olup olmadığını kontrol et.
 * AuthContext'te token temizleme için kullanılır.
 *
 * @example
 * try {
 *   const advice = await getDailyAdvice(token);
 * } catch (error) {
 *   if (isAuthError(error)) {
 *     logout(); // Token expired → kullanıcıyı login'e gönder
 *   }
 * }
 */
export function isAuthError(error: unknown): boolean {
  return error instanceof AICoachAuthError;
}

/**
 * Pomodoro iptal oranına göre motivasyon tetikleyicisini belirle.
 * ai_coach.tsx ekranında otomatik tetikleme için kullanılır.
 *
 * @example
 * const trigger = detectMotivationTrigger(2, 8, 120, 180);
 * // → 'high_cancel_rate' (iptal oranı yüksek)
 */
export function detectMotivationTrigger(
  cancelledToday: number,
  completedToday: number,
  minutesToday: number,
  dailyTargetMinutes: number,
): MotivationTrigger | null {
  const total = cancelledToday + completedToday;
  const cancelRate = total > 0 ? cancelledToday / total : 0;
  const progressRate = dailyTargetMinutes > 0 ? minutesToday / dailyTargetMinutes : 0;

  if (cancelRate > 0.5 && total >= 2) {
    return 'high_cancel_rate';
  }
  if (progressRate >= 1.0) {
    return 'goal_achieved';
  }
  if (progressRate < 0.3 && minutesToday > 0) {
    return 'low_performance';
  }
  return null; // Otomatik tetikleme yok — kullanıcı manuel isteyebilir
}