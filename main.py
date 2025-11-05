from fastapi import FastAPI, Request, HTTPException, Body
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from model import model
from services.transformer import is_frontend_payload, transform_frontend_to_model_payload
from templates import templates

# NEW: simple file-based persistence for saving/loading scenarios
import os, json

app = FastAPI(title="MeetSync Backend", version="1.0.0")

app.mount("/static", StaticFiles(directory="static"), name="static")

# Ensure a data folder exists for saves
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)


@app.get("/", response_class=HTMLResponse)
async def main_page(request: Request):
    return templates.TemplateResponse("main.html.jinja", {"request": request})


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/call-model", response_class=JSONResponse)
async def call_model(request: Request):
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    try:
        payload = transform_frontend_to_model_payload(data) if is_frontend_payload(data) else data
        result = model(payload)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")

    return JSONResponse(result)


# ---------- NEW ROUTES (Save/Load) ----------

@app.post("/api/presets", response_class=JSONResponse)
async def save_preset(payload: dict = Body(...), preset_id: str = "default"):
    """
    Save any client payload (e.g., attendees, active_attendees, weights, etc.)
    to ./data/<preset_id>.json so the UI can persist state between user switches.
    """
    try:
        path = os.path.join(DATA_DIR, f"{preset_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        return {"saved": True, "id": preset_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save preset: {e}")


@app.get("/api/presets/{preset_id}", response_class=JSONResponse)
async def load_preset(preset_id: str):
    """
    Load a previously saved payload from ./data/<preset_id>.json
    """
    path = os.path.join(DATA_DIR, f"{preset_id}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="preset not found")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load preset: {e}")
