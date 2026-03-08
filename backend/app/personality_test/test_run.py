import json
from .models import UserResponse, Question
from .data import get_sample_questions
from .engine import AssessmentEngine

def simulate_user_session():
    # 1. Load Sample Questions
    questions = get_sample_questions()
    print(f"Loaded {len(questions)} questions for the Personality & Learning Style Inventory.\n")

    # 2. Simulate User Answering (Picking specific options for a 'Visual Learner' who procrastinates)
    # Question 1 (Visual): Option A (Score 10) -> "Diyagramlar..."
    # Question 2 (Kinesthetic): Option B (Map drawing - low Kinesthetic, but Visual?) -> In my data: B=0. Let's pick A (Score 10)
    # Question 3 (Procrastination): Option D (Score 10) -> "Son ana kadar beklerim"
    # Question 4 (Focus): Option C (Score 0) -> "Sık sık telefonuma bakarım"
    # Question 5 (Auditory): Option B (Score 0) -> "Tahtadaki çizimleri..." (Visual preference actually, but mapped to 0 in Auditory category)

    print("Simulating User Responses...")
    user_responses = [
        UserResponse(question_id="q1", selected_option_id="opt1_a", score_obtained=10),
        UserResponse(question_id="q2", selected_option_id="opt2_a", score_obtained=10),
        UserResponse(question_id="q3", selected_option_id="opt3_d", score_obtained=10),
        UserResponse(question_id="q4", selected_option_id="opt4_c", score_obtained=0),
        UserResponse(question_id="q5", selected_option_id="opt5_b", score_obtained=0)
    ]

    # 3. Process with Engine
    engine = AssessmentEngine(questions)
    result = engine.process_responses(user_responses)

    # 4. Output Results
    print("\n--- Assessment Complete ---")
    print(f"Dominant Category: {result.dominant_category}")
    print(f"Summary: {result.profile_summary}")
    
    print("\nScore Breakdown:")
    for category, score in result.raw_scores.items():
        print(f"  - {category}: {score}")

    print("\nRecommended Strategies:")
    for i, rec in enumerate(result.recommendations, 1):
        print(f"  {i}. {rec}")
    
    # Save a JSON structure (optional but cool for API simulation)
    # print("\nJSON Output:\n", result.json(indent=2)) 

if __name__ == "__main__":
    simulate_user_session()
