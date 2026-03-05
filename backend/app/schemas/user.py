from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ProfileUpdate(BaseModel):
    age: Optional[int]
    occupation: Optional[str]
    goal: Optional[str]
    daily_study_target: Optional[int]
    # Yeni AI alanları (opsiyonel)
    learning_style: Optional[str] = None
    work_tendency: Optional[str] = None
    core_values: Optional[str] = None # Frontend comma-separated gönderebilir veya List dönüşümü yapılabilir
    stress_level: Optional[int] = 5

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    age: Optional[int] = None
    occupation: Optional[str] = None
    goal: Optional[str] = None
    daily_study_target: Optional[int] = None
    is_profile_complete: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"