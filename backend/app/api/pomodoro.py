from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional

from app.core.database import get_db
from app.core.security import verify_token
from app.models.pomodoro import PomodoroSession, PomodoroStatus
from app.models.user import User
from app.schemas.pomodoro import (
    PomodoroStart, 
    PomodoroEnd, 
    PomodoroResponse, 
    PomodoroStats,
    PomodoroHistory
)

router = APIRouter(prefix="/pomodoro", tags=["Pomodoro"])
security = HTTPBearer()

# Kullanıcıyı token'dan al
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = verify_token(token)
    
    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz token",
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı",
        )
    
    return user

# Yeni Pomodoro başlat
@router.post("/start", response_model=PomodoroResponse)
def start_pomodoro(
    pomodoro_data: PomodoroStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ... geri kalan kod aynı kalacak
    # Aktif pomodoro var mı kontrol et
    active_session = db.query(PomodoroSession).filter(
        PomodoroSession.user_id == current_user.id,
        PomodoroSession.status == PomodoroStatus.ACTIVE
    ).first()
    
    if active_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zaten aktif bir Pomodoro oturumun var. Önce onu tamamla veya iptal et."
        )
    
    # Yeni pomodoro oluştur
    new_session = PomodoroSession(
        user_id=current_user.id,
        duration_minutes=pomodoro_data.duration_minutes,
        category=pomodoro_data.category,
        note=pomodoro_data.note,
        status=PomodoroStatus.ACTIVE
    )
    
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    return new_session

# Pomodoro tamamla (Füze fırlatıldı!)
@router.post("/{pomodoro_id}/complete", response_model=PomodoroResponse)
def complete_pomodoro(
    pomodoro_id: int,
    end_data: PomodoroEnd = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(PomodoroSession).filter(
        PomodoroSession.id == pomodoro_id,
        PomodoroSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Pomodoro bulunamadı")
    
    if session.status != PomodoroStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Bu Pomodoro zaten sonlanmış")
    
    session.status = PomodoroStatus.COMPLETED
    session.ended_at = datetime.utcnow()
    
    if end_data and end_data.note:
        session.note = end_data.note
    
    db.commit()
    db.refresh(session)
    
    return session

# Pomodoro iptal et (Başarısız fırlatma)
@router.post("/{pomodoro_id}/cancel", response_model=PomodoroResponse)
def cancel_pomodoro(
    pomodoro_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(PomodoroSession).filter(
        PomodoroSession.id == pomodoro_id,
        PomodoroSession.user_id == current_user.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Pomodoro bulunamadı")
    
    if session.status != PomodoroStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Bu Pomodoro zaten sonlanmış")
    
    session.status = PomodoroStatus.CANCELLED
    session.ended_at = datetime.utcnow()
    
    db.commit()
    db.refresh(session)
    
    return session

# Aktif pomodoro getir
@router.get("/active", response_model=Optional[PomodoroResponse])
def get_active_pomodoro(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    session = db.query(PomodoroSession).filter(
        PomodoroSession.user_id == current_user.id,
        PomodoroSession.status == PomodoroStatus.ACTIVE
    ).first()
    
    return session

# Pomodoro geçmişi
@router.get("/history", response_model=PomodoroHistory)
def get_pomodoro_history(
    days: int = 7,  # Son kaç gün
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    since_date = datetime.utcnow() - timedelta(days=days)
    
    sessions = db.query(PomodoroSession).filter(
        PomodoroSession.user_id == current_user.id,
        PomodoroSession.started_at >= since_date
    ).order_by(PomodoroSession.started_at.desc()).all()
    
    # İstatistikleri hesapla
    completed = [s for s in sessions if s.status == PomodoroStatus.COMPLETED]
    cancelled = [s for s in sessions if s.status == PomodoroStatus.CANCELLED]
    
    # Kategori breakdown
    category_breakdown = {}
    for s in completed:
        cat = s.category
        category_breakdown[cat] = category_breakdown.get(cat, 0) + 1
    
    stats = PomodoroStats(
        total_sessions=len(sessions),
        completed_sessions=len(completed),
        cancelled_sessions=len(cancelled),
        total_minutes=sum(s.duration_minutes for s in completed),
        category_breakdown=category_breakdown
    )
    
    return PomodoroHistory(sessions=sessions, stats=stats)

# Bugünün istatistikleri (dashboard için)
@router.get("/today", response_model=PomodoroStats)
def get_today_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    sessions = db.query(PomodoroSession).filter(
        PomodoroSession.user_id == current_user.id,
        PomodoroSession.started_at >= today_start
    ).all()
    
    completed = [s for s in sessions if s.status == PomodoroStatus.COMPLETED]
    cancelled = [s for s in sessions if s.status == PomodoroStatus.CANCELLED]
    
    category_breakdown = {}
    for s in completed:
        cat = s.category
        category_breakdown[cat] = category_breakdown.get(cat, 0) + 1
    
    return PomodoroStats(
        total_sessions=len(sessions),
        completed_sessions=len(completed),
        cancelled_sessions=len(cancelled),
        total_minutes=sum(s.duration_minutes for s in completed),
        category_breakdown=category_breakdown
    )