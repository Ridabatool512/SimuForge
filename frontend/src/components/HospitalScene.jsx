
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

const ROWS = 13;
const COLS = 17;

export function gridCellToWorld([row, col]) {
  return [col - 8, 0.12, row - 6];
}

function Floor() {
  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.12, 0]}
        receiveShadow
      >
        <planeGeometry args={[COLS, ROWS]} />
        <meshStandardMaterial color="#111923" />
      </mesh>

      <Grid
        args={[COLS, ROWS]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#263746"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#3d5365"
        fadeDistance={30}
        fadeStrength={1}
        position={[0, -0.1, 0]}
      />
    </>
  );
}

function Room({ position, size, label, color = "#1b2a38" }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} />
      </mesh>

      <Text
        position={[0, 0.12, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22}
        color="#91a9bb"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

function Wall({ position, size }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color="#304253"
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}

function Obstacle({ position }) {
  const beaconRef = useRef(null);

  useFrame(({ clock }) => {
    const material = beaconRef.current?.material;

    if (material) {
      material.emissiveIntensity =
        0.25 + (Math.sin(clock.elapsedTime * 2.5) + 1) * 0.15;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.82, 0.62, 0.82]} />
        <meshStandardMaterial
          color="#d94c61"
          emissive="#641827"
          emissiveIntensity={0.4}
          roughness={0.45}
        />
      </mesh>

      <mesh ref={beaconRef} position={[0, 0.65, 0]}>
        <boxGeometry args={[0.86, 0.035, 0.86]} />
        <meshStandardMaterial
          color="#ff8794"
          emissive="#9e2437"
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}

function InteractiveGrid({ grid, onCellClick, path }) {
  const pathSet = useMemo(
    () => new Set(path.map(([row, col]) => `${row},${col}`)),
    [path]
  );

  const tiles = useMemo(() => {
    const result = [];

    for (let row = 1; row < ROWS - 1; row += 1) {
      for (let col = 1; col < COLS - 1; col += 1) {
        result.push({ row, col });
      }
    }

    return result;
  }, []);

  return (
    <group>
      {tiles.map(({ row, col }) => {
        const blocked = grid[row]?.[col] === 1;
        const isPath = pathSet.has(`${row},${col}`);

        return (
          <group key={`${row}-${col}`}>
            <mesh
              position={[col - 8, -0.025, row - 6]}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(event) => {
                event.stopPropagation();
                onCellClick?.(row, col);
              }}
            >
              <planeGeometry args={[0.94, 0.94]} />
              <meshStandardMaterial
                color={
                  blocked
                    ? "#542630"
                    : isPath
                      ? "#174d49"
                      : "#182530"
                }
                emissive={
                  blocked
                    ? "#641827"
                    : isPath
                      ? "#087b70"
                      : "#000000"
                }
                emissiveIntensity={blocked ? 0.3 : isPath ? 0.25 : 0}
                transparent
                opacity={0.95}
                side={THREE.DoubleSide}
              />
            </mesh>

            {blocked && (
              <Obstacle position={[col - 8, 0, row - 6]} />
            )}
          </group>
        );
      })}
    </group>
  );
}

function Route({ path, color = "#42e6c4" }) {
  const geometry = useMemo(() => {
    if (path.length < 2) return null;

    const points = path.map(
      ([row, col]) => new THREE.Vector3(col - 8, 0.08, row - 6)
    );

    return new THREE.BufferGeometry().setFromPoints(points);
  }, [path]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.95} />
    </line>
  );
}

function Marker({ position, color, label }) {
  const ringRef = useRef(null);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 2.4) * 0.1;
      ringRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={ringRef}
        position={[0, 0.025, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.24, 0.34, 32]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, 0.055, 0]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      <Text
        position={[0, 0.42, 0]}
        fontSize={0.2}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}


function findGridRoute(grid, start, goal) {
  if (!grid?.length || !grid[start[0]] || grid[start[0]][start[1]] !== 0 ||
      !grid[goal[0]] || grid[goal[0]][goal[1]] !== 0) return [];
  const key = ([r, c]) => `${r},${c}`;
  const queue = [start];
  const previous = new Map([[key(start), null]]);
  for (let i = 0; i < queue.length; i += 1) {
    const cell = queue[i];
    if (cell[0] === goal[0] && cell[1] === goal[1]) break;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const next = [cell[0] + dr, cell[1] + dc];
      if (!grid[next[0]] || grid[next[0]][next[1]] !== 0 || previous.has(key(next))) continue;
      previous.set(key(next), cell);
      queue.push(next);
    }
  }
  if (!previous.has(key(goal))) return [];
  const route = [];
  let cursor = goal;
  while (cursor) { route.push(cursor); cursor = previous.get(key(cursor)); }
  return route.reverse();
}

function Pedestrian({ grid, start, end, color, robotPositions }) {
  const personRef = useRef(null);
  const progressRef = useRef(0);
  const route = useMemo(() => {
    const outward = findGridRoute(grid, start, end);
    const returning = findGridRoute(grid, end, start);
    return outward.length > 1 && returning.length > 1
      ? [...outward, ...returning.slice(1)]
      : [];
  }, [grid, start, end]);

  useFrame((_, delta) => {
    if (!personRef.current || route.length < 2) return;
    const current = personRef.current.position;
    const nextIndex = (Math.floor(progressRef.current) + 1) % route.length;
    const cell = route[nextIndex];
    const target = new THREE.Vector3(cell[1] - 8, 0, cell[0] - 6);
    const blockedByRobot = robotPositions.some((position) =>
      position && Math.hypot(target.x - position[0], target.z - position[2]) < 1.2
    );
    if (blockedByRobot) return;
    const dx = target.x - current.x;
    const dz = target.z - current.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.06) { progressRef.current = nextIndex; return; }
    const step = Math.min(distance, 0.72 * Math.min(delta, 0.05));
    current.x += dx / distance * step;
    current.z += dz / distance * step;
    personRef.current.rotation.y = Math.atan2(dx, dz);
  });

  if (route.length < 2) return null;
  return (
    <group ref={personRef} position={[start[1] - 8, 0, start[0] - 6]}>
      <mesh position={[0, 0.46, 0]} castShadow>
        <capsuleGeometry args={[0.15, 0.36, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.77, 0]} castShadow>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#d9b59a" roughness={0.8} />
      </mesh>
      <mesh position={[-0.07, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.065, 0.23, 8]} />
        <meshStandardMaterial color="#273746" />
      </mesh>
      <mesh position={[0.07, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.065, 0.23, 8]} />
        <meshStandardMaterial color="#273746" />
      </mesh>
    </group>
  );
}

function Pedestrians({ grid, robotPosition, secondaryRobotPosition }) {
  const robotPositions = useMemo(() => [robotPosition, secondaryRobotPosition], [robotPosition, secondaryRobotPosition]);
  return (
    <group>
      {/* Keep pedestrians in the corridor rows, outside the room/table footprints. */}
      <Pedestrian grid={grid} start={[4, 2]} end={[4, 14]} color="#f2b36d" robotPositions={robotPositions} />
      <Pedestrian grid={grid} start={[8, 14]} end={[8, 2]} color="#9cb9e8" robotPositions={robotPositions} />
    </group>
  );
}

function Robot({ position, running, completed, accent = "#55e5d0" }) {
  const robotRef = useRef(null);
  const bodyRef = useRef(null);
  const wheelGroupRef = useRef(null);
  const statusLightRef = useRef(null);
  const previousPosition = useRef(new THREE.Vector3(...position));
  const facing = useRef(0);

  useFrame(({ clock }, delta) => {
    if (!robotRef.current) return;

    const target = new THREE.Vector3(...position);
    const previous = previousPosition.current;

    const dx = target.x - previous.x;
    const dz = target.z - previous.z;

    if (Math.hypot(dx, dz) > 0.0001) {
      facing.current = Math.atan2(dx, dz);
    }

    robotRef.current.rotation.y = THREE.MathUtils.damp(
      robotRef.current.rotation.y,
      facing.current,
      9,
      delta
    );

    if (bodyRef.current) {
      bodyRef.current.position.y =
        0.31 +
        Math.sin(clock.elapsedTime * (running ? 9 : 2.1)) *
          (running ? 0.025 : 0.008);
    }

    if (wheelGroupRef.current && running) {
      wheelGroupRef.current.rotation.x += delta * 7;
    }

    const material = statusLightRef.current?.material;

    if (material) {
      const pulse = (Math.sin(clock.elapsedTime * 5) + 1) / 2;

      material.emissiveIntensity = completed
        ? 1.5 + pulse * 0.8
        : running
          ? 0.8 + pulse * 0.5
          : 0.35;
    }

    previous.copy(target);
  });

  return (
    <group ref={robotRef} position={position}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.105, 0]}
      >
        <circleGeometry args={[0.48, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} />
      </mesh>

      <group ref={bodyRef} position={[0, 0.31, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.47, 0.32, 0.55]} />
          <meshStandardMaterial
            color={accent}
            metalness={0.45}
            roughness={0.3}
            emissive={accent}
            emissiveIntensity={0.5}
          />
        </mesh>

        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.18, 0.12, 24]} />
          <meshStandardMaterial
            color="#d3fff7"
            metalness={0.35}
            roughness={0.25}
          />
        </mesh>

        <mesh ref={statusLightRef} position={[0, 0.03, 0.282]}>
          <boxGeometry args={[0.19, 0.045, 0.025]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.6}
          />
        </mesh>

        <mesh position={[0, 0.12, 0.22]}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>

      <group ref={wheelGroupRef}>
        {[
          [-0.255, 0.12, 0.19],
          [0.255, 0.12, 0.19],
          [-0.255, 0.12, -0.19],
          [0.255, 0.12, -0.19],
        ].map((wheelPosition, index) => (
          <mesh
            key={index}
            position={wheelPosition}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <cylinderGeometry args={[0.085, 0.085, 0.055, 16]} />
            <meshStandardMaterial color="#14212a" roughness={0.65} />
          </mesh>
        ))}
      </group>

      <pointLight
        position={[0, 0.55, 0]}
        intensity={completed ? 1.2 : 0.65}
        distance={2.5}
        color={completed ? "#65ffab" : accent}
      />
    </group>
  );
}

function HospitalWorld({
  robotPosition,
  running,
  completed,
  secondaryRobotPosition,
  secondaryRobotRunning,
  secondaryRobotPath,
  path,
  grid,
  onCellClick,
}) {
  return (
    <>
      <color attach="background" args={["#0b1118"]} />
      <fog attach="fog" args={["#0b1118", 18, 35]} />

      <ambientLight intensity={1.4} />
      <directionalLight position={[4, 10, 5]} intensity={2} castShadow />
      <pointLight position={[-5, 5, -4]} intensity={0.7} color="#3c7ca3" />

      <Floor />

      <InteractiveGrid grid={grid} path={path} onCellClick={onCellClick} />

      <Room
        position={[-5.5, 0, -3.8]}
        size={[3.8, 0.025, 2.2]}
        label="PHARMACY"
        color="#1c303c"
      />

      <Room
        position={[3.7, 0, -3.8]}
        size={[4.5, 0.025, 2.2]}
        label="PATIENT WARD"
        color="#1b303b"
      />

      <Room
        position={[-5.5, 0, 3.7]}
        size={[3.8, 0.025, 2.2]}
        label="SUPPLY ROOM"
        color="#1e2d3c"
      />

      <Room
        position={[3.7, 0, 3.7]}
        size={[4.5, 0.025, 2.2]}
        label="NURSE STATION"
        color="#1c303c"
      />

      <Wall position={[0, 0.35, -6.5]} size={[17, 0.7, 0.16]} />
      <Wall position={[0, 0.35, 6.5]} size={[17, 0.7, 0.16]} />
      <Wall position={[-8.5, 0.35, 0]} size={[0.16, 0.7, 13]} />
      <Wall position={[8.5, 0.35, 0]} size={[0.16, 0.7, 13]} />

      <Route path={path} />
      <Route path={secondaryRobotPath ?? []} color="#79aaff" />

      <Marker
        position={gridCellToWorld([6, 1])}
        color="#62a9ff"
        label="START"
      />

      <Marker
        position={gridCellToWorld([6, 14])}
        color="#ffcb70"
        label="DESTINATION"
      />

      <Pedestrians grid={grid} robotPosition={robotPosition} secondaryRobotPosition={secondaryRobotPosition} />

      <Robot
        position={robotPosition}
        running={running}
        completed={completed}
      />

      <Robot
        position={secondaryRobotPosition}
        running={Boolean(secondaryRobotRunning)}
        completed={false}
        accent="#79aaff"
      />
      <Text
        position={[
          secondaryRobotPosition[0],
          secondaryRobotPosition[1] + 0.72,
          secondaryRobotPosition[2],
        ]}
        fontSize={0.16}
        color="#79aaff"
        anchorX="center"
        anchorY="middle"
      >
        ROBOT 02 · AUTONOMOUS
      </Text>

      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        minDistance={8}
        maxDistance={24}
        maxPolarAngle={Math.PI / 2.05}
      />
    </>
  );
}

export default function HospitalScene({
  robotPosition,
  running,
  completed = false,
  secondaryRobotPosition = gridCellToWorld([2, 2]),
  secondaryRobotRunning = false,
  secondaryRobotPath = [],
  path = [],
  grid,
  onCellClick,
}) {
  const safeGrid = grid ?? Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) =>
      row === 0 ||
      col === 0 ||
      row === ROWS - 1 ||
      col === COLS - 1
        ? 1
        : 0
    )
  );

  return (
    <div className="hospital-scene">
      <Canvas
        shadows
        camera={{
          position: [10, 13, 14],
          fov: 42,
          near: 0.1,
          far: 100,
        }}
        dpr={[1, 2]}
      >
        <HospitalWorld
          robotPosition={robotPosition}
          running={running}
          completed={completed}
          secondaryRobotPosition={secondaryRobotPosition}
          secondaryRobotRunning={secondaryRobotRunning}
          secondaryRobotPath={secondaryRobotPath}
          path={path}
          grid={safeGrid}
          onCellClick={onCellClick}
        />
      </Canvas>
    </div>
  );
}
