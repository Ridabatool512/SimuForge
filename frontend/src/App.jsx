
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Crosshair,
  Layers3,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Route as RouteIcon,
  ShieldCheck,
  Target,
  Trash2,
  Waypoints,
  Zap,
  History,
  Gauge,
} from "lucide-react";
import HospitalScene, { gridCellToWorld } from "./components/HospitalScene";
import "./App.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

const GRID_ROWS = 13;
const GRID_COLS = 17;
const START = [6, 1];
const GOAL = [6, 14];
const ROBOT_2_START = [2, 2];
const ROBOT_2_GOAL = [10, 3];
const CELL_DURATION_MS = 650;

function createHospitalGrid() {
  return Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: GRID_COLS }, (_, col) =>
      row === 0 ||
      col === 0 ||
      row === GRID_ROWS - 1 ||
      col === GRID_COLS - 1
        ? 1
        : 0
    )
  );
}

function formatMilliseconds(value) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "--";
  }

  return `${Number(value).toFixed(3)} ms`;
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainder
  ).padStart(2, "0")}`;
}

function MetricCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="metric-card">
      <div className="metric-icon">
        <Icon size={18} />
      </div>

      <div className="metric-content">
        <span className="metric-label">{label}</span>
        <strong className="metric-value">{value}</strong>
        <span className="metric-detail">{detail}</span>
      </div>
    </div>
  );
}

function validatePath(candidatePath, grid, expectedStart = START, expectedGoal = GOAL) {
  if (!Array.isArray(candidatePath) || candidatePath.length === 0) {
    return {
      valid: false,
      reason: "The path planner did not return a route.",
    };
  }

  for (const cell of candidatePath) {
    if (
      !Array.isArray(cell) ||
      cell.length < 2 ||
      !Number.isInteger(cell[0]) ||
      !Number.isInteger(cell[1])
    ) {
      return {
        valid: false,
        reason: "The planner returned an invalid grid coordinate.",
      };
    }

    const [row, col] = cell;

    if (
      !Array.isArray(grid) ||
      row < 0 ||
      row >= grid.length ||
      !Array.isArray(grid[row]) ||
      col < 0 ||
      col >= grid[row].length
    ) {
      return {
        valid: false,
        reason: "The route leaves the navigation grid.",
      };
    }

    if (grid[row][col] !== 0) {
      return {
        valid: false,
        reason: `Collision detected: route crosses blocked cell (${row}, ${col}).`,
      };
    }
  }

  const first = candidatePath[0];
  const last = candidatePath[candidatePath.length - 1];

  if (first[0] !== expectedStart[0] || first[1] !== expectedStart[1]) {
    return {
      valid: false,
      reason: "The route does not begin at the robot's starting point.",
    };
  }

  if (last[0] !== expectedGoal[0] || last[1] !== expectedGoal[1]) {
    return {
      valid: false,
      reason: "The route does not reach the destination.",
    };
  }

  for (let index = 1; index < candidatePath.length; index += 1) {
    const previous = candidatePath[index - 1];
    const current = candidatePath[index];

    const distance =
      Math.abs(current[0] - previous[0]) +
      Math.abs(current[1] - previous[1]);

    if (distance !== 1) {
      return {
        valid: false,
        reason:
          "Collision safety check failed: the route contains an invalid movement step.",
      };
    }
  }

  return { valid: true, reason: "" };
}

function ProgressPanel({ progress, running, completed }) {
  return (
    <div
      style={{
        padding: "16px",
        marginBottom: "18px",
        border: "1px solid var(--border, #293744)",
        borderRadius: "12px",
        background: "rgba(20, 32, 43, 0.7)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <Gauge size={17} />
          <strong style={{ fontSize: "13px" }}>Route progress</strong>
        </div>

        <strong
          style={{
            fontSize: "19px",
            color: completed ? "#65e6a8" : "#55e5d0",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {progress}%
        </strong>
      </div>

      <div
        role="progressbar"
        aria-label="Mission route progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        style={{
          height: "7px",
          overflow: "hidden",
          borderRadius: "20px",
          background: "#253441",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            borderRadius: "20px",
            background: completed
              ? "linear-gradient(90deg, #36b985, #65e6a8)"
              : "linear-gradient(90deg, #249f91, #55e5d0)",
            transition: "width 120ms linear",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "9px",
          fontSize: "11px",
          color: "#91a4b5",
        }}
      >
        <span>
          {completed
            ? "Destination reached"
            : running
              ? "Robot navigating"
              : progress > 0
                ? "Mission paused"
                : "Awaiting movement"}
        </span>
        <span>{progress === 100 ? "Route complete" : "Destination"}</span>
      </div>
    </div>
  );
}

function MissionHistory({ missions }) {
  return (
    <div className="control-section">
      <div className="section-heading">
        <span>MISSION HISTORY</span>
        <span className="section-number">04</span>
      </div>

      {missions.length === 0 ? (
        <div
          style={{
            padding: "16px",
            borderRadius: "10px",
            border: "1px dashed #344553",
            color: "#91a4b5",
            fontSize: "12px",
            lineHeight: 1.7,
          }}
        >
          <History size={17} style={{ marginBottom: "7px" }} />
          <div>No completed missions in this session yet.</div>
          <div>Completed deliveries will appear here.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {missions.map((mission) => (
            <div
              key={mission.id}
              style={{
                padding: "13px",
                borderRadius: "10px",
                border: "1px solid #293744",
                background: "rgba(20, 32, 43, 0.6)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "10px",
                  alignItems: "center",
                  marginBottom: "9px",
                }}
              >
                <strong style={{ fontSize: "12px" }}>
                  Delivery #{mission.number}
                </strong>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    color: "#65e6a8",
                    fontSize: "10px",
                  }}
                >
                  <CheckCircle2 size={12} />
                  COMPLETE
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "8px",
                }}
              >
                <div>
                  <div
                    style={{
                      color: "#91a4b5",
                      fontSize: "10px",
                      marginBottom: "4px",
                    }}
                  >
                    Duration
                  </div>
                  <strong style={{ fontSize: "12px" }}>
                    {formatDuration(mission.duration)}
                  </strong>
                </div>

                <div>
                  <div
                    style={{
                      color: "#91a4b5",
                      fontSize: "10px",
                      marginBottom: "4px",
                    }}
                  >
                    Path
                  </div>
                  <strong style={{ fontSize: "12px" }}>
                    {mission.pathLength} steps
                  </strong>
                </div>

                <div>
                  <div
                    style={{
                      color: "#91a4b5",
                      fontSize: "10px",
                      marginBottom: "4px",
                    }}
                  >
                    Planning
                  </div>
                  <strong style={{ fontSize: "12px" }}>
                    {mission.planningTime === null
                      ? "--"
                      : `${mission.planningTime.toFixed(2)} ms`}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  marginTop: "9px",
                  color: "#718697",
                  fontSize: "10px",
                }}
              >
                Completed at {mission.completedAt}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [grid, setGrid] = useState(() => createHospitalGrid());
  const [running, setRunning] = useState(false);
  const [robotPosition, setRobotPosition] = useState(() =>
    gridCellToWorld(START)
  );
  const [robot2Position, setRobot2Position] = useState(() =>
    gridCellToWorld(ROBOT_2_START)
  );
  const [robot2Path, setRobot2Path] = useState([]);
  const [robot2Running, setRobot2Running] = useState(false);
  const [robot2Status, setRobot2Status] = useState("Planning route");
  const [robot2Progress, setRobot2Progress] = useState(0);
  const [safetyStats, setSafetyStats] = useState({ prevented: 0, waits: 0 });

  const [elapsed, setElapsed] = useState(0);
  const [missionElapsed, setMissionElapsed] = useState(0);
  const [deliveries, setDeliveries] = useState(0);
  const [path, setPath] = useState([]);
  const [pathLength, setPathLength] = useState(null);
  const [exploredNodes, setExploredNodes] = useState(0);
  const [planningTime, setPlanningTime] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [apiError, setApiError] = useState("");
  const [missionStatus, setMissionStatus] = useState("Initializing");
  const [routeProgress, setRouteProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [missionHistory, setMissionHistory] = useState([]);

  const gridRef = useRef(grid);
  const pathRef = useRef([]);
  const runningRef = useRef(false);
  const planningRef = useRef(false);
  const robot2PathRef = useRef([]);
  const robot2RunningRef = useRef(false);
  const robot2StatusRef = useRef("Planning route");
  const robot2MotionRef = useRef({ progress: 0, lastTimestamp: null, completed: false, waitingFor: null });
  // A robot reserves its next cell before entering it. This prevents both
  // robots from claiming the same cell or swapping positions head-on.
  const reservationsRef = useRef({ robot1: null, robot2: null });
  const routeProgressRef = useRef(0);
  const elapsedRef = useRef(0);
  const missionElapsedRef = useRef(0);
  const missionStatusRef = useRef("Initializing");

  const motionRef = useRef({
    progress: 0,
    lastTimestamp: null,
    deliveryRecorded: false,
    waitingFor: null,
  });

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  useEffect(() => { missionStatusRef.current = missionStatus; }, [missionStatus]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    missionElapsedRef.current = missionElapsed;
  }, [missionElapsed]);

  useEffect(() => { robot2StatusRef.current = robot2Status; }, [robot2Status]);

  const updateProgress = useCallback((value) => {
    const safeValue = Math.max(0, Math.min(100, Math.round(value)));

    if (routeProgressRef.current !== safeValue) {
      routeProgressRef.current = safeValue;
      setRouteProgress(safeValue);
    }
  }, []);

  const cellKey = (cell) => `${cell[0]},${cell[1]}`;

  const getCurrentCell = (robotId) => {
    const route = robotId === "robot1" ? pathRef.current : robot2PathRef.current;
    const motion = robotId === "robot1" ? motionRef.current : robot2MotionRef.current;
    if (!route.length) return null;
    return route[Math.min(Math.floor(motion.progress), route.length - 1)];
  };

  const canReserveNextCell = (robotId, targetCell, currentCell) => {
    const otherId = robotId === "robot1" ? "robot2" : "robot1";
    const otherCurrent = getCurrentCell(otherId);
    const targetKey = cellKey(targetCell);
    const currentKey = cellKey(currentCell);
    const otherReservation = reservationsRef.current[otherId];

    // Never enter the other robot's currently occupied cell, and never
    // allow a head-on swap into the cell the other robot is reserving.
    if (otherCurrent && cellKey(otherCurrent) === targetKey) return false;
    if (otherReservation === targetKey) return false;
    if (otherReservation === currentKey) return false;
    return true;
  };

  const planRoute = useCallback(async (gridToUse = gridRef.current) => {
    if (planningRef.current) {
      return false;
    }

    planningRef.current = true;
    setPlanning(true);
    setApiError("");
    setCompleted(false);
    updateProgress(0);
    setMissionStatus("Calculating route");

    try {
      const response = await fetch(`${API_URL}/path`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grid: gridToUse,
          start: START,
          goal: GOAL,
          algorithm: "astar",
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Path API returned ${response.status}: ${body}`);
      }

      const data = await response.json();

      const executionTime =
        data.execution_ms ??
        data.planning_time_ms ??
        data.planning_time ??
        null;

      setExploredNodes(data.explored_nodes ?? 0);
      setPlanningTime(
        executionTime !== null &&
          executionTime !== undefined &&
          Number.isFinite(Number(executionTime))
          ? Number(executionTime)
          : null
      );

      const candidatePath = Array.isArray(data.path) ? data.path : [];

      if (data.found === false || candidatePath.length === 0) {
        pathRef.current = [];
        setPath([]);
        setPathLength(null);
        setMissionStatus("No route available");
        setApiError(
          "No collision-free route exists. Remove an obstacle and try again."
        );
        return false;
      }

      const validation = validatePath(candidatePath, gridToUse);

      if (!validation.valid) {
        pathRef.current = [];
        setPath([]);
        setPathLength(null);
        setMissionStatus("Safety check failed");
        setApiError(validation.reason);
        return false;
      }

      pathRef.current = candidatePath;
      setPath(candidatePath);

      setPathLength(data.path_length ?? candidatePath.length - 1);

      motionRef.current = {
        progress: 0,
        lastTimestamp: null,
        deliveryRecorded: false,
        waitingFor: null,
      };

      setRobotPosition(gridCellToWorld(candidatePath[0]));
      setMissionElapsed(0);
      missionElapsedRef.current = 0;
      setCompleted(false);
      updateProgress(0);
      setMissionStatus("Route ready");

      return true;
    } catch (error) {
      pathRef.current = [];
      setPath([]);
      setPathLength(null);
      setMissionStatus("API disconnected");

      setApiError(
        error instanceof Error
          ? error.message
          : "Could not connect to the SimuForge API."
      );

      return false;
    } finally {
      planningRef.current = false;
      setPlanning(false);
    }
  }, [updateProgress]);

  const planRobot2Route = useCallback(async (gridToUse = gridRef.current) => {
    robot2RunningRef.current = false;
    setRobot2Running(false);
    setRobot2Status("Planning route");
    setRobot2Progress(0);

    try {
      const response = await fetch(`${API_URL}/path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grid: gridToUse,
          start: ROBOT_2_START,
          goal: ROBOT_2_GOAL,
          algorithm: "astar",
        }),
      });

      if (!response.ok) {
        throw new Error(`Path API returned ${response.status}`);
      }

      const data = await response.json();
      const candidatePath = Array.isArray(data.path) ? data.path : [];
      const validation = validatePath(candidatePath, gridToUse, ROBOT_2_START, ROBOT_2_GOAL);

      if (data.found === false || !validation.valid) {
        robot2PathRef.current = [];
        setRobot2Path([]);
        setRobot2Status(data.found === false ? "No route available" : "Safety check failed");
        return false;
      }

      robot2PathRef.current = candidatePath;
      setRobot2Path(candidatePath);
      robot2MotionRef.current = { progress: 0, lastTimestamp: null, completed: false };
      setRobot2Position(gridCellToWorld(candidatePath[0]));
      setRobot2Status("Route ready");
      return true;
    } catch (error) {
      robot2PathRef.current = [];
      setRobot2Path([]);
      setRobot2Status("API unavailable");
      return false;
    }
  }, []);

  useEffect(() => {
    planRoute();
    planRobot2Route();
  }, [planRoute, planRobot2Route]);

  useEffect(() => {
    if (!robot2Running || robot2Path.length < 2) return undefined;
    let animationFrame;

    function animateRobot2(timestamp) {
      if (!robot2RunningRef.current) return;
      const motion = robot2MotionRef.current;
      if (motion.lastTimestamp === null) motion.lastTimestamp = timestamp;
      const delta = Math.min(timestamp - motion.lastTimestamp, 50);
      motion.lastTimestamp = timestamp;
      const currentPath = robot2PathRef.current;
      const finalProgress = currentPath.length - 1;
      const currentIndexBeforeMove = Math.min(Math.floor(motion.progress), finalProgress);
      const currentCell = currentPath[currentIndexBeforeMove];

      if (currentIndexBeforeMove < finalProgress) {
        const targetCell = currentPath[currentIndexBeforeMove + 1];
        const targetKey = cellKey(targetCell);
        if (reservationsRef.current.robot2 !== targetKey) {
          if (!canReserveNextCell("robot2", targetCell, currentCell)) {
            motion.lastTimestamp = timestamp;
            if (motion.waitingFor !== targetKey) {
              motion.waitingFor = targetKey;
              setSafetyStats((stats) => ({ ...stats, prevented: stats.prevented + 1, waits: stats.waits + 1 }));
              setRobot2Status("Waiting — route conflict");
            }
            animationFrame = window.requestAnimationFrame(animateRobot2);
            return;
          }
          reservationsRef.current.robot2 = targetKey;
        }
      }

      motion.waitingFor = null;
      if (robot2StatusRef.current === "Waiting — route conflict") {
        setRobot2Status("Robot in motion");
      }
      motion.progress = Math.min(finalProgress, motion.progress + delta / CELL_DURATION_MS);
      const fromIndex = Math.floor(motion.progress);
      if (fromIndex > currentIndexBeforeMove || motion.progress >= finalProgress) {
        reservationsRef.current.robot2 = null;
      }
      const toIndex = Math.min(fromIndex + 1, finalProgress);
      const amount = motion.progress - fromIndex;
      const from = gridCellToWorld(currentPath[fromIndex]);
      const to = gridCellToWorld(currentPath[toIndex]);
      setRobot2Position([
        from[0] + (to[0] - from[0]) * amount,
        from[1] + (to[1] - from[1]) * amount,
        from[2] + (to[2] - from[2]) * amount,
      ]);
      setRobot2Progress(Math.round((motion.progress / finalProgress) * 100));

      if (motion.progress >= finalProgress) {
        setRobot2Position(gridCellToWorld(currentPath[finalProgress]));
        setRobot2Progress(100);
        robot2RunningRef.current = false;
        setRobot2Running(false);
        setRobot2Status("Mission complete");
        motion.completed = true;
        motion.lastTimestamp = null;
        reservationsRef.current.robot2 = null;
        return;
      }
      animationFrame = window.requestAnimationFrame(animateRobot2);
    }

    animationFrame = window.requestAnimationFrame(animateRobot2);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      robot2MotionRef.current.lastTimestamp = null;
    };
  }, [robot2Running, robot2Path]);

  useEffect(() => {
    if (!running || path.length < 2) {
      return undefined;
    }

    let animationFrame;

    function animate(timestamp) {
      if (!runningRef.current) {
        return;
      }

      const motion = motionRef.current;

      if (motion.lastTimestamp === null) {
        motion.lastTimestamp = timestamp;
      }

      const delta = Math.min(timestamp - motion.lastTimestamp, 50);
      motion.lastTimestamp = timestamp;

      const currentPath = pathRef.current;
      const finalProgress = currentPath.length - 1;
      const currentIndexBeforeMove = Math.min(Math.floor(motion.progress), finalProgress);
      const currentCell = currentPath[currentIndexBeforeMove];

      if (currentIndexBeforeMove < finalProgress) {
        const targetCell = currentPath[currentIndexBeforeMove + 1];
        const targetKey = cellKey(targetCell);
        if (reservationsRef.current.robot1 !== targetKey) {
          if (!canReserveNextCell("robot1", targetCell, currentCell)) {
            motion.lastTimestamp = timestamp;
            if (motion.waitingFor !== targetKey) {
              motion.waitingFor = targetKey;
              setSafetyStats((stats) => ({ ...stats, prevented: stats.prevented + 1, waits: stats.waits + 1 }));
              setMissionStatus("Waiting — route conflict");
            }
            animationFrame = window.requestAnimationFrame(animate);
            return;
          }
          reservationsRef.current.robot1 = targetKey;
        }
      }

      motion.waitingFor = null;
      if (missionStatusRef.current === "Waiting — route conflict") {
        setMissionStatus("Robot in motion");
      }
      motion.progress = Math.min(finalProgress, motion.progress + delta / CELL_DURATION_MS);

      const fromIndex = Math.floor(motion.progress);
      if (fromIndex > currentIndexBeforeMove || motion.progress >= finalProgress) {
        reservationsRef.current.robot1 = null;
      }
      const toIndex = Math.min(fromIndex + 1, finalProgress);
      const amount = motion.progress - fromIndex;

      const from = gridCellToWorld(currentPath[fromIndex]);
      const to = gridCellToWorld(currentPath[toIndex]);

      setRobotPosition([
        from[0] + (to[0] - from[0]) * amount,
        from[1] + (to[1] - from[1]) * amount,
        from[2] + (to[2] - from[2]) * amount,
      ]);

      updateProgress((motion.progress / finalProgress) * 100);

      if (motion.progress >= finalProgress) {
        setRobotPosition(gridCellToWorld(currentPath[finalProgress]));
        updateProgress(100);
        runningRef.current = false;
        setRunning(false);
        setCompleted(true);
        setMissionStatus("Delivery complete");

        if (!motion.deliveryRecorded) {
          motion.deliveryRecorded = true;

          const newDeliveryNumber = deliveries + 1;
          setDeliveries((count) => count + 1);

          const record = {
            id: `${Date.now()}-${newDeliveryNumber}`,
            number: newDeliveryNumber,
            duration: missionElapsedRef.current,
            pathLength: pathLength ?? finalProgress,
            planningTime,
            completedAt: new Date().toLocaleTimeString(),
          };

          setMissionHistory((history) => [record, ...history].slice(0, 5));
        }

        motion.lastTimestamp = null;
        reservationsRef.current.robot1 = null;
        return;
      }

      animationFrame = window.requestAnimationFrame(animate);
    }

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      motionRef.current.lastTimestamp = null;
    };
  }, [
    running,
    path,
    pathLength,
    planningTime,
    deliveries,
    updateProgress,
  ]);

  useEffect(() => {
    if (!running) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
      setMissionElapsed((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running]);

  async function handleCellClick(row, col) {
    if (running || planning || planningRef.current) {
      return;
    }

    if (
      (row === START[0] && col === START[1]) ||
      (row === GOAL[0] && col === GOAL[1]) ||
      (row === ROBOT_2_START[0] && col === ROBOT_2_START[1]) ||
      (row === ROBOT_2_GOAL[0] && col === ROBOT_2_GOAL[1])
    ) {
      return;
    }

    const updatedGrid = gridRef.current.map((currentRow) => [...currentRow]);
    updatedGrid[row][col] = updatedGrid[row][col] === 1 ? 0 : 1;

    gridRef.current = updatedGrid;
    setGrid(updatedGrid);

    runningRef.current = false;
    setRunning(false);
    reservationsRef.current = { robot1: null, robot2: null };
    setCompleted(false);

    pathRef.current = [];
    setPath([]);
    setPathLength(null);
    setExploredNodes(0);
    setPlanningTime(null);
    setMissionElapsed(0);
    missionElapsedRef.current = 0;
    updateProgress(0);

    motionRef.current = {
      progress: 0,
      lastTimestamp: null,
      deliveryRecorded: false,
      waitingFor: null,
    };

    setRobotPosition(gridCellToWorld(START));

    await Promise.all([planRoute(updatedGrid), planRobot2Route(updatedGrid)]);
  }

  async function handleRecalculate() {
    if (running || planning || planningRef.current) {
      return;
    }

    await Promise.all([planRoute(gridRef.current), planRobot2Route(gridRef.current)]);
  }

  async function clearAllObstacles() {
    if (planning || planningRef.current) return;
    runningRef.current = false;
    robot2RunningRef.current = false;
    setRunning(false);
    setRobot2Running(false);
    reservationsRef.current = { robot1: null, robot2: null };
    const cleanGrid = createHospitalGrid();
    gridRef.current = cleanGrid;
    setGrid(cleanGrid);
    motionRef.current = { progress: 0, lastTimestamp: null, deliveryRecorded: false, waitingFor: null };
    robot2MotionRef.current = { progress: 0, lastTimestamp: null, completed: false, waitingFor: null };
    setRobotPosition(gridCellToWorld(START));
    setRobot2Position(gridCellToWorld(ROBOT_2_START));
    setRobot2Progress(0);
    setRobot2Status("Replanning route");
    setMissionElapsed(0);
    missionElapsedRef.current = 0;
    updateProgress(0);
    setMissionStatus("Clearing obstacles");
    setCompleted(false);
    setApiError("");
    await Promise.all([planRoute(cleanGrid), planRobot2Route(cleanGrid)]);
  }

  async function resetSimulation() {
    runningRef.current = false;
    setRunning(false);
    robot2RunningRef.current = false;
    setRobot2Running(false);
    reservationsRef.current = { robot1: null, robot2: null };

    const cleanGrid = createHospitalGrid();

    gridRef.current = cleanGrid;
    setGrid(cleanGrid);

    pathRef.current = [];
    setPath([]);
    setPathLength(null);
    setExploredNodes(0);
    setPlanningTime(null);

    motionRef.current = {
      progress: 0,
      lastTimestamp: null,
      deliveryRecorded: false,
      waitingFor: null,
    };

    setElapsed(0);
    elapsedRef.current = 0;
    setMissionElapsed(0);
    missionElapsedRef.current = 0;
    setDeliveries(0);
    setMissionHistory([]);
    setSafetyStats({ prevented: 0, waits: 0 });
    setRobot2Path([]);
    robot2PathRef.current = [];
    robot2MotionRef.current = { progress: 0, lastTimestamp: null, completed: false, waitingFor: null };
    setRobotPosition(gridCellToWorld(START));
    setRobot2Position(gridCellToWorld(ROBOT_2_START));
    setRobot2Progress(0);
    setRobot2Status("Resetting");
    setApiError("");
    setCompleted(false);
    updateProgress(0);
    setMissionStatus("Resetting simulation");

    await Promise.all([planRoute(cleanGrid), planRobot2Route(cleanGrid)]);
  }

  function toggleRobot2() {
    if (robot2Running) {
      robot2RunningRef.current = false;
      setRobot2Running(false);
      setRobot2Status("Paused");
      return;
    }
    if (robot2PathRef.current.length < 2) {
      setRobot2Status("Plan a route first");
      return;
    }
    const motion = robot2MotionRef.current;
    if (motion.progress >= robot2PathRef.current.length - 1) {
      motion.progress = 0;
      motion.completed = false;
      motion.waitingFor = null;
      reservationsRef.current.robot2 = null;
      setRobot2Position(gridCellToWorld(robot2PathRef.current[0]));
      setRobot2Progress(0);
    }
    motion.lastTimestamp = null;
    motion.waitingFor = null;
    robot2RunningRef.current = true;
    setRobot2Running(true);
    setRobot2Status("Robot in motion");
  }

  function toggleSimulation() {
    if (planning || planningRef.current) {
      return;
    }

    if (running) {
      runningRef.current = false;
      setRunning(false);
      setMissionStatus("Simulation paused");
      return;
    }

    if (pathRef.current.length < 2) {
      setMissionStatus("Plan a valid route first");
      return;
    }

    const motion = motionRef.current;
    const finalProgress = pathRef.current.length - 1;

    if (motion.progress >= finalProgress) {
      motion.progress = 0;
      motion.deliveryRecorded = false;
      motion.waitingFor = null;
      reservationsRef.current.robot1 = null;
      setRobotPosition(gridCellToWorld(pathRef.current[0]));
      setMissionElapsed(0);
      missionElapsedRef.current = 0;
      setCompleted(false);
      updateProgress(0);
    }

    motion.lastTimestamp = null;
    runningRef.current = true;
    setMissionStatus("Robot in motion");
    setRunning(true);
  }

  const obstacleCount =
    grid.reduce(
      (total, row) => total + row.filter((cell) => cell === 1).length,
      0
    ) -
    (GRID_ROWS * 2 + GRID_COLS * 2 - 4);

  const hasRoute = path.length > 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Bot size={24} />
          </div>

          <div>
            <div className="brand-name">SimuForge</div>
            <div className="brand-subtitle">ROBOTICS SIMULATION LAB</div>
          </div>
        </div>

        <div className="topbar-center">
          <span className="system-indicator" />
          SIMULATION ENVIRONMENT
        </div>

        <div className="topbar-right">
          <span className="build-label">BUILD 0.8.0</span>

          <span
            className={`connection-badge ${
              apiError ? "connection-error" : ""
            }`}
          >
            <span className="status-dot" />
            {apiError ? "CHECK STATUS" : "A* CONNECTED"}
          </span>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <Activity size={14} />
            AUTONOMOUS SYSTEMS / PATH PLANNING
          </div>

          <h1>Hospital Robotics Simulator</h1>

          <p>
            Simulate autonomous hospital deliveries, plan collision-aware
            routes, and test navigation in a 3D environment.
          </p>
        </div>

        <div className="mission-status">
          <span className="status-label">MISSION STATUS</span>
          <span
            className={`mission-value ${
              apiError ? "status-danger" : ""
            }`}
          >
            <span className="status-dot" />
            {missionStatus}
          </span>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard
          icon={Bot}
          label="ACTIVE ROBOTS"
          value={String(Number(running) + Number(robot2Running)).padStart(2, "0")}
          detail={running || robot2Running ? "Robot(s) in motion" : "Standby"}
        />

        <MetricCard
          icon={CheckCircle2}
          label="DELIVERIES"
          value={String(deliveries).padStart(2, "0")}
          detail="Completed missions"
        />

        <MetricCard
          icon={Clock3}
          label="MISSION TIME"
          value={formatDuration(elapsed)}
          detail="Current session"
        />

        <MetricCard
          icon={RouteIcon}
          label="PLANNED PATH"
          value={pathLength === null ? "--" : `${pathLength} steps`}
          detail={hasRoute ? "A* route length" : "No available route"}
        />
      </section>

      <section className="workspace-grid">
        <div className="scene-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <div className="panel-icon">
                <Layers3 size={18} />
              </div>

              <div>
                <h2>3D Hospital Environment</h2>
                <p>Interactive navigation and obstacle mapping</p>
              </div>
            </div>

            <span className="live-badge">
              <span className="status-dot" />
              LIVE
            </span>
          </div>

          <div className="scene-container">
            <HospitalScene
              robotPosition={robotPosition}
              running={running}
              completed={completed}
              secondaryRobotPosition={robot2Position}
              secondaryRobotRunning={robot2Running}
              secondaryRobotPath={robot2Path}
              path={path}
              grid={grid}
              onCellClick={handleCellClick}
            />

            <div className="scene-overlay scene-overlay-top">
              <span>
                <Crosshair size={13} />
                SIMULATION VIEW
              </span>

              <span>
                GRID {GRID_ROWS} × {GRID_COLS}
              </span>
            </div>

            <div className="scene-overlay scene-overlay-bottom">
              <span className="legend-item">
                <span className="legend-dot robot-legend" />
                Robot
              </span>

              <span className="legend-item">
                <span className="legend-dot route-legend" />
                Planned path
              </span>

              <span className="legend-item">
                <span className="legend-dot obstacle-legend" />
                Obstacle
              </span>

              <span className="legend-item">
                <span className="legend-dot goal-legend" />
                Destination
              </span>
            </div>
          </div>

          <div className="scene-footer">
            <div className="interaction-hint">
              <MousePointer2 size={15} />
              <span>
                Click a free grid cell to add an obstacle. Click a red
                obstacle to remove it.
              </span>
            </div>

            <div className="obstacle-counter">
              <span className="status-dot obstacle-status-dot" />
              {Math.max(0, obstacleCount)} obstacles
            </div>
          </div>

          <div style={{ padding: "0 20px 20px" }}>
            <ProgressPanel
              progress={routeProgress}
              running={running}
              completed={completed}
            />
          </div>
        </div>

        <aside className="control-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <div className="panel-icon">
                <Waypoints size={18} />
              </div>

              <div>
                <h2>Mission Control</h2>
                <p>Configure robot navigation</p>
              </div>
            </div>
          </div>

          <div className="control-section">
            <div className="section-heading">
              <span>PATH PLANNING</span>
              <span className="section-number">01</span>
            </div>

            <div className="algorithm-card">
              <div className="algorithm-icon">
                <Zap size={19} />
              </div>

              <div className="algorithm-info">
                <strong>A* Search Algorithm</strong>
                <span>Heuristic-based shortest path</span>
              </div>

              <span className="algorithm-active">ACTIVE</span>
            </div>

            <div className="stat-row">
              <span>Explored nodes</span>
              <strong>{exploredNodes}</strong>
            </div>

            <div className="stat-row">
              <span>Planning time</span>
              <strong>{formatMilliseconds(planningTime)}</strong>
            </div>

            <div className="stat-row">
              <span>Path length</span>
              <strong>
                {pathLength === null ? "--" : `${pathLength} steps`}
              </strong>
            </div>

            <button
              className="secondary-button full-width"
              onClick={handleRecalculate}
              disabled={running || planning}
            >
              <RouteIcon size={16} />
              {planning ? "Calculating route..." : "Recalculate A* Route"}
            </button>
          </div>

          <div className="control-section">
            <div className="section-heading">
              <span>SIMULATION CONTROLS</span>
              <span className="section-number">02</span>
            </div>

            <button
              className="primary-button full-width"
              onClick={toggleSimulation}
              disabled={planning || !hasRoute}
            >
              {running ? <Pause size={17} /> : <Play size={17} />}
              {running ? "Pause Simulation" : "Start Simulation"}
            </button>

            <button
              className="secondary-button full-width reset-button"
              onClick={resetSimulation}
              disabled={planning}
            >
              <RotateCcw size={16} />
              Reset Simulation
            </button>

            <button
              className="text-button full-width"
              onClick={clearAllObstacles}
              disabled={planning || obstacleCount === 0}
            >
              <Trash2 size={15} />
              Clear all obstacles
            </button>
          </div>

          <div className="control-section">
            <div className="section-heading">
              <span>ROBOT 02 · INDEPENDENT MISSION</span>
              <span className="section-number">03</span>
            </div>
            <div className="stat-row">
              <span>Mission status</span>
              <strong>{robot2Status}</strong>
            </div>
            <div className="stat-row">
              <span>Route length</span>
              <strong>{robot2Path.length ? `${robot2Path.length - 1} steps` : "--"}</strong>
            </div>
            <div className="stat-row">
              <span>Progress</span>
              <strong>{robot2Progress}%</strong>
            </div>
            <div style={{ height: 5, background: "rgba(121,170,255,.15)", borderRadius: 99, overflow: "hidden", margin: "10px 0 14px" }}>
              <div style={{ width: `${robot2Progress}%`, height: "100%", background: "#79aaff", transition: "width 120ms linear" }} />
            </div>
            <button className="primary-button full-width" onClick={toggleRobot2} disabled={robot2Path.length < 2}>
              {robot2Running ? <Pause size={17} /> : <Play size={17} />}
              {robot2Running ? "Pause Robot 02" : robot2Progress >= 100 ? "Restart Robot 02" : "Start Robot 02"}
            </button>
            <button className="secondary-button full-width" onClick={() => planRobot2Route(gridRef.current)} disabled={robot2Running}>
              <RouteIcon size={16} /> Recalculate Robot 02 Route
            </button>
          </div>

          <div className="control-section">
            <div className="section-heading">
              <span>MULTI-ROBOT SAFETY</span>
              <span className="section-number">05</span>
            </div>
            <div className="stat-row">
              <span>Conflicting moves prevented</span>
              <strong>{safetyStats.prevented}</strong>
            </div>
            <div className="stat-row">
              <span>Safe waiting events</span>
              <strong>{safetyStats.waits}</strong>
            </div>
            <p style={{ color: "#91a4b5", fontSize: "11px", lineHeight: 1.6, marginTop: "10px" }}>
              Robots reserve their next grid cell before entering it. Conflicting moves and head-on swaps are held until the cell is safe.
            </p>
          </div>

          <div className="control-section">
            <div className="section-heading">
              <span>NAVIGATION MAP</span>
              <span className="section-number">06</span>
            </div>

            <div className="location-card">
              <div className="location-icon start-icon">
                <Crosshair size={16} />
              </div>

              <div className="location-info">
                <span>START LOCATION</span>
                <strong>Hospital Robot Bay</strong>
                <small>
                  Row {START[0]}, Column {START[1]}
                </small>
              </div>
            </div>

            <div className="location-connector">
              <span />
              <span />
              <span />
            </div>

            <div className="location-card">
              <div className="location-icon goal-icon">
                <Target size={16} />
              </div>

              <div className="location-info">
                <span>DESTINATION</span>
                <strong>Patient Delivery Point</strong>
                <small>
                  Row {GOAL[0]}, Column {GOAL[1]}
                </small>
              </div>
            </div>
          </div>

          <MissionHistory missions={missionHistory} />

          <div className="safety-card">
            {apiError ? (
              <AlertTriangle size={17} />
            ) : (
              <ShieldCheck size={17} />
            )}

            <div>
              <strong>
                {apiError
                  ? "Navigation safety notice"
                  : "Navigation system ready"}
              </strong>

              <p>
                {apiError ||
                  "Routes are validated before movement. Blocked cells and non-adjacent steps are rejected."}
              </p>
            </div>
          </div>
        </aside>
      </section>

      <footer className="app-footer">
        <div>
          <span className="footer-brand">SIMUFORGE</span>
          <span>Autonomous robotics research environment</span>
        </div>

        <div className="footer-right">
          <span>FASTAPI BACKEND</span>
          <span className="footer-divider">/</span>
          <span>REACT THREE FIBER</span>
          <span className="footer-divider">/</span>
          <span>A* PATHFINDING</span>
        </div>
      </footer>
    </main>
  );
}

export default App;
