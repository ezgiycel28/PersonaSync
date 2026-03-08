from app.personality_test.models import Question, QuestionOption, Category, UserResponse
from app.personality_test.engine import AssessmentEngine

def test_vark_score_calculation():
    # Arrange: Setup a test question
    question = Question(
        id="q1",
        text="Sample Question",
        category=Category.VARK_VISUAL,
        options=[
            QuestionOption(id="o1", text="Visual Option", score_value=10),
            QuestionOption(id="o2", text="Non-Visual Option", score_value=0),
        ]
    )
    
    engine = AssessmentEngine([question])
    
    # Act: Simulate a user picking the visual option
    response = UserResponse(
        question_id="q1",
        selected_option_id="o1",
        score_obtained=10
    )
    result = engine.process_responses([response])
    
    # Assert
    assert result.dominant_category == Category.VARK_VISUAL.value
    assert result.raw_scores[Category.VARK_VISUAL.value] == 10

def test_empty_responses_handled_gracefully():
    engine = AssessmentEngine([])
    result = engine.process_responses([])
    
    assert result.dominant_category == "None"
    assert result.profile_summary == "Yeterli veri yok."
