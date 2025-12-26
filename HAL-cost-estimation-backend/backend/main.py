from fastapi import FastAPI
from .db import engine
from .models.models import Base
from .routes import cost_estimation
from fastapi.middleware.cors import CORSMiddleware

from .routes import (
    operation_type,
    machines,
    dimensions,
    duties,
    materials,
    machine_selection,
    mhr
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="HAL Cost Estimation API")

# CORS CONFIGURATION
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://192.168.137.1:5173",   # optional (LAN)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(operation_type.router)
app.include_router(machines.router)
app.include_router(dimensions.router)
app.include_router(duties.router)
app.include_router(materials.router)
app.include_router(machine_selection.router)
app.include_router(mhr.router)
app.include_router(cost_estimation.router)
@app.get("/")
def root():
    return {"status": "HAL Cost Estimation Backend Running 🚀"}
