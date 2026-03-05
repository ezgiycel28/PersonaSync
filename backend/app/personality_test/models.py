from enum import Enum
from typing import List, Dict, Optional, Union
from pydantic import BaseModel, Field

class Category(str, Enum):
    VARK_VISUAL = "VARK_Visual"
    VARK_AUDITORY = "VARK_Auditory"
    VARK_READING = "VARK_Reading"
    VARK_KINESTHETIC = "VARK_Kinesthetic"
    FOCUS = "Focus_Habits"
    PROCRASTINATION = "Procrastination_Tendency"
    TIME_MANAGEMENT = "Time_Management"

class QuestionOption(BaseModel):
    id: str
    text: str
    score_value: int = Field(..., description="Numerical weight for scoring")
    # Optional: could add a specific category multiplier if needed, but simple score is fine for now

class Question(BaseModel):
    id: str
    text: str
    category: Category
    options: List[QuestionOption]

class UserResponse(BaseModel):
    question_id: str
    selected_option_id: str
    score_obtained: int # Store the actual score from the option for easy calculation later

class AssessmentResult(BaseModel):
    raw_scores: Dict[str, int] = Field(..., description="Total score per category")
    dominant_category: Optional[str] = Field(None, description="The category with the highest score")
    profile_summary: str = Field(..., description="A textual description of the user's profile")
    recommendations: List[str] = Field(default_factory=list, description="Actionable advice based on the profile")
