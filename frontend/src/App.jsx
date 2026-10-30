import { createWarehouseGrid, DEFAULT_OBSTACLES, HUMAN_PATROLS } from "./config/warehouseLayout";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Crosshair,
  Gauge,
  History,
  Layers3,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Route as RouteIcon,
  ShieldCheck,
  Target,
  Terminal,
  Send,
  Trash2,
  Waypoints,
  Zap,
} from "lucide-react";
import WarehouseScene from "./components/WarehouseScene";
import { gridCellToWorld } from "./utils/grid";
import "./App.css";

const API_URL = "http://127.0.0.1:8000/api";

const GRID_ROWS = 13;
const GRID_COLS = 17;
const START = [6, 1];
const GOAL = [6, 14];
const ROBOT_2_START = [2, 2];
const ROBOT_2_GOAL = [10, 3];

const CELL_DURATION_MS = 650;
const DEADLOCK_TIMEOUT_MS = 1800;

const keyOf = (cell) => `${cell[0]},${cell[1]}`;
const edgeKeyOf = (from, to) => `${keyOf(from)}>${keyOf(to)}`;
const reverseEdgeKeyOf = (from, to) => edgeKeyOf(to, from);

const sameCell = (a, b) =>
  Boolean(a && b && a[0] === b[0] && a[1] === b[1]);

function createHospitalGrid() {
  return createWarehouseGrid();
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
  const total = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;

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

function validatePath(candidate, grid, start, goal) {
  if (!Array.isArray(candidate) || candidate.length === 0) {
    return { valid: false, reason: "The planner returned no route." };
  }

  for (let i = 0; i < candidate.length; i += 1) {
    const cell = candidate[i];

    if (
      !Array.isArray(cell) ||
      !Number.isInteger(cell[0]) ||
      !Number.isInteger(cell[1])
    ) {
      return {
        valid: false,
        reason: "The planner returned an invalid coordinate.",
      };
    }

    const [row, col] = cell;

    if (
      row < 0 ||
      row >= GRID_ROWS ||
      col < 0 ||
      col >= GRID_COLS
    ) {
      return { valid: false, reason: "The route leaves the grid." };
    }

    if (grid[row][col] === 1) {
      return {
        valid: false,
        reason: `The route crosses blocked cell (${row}, ${col}).`,
      };
    }

    if (i > 0) {
      const previous = candidate[i - 1];
      const distance =
        Math.abs(previous[0] - row) +
        Math.abs(previous[1] - col);

      if (distance !== 1) {
        return {
          valid: false,
          reason: "The route contains an invalid movement step.",
        };
      }
    }
  }

  if (!sameCell(candidate[0], start)) {
    return { valid: false, reason: "The route has the wrong start." };
  }

  if (!sameCell(candidate[candidate.length - 1], goal)) {
    return {
      valid: false,
      reason: "The route does not reach its destination.",
    };
  }

  return { valid: true, reason: "" };
}

function ProgressPanel({ progress, running, completed }) {
  return (
    <div
      style={{
        padding: 16,
        marginBottom: 18,
        border: "1px solid var(--border, #293744)",
        borderRadius: 12,
        background: "rgba(20,32,43,.7)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <strong style={{ display: "flex", gap: 9, fontSize: 13 }}>
          <Gauge size={17} /> Route progress
        </strong>
        <strong
          style={{
            fontSize: 19,
            color: completed ? "#65e6a8" : "#55e5d0",
          }}
        >
          {progress}%
        </strong>
      </div>

      <div
        role="progressbar"
        aria-label="Robot 01 route progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        style={{
          height: 7,
          borderRadius: 20,
          overflow: "hidden",
          background: "#253441",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: completed
              ? "#65e6a8"
              : "linear-gradient(90deg,#249f91,#55e5d0)",
            transition: "width 120ms linear",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 9,
          fontSize: 11,
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
        <span>{progress === 100 ? "Complete" : "Destination"}</span>
      </div>
    </div>
  );
}

function MissionHistory({ missions }) {
  return (
    <div className="control-section">
      <div className="section-heading">
        <span>MISSION HISTORY</span>
        <span className="section-number">05</span>
      </div>

      {missions.length === 0 ? (
        <div
          style={{
            padding: 16,
            border: "1px dashed #344553",
            borderRadius: 10,
            color: "#91a4b5",
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          <History size={17} />
          <div>No completed missions in this session yet.</div>
          <div>Completed deliveries will appear here.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {missions.map((mission) => (
            <div
              key={mission.id}
              style={{
                padding: 13,
                border: "1px solid #293744",
                borderRadius: 10,
                background: "rgba(20,32,43,.6)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 9,
                }}
              >
                <strong>Delivery #{mission.number}</strong>
                <span style={{ color: "#65e6a8", fontSize: 10 }}>
                  <CheckCircle2 size={12} /> COMPLETE
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#91a4b5" }}>
                Duration: {formatDuration(mission.duration)}
                <br />
                Path: {mission.pathLength} steps
                <br />
                Planning: {formatMilliseconds(mission.planningTime)}
                <br />
                Completed: {mission.completedAt}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [grid, setGrid] = useState(createHospitalGrid);
  const [running, setRunning] = useState(false);
  const [robot2Running, setRobot2Running] = useState(false);

  const [robotPosition, setRobotPosition] = useState(() =>
    gridCellToWorld(START)
  );
  const [robot2Position, setRobot2Position] = useState(() =>
    gridCellToWorld(ROBOT_2_START)
  );

  const [path, setPath] = useState([]);
  const [robot2Path, setRobot2Path] = useState([]);
  const [pathLength, setPathLength] = useState(null);
  const [exploredNodes, setExploredNodes] = useState(0);
  const [planningTime, setPlanningTime] = useState(null);

  const [planning, setPlanning] = useState(false);
  const [apiError, setApiError] = useState("");
  const [missionStatus, setMissionStatus] = useState("Waiting for a command");
  const [robot2Status, setRobot2Status] = useState("Waiting for a command");

  const [routeProgress, setRouteProgress] = useState(0);
  const [robot2Progress, setRobot2Progress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
const [, setMissionElapsed] = useState(0);
  const [deliveries, setDeliveries] = useState(0);
const deliveriesRef = useRef(0);
  const [completed, setCompleted] = useState(false);
  const [missionHistory, setMissionHistory] = useState([]);
  const [commandInput, setCommandInput] = useState("");
  const [taskQueue, setTaskQueue] = useState([]);
  const [battery, setBattery] = useState({ R1: 100, R2: 100 });
  const [charging, setCharging] = useState({ R1: false, R2: false });
  const [workflowLog, setWorkflowLog] = useState([]);
  const [commandLog, setCommandLog] = useState([
    { type: "system", text: "Command console ready. Type HELP to see available commands." },
  ]);
  const [safetyStats, setSafetyStats] = useState({
    prevented: 0,
    waits: 0,
    recoveries: 0,
  });

  const chargingTargetRef = useRef({ R1: false, R2: false });
  const gridRef = useRef(grid);
  const pathRef = useRef([]);
  const robot2PathRef = useRef([]);

  const runningRef = useRef(false);
  const robot2RunningRef = useRef(false);
  const planningRef = useRef(false);

  const motionRef = useRef({
    progress: 0,
    lastTimestamp: null,
    deliveryRecorded: false,
    blockedSince: null,
    recovering: false,
  });

  const robot2MotionRef = useRef({
    progress: 0,
    lastTimestamp: null,
    deliveryRecorded: false,
    blockedSince: null,
    recovering: false,
  });

  // Both robots use one scheduler and one reservation table.
  // This avoids races between two independent animation loops.
  const reservationsRef = useRef({
    robot1: null,
    robot2: null,
  });

  // Each robot reserves its directed edge while traversing it.
  const edgeReservationsRef = useRef({
    robot1: null,
    robot2: null,
  });

  const priorityRef = useRef("robot1");
  const recoveryRef = useRef(false);
  const elapsedRef = useRef(0);
  const missionElapsedRef = useRef(0);

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

 

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBattery((current) => ({
        R1: charging.R1 ? Math.min(100, current.R1 + 3) : runningRef.current ? Math.max(0, current.R1 - 0.35) : current.R1,
        R2: charging.R2 ? Math.min(100, current.R2 + 3) : robot2RunningRef.current ? Math.max(0, current.R2 - 0.35) : current.R2,
      }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [charging]);

  const fetchPath = useCallback(
    async (gridToUse, start, goal, blockedCell = null) => {
      const planningGrid = gridToUse.map((row) => [...row]);

      // During deadlock recovery, treat the other robot's cell as
      // temporarily blocked so the planner searches for an alternate route.
      if (
        blockedCell &&
        !sameCell(blockedCell, start) &&
        !sameCell(blockedCell, goal)
      ) {
        planningGrid[blockedCell[0]][blockedCell[1]] = 1;
      }

      const response = await fetch(`${API_URL}/path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grid: planningGrid,
          start,
          goal,
          algorithm: "astar",
        }),
      });

      if (!response.ok) {
        throw new Error(`Path API returned ${response.status}`);
      }

      const data = await response.json();
      const candidate = Array.isArray(data.path) ? data.path : [];

      if (data.found === false) {
        return {
          path: [],
          data,
          error: "No collision-free route is available.",
        };
      }

      const validation = validatePath(candidate, planningGrid, start, goal);

      if (!validation.valid) {
        return { path: [], data, error: validation.reason };
      }

      return { path: candidate, data, error: "" };
    },
    []
  );

  const planRoute = useCallback(async () => {
    if (planningRef.current) return false;

    planningRef.current = true;
    setPlanning(true);
    setApiError("");
    setMissionStatus("Calculating routes");

    runningRef.current = false;
    robot2RunningRef.current = false;
    setRunning(false);
    setRobot2Running(false);

    try {
      const currentGrid = gridRef.current;

      const [first, second] = await Promise.all([
        fetchPath(currentGrid, START, GOAL),
        fetchPath(currentGrid, ROBOT_2_START, ROBOT_2_GOAL),
      ]);

      if (!first.path.length || !second.path.length) {
        pathRef.current = first.path;
        robot2PathRef.current = second.path;
        setPath(first.path);
        setRobot2Path(second.path);

        const reason = first.error || second.error;
        setApiError(reason);
        setMissionStatus("Route planning failed");
        setRobot2Status(
          second.error ? "No route available" : "Route ready"
        );

        return false;
      }

      pathRef.current = first.path;
      robot2PathRef.current = second.path;

      setPath(first.path);
      setRobot2Path(second.path);

      setPathLength(first.data.path_length ?? first.path.length - 1);
      setExploredNodes(first.data.explored_nodes ?? 0);

      const time =
        first.data.execution_ms ??
        first.data.planning_time_ms ??
        first.data.planning_time ??
        null;

      setPlanningTime(
        time !== null && Number.isFinite(Number(time))
          ? Number(time)
          : null
      );

      motionRef.current = {
        progress: 0,
        lastTimestamp: null,
        deliveryRecorded: false,
        blockedSince: null,
        recovering: false,
      };

      robot2MotionRef.current = {
        progress: 0,
        lastTimestamp: null,
        deliveryRecorded: false,
        blockedSince: null,
        recovering: false,
      };

      reservationsRef.current = { robot1: null, robot2: null };
      edgeReservationsRef.current = { robot1: null, robot2: null };
      priorityRef.current = "robot1";

      setRobotPosition(gridCellToWorld(first.path[0]));
      setRobot2Position(gridCellToWorld(second.path[0]));

      setRouteProgress(0);
      setRobot2Progress(0);
      setCompleted(false);
      setMissionElapsed(0);
      missionElapsedRef.current = 0;

      setRobot2Status("Route ready");
      setMissionStatus("Routes ready");
      return true;
    } catch (error) {
      setApiError(
        error instanceof Error ? error.message : "Could not connect to the API."
      );
      setMissionStatus("API disconnected");
      setRobot2Status("API unavailable");
      return false;
    } finally {
      planningRef.current = false;
      setPlanning(false);
    }
  }, [fetchPath]);

  // The warehouse starts idle. A destination is only created when a command is submitted.

  const recoverDeadlock = useCallback(
    async (blockedRobot, otherCell) => {
      if (recoveryRef.current) return false;

      recoveryRef.current = true;

      const isFirst = blockedRobot === "robot1";
      const motion = isFirst ? motionRef.current : robot2MotionRef.current;
      const route = isFirst ? pathRef.current : robot2PathRef.current;
      const goal = isFirst ? GOAL : ROBOT_2_GOAL;

      const currentIndex = Math.min(
        Math.floor(motion.progress),
        Math.max(0, route.length - 1)
      );
      const currentCell = route[currentIndex];

      if (!currentCell || !otherCell) {
        recoveryRef.current = false;
        return false;
      }

      try {
        const result = await fetchPath(
          gridRef.current,
          currentCell,
          goal,
          otherCell
        );

        if (!result.path.length) {
          if (isFirst) {
            setMissionStatus("Waiting for safe route");
          } else {
            setRobot2Status("Waiting for safe route");
          }
          return false;
        }

        // Do not teleport the robot. Replan from its current grid cell,
        // reset its progress, and let the normal scheduler move it.
        if (isFirst) {
          pathRef.current = result.path;
          setPath(result.path);
          setPathLength(result.path.length - 1);
          motionRef.current = {
            progress: 0,
            lastTimestamp: null,
            deliveryRecorded: false,
            blockedSince: null,
            recovering: false,
          };
          setRobotPosition(gridCellToWorld(currentCell));
          setMissionStatus("Alternate route found");
        } else {
          robot2PathRef.current = result.path;
          setRobot2Path(result.path);
          robot2MotionRef.current = {
            progress: 0,
            lastTimestamp: null,
            deliveryRecorded: false,
            blockedSince: null,
            recovering: false,
          };
          setRobot2Position(gridCellToWorld(currentCell));
          setRobot2Status("Alternate route found");
        }

        reservationsRef.current[blockedRobot] = null;
        edgeReservationsRef.current[blockedRobot] = null;

        setSafetyStats((stats) => ({
          ...stats,
          recoveries: stats.recoveries + 1,
        }));

        return true;
      } catch {
        if (isFirst) {
          setMissionStatus("Waiting for safe route");
        } else {
          setRobot2Status("Waiting for safe route");
        }
        return false;
      } finally {
        recoveryRef.current = false;
      }
    },
    [fetchPath]
  );

  // Central scheduler: both robots request movement from this single loop.
  useEffect(() => {
    if ((!running && !robot2Running) || (!path.length && !robot2Path.length)) {
      return undefined;
    }

    let frameId;
    let lastSchedulerTimestamp = null;

    const getRoute = (id) =>
      id === "robot1" ? pathRef.current : robot2PathRef.current;

    const getMotion = (id) =>
      id === "robot1" ? motionRef.current : robot2MotionRef.current;

    const isRunning = (id) =>
      id === "robot1" ? runningRef.current : robot2RunningRef.current;

    const setRobotStatus = (id, status) => {
      if (id === "robot1") setMissionStatus(status);
      else setRobot2Status(status);
    };

    const setPosition = (id, position) => {
      if (id === "robot1") setRobotPosition(position);
      else setRobot2Position(position);
    };

    const setProgress = (id, value) => {
      const percentage = Math.max(0, Math.min(100, Math.round(value)));
      if (id === "robot1") setRouteProgress(percentage);
      else setRobot2Progress(percentage);
    };

    function animate(timestamp) {
      if (!runningRef.current && !robot2RunningRef.current) return;

      if (lastSchedulerTimestamp === null) {
        lastSchedulerTimestamp = timestamp;
      }

      const delta = Math.min(timestamp - lastSchedulerTimestamp, 50);
      lastSchedulerTimestamp = timestamp;

      const ids =
        priorityRef.current === "robot1"
          ? ["robot1", "robot2"]
          : ["robot2", "robot1"];

      const states = {};

      for (const id of ["robot1", "robot2"]) {
        const route = getRoute(id);
        const motion = getMotion(id);

        if (!route.length) {
          states[id] = { route, motion, index: -1, current: null, target: null };
          continue;
        }

        const index = Math.min(
          Math.floor(motion.progress),
          route.length - 1
        );

        states[id] = {
          route,
          motion,
          index,
          current: route[index],
          target: route[Math.min(index + 1, route.length - 1)],
        };
      }

      // Robots are processed in alternating priority order. Each move
      // is reserved synchronously before the second robot is evaluated.
      for (const id of ids) {
        if (!isRunning(id)) continue;

        const state = states[id];
        if (!state.route.length || state.index < 0) continue;

        const finalIndex = state.route.length - 1;
        const motion = state.motion;

        if (state.index >= finalIndex) {
          motion.progress = finalIndex;
          motion.lastTimestamp = timestamp;
          setPosition(id, gridCellToWorld(state.route[finalIndex]));
          setProgress(id, 100);

          if (id === "robot1" && !motion.deliveryRecorded) {
            motion.deliveryRecorded = true;
            runningRef.current = false;
            setRunning(false);
            setCompleted(true);
            if (chargingTargetRef.current.R1) { chargingTargetRef.current.R1 = false; setCharging((current) => ({ ...current, R1: true })); setMissionStatus("Charging"); } else { setMissionStatus("Delivery complete"); }

            
            const nextDeliveryNumber = deliveriesRef.current + 1;
deliveriesRef.current = nextDeliveryNumber;

            setDeliveries(nextDeliveryNumber);

            setMissionHistory((history) => [
              {
                id: `${Date.now()}-${nextDeliveryNumber}`,
                number: nextDeliveryNumber,
                duration: missionElapsedRef.current,
                pathLength: finalIndex,
                planningTime,
                completedAt: new Date().toLocaleTimeString(),
              },
              ...history,
            ].slice(0, 5));

          } else if (id === "robot2") {
            robot2RunningRef.current = false;
            setRobot2Running(false);
            if (chargingTargetRef.current.R2) { chargingTargetRef.current.R2 = false; setCharging((current) => ({ ...current, R2: true })); setRobot2Status("Charging"); } else { setRobot2Status("Mission complete"); }
          }

          reservationsRef.current[id] = null;
          edgeReservationsRef.current[id] = null;
          continue;
        }

        const target = state.target;
        const targetKey = keyOf(target);
        const currentEdgeKey = edgeKeyOf(state.current, target);

        // Final movement guard: never interpolate into a cell that is
        // currently blocked, even if a stale or invalid route contains it.
        const liveGrid = gridRef.current;
        if (
          !target ||
          liveGrid[target[0]]?.[target[1]] !== 0
        ) {
          motion.lastTimestamp = timestamp;
          if (id === "robot1") {
            runningRef.current = false;
            setRunning(false);
          } else {
            robot2RunningRef.current = false;
            setRobot2Running(false);
          }
          reservationsRef.current[id] = null;
          edgeReservationsRef.current[id] = null;
          setRobotStatus(id, "Stopped: blocked cell");
          continue;
        }

        const otherId = id === "robot1" ? "robot2" : "robot1";
     
        const otherMotion = getMotion(otherId);
        const otherRoute = getRoute(otherId);

        const otherIndex = otherRoute.length
          ? Math.min(
              Math.floor(otherMotion.progress),
              otherRoute.length - 1
            )
          : -1;

        const otherCell =
          otherIndex >= 0 ? otherRoute[otherIndex] : null;

        const otherTarget =
          otherIndex >= 0 && otherIndex + 1 < otherRoute.length
            ? otherRoute[otherIndex + 1]
            : null;

        // Do not enter an occupied cell, a reserved cell, or swap
        // positions with the other robot in one movement interval.
        const occupied =
          otherCell && sameCell(target, otherCell);

        const reserved =
          reservationsRef.current[otherId] === targetKey;

        const edgeSwap =
          otherCell &&
          otherTarget &&
          sameCell(target, otherCell) &&
          sameCell(state.current, otherTarget);

        const oppositeEdgeReserved =
          edgeReservationsRef.current[otherId] ===
          reverseEdgeKeyOf(state.current, target);

        if (occupied || reserved || edgeSwap || oppositeEdgeReserved) {
          motion.lastTimestamp = timestamp;

          if (motion.blockedSince === null) {
            motion.blockedSince = timestamp;
            setSafetyStats((stats) => ({
              ...stats,
              prevented: stats.prevented + 1,
              waits: stats.waits + 1,
            }));
          }

          setRobotStatus(id, "Waiting for safe cell");

          if (
            timestamp - motion.blockedSince >= DEADLOCK_TIMEOUT_MS &&
            !recoveryRef.current
          ) {
            void recoverDeadlock(id, otherCell);
          }

          continue;
        }

        motion.blockedSince = null;

        // Reserve the destination and directed edge before moving.
        reservationsRef.current[id] = targetKey;
        edgeReservationsRef.current[id] = currentEdgeKey;

        motion.progress = Math.min(
          finalIndex,
          motion.progress + delta / CELL_DURATION_MS
        );

        const fromIndex = Math.floor(motion.progress);
        const toIndex = Math.min(fromIndex + 1, finalIndex);
        const amount = motion.progress - fromIndex;

        const from = gridCellToWorld(state.route[fromIndex]);
        const to = gridCellToWorld(state.route[toIndex]);

        setPosition(id, [
          from[0] + (to[0] - from[0]) * amount,
          from[1] + (to[1] - from[1]) * amount,
          from[2] + (to[2] - from[2]) * amount,
        ]);

        setProgress(id, (motion.progress / finalIndex) * 100);

        if (Math.floor(motion.progress) > state.index) {
          reservationsRef.current[id] = null;
          edgeReservationsRef.current[id] = null;
          priorityRef.current =
            priorityRef.current === "robot1" ? "robot2" : "robot1";
        }

        if (motion.progress >= finalIndex) {
          setPosition(id, gridCellToWorld(state.route[finalIndex]));
          setProgress(id, 100);
        } else {
          setRobotStatus(id, "Robot in motion");
        }
      }

      frameId = window.requestAnimationFrame(animate);
    }

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [running, robot2Running, path, robot2Path, planningTime, recoverDeadlock]);

  useEffect(() => {
    if (!running && !robot2Running) return undefined;

    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
      setMissionElapsed((value) => value + 1);
      missionElapsedRef.current += 1;
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running, robot2Running]);

  async function handleCellClick(row, col) {
    if (runningRef.current || robot2RunningRef.current || planningRef.current) {
      return;
    }

    const protectedCells = [START, GOAL, ROBOT_2_START, ROBOT_2_GOAL];
    const safetyCell = DEFAULT_OBSTACLES.some((item) => sameCell([item.row, item.col], [row, col])) ||
      HUMAN_PATROLS.some((person) => person.cells.some((cell) => sameCell(cell, [row, col])));

    if (safetyCell || protectedCells.some((cell) => sameCell(cell, [row, col]))) {
      return;
    }

    const updatedGrid = gridRef.current.map((line) => [...line]);
    updatedGrid[row][col] = updatedGrid[row][col] === 1 ? 0 : 1;

    gridRef.current = updatedGrid;
    setGrid(updatedGrid);
    await planRoute();
  }

  async function handleRecalculate() {
    if (runningRef.current || robot2RunningRef.current) return;
    await planRoute();
  }

  async function resetSimulation() {
    runningRef.current = false;
    robot2RunningRef.current = false;
    setRunning(false);
    setRobot2Running(false);

    const cleanGrid = createHospitalGrid();
    gridRef.current = cleanGrid;
    setGrid(cleanGrid);

    setElapsed(0);
    elapsedRef.current = 0;
    setMissionElapsed(0);
    missionElapsedRef.current = 0;
    setDeliveries(0);
deliveriesRef.current = 0;
    setMissionHistory([]);

    setSafetyStats({ prevented: 0, waits: 0, recoveries: 0 });

    reservationsRef.current = { robot1: null, robot2: null };
    edgeReservationsRef.current = { robot1: null, robot2: null };
    setCompleted(false);
    setApiError("");
    pathRef.current = [];
    robot2PathRef.current = [];
    setPath([]);
    setRobot2Path([]);
    setRobotPosition(gridCellToWorld(START));
    setRobot2Position(gridCellToWorld(ROBOT_2_START));
    motionRef.current = { progress: 0, lastTimestamp: null, deliveryRecorded: false, blockedSince: null, recovering: false };
    robot2MotionRef.current = { progress: 0, lastTimestamp: null, deliveryRecorded: false, blockedSince: null, recovering: false };
    setRouteProgress(0);
    setRobot2Progress(0);
    setMissionStatus("Waiting for a command");
    setRobot2Status("Waiting for a command");
  }

  function toggleRobot2() {
    if (robot2RunningRef.current) {
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
    const finalIndex = robot2PathRef.current.length - 1;

    if (motion.progress >= finalIndex) {
      motion.progress = 0;
      motion.deliveryRecorded = false;
      motion.blockedSince = null;
      setRobot2Position(gridCellToWorld(robot2PathRef.current[0]));
      setRobot2Progress(0);
    }

    motion.lastTimestamp = null;
    robot2RunningRef.current = true;
    setRobot2Running(true);
    setRobot2Status("Robot in motion");
  }

  function toggleSimulation() {
    if (planning || planningRef.current) return;

    if (runningRef.current) {
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
    const finalIndex = pathRef.current.length - 1;

    if (motion.progress >= finalIndex) {
      motion.progress = 0;
      motion.deliveryRecorded = false;
      motion.blockedSince = null;
      setRobotPosition(gridCellToWorld(pathRef.current[0]));
      setMissionElapsed(0);
      missionElapsedRef.current = 0;
      setCompleted(false);
      setRouteProgress(0);
    }

    motion.lastTimestamp = null;
    runningRef.current = true;
    setRunning(true);
    setMissionStatus("Robot in motion");
  }

  async function executeCommand(event, explicitCommand) {
    event?.preventDefault?.();
    const raw = (explicitCommand ?? commandInput).trim();
    if (!raw) return;
    const normalized = raw.toUpperCase().replace(/\s+/g, " ");
    const addLog = (type, text) => setCommandLog((items) => [...items.slice(-39), { type, text }]);
    setCommandInput("");
    addLog("command", `> ${raw}`);

    const statusFor = (id) => {
      if (id === "R1") return `Robot 01: ${runningRef.current ? "RUNNING" : missionStatus.toUpperCase()}; battery ${battery.R1.toFixed(0)}%; progress ${routeProgress}%; route ${pathRef.current.length ? `${pathRef.current.length - 1} steps` : "not planned"}.`;
      if (id === "R2") return `Robot 02: ${robot2RunningRef.current ? "RUNNING" : robot2Status.toUpperCase()}; battery ${battery.R2.toFixed(0)}%; progress ${robot2Progress}%; route ${robot2PathRef.current.length ? `${robot2PathRef.current.length - 1} steps` : "not planned"}.`;
      return `Robot 01: ${runningRef.current ? "RUNNING" : missionStatus.toUpperCase()} · battery ${battery.R1.toFixed(0)}%; Robot 02: ${robot2RunningRef.current ? "RUNNING" : robot2Status.toUpperCase()} · battery ${battery.R2.toFixed(0)}%.`;
    };
    const destinations = {
      PICKUP: [1, 1], "PICKUP ZONE": [1, 1], PACKING: [1, 15], PACKAGING: [1, 15], PAKAGING: [1, 15], "PACKING ZONE": [1, 15], "PACKAGING ZONE": [1, 15],
      CHARGING: [11, 1], "CHARGING BAY": [11, 1], DISPATCH: [11, 15], "DISPATCH BAY": [11, 15],
      "RACK A": [2, 4], "RACK B": [2, 6], "RACK C": [2, 8], "RACK D": [2, 10],
      "RACK E": [6, 4], "RACK F": [6, 6], "RACK G": [6, 8], "RACK H": [6, 10],
      "ROBOT BAY": START, "HOME R1": START, "HOME R2": ROBOT_2_START,
    };
    const moveRobot = async (id, destinationName, shouldStart = true) => {
      const destination = destinations[destinationName];
      if (!destination) { addLog("error", `Unknown destination "${destinationName}". Try PICKUP, PACKING, CHARGING, DISPATCH or RACK A-H.`); return false; }
      const isR1 = id === "R1";
      if ((isR1 && runningRef.current) || (!isR1 && robot2RunningRef.current)) { addLog("error", `Pause ${id} before changing its destination.`); return false; }
      if (battery[id] <= 1 && destinationName !== "CHARGING" && destinationName !== "CHARGING BAY") { addLog("error", `${id} battery is critically low. Send it to CHARGING first.`); return false; }
      const route = isR1 ? pathRef.current : robot2PathRef.current;
      const motion = isR1 ? motionRef.current : robot2MotionRef.current;
      const currentIndex = Math.min(Math.floor(motion.progress), Math.max(0, route.length - 1));
      const currentCell = route[currentIndex] || (isR1 ? START : ROBOT_2_START);
      let result;
      try {
        result = await fetchPath(gridRef.current, currentCell, destination);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown path-planning error";
        addLog("error", `Could not plan a route for ${id}: ${detail}. Check that the backend is running at ${API_URL}.`);
        return false;
      }
      if (!result.path.length) { addLog("error", `No safe route for ${id} to ${destinationName}: ${result.error || "route unavailable"}`); return false; }
      motion.progress = 0; motion.lastTimestamp = null; motion.deliveryRecorded = false; motion.blockedSince = null; motion.recovering = false;
      if (isR1) {
        pathRef.current = result.path; setPath(result.path); setRobotPosition(gridCellToWorld(currentCell));
        setRouteProgress(0); setCompleted(false); setMissionStatus(`Route to ${destinationName}`);
        if (shouldStart) { runningRef.current = true; setRunning(true); }
      } else {
        robot2PathRef.current = result.path; setRobot2Path(result.path); setRobot2Position(gridCellToWorld(currentCell));
        setRobot2Progress(0); setRobot2Status(`Route to ${destinationName}`);
        if (shouldStart) { robot2RunningRef.current = true; setRobot2Running(true); }
      }
      chargingTargetRef.current[id] = destinationName === "CHARGING" || destinationName === "CHARGING BAY";
      setCharging((current) => ({ ...current, [id]: false }));
      setWorkflowLog((items) => [{ id: Date.now(), robot: id, destination: destinationName, status: shouldStart ? "Started" : "Queued", time: new Date().toLocaleTimeString() }, ...items].slice(0, 20));
      addLog("success", `${id} route planned to ${destinationName} (${result.path.length - 1} steps).${shouldStart ? " Mission started." : " Added to queue."}`);
      return true;
    };

    if (normalized === "HELP") {
      addLog("system", "Try: MOVE R1 TO RACK A | SEND ROBOT 2 TO PACKING | ROBOT 1 GO TO DISPATCH | STATUS ALL | PAUSE R1 | CHARGE R2 | HELP");
    } else if (normalized === "STATUS" || normalized === "STATUS ALL") {
      addLog("success", statusFor("ALL"));
    } else if (/^STATUS (R1|R2|ROBOT ?0?[12]|ROBOT[12])$/.test(normalized)) {
      addLog("success", statusFor(normalized.includes("2") ? "R2" : "R1"));
    } else if (/^(MOVE|GO|SEND) (R1|R2|ROBOT ?0?[12]) TO .+$/.test(normalized)) {
      const match = normalized.match(/^(?:MOVE|GO|SEND) (R1|R2|ROBOT ?0?[12]) TO (.+)$/);
      const robotId = match[1].includes("2") ? "R2" : "R1";
      const destinationName = match[2].replace(/^THE /, "").replace(/ ZONE$/, " ZONE");
      await moveRobot(robotId, destinationName, true);
    } else if (/^(R1|R2|ROBOT ?0?[12]) (?:RETURN|GO BACK|HEAD BACK) TO CHARGING$/.test(normalized)) {
      const match = normalized.match(/^(R1|R2|ROBOT ?0?[12])/);
      await moveRobot(match[1].includes("2") ? "R2" : "R1", "CHARGING", true);
    } else if (/^(?:RETURN|GO BACK|HEAD BACK) TO CHARGING$/.test(normalized)) {
      addLog("system", "No robot specified, so Robot 1 will take this task. Use R2 RETURN TO CHARGING to send Robot 2.");
      await moveRobot("R1", "CHARGING", true);
    } else if (/^(R1|R2|ROBOT ?0?[12]) (?:GO|MOVE|DRIVE) TO .+$/.test(normalized)) {
      const match = normalized.match(/^(R1|R2|ROBOT ?0?[12]) (?:GO|MOVE|DRIVE) TO (.+)$/);
      await moveRobot(match[1].includes("2") ? "R2" : "R1", match[2].replace(/^THE /, ""), true);
    } else if (/^(?:GO|MOVE|DRIVE) TO .+$/.test(normalized)) {
      const destinationName = normalized.replace(/^(?:GO|MOVE|DRIVE) TO /, "").replace(/^THE /, "");
      addLog("system", "No robot specified, so Robot 1 will take this task.");
      await moveRobot("R1", destinationName, true);
    } else if (/^WORKFLOW (R1|R2)$/.test(normalized)) {
      const robot = normalized.endsWith("R1") ? "R1" : "R2";
      const stages = ["PICKUP", "PACKING", "DISPATCH"].map((destination, index) => ({ id: Date.now() + index, robot, destination, status: "Queued" }));
      setTaskQueue((items) => [...items, ...stages]);
      addLog("success", `Warehouse workflow queued for ${robot}: PICKUP → PACKING → DISPATCH. Run QUEUE after each completed stage.`);
    } else if (/^QUEUE (R1|R2) TO .+$/.test(normalized)) {
      const match = normalized.match(/^QUEUE (R1|R2) TO (.+)$/);
      if (!destinations[match[2]]) addLog("error", `Unknown destination "${match[2]}".`);
      else { setTaskQueue((items) => [...items, { id: Date.now(), robot: match[1], destination: match[2], status: "Queued" }]); addLog("success", `Queued ${match[1]} → ${match[2]}.`); }
    } else if (normalized === "RUN QUEUE") {
      if (!taskQueue.length) addLog("system", "Task queue is empty.");
      else { const [next, ...remaining] = taskQueue; setTaskQueue(remaining); const ok = await moveRobot(next.robot, next.destination, true); if (!ok) setTaskQueue((items) => [next, ...items]); }
    } else if (normalized === "QUEUE CLEAR") {
      setTaskQueue([]); addLog("success", "Pending task queue cleared.");
    } else if (["CHARGE R1", "CHARGE R2"].includes(normalized)) {
      const id = normalized.endsWith("R1") ? "R1" : "R2";
      if (id === "R1") { runningRef.current = false; setRunning(false); } else { robot2RunningRef.current = false; setRobot2Running(false); }
      await moveRobot(id, "CHARGING", true);
    } else if (["START R1", "RESUME R1"].includes(normalized)) {
      if (!pathRef.current.length) addLog("error", "Robot 01 has no valid route.");
      else if (battery.R1 <= 1) addLog("error", "Robot 01 battery is empty. Use CHARGE R1.");
      else if (!runningRef.current) { setCharging((v) => ({ ...v, R1: false })); toggleSimulation(); addLog("success", "Robot 01 start requested."); }
      else addLog("system", "Robot 01 is already running.");
    } else if (["PAUSE R1", "STOP R1"].includes(normalized)) {
      runningRef.current = false; setRunning(false); setMissionStatus("Paused by command"); addLog("success", "Robot 01 paused at its current scheduler position.");
    } else if (["START R2", "RESUME R2"].includes(normalized)) {
      if (!robot2PathRef.current.length) addLog("error", "Robot 02 has no valid route.");
      else if (battery.R2 <= 1) addLog("error", "Robot 02 battery is empty. Use CHARGE R2.");
      else if (!robot2RunningRef.current) { setCharging((v) => ({ ...v, R2: false })); toggleRobot2(); addLog("success", "Robot 02 start requested."); }
      else addLog("system", "Robot 02 is already running.");
    } else if (["PAUSE R2", "STOP R2"].includes(normalized)) {
      robot2RunningRef.current = false; setRobot2Running(false); setRobot2Status("Paused by command"); addLog("success", "Robot 02 paused at its current scheduler position.");
    } else if (normalized === "REPLAN" || normalized === "REPLAN ROUTES") {
      if (runningRef.current || robot2RunningRef.current) {
        addLog("error", "Pause both robots before replanning.");
      } else if (!pathRef.current.length && !robot2PathRef.current.length) {
        addLog("system", "No destination is selected yet. Try MOVE R1 TO RACK A or SEND R2 TO PACKING.");
      } else {
        addLog("system", "To change a destination, enter MOVE R1 TO <place> or MOVE R2 TO <place>.");
      }
    } else if (normalized === "RESET" || normalized === "RESET SIMULATION") {
      await resetSimulation(); setBattery({ R1: 100, R2: 100 }); setCharging({ R1: false, R2: false }); setTaskQueue([]); addLog("success", "Simulation reset.");
    } else {
      addLog("error", "Unknown command. Type HELP to see supported commands.");
    }
  }

  const obstacleCount =
    grid.reduce(
      (total, row) => total + row.filter((cell) => cell === 1).length,
      0
    ) -
    (GRID_ROWS * 2 + GRID_COLS * 2 - 4);

  const hasRoute = path.length > 0;
  const activeRobots = Number(running) + Number(robot2Running);
  const editingDisabled = running || robot2Running || planning;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Bot size={24} /></div>
          <div>
            <div className="brand-name">SimuForge</div>
            <div className="brand-subtitle">ROBOTICS SIMULATION LAB</div>
          </div>
        </div>

        <div className="topbar-center">
          <span className="system-indicator" />
          WAREHOUSE FLOOR
        </div>

        <div className="topbar-right">
          <span className="build-label">BUILD 0.8.2</span>
          <span className={`connection-badge ${apiError ? "connection-error" : ""}`}>
            <span className="status-dot" />
            {apiError ? "API OFFLINE" : "SYSTEM READY"}
          </span>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <Activity size={14} /> WAREHOUSE / ROBOT CONTROL
          </div>
          <h1>SimuForge — Smart Warehouse Robotics Simulator</h1>
          <p>
            Simulate autonomous warehouse deliveries, plan collision-aware
            routes, and test navigation in a 3D environment.
          </p>
        </div>

        <div className="mission-status">
          <span className="status-label">MISSION STATUS</span>
          <span className={`mission-value ${apiError ? "status-danger" : ""}`}>
            <span className="status-dot" /> {missionStatus}
          </span>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard
          icon={Bot}
          label="ACTIVE ROBOTS"
          value={String(activeRobots).padStart(2, "0")}
          detail={activeRobots ? `${activeRobots} robot(s) in motion` : "Standby"}
        />
        <MetricCard
          icon={CheckCircle2}
          label="DELIVERIES"
          value={String(deliveries).padStart(2, "0")}
          detail="Completed Robot 01 missions"
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
          detail={hasRoute ? "Route length" : "No available route"}
        />
      </section>

      <section className="workspace-grid">
        <div className="scene-panel">
          <div className="panel-header">
            <div className="panel-title-group">
              <div className="panel-icon"><Layers3 size={18} /></div>
              <div>
                <h2>3D Warehouse Environment</h2>
                <p>Interactive navigation and obstacle mapping</p>
              </div>
            </div>
            <span className="live-badge"><span className="status-dot" /> LIVE</span>
          </div>

          <div className="scene-container">
            <WarehouseScene
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
              <span><Crosshair size={13} /> WAREHOUSE VIEW</span>
              <span>GRID {GRID_ROWS} × {GRID_COLS}</span>
            </div>

            <div className="scene-overlay scene-overlay-bottom">
              <span className="legend-item">
                <span className="legend-dot robot-legend" /> Robot 01
              </span>
              <span className="legend-item">
                <span className="legend-dot" style={{ background: "#79aaff" }} /> Robot 02
              </span>
              <span className="legend-item">
                <span className="legend-dot route-legend" /> Planned path
              </span>
              <span className="legend-item">
                <span className="legend-dot obstacle-legend" /> Obstacle
              </span>
              <span className="legend-item">
                <span className="legend-dot goal-legend" /> Destination
              </span>
            </div>
          </div>

          <div className="scene-footer">
            <div className="interaction-hint">
              <MousePointer2 size={15} />
              <span>
                {editingDisabled
                  ? "Pause both robots before editing obstacles."
                  : "Click a free grid cell to add an obstacle. Click a red obstacle to remove it."}
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
              <div className="panel-icon"><Waypoints size={18} /></div>
              <div>
                <h2>Mission Control</h2>
                <p>Configure robot navigation</p>
              </div>
            </div>
          </div>

          <div className="control-section command-console">
            <div className="section-heading">
              <span><Terminal size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />ROBOT COMMAND CONSOLE</span>
              <span className="section-number">CMD / LIVE</span>
            </div>

            <div className="command-help">
              <strong>Send a command to a robot</strong>
              <span>Example: MOVE R1 TO PACKING</span>
            </div>

            <form className="command-form" onSubmit={executeCommand}>
              <input
                aria-label="Robot command"
                value={commandInput}
                onChange={(event) => setCommandInput(event.target.value)}
                placeholder="Enter robot command…"
                spellCheck={false}
                autoComplete="off"
              />
              <button type="submit" className="primary-button" aria-label="Execute command">
                <Send size={16} /> <span>Run</span>
              </button>
            </form>

            <div className="command-shortcuts" aria-label="Quick commands">
              {["HELP", "STATUS ALL", "START R1", "START R2", "REPLAN"].map((command) => (
                <button key={command} type="button" className="secondary-button" onClick={() => void executeCommand(null, command)}>{command}</button>
              ))}
            </div>

            <div className="command-log-heading"><span>COMMAND OUTPUT</span><span>{commandLog.length} messages</span></div>
            <div className="command-log-box">
              <div role="log" aria-live="polite">
                {commandLog.map((entry, index) => (
                  <div key={index} className={`command-log-entry command-log-${entry.type || "info"}`}>{entry.text}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="control-section">
            <div className="section-heading"><span>ROBOT POWER & TASK QUEUE</span><span className="section-number">OPS</span></div>
            {[["R1","ROBOT 01"],["R2","ROBOT 02"]].map(([id,label]) => (
              <div key={id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}><span>{label} · {charging[id] ? "CHARGING" : "BATTERY"}</span><strong>{battery[id].toFixed(0)}%</strong></div>
                <div style={{ height: 6, background: "#253441", borderRadius: 10, overflow: "hidden" }}><div style={{ width: `${battery[id]}%`, height: "100%", background: battery[id] < 20 ? "#f07181" : charging[id] ? "#75b5ff" : "#58e1c8", transition: "width .2s" }} /></div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 8px" }}><strong style={{ fontSize: 12 }}>Pending tasks</strong><span style={{ fontSize: 11, color: "#91a4b5" }}>{taskQueue.length} queued</span></div>
            {taskQueue.length ? taskQueue.map((task) => <div key={task.id} style={{ padding: "8px 9px", marginBottom: 6, border: "1px solid #293744", borderRadius: 7, fontSize: 11 }}>{task.robot} → {task.destination}</div>) : <div style={{ color: "#8294a6", fontSize: 11, padding: "6px 0" }}>Queue empty. Use QUEUE R1 TO DISPATCH.</div>}
            <div style={{ display: "flex", gap: 7, marginTop: 8 }}><button className="secondary-button" onClick={() => { setCommandInput("RUN QUEUE"); }} disabled={!taskQueue.length}>Load next task</button><button className="text-button" onClick={() => setTaskQueue([])} disabled={!taskQueue.length}>Clear</button></div>
            <div style={{ marginTop: 12, fontSize: 11, color: "#91a4b5" }}>Recent workflow events</div>
            {workflowLog.slice(0,3).map((item) => <div key={item.id} style={{ marginTop: 6, fontSize: 10, color: "#a5b7c5" }}>{item.time} · {item.robot} → {item.destination} · {item.status}</div>)}
          </div>

          <div className="control-section">
            <div className="section-heading"><span>LIVE STATUS</span><span className="section-number">DATA</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["Deliveries", deliveries],
                ["Active robots", Number(running) + Number(robot2Running)],
                ["Safety waits", safetyStats.waits],
                ["Deadlock recoveries", safetyStats.recoveries],
                ["Blocked moves prevented", safetyStats.prevented],
                ["Pending tasks", taskQueue.length],
              ].map(([label, value]) => <div key={label} style={{ border: "1px solid #293744", borderRadius: 8, padding: 10, background: "rgba(20,32,43,.55)" }}><div style={{ color: "#8294a6", fontSize: 10, marginBottom: 5 }}>{label}</div><strong style={{ fontSize: 19, color: "#dce9f1" }}>{value}</strong></div>)}
            </div>
            <div style={{ color: "#8294a6", fontSize: 10, lineHeight: 1.6, marginTop: 9 }}>Live session metrics. Battery use, mission counts and scheduler safety counters are simulated locally and reset with the simulation.</div>
          </div>


          <div className="control-section">
            <div className="section-heading">
              <span>ROUTES</span><span className="section-number">01</span>
            </div>

            <div className="algorithm-card">
              <div className="algorithm-icon"><Zap size={19} /></div>
              <div className="algorithm-info">
                <strong>A* Search Algorithm</strong>
                <span>Heuristic-based shortest path</span>
              </div>
              <span className="algorithm-active">ACTIVE</span>
            </div>

            <div className="stat-row"><span>Explored nodes</span><strong>{exploredNodes}</strong></div>
            <div className="stat-row"><span>Planning time</span><strong>{formatMilliseconds(planningTime)}</strong></div>
            <div className="stat-row">
              <span>Path length</span>
              <strong>{pathLength === null ? "--" : `${pathLength} steps`}</strong>
            </div>

            <button className="secondary-button full-width" onClick={handleRecalculate} disabled={editingDisabled}>
              <RouteIcon size={16} /> {planning ? "Calculating routes..." : "Recalculate A* Routes"}
            </button>
          </div>

          <div className="control-section">
            <div className="section-heading">
              <span>SIMULATION CONTROLS</span><span className="section-number">02</span>
            </div>

            <button className="primary-button full-width" onClick={toggleSimulation} disabled={planning || !hasRoute}>
              {running ? <Pause size={17} /> : <Play size={17} />}
              {running ? "Pause Robot 01" : "Start Robot 01"}
            </button>

            <button className="secondary-button full-width reset-button" onClick={resetSimulation} disabled={planning}>
              <RotateCcw size={16} /> Reset Simulation
            </button>

            <button
              className="text-button full-width"
              onClick={async () => {
                if (editingDisabled || obstacleCount === 0) return;
                const cleanGrid = createHospitalGrid();
                gridRef.current = cleanGrid;
                setGrid(cleanGrid);
                await planRoute();
              }}
              disabled={editingDisabled || obstacleCount === 0}
            >
              <Trash2 size={15} /> Clear all obstacles
            </button>
          </div>

          <div className="control-section">
            <div className="section-heading">
              <span>ROBOT 02 · INDEPENDENT MISSION</span><span className="section-number">03</span>
            </div>

            <div className="stat-row"><span>Mission status</span><strong>{robot2Status}</strong></div>
            <div className="stat-row">
              <span>Route length</span>
              <strong>{robot2Path.length ? `${robot2Path.length - 1} steps` : "--"}</strong>
            </div>
            <div className="stat-row"><span>Progress</span><strong>{robot2Progress}%</strong></div>

            <div style={{ height: 5, background: "rgba(121,170,255,.15)", borderRadius: 99, overflow: "hidden", margin: "10px 0 14px" }}>
              <div style={{ width: `${robot2Progress}%`, height: "100%", background: "#79aaff", transition: "width 120ms linear" }} />
            </div>

            <button className="primary-button full-width" onClick={toggleRobot2} disabled={robot2Path.length < 2}>
              {robot2Running ? <Pause size={17} /> : <Play size={17} />}
              {robot2Running ? "Pause Robot 02" : robot2Progress >= 100 ? "Restart Robot 02" : "Start Robot 02"}
            </button>
          </div>

          <div className="control-section">
            <div className="section-heading">
              <span>MULTI-ROBOT SAFETY</span><span className="section-number">04</span>
            </div>
            <div className="stat-row"><span>Conflicting moves prevented</span><strong>{safetyStats.prevented}</strong></div>
            <div className="stat-row"><span>Safe waiting events</span><strong>{safetyStats.waits}</strong></div>
            <div className="stat-row"><span>Deadlock recoveries</span><strong>{safetyStats.recoveries}</strong></div>
            <p style={{ color: "#91a4b5", fontSize: 11, lineHeight: 1.6, marginTop: 10 }}>
              A shared scheduler arbitrates movement, prevents occupied-cell
              entry, alternates priority, and requests alternate routes after
              prolonged blocking.
            </p>
          </div>

          <div className="control-section">
            <div className="section-heading">
              <span>NAVIGATION MAP</span><span className="section-number">05</span>
            </div>
            <div className="location-card">
              <div className="location-icon start-icon"><Crosshair size={16} /></div>
              <div className="location-info">
                <span>ROBOT 01 START</span>
                <strong>Warehouse Robot Bay</strong>
                <small>Row {START[0]}, Column {START[1]}</small>
              </div>
            </div>
            <div className="location-connector"><span /><span /><span /></div>
            <div className="location-card">
              <div className="location-icon goal-icon"><Target size={16} /></div>
              <div className="location-info">
                <span>ROBOT 01 DESTINATION</span>
                <strong>Choose in command box</strong>
                <small>No destination selected</small>
              </div>
            </div>
            <div className="location-card" style={{ marginTop: 12 }}>
              <div className="location-icon" style={{ color: "#79aaff", background: "rgba(121,170,255,.12)" }}>
                <Bot size={16} />
              </div>
              <div className="location-info">
                <span>ROBOT 02 MISSION</span>
                <strong>Choose in command box</strong>
                <small>Start: ({ROBOT_2_START.join(", ")}) · No destination selected</small>
              </div>
            </div>
          </div>

          <MissionHistory missions={missionHistory} />

          <div className="safety-card">
            {apiError ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}
            <div>
              <strong>{apiError ? "Navigation safety notice" : "Navigation system ready"}</strong>
              <p>{apiError || "Routes are validated before movement. The shared scheduler checks robot occupancy and movement conflicts."}</p>
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
          <span>API CONNECTED</span><span className="footer-divider">/</span>
          <span>3D WAREHOUSE</span><span className="footer-divider">/</span>
          <span>SAFE ROUTES</span>
        </div>
      </footer>
    </main>
  );
}

export default App;

