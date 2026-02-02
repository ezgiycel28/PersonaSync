from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import ProfileUpdate, UserResponse

router = APIRouter()

@router.put("/{user_id}/profile", response_model=UserResponse)
def update_profile(user_id: int, profile: ProfileUpdate, db: Session = Depends(get_db)):
    # Kullanıcıyı bul
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı"
        )
    
    # Profili güncelle
    user.age = profile.age
    user.occupation = profile.occupation
    user.goal = profile.goal
    user.daily_study_target = profile.daily_study_target
    user.is_profile_complete = True
    
    db.commit()
    db.refresh(user)
    
    return user

@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı"
        )
    
    return user