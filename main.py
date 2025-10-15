from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from model import model

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.post("/call-model", response_class=JSONResponse)
async def call_model(request: Request):
    # Insert backend code here or in `model.py`
    data = await request.json()
    return model(data)
