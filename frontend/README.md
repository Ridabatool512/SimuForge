# SimuForge — Hospital Robotics Simulator

SimuForge is a browser-based 3D hospital simulation for experimenting with A* and Dijkstra path planning, obstacle placement, and multi-robot navigation.

## Stack
- **Frontend:** React, Vite, Three.js, React Three Fiber and Drei
- **Backend:** Python, FastAPI
- **Path planning:** A* and Dijkstra on a four-directional binary grid
- **Safety:** route validation, walkable-cell validation, robot cell reservations, and pedestrian routes that avoid blocked cells and pause near robots

## Run locally

### Backend
From the repository root:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install fastapi "uvicorn[standard]" pytest
uvicorn app.main:app --reload --app-dir backend
```

API health check: http://127.0.0.1:8000/api/health

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000` in local development. For a separately hosted backend, create `frontend/.env.local`:

```dotenv
VITE_API_URL=https://your-backend.example.com/api
```

Set `SIMUFORGE_API_PROXY` to change the local proxy target. Set backend `SIMUFORGE_CORS_ORIGINS` to a comma-separated list of allowed frontend origins when deploying across domains.

## Tests and checks
From the repository root:

```bash
PYTHONPATH=backend pytest backend/tests -q
cd frontend
npm run lint
npm run build
```

## Grid format
Grid cells must be integer `0` (walkable) or `1` (blocked). The API rejects ragged grids, invalid cell values, out-of-bounds coordinates, blocked start/goal cells, and unsupported algorithms.

## Note
This is an educational prototype, not a certified safety system for real hospital equipment.
