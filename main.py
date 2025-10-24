from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from model import model
from templates import templates

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def main_page(request: Request):
    return templates.TemplateResponse("main.html.jinja", {"request": request})


@app.post("/call-model", response_class=JSONResponse)
async def call_model(request: Request):
    # Insert backend code here or in `model.py`
    data = await request.json()
    return model(data)
