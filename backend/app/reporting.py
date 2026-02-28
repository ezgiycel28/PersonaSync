"""
Haftalık Raporlama Servisi
- Kullanıcı pomodoro verilerini analiz eder
- AI ile kişiselleştirilmiş motivasyon mesajı oluşturur
- Haftalık raporları saklar ve sunar
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, List
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
import os
from anthropic import Anthropic

from app.models.user import User
from app.models.pomodoro import PomodoroSession, PomodoroStatus
from app.models.weekly_report import WeeklyReport


class ReportingService:
    """Haftalık raporlama işlemlerini yöneten servis sınıfı"""
    
    def __init__(self):
        # Anthropic API client
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            print("⚠️ ANTHROPIC_API_KEY bulunamadı! AI mesajları oluşturulamayacak.")
        self.anthropic_client = Anthropic(api_key=api_key) if api_key else None
    
    
    def get_week_boundaries(self, reference_date: Optional[datetime] = None) -> tuple:
        """
        Haftanın başlangıç ve bitiş tarihlerini hesaplar (Pazartesi-Pazar)
        
        Args:
            reference_date: Referans tarih (None ise bugün)
        
        Returns:
            (week_start, week_end) tuple
        """
        if reference_date is None:
            reference_date = datetime.now()
        
        # Pazartesi günü bul (weekday: 0=Pazartesi, 6=Pazar)
        days_since_monday = reference_date.weekday()
        week_start = (reference_date - timedelta(days=days_since_monday)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        
        # Pazar günü bul
        week_end = (week_start + timedelta(days=6)).replace(
            hour=23, minute=59, second=59, microsecond=999999
        )
        
        return week_start, week_end
    
    
    def calculate_weekly_stats(
        self, 
        db: Session, 
        user_id: int, 
        week_start: datetime, 
        week_end: datetime
    ) -> Dict:
        """
        Belirtilen hafta için kullanıcının istatistiklerini hesaplar
        
        Args:
            db: Database session
            user_id: Kullanıcı ID
            week_start: Hafta başlangıcı
            week_end: Hafta bitişi
        
        Returns:
            İstatistik dictionary
        """
        # Haftadaki tüm pomodoro seansları
        sessions = db.query(PomodoroSession).filter(
            and_(
                PomodoroSession.user_id == user_id,
                PomodoroSession.started_at >= week_start,
                PomodoroSession.started_at <= week_end
            )
        ).all()
        
        # Temel sayılar
        total_sessions = len(sessions)
        completed_sessions = sum(1 for s in sessions if s.status == PomodoroStatus.COMPLETED)
        cancelled_sessions = sum(1 for s in sessions if s.status == PomodoroStatus.CANCELLED)
        
        # Toplam dakika (sadece tamamlananlar)
        total_minutes = sum(
            s.duration_minutes for s in sessions 
            if s.status == PomodoroStatus.COMPLETED
        )
        
        # Kategorilere göre dağılım (dakika bazında)
        category_breakdown = {}
        for session in sessions:
            if session.status == PomodoroStatus.COMPLETED:
                category = session.category
                category_breakdown[category] = category_breakdown.get(category, 0) + session.duration_minutes
        
        # Günlük dağılım (dakika bazında)
        daily_breakdown = {}
        for session in sessions:
            if session.status == PomodoroStatus.COMPLETED:
                day_key = session.started_at.strftime("%Y-%m-%d")
                daily_breakdown[day_key] = daily_breakdown.get(day_key, 0) + session.duration_minutes
        
        # Hedef karşılaştırması
        user = db.query(User).filter(User.id == user_id).first()
        goal_achievement = 0.0
        
        if user and user.daily_study_target:
            # Haftalık hedef = günlük hedef * 7
            weekly_goal_minutes = user.daily_study_target * 7
            if weekly_goal_minutes > 0:
                goal_achievement = (total_minutes / weekly_goal_minutes) * 100
                goal_achievement = min(goal_achievement, 100.0)  # Max %100
        
        return {
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "cancelled_sessions": cancelled_sessions,
            "total_minutes": total_minutes,
            "category_breakdown": category_breakdown,
            "daily_breakdown": daily_breakdown,
            "goal_achievement": round(goal_achievement, 1)
        }
    
    
    def generate_ai_motivation(
        self, 
        user: User, 
        stats: Dict
    ) -> str:
        """
        Claude AI ile kişiselleştirilmiş motivasyon mesajı oluşturur
        
        Args:
            user: User modeli
            stats: Haftalık istatistikler
        
        Returns:
            AI'dan gelen motivasyon mesajı
        """
        if not self.anthropic_client:
            return "Harika bir hafta geçirdin! Çalışmaya devam et! 🚀"
        
        # Kullanıcı profil bilgileri
        user_context = f"""
Kullanıcı Profili:
- İsim: {user.full_name}
- Hedef: {user.goal or 'Belirtilmemiş'}
- Meslek/Okul: {user.occupation or 'Belirtilmemiş'}
- Günlük Hedef: {user.daily_study_target or 0} dakika

Haftalık Performans:
- Toplam Seans: {stats['total_sessions']}
- Tamamlanan: {stats['completed_sessions']}
- İptal Edilen: {stats['cancelled_sessions']}
- Toplam Çalışma Süresi: {stats['total_minutes']} dakika ({stats['total_minutes']//60} saat {stats['total_minutes']%60} dakika)
- Hedef Başarısı: %{stats['goal_achievement']}
- Kategori Dağılımı: {stats['category_breakdown']}
"""
        
        prompt = f"""{user_context}

Sen bir öğrenci koçusun. Yukarıdaki kullanıcının haftalık performansına bakarak:

1. Başarılarını kutla (hangi kategoride çok çalıştıysa vurgula)
2. Hedefine ne kadar yakın olduğunu değerlendir
3. Bir sonraki hafta için motivasyonel ve yapıcı önerilerde bulun
4. Samimi, sıcak ve cesaret verici bir dil kullan
5. Maksimum 150 kelime kullan

Mesajını doğrudan kullanıcıya hitap ederek yaz (sen/senin). Emoji kullanabilirsin ama fazla abartma (2-3 tane yeter).
"""
        
        try:
            response = self.anthropic_client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            ai_message = response.content[0].text
            return ai_message
            
        except Exception as e:
            print(f"AI mesaj oluşturulurken hata: {e}")
            return f"Bu hafta {stats['total_minutes']} dakika çalıştın! Harika gidiyorsun! 🚀"
    
    
    def generate_report(
        self, 
        db: Session, 
        user_id: int,
        week_start: Optional[datetime] = None,
        week_end: Optional[datetime] = None
    ) -> WeeklyReport:
        """
        Kullanıcı için haftalık rapor oluşturur
        
        Args:
            db: Database session
            user_id: Kullanıcı ID
            week_start: Hafta başlangıcı (None ise bu hafta)
            week_end: Hafta bitişi (None ise bu hafta)
        
        Returns:
            Oluşturulan WeeklyReport
        """
        # Tarih aralığını belirle
        if week_start is None or week_end is None:
            week_start, week_end = self.get_week_boundaries()
        
        # Kullanıcıyı getir
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} bulunamadı")
        
        # İstatistikleri hesapla
        stats = self.calculate_weekly_stats(db, user_id, week_start, week_end)
        
        # AI motivasyon mesajı oluştur
        ai_message = self.generate_ai_motivation(user, stats)
        
        # Daha önce bu hafta için rapor var mı kontrol et
        existing_report = db.query(WeeklyReport).filter(
            and_(
                WeeklyReport.user_id == user_id,
                WeeklyReport.week_start == week_start,
                WeeklyReport.week_end == week_end
            )
        ).first()
        
        if existing_report:
            # Mevcut raporu güncelle
            existing_report.stats = stats
            existing_report.ai_message = ai_message
            existing_report.created_at = datetime.utcnow()
            db.commit()
            db.refresh(existing_report)
            return existing_report
        
        # Yeni rapor oluştur
        report = WeeklyReport(
            user_id=user_id,
            week_start=week_start,
            week_end=week_end,
            stats=stats,
            ai_message=ai_message,
            is_viewed=False
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        return report
    
    
    def get_user_reports(
        self, 
        db: Session, 
        user_id: int,
        limit: int = 10,
        offset: int = 0
    ) -> List[WeeklyReport]:
        """
        Kullanıcının geçmiş raporlarını getirir (en yeniden eskiye)
        
        Args:
            db: Database session
            user_id: Kullanıcı ID
            limit: Maksimum rapor sayısı
            offset: Kaç rapor atlansın
        
        Returns:
            WeeklyReport listesi
        """
        reports = db.query(WeeklyReport).filter(
            WeeklyReport.user_id == user_id
        ).order_by(
            WeeklyReport.week_start.desc()
        ).limit(limit).offset(offset).all()
        
        return reports
    
    
    def mark_report_as_viewed(
        self, 
        db: Session, 
        report_id: int, 
        user_id: int
    ) -> bool:
        """
        Raporu görüldü olarak işaretler
        
        Args:
            db: Database session
            report_id: Rapor ID
            user_id: Kullanıcı ID (güvenlik kontrolü)
        
        Returns:
            Başarılı ise True
        """
        report = db.query(WeeklyReport).filter(
            and_(
                WeeklyReport.id == report_id,
                WeeklyReport.user_id == user_id
            )
        ).first()
        
        if not report:
            return False
        
        report.is_viewed = True
        db.commit()
        return True


# Servis instance'ı
reporting_service = ReportingService()