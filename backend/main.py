from fastapi.middleware.cors import CORSMiddleware
from backend.database import initialize_database
from backend.endpoints import app
initialize_database()
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.sound_router import sound_router
from backend.model_router import model_router
from backend.powerRouter import power_router
from backend.authRouter import auth_router
@app.get("/control")
async def control_page():
    return FileResponse("control.html")
app.include_router(sound_router)
app.include_router(model_router)
app.include_router(power_router)
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
 allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173", 
        "http://localhost:5174", 
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.99:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
