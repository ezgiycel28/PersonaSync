// API Configuration
const API_BASE_URL =process.env.EXPO_PUBLIC_API_URL;

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