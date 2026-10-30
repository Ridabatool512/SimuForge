
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os

from app.pathfinding import find_path

app = FastAPI(
    title="SimuForge API",
    description="Robotics simulation and pathfinding engine",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "SIMUFORGE_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PathRequest(BaseModel):
    grid: list[list[int]] = Field(min_length=1)
    start: tuple[int, int]
    goal: tuple[int, int]
    algorithm: str = "astar"


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "SimuForge API",
    }


@app.post("/api/path")
def calculate_path(request: PathRequest):
    try:
        return find_path(
            grid=request.grid,
            start=request.start,
            goal=request.goal,
            algorithm=request.algorithm.lower(),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
