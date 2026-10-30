# SimuForge — Smart Warehouse Robotics Simulator

SimuForge is a browser-based 3D warehouse robotics simulation built with React, Three.js / React Three Fiber, and a FastAPI pathfinding service. It demonstrates grid-based route planning, two-robot scheduling, collision-aware movement, command-driven missions, task queues, simulated battery charging, and session analytics.

## Features

- Interactive 3D warehouse with storage racks A–H, floor zones, grid cells, and editable obstacles.
- A* and Dijkstra pathfinding through the FastAPI API.
- Two-robot scheduler with cell/edge reservations and deadlock recovery logic.
- Command console for robot controls, status queries, destination routing, charging, queue management, replanning, and reset.
- Local task queue and simulated battery drain/charging.
- Session metrics for deliveries, active robots, waits, recoveries, and blocked moves.
- Mission history and route-progress indicators.

> This is a simulation, not a physical robot controller. Battery, workflow, and analytics values are simulated in the browser and are not persisted to a database.

## Requirements

- Node.js 20+ recommended
- Python 3.11+
- PowerShell on Windows (commands below)

## Run the backend

From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install fastapi uvicorn pydantic pytest
python -m uvicorn app.main:app --reload
```

The API runs at http://127.0.0.1:8000. Health check: http://127.0.0.1:8000/api/health

## Run the frontend

Open a second PowerShell window:

```powershell
cd frontend
npm install
npm run dev
```

Vite normally serves the app at http://localhost:5173.

## Command console

Commands are case-insensitive. Use the command console in the Mission Control panel.

| Command | Purpose |
| --- | --- |
| `HELP` | List supported commands |
| `START R1`, `PAUSE R1` | Start or pause Robot 01 |
| `START R2`, `PAUSE R2` | Start or pause Robot 02 |
| `STATUS ALL`, `STATUS R1`, `STATUS R2` | Show status, progress and battery |
| `MOVE R1 TO DISPATCH` | Plan and start a destination route |
| `MOVE R2 TO RACK A` | Plan and start a route to a rack access cell |
| `QUEUE R1 TO PACKING` | Add a task to the pending queue |
| `RUN QUEUE` | Remove and start the next queued task |
| `QUEUE CLEAR` | Clear pending tasks |
| `CHARGE R1`, `CHARGE R2` | Route a robot to the charging bay |
| `REPLAN` | Recalculate default routes while both robots are paused |
| `RESET` | Reset the simulation and restore default routes |

Supported destinations include PICKUP, PACKING, CHARGING, DISPATCH, RACK A through RACK H, START, HOME R1 and HOME R2. Pause a robot before issuing it a new destination.

## Checks

```powershell
cd frontend
npm run lint
npm run build
```

The backend endpoint can be tested without Postman:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/health
```

## Architecture

- `frontend/src/App.jsx`: simulation state, scheduler integration, command console, queue, battery and analytics.
- `frontend/src/components/HospitalScene.jsx`: Three.js warehouse rendering (legacy filename).
- `frontend/src/config/warehouseLayout.js`: grid and rack layout.
- `backend/app/main.py`: FastAPI routes.
- `backend/app/pathfinding.py`: A* and Dijkstra pathfinding.

## Current limitations

- Tasks, battery state, mission history, and analytics are session-only; no database persistence yet.
- Command-based routes are simulated and should be thoroughly tested against concurrent robot reservations before any physical deployment.
- ROS 2, real robot adapters, inventory persistence, authentication, and automated workflow dispatch are future extensions.
