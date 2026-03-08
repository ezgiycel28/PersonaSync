from typing import List
from .models import Question, QuestionOption, Category

def get_sample_questions() -> List[Question]:
    return [
        # Question 1: VARK - Visual vs Auditory vs Kinesthetic (Simplifying to one category per option logic is tricky with single category per question model,
        # but let's assume each question targets a primary category or specific style.
        # Actually a better design is that an Option maps to a Category score increment.
        # But the User asked for Question Model to have a category. Let's stick to the requested model: Question bas its own category.
        
        Question(
            id="q1",
            text="Yeni bir şey öğrenirken en çok neyden faydalanırsınız?",
            category=Category.VARK_VISUAL, # Primary category tested
            options=[
                QuestionOption(id="opt1_a", text="Diyagramlar, grafikler ve resimler.", score_value=10), # Highly Visual
                QuestionOption(id="opt1_b", text="Dinleyerek ve tartışarak.", score_value=0), # Not Visual (or low)
                QuestionOption(id="opt1_c", text="Okuyarak ve not alarak.", score_value=2), 
                QuestionOption(id="opt1_d", text="Pratik yaparak ve deneyerek.", score_value=5)
            ]
        ),
        Question(
            id="q2",
            text="Bir arkadaşınıza yol tarif ederken ne yaparsınız?",
            category=Category.VARK_KINESTHETIC,
            options=[
                QuestionOption(id="opt2_a", text="Onu oraya bizzat götürürüm veya el hareketleriyle tarif ederim.", score_value=10), # Kinesthetic
                QuestionOption(id="opt2_b", text="Bir harita çizerim.", score_value=0),
                QuestionOption(id="opt2_c", text="Sözlü olarak anlatırım.", score_value=2),
                QuestionOption(id="opt2_d", text="Adresi bir kağıda yazarım.", score_value=5)
            ]
        ),
         Question(
            id="q3",
            text="Çalışmaya başlamadan önce genellikle ne hissedersiniz?",
            category=Category.PROCRASTINATION,
            options=[
                QuestionOption(id="opt3_a", text="Hemen başlarım, beklemekten hoşlanmam.", score_value=0), # Low Procrastination
                QuestionOption(id="opt3_b", text="Biraz direnç hissederim ama 5 dakika içinde başlarım.", score_value=3),
                QuestionOption(id="opt3_c", text="Başka işlerle uğraşıp süreci ertelerim.", score_value=7),
                QuestionOption(id="opt3_d", text="Son ana kadar beklerim, stres olmadan çalışamam.", score_value=10) # High Procrastination
            ]
        ),
        Question(
            id="q4",
            text="Uzun süre odaklanmanız gerektiğinde hangi yöntemi tercih edersiniz?",
            category=Category.FOCUS,
            options=[
                QuestionOption(id="opt4_a", text="Pomodoro tekniği (25 dk çalış, 5 dk mola).", score_value=10), # Good Focus Habit
                QuestionOption(id="opt4_b", text="Molalar vermeden bitene kadar çalışırım.", score_value=5),
                QuestionOption(id="opt4_c", text="Sık sık telefonuma bakarım.", score_value=0), # Poor Focus
                QuestionOption(id="opt4_d", text="Müzik dinleyerek arka planda çalışırım.", score_value=7)
            ]
        ),
        Question(
            id="q5",
            text="Bir toplantı veya dersten sonra en çok neyi hatırlarsınız?",
            category=Category.VARK_AUDITORY,
            options=[
                QuestionOption(id="opt5_a", text="Konuşulan tuhaf veya komik şeyleri.", score_value=10), # Auditory
                QuestionOption(id="opt5_b", text="Tahtadaki çizimleri veya slaytları.", score_value=0),
                QuestionOption(id="opt5_c", text="Aldığım notları.", score_value=5),
                QuestionOption(id="opt5_d", text="Ortamdaki hissi veya yapılan aktiviteleri.", score_value=2)
            ]
        )
    ]
