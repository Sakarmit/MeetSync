from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from model import model
from templates import templates

app = FastAPI(title="MeetSync Backend", version="1.0.0")

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def main_page(request: Request):
    return templates.TemplateResponse("main.html.jinja", {"request": request})

# allow local dev clients; adjust as needed later
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/call-model", response_class=JSONResponse)
async def call_model(request: Request):
    """
    Backward-compatible endpoint your teammate created.
    Expects the scheduling JSON payload (see example below) and returns ranked suggestions.
    """
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    try:
        result = model(data)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")

    return JSONResponse(result)

# Optional clearer alias (same behavior)
@app.post("/api/suggest", response_class=JSONResponse)
async def api_suggest(request: Request):
    data = await request.json()
    return JSONResponse(model(data))
