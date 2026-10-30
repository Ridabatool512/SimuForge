
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { gridCellToWorld } from "../utils/grid";
import {
  WAREHOUSE_ROWS,
  WAREHOUSE_COLS,
  WAREHOUSE_RACKS,
  createWarehouseGrid,
  isRackCell,
} from "../config/warehouseLayout";
const ROWS = WAREHOUSE_ROWS;
const COLS = WAREHOUSE_COLS;

function Floor() {
  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.12, 0]}
        receiveShadow
      >
        <planeGeometry args={[COLS, ROWS]} />
        <meshStandardMaterial color="#101820" roughness={0.9} />
      </mesh>
      <Grid
        args={[COLS, ROWS]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#263b43"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#3b5960"
        fadeDistance={30}
        fadeStrength={1}
        position={[0, -0.1, 0]}
      />
    </>
  );
}

function Zone({ position, size, label, color = "#20363a" }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <Text
        position={[0, 0.06, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.2}
        color="#a6c5c5"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}


function Rack({ position, label }) {
  const cartons = [
    { x: -0.3, y: 0.25, z: -0.2, color: "#b77a50" },
    { x: 0.3, y: 0.25, z: 0.2, color: "#c9a16b" },
    { x: -0.3, y: 0.6, z: 0.2, color: "#6e9c98" },
    { x: 0.3, y: 0.6, z: -0.2, color: "#bd8055" },
    { x: 0, y: 0.95, z: 0, color: "#d0b17b" },
  ];

  return (
    <group position={position}>
      {/* Industrial rack shelves */}
      {[0, 0.35, 0.7].map((y) => (
        <mesh key={y} position={[0, y + 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.45, 0.075, 1.45]} />
          <meshStandardMaterial
            color="#d18b45"
            metalness={0.3}
            roughness={0.48}
          />
        </mesh>
      ))}

      {/* Vertical steel uprights */}
      {[-0.65, 0.65].map((x) =>
        [-0.65, 0.65].map((z) => (
          <mesh
            key={`${x}-${z}`}
            position={[x, 0.55, z]}
            castShadow
          >
            <boxGeometry args={[0.075, 1.1, 0.075]} />
            <meshStandardMaterial
              color="#536b80"
              metalness={0.65}
              roughness={0.32}
            />
          </mesh>
        ))
      )}

      {/* Stored inventory cartons */}
      {cartons.map((carton, index) => (
        <group
          key={index}
          position={[carton.x, carton.y, carton.z]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.36, 0.2, 0.22]} />
            <meshStandardMaterial
              color={carton.color}
              roughness={0.82}
            />
          </mesh>
          <mesh position={[0, 0, 0.112]}>
            <boxGeometry args={[0.17, 0.075, 0.006]} />
            <meshStandardMaterial color="#e9e5d9" />
          </mesh>
        </group>
      ))}

      {/* Rack identification */}
      <Text
        position={[0, 1.22, 0]}
        fontSize={0.16}
        color="#e1edf2"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.008}
        outlineColor="#101820"
      >
        {label}
      </Text>
    </group>
  );
}


function Obstacle({ position }) {
  const beaconRef = useRef(null);

  useFrame(({ clock }) => {
    if (beaconRef.current?.material) {
      beaconRef.current.material.emissiveIntensity =
        0.25 + (Math.sin(clock.elapsedTime * 2.5) + 1) * 0.15;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.82, 0.62, 0.82]} />
        <meshStandardMaterial
          color="#b7474e"
          emissive="#541b20"
          emissiveIntensity={0.4}
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
const rackCell = isRackCell(row, col);
const isPath = pathSet.has(`${row},${col}`);
const isManualObstacle = blocked && !rackCell;

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
    rackCell
      ? "#263940"
      : isManualObstacle
        ? "#512a30"
        : isPath
          ? "#15574e"
          : "#17262b"
  }
  emissive={
    rackCell
      ? "#101e23"
      : isManualObstacle
        ? "#641827"
        : isPath
          ? "#087b70"
          : "#000000"
  }
  emissiveIntensity={isManualObstacle ? 0.3 : isPath ? 0.25 : 0}
  transparent
  opacity={0.95}
  side={THREE.DoubleSide}
/>
            </mesh>
            {isManualObstacle && (
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
      ringRef.current.scale.setScalar(
        1 + Math.sin(clock.elapsedTime * 2.4) * 0.1
      );
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
        fontSize={0.18}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.105, 0]}>
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
          <meshStandardMaterial color="#d3fff7" metalness={0.35} roughness={0.25} />
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

function WarehouseWorld({
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
      <ambientLight intensity={0.8} />

<hemisphereLight
  skyColor="#c8e4f2"
  groundColor="#17212b"
  intensity={1.1}
/>

<directionalLight
  position={[5, 12, 7]}
  intensity={2.2}
  castShadow
  shadow-mapSize-width={1024}
  shadow-mapSize-height={1024}
/>

<pointLight
  position={[-5, 4, -4]}
  intensity={1.1}
  distance={12}
  color="#40cbb0"
/>

<pointLight
  position={[5, 4, 4]}
  intensity={0.8}
  distance={10}
  color="#729dff"
/>

      <Floor />
      <InteractiveGrid grid={grid} path={path} onCellClick={onCellClick} />

      <Zone position={[-5.5, 0, -4]} size={[3.6, 0.025, 1.6]} label="PICKUP ZONE" color="#1b3737" />
      <Zone position={[5.5, 0, -4]} size={[3.6, 0.025, 1.6]} label="PACKING" color="#27333e" />
      <Zone position={[-5.5, 0, 4]} size={[3.6, 0.025, 1.6]} label="CHARGING BAY" color="#1c3436" />
      <Zone position={[5.5, 0, 4]} size={[3.6, 0.025, 1.6]} label="DISPATCH" color="#3a3022" />

      {WAREHOUSE_RACKS.map((rack) => {
  const x = rack.col - 7.5;
  const z = rack.row - 5.5;

  return (
    <Rack
      key={rack.id}
      position={[x, 0, z]}
      label={`RACK ${rack.id}`}
    />
  );
})}

      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[0.12, 0.015, 11]} />
        <meshStandardMaterial color="#d7a94f" emissive="#644b1e" emissiveIntensity={0.2} />
      </mesh>

      <mesh position={[0, 0.35, -6.5]} castShadow>
        <boxGeometry args={[17, 0.7, 0.16]} />
        <meshStandardMaterial color="#304253" />
      </mesh>
      <mesh position={[0, 0.35, 6.5]} castShadow>
        <boxGeometry args={[17, 0.7, 0.16]} />
        <meshStandardMaterial color="#304253" />
      </mesh>
      <mesh position={[-8.5, 0.35, 0]} castShadow>
        <boxGeometry args={[0.16, 0.7, 13]} />
        <meshStandardMaterial color="#304253" />
      </mesh>
      <mesh position={[8.5, 0.35, 0]} castShadow>
        <boxGeometry args={[0.16, 0.7, 13]} />
        <meshStandardMaterial color="#304253" />
      </mesh>

      <Route path={path} />
      <Route path={secondaryRobotPath ?? []} color="#79aaff" />

      <Marker position={gridCellToWorld([6, 1])} color="#62a9ff" label="START" />
      <Marker position={gridCellToWorld([6, 14])} color="#ffcb70" label="DESTINATION" />

      <Robot position={robotPosition} running={running} completed={completed} />
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
 const safeGrid = grid ?? createWarehouseGrid();

  return (
    <div className="warehouse-scene">
      <Canvas
        shadows
        camera={{ position: [10, 13, 14], fov: 42, near: 0.1, far: 100 }}
        dpr={[1, 2]}
      >
        <WarehouseWorld
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
