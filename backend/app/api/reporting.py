"""
Reporting API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.user import User
from app.schemas.reporting import (
    WeeklyReportResponse, 
    WeeklyReportList, 
    GenerateReportRequest,
    WeeklyReportStats
)
from app.reporting import reporting_service
# Auth dependency'lerini import edin (mevcut auth.py'nizden)
# from app.api.auth import get_current_user


router = APIRouter()


# !! ÖNEMLİ: get_current_user fonksiyonunu auth.py'den import edin
# Şimdilik placeholder koyuyorum, siz kendi auth sisteminizi kullanın
async def get_current_user(db: Session = Depends(get_db)) -> User:
    """
    TODO: Bu fonksiyonu app.api.auth'dan import edin!
    Örnek: from app.api.auth import get_current_user
    """
    # Geçici - test için user id=1 döndürüyor
    user = db.query(User).filter(User.id == 1).first()
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return user


@router.post("/reports/generate", response_model=WeeklyReportResponse)
async def generate_weekly_report(
    request: GenerateReportRequest = GenerateReportRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manuel olarak haftalık rapor oluştur
    
    - Belirtilen tarih aralığı için rapor oluşturur
    - Tarih belirtilmezse bu hafta için oluşturulur
    - AI ile kişiselleştirilmiş motivasyon mesajı içerir
    """
    try:
        report = reporting_service.generate_report(
            db=db,
            user_id=current_user.id,
            week_start=request.week_start,
            week_end=request.week_end
        )
        
        # Response için stats'i dönüştür
        stats_response = WeeklyReportStats(**report.stats)
        
        return WeeklyReportResponse(
            id=report.id,
            user_id=report.user_id,
            week_start=report.week_start,
            week_end=report.week_end,
            created_at=report.created_at,
            stats=stats_response,
            ai_message=report.ai_message,
            is_viewed=report.is_viewed
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rapor oluşturulamadı: {str(e)}")


@router.get("/reports", response_model=WeeklyReportList)
async def get_my_reports(
    limit: int = 10,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Kullanıcının tüm haftalık raporlarını listele
    
    - En yeni rapordan eskiye doğru sıralı
    - Pagination desteği
    """
    reports = reporting_service.get_user_reports(
        db=db,
        user_id=current_user.id,
        limit=limit,
        offset=offset
    )
    
    # Total count
    from app.models.weekly_report import WeeklyReport
    total_count = db.query(WeeklyReport).filter(
        WeeklyReport.user_id == current_user.id
    ).count()
    
    # Response formatına dönüştür
    report_responses = []
    for report in reports:
        stats_response = WeeklyReportStats(**report.stats)
        report_responses.append(
            WeeklyReportResponse(
                id=report.id,
                user_id=report.user_id,
                week_start=report.week_start,
                week_end=report.week_end,
                created_at=report.created_at,
                stats=stats_response,
                ai_message=report.ai_message,
                is_viewed=report.is_viewed
            )
        )
    
    return WeeklyReportList(
        reports=report_responses,
        total_count=total_count
    )


@router.get("/reports/{report_id}", response_model=WeeklyReportResponse)
async def get_report_detail(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Belirli bir raporun detayını getir
    
    - Rapor otomatik olarak "görüldü" işaretlenir
    """
    from app.models.weekly_report import WeeklyReport
    from sqlalchemy import and_
    
    report = db.query(WeeklyReport).filter(
        and_(
            WeeklyReport.id == report_id,
            WeeklyReport.user_id == current_user.id
        )
    ).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı")
    
    # Görüldü olarak işaretle
    reporting_service.mark_report_as_viewed(db, report_id, current_user.id)
    
    stats_response = WeeklyReportStats(**report.stats)
    
    return WeeklyReportResponse(
        id=report.id,
        user_id=report.user_id,
        week_start=report.week_start,
        week_end=report.week_end,
        created_at=report.created_at,
        stats=stats_response,
        ai_message=report.ai_message,
        is_viewed=True  # Şimdi görüldü
    )


@router.get("/reports/latest/current-week", response_model=WeeklyReportResponse)
async def get_current_week_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Bu haftanın raporunu getir (yoksa otomatik oluştur)
    
    - Kullanıcının mevcut hafta için anlık rapor görmesini sağlar
    """
    try:
        # Bu hafta için rapor oluştur/getir
        report = reporting_service.generate_report(
            db=db,
            user_id=current_user.id
        )
        
        stats_response = WeeklyReportStats(**report.stats)
        
        return WeeklyReportResponse(
            id=report.id,
            user_id=report.user_id,
            week_start=report.week_start,
            week_end=report.week_end,
            created_at=report.created_at,
            stats=stats_response,
            ai_message=report.ai_message,
            is_viewed=report.is_viewed
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rapor oluşturulamadı: {str(e)}")