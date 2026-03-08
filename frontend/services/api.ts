// API Configuration
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error('EXPO_PUBLIC_API_URL environment variable is not set. Check your .env file.');
}

// Types
export interface UserRegister {
  email: string;
  password: string;
  full_name: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface ProfileUpdate {
  age: number;
  occupation: string;
  goal: string;
  daily_study_target: number;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  age: number | null;
  occupation: string | null;
  goal: string | null;
  daily_study_target: number | null;
  is_profile_complete: boolean;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface ApiError {
  detail: string;
}

export type StudyCategory =
  | 'lesson'
  | 'project'
  | 'reading'
  | 'homework'
  | 'personal'
  | 'other';

export type PomodoroStatus = 'active' | 'completed' | 'cancelled';

export interface PomodoroStart {
  duration_minutes: number;
  category: StudyCategory;
}

export interface PomodoroEnd {
  note?: string; // İsteğe bağlı
}

export interface PomodoroSession {
  id: number;
  user_id: number;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  status: PomodoroStatus;
  category: StudyCategory;
  note: string | null;
}

export interface PomodoroStats {
  total_sessions: number;
  completed_sessions: number;
  cancelled_sessions: number;
  total_minutes: number;
  category_breakdown: Record<string, number>;
}

export interface PomodoroHistory {
  sessions: PomodoroSession[];
  stats: PomodoroStats;
}

// API Functions
export async function registerUser(data: UserRegister): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Kayıt başarısız');
  }

  return response.json();
}

export async function loginUser(data: UserLogin): Promise<AuthToken> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Giriş başarısız');
  }

  return response.json();
}

export async function updateProfile(userId: number, data: ProfileUpdate, token: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Profil güncelleme başarısız');
  }

  return response.json();
}

export async function getUser(userId: number, token: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Kullanıcı bilgisi alınamadı');
  }

  return response.json();
}
// Reporting API Functions
export async function getWeeklyReports(token: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/reports?limit=20`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Raporlar yüklenemedi');
  }

  return response.json();
}

export async function getCurrentWeekReport(token: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/reports/latest/current-week`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Rapor oluşturulamadı');
  }

  return response.json();
}

export async function generateReport(token: string, weekStart?: string, weekEnd?: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/reports/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ week_start: weekStart, week_end: weekEnd }),
  });

  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Rapor oluşturulamadı');
  }


//---Pomodoro API Functions-----------------
export async function startPomodoro(data: PomodoroStart, token: string): Promise<PomodoroSession> {
  const response = await fetch(`${API_BASE_URL}/api/pomodoro/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Pomodoro başlatılamadı');
  }
  return response.json();
}

export async function completePomodoro(
  pomodoroId: number,
  data: PomodoroEnd,
  token: string
): Promise<PomodoroSession> {
  const response = await fetch(`${API_BASE_URL}/api/pomodoro/${pomodoroId}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Pomodoro tamamlanamadı');
  }
  return response.json();
}

export async function cancelPomodoro(pomodoroId: number, token: string): Promise<PomodoroSession> {
  const response = await fetch(`${API_BASE_URL}/api/pomodoro/${pomodoroId}/cancel`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Pomodoro iptal edilemedi');
  }
  return response.json();
}

export async function getActivePomodoro(token: string): Promise<PomodoroSession | null> {
  const response = await fetch(`${API_BASE_URL}/api/pomodoro/active`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Aktif oturum alınamadı');
  }
  return response.json();
}

export async function getPomodoroHistory(token: string, days = 7): Promise<PomodoroHistory> {
  const response = await fetch(`${API_BASE_URL}/api/pomodoro/history?days=${days}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Geçmiş alınamadı');
  }
  return response.json();
}

export async function getTodayStats(token: string): Promise<PomodoroStats> {
  const response = await fetch(`${API_BASE_URL}/api/pomodoro/today`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const error: ApiError = await response.json();
    throw new Error(error.detail || 'Günlük istatistik alınamadı');
  }
  return response.json();
}