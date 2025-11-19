from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from model import model
from services.transformer import is_frontend_payload, transform_frontend_to_model_payload
from templates import templates

app = FastAPI(title="MeetSync Backend", version="1.0.0")

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def main_page(request: Request):
    return templates.TemplateResponse("main.html.jinja", {"request": request})


@app.get("/results", response_class=HTMLResponse)
async def results_page(request: Request):
    return templates.TemplateResponse("results.html.jinja", {"request": request})


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/call-model", response_class=JSONResponse)
async def call_model(request: Request):
    """
    Primary backend entrypoint.
    Handles both raw model payloads and frontend payloads that need transformation.
    """
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    try:
        # Automatically transform frontend request → model payload
        payload = (
            transform_frontend_to_model_payload(data)
            if is_frontend_payload(data)
            else data
        )
        result = model(payload)

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {e}"
        )

    return JSONResponse(result)
