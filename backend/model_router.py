import os
from fastapi import APIRouter

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

# Expected weight file locations — team can drop these in anytime
# Falls back to best.pt if the specific file doesn't exist yet
WEIGHT_FILES = {
    "light":  os.path.join(PROJECT_ROOT, "weights", "light.pt"),
    "medium": os.path.join(PROJECT_ROOT, "weights", "medium.pt"),
    "heavy":  os.path.join(PROJECT_ROOT, "weights", "heavy.pt"),
}
FALLBACK_WEIGHT = os.path.join(PROJECT_ROOT, "weights2", "best.pt")

MODELS = {
    "light":  {"name": "light",  "description": "Faster, works on weaker PCs",          "confidence": 0.35},
    "medium": {"name": "medium", "description": "Balanced speed and accuracy",           "confidence": 0.50},
    "heavy":  {"name": "heavy",  "description": "Slower, catches more foreign material", "confidence": 0.65},
}

active_model = {"name": "medium"}

model_router = APIRouter(prefix="/model", tags=["model"])


def resolve_weight_path(model_name: str) -> str:
    path = WEIGHT_FILES.get(model_name, FALLBACK_WEIGHT)
    if os.path.exists(path):
        return path
    return FALLBACK_WEIGHT


def model_info(name: str, is_active: bool) -> dict:
    weight_path = resolve_weight_path(name)
    has_own_weights = os.path.exists(WEIGHT_FILES.get(name, ""))
    return {
        **MODELS[name],
        "active":          is_active,
        "weight_file":     weight_path,
        "has_own_weights": has_own_weights,
    }


@model_router.get("/active")
async def get_active_model():
    name = active_model["name"]
    return model_info(name, True)


@model_router.get("/list")
async def list_models():
    current = active_model["name"]
    return [model_info(name, name == current) for name in MODELS]


@model_router.post("/set/{model_name}")
async def set_model(model_name: str):
    if model_name not in MODELS:
        return {"error": f"Unknown model '{model_name}'. Choose from: light, medium, heavy"}
    active_model["name"] = model_name
    return {
        **model_info(model_name, True),
        "message": f"Switched to {model_name} model"
    }
