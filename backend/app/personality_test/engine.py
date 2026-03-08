from typing import List, Dict
from collections import defaultdict
from .models import Question, UserResponse, AssessmentResult, Category

class AssessmentEngine:
    """
    Engine responsible for processing user responses and generating personality/learning profiles.
    """
    
    def __init__(self, questions: List[Question]):
         # We store questions to validate/lookup category if needed, though strictly UserResponse carries the score.
         # Actually, UserResponse carries the score, but to know the CATEGORY, we need to look up the Question.
         self.question_map = {q.id: q for q in questions}

    def process_responses(self, responses: List[UserResponse]) -> AssessmentResult:
        """
        Takes a list of user responses, calculates scores per category, and returns the final assessment result.
        """
        category_scores: Dict[str, int] = defaultdict(int)

        # 1. Calculate Raw Scores
        for response in responses:
            question = self.question_map.get(response.question_id)
            if not question:
                continue # Or raise error
            
            # Add score to the question's category
            # Note: In a real system, options might map to DIFFERENT categories (e.g. Q1 Option A -> Visual, Option B -> Auditory).
            # But per user requirement: Question has a category. So we score THAT category.
            # My current implementation of Question has `category: Category`.
            # If the user selects a high score option, they get points in that category.
            category_scores[question.category.value] += response.score_obtained

        # 2. Determine Dominant Category (for Profile Summary)
        # Using max(scores, key=scores.get)
        if not category_scores:
             return AssessmentResult(
                raw_scores={},
                dominant_category="None",
                profile_summary="Yeterli veri yok.",
            )

        dominant_cat = max(category_scores, key=category_scores.get)
        max_score = category_scores[dominant_cat]

        # 3. Generate Profile Summary & Recommendations
        summary = self._generate_summary(dominant_cat, max_score)
        recommendations = self._generate_recommendations(category_scores)

        return AssessmentResult(
            raw_scores=dict(category_scores),
            dominant_category=dominant_cat,
            profile_summary=summary,
            recommendations=recommendations
        )

    def _generate_summary(self, category_name: str, score: int) -> str:
        if "VARK" in category_name:
            style = category_name.split("_")[1]
            return f"Öğrenme stiliniz ağırlıklı olarak {style} (Puan: {score}). Görsel/İşitsel materyallerle daha iyi öğreniyorsunuz."
        elif category_name == Category.PROCRASTINATION.value:
             if score > 7:
                 return f"Yüksek Erteleme Eğilimi (Puan: {score}). İşleri son ana bırakma huyunuz var."
             else:
                 return f"Düşük Erteleme Eğilimi (Puan: {score}). Zamanı iyi yönetiyorsunuz."
        elif category_name == Category.FOCUS.value:
             return f"Odaklanma Alışkanlıkları (Puan: {score}). Mevcut çalışma düzeniniz {score}/10 puan üzerinden değerlendirildi."
        
        return f"Genel Profil: {category_name} baskın."

    def _generate_recommendations(self, scores: Dict[str, int]) -> List[str]:
        recommendations = []
        
        # Check specific thresholds
        if scores.get(Category.PROCRASTINATION.value, 0) > 5:
            recommendations.append("Pomodoro tekniği ile çalışmayı deneyin (25 dk çalışma + 5 dk mola).")
            recommendations.append("Büyük görevleri küçük, yönetilebilir parçalara bölün.")
        
        if scores.get(Category.VARK_VISUAL.value, 0) > 5:
             recommendations.append("Ders çalışırken fosforlu kalemler ve zihin haritaları (Mind Maps) kullanın.")

        if scores.get(Category.VARK_AUDITORY.value, 0) > 5:
             recommendations.append("Konuları sesli olarak tekrar edin veya çalışma arkadaşlarıyla tartışın.")
             
        if scores.get(Category.FOCUS.value, 0) < 5:
            recommendations.append("Çalışma ortamınızdaki dikkat dağıtıcı unsurları (telefon, bildirimler) en aza indirin.")

        return recommendations
