
export const WAREHOUSE_ROWS = 13;
export const WAREHOUSE_COLS = 17;

export const WAREHOUSE_RACKS = [
  { id: "A", row: 3, col: 4 },
  { id: "B", row: 3, col: 6 },
  { id: "C", row: 3, col: 8 },
  { id: "D", row: 3, col: 10 },
  { id: "E", row: 7, col: 4 },
  { id: "F", row: 7, col: 6 },
  { id: "G", row: 7, col: 8 },
  { id: "H", row: 7, col: 10 },
];

export function isRackCell(row, col) {
  return WAREHOUSE_RACKS.some(
    (rack) =>
      row >= rack.row &&
      row < rack.row + 2 &&
      col >= rack.col &&
      col < rack.col + 2
  );
}

// Default safety obstacles and marked pedestrian-only patrol cells.
// Every pedestrian patrol cell is blocked for robots, so planned routes
// keep a permanent safety buffer around moving people.
export const DEFAULT_OBSTACLES = [
  [5, 2], [5, 13], [9, 13], [9, 2],
];
export const HUMAN_PATROLS = [
  { id: "P1", cells: [[4, 2], [4, 3], [4, 4]], axis: "x" },
  { id: "P2", cells: [[8, 12], [8, 13], [8, 14]], axis: "x" },
];

export function createWarehouseGrid() {
  const grid = Array.from({ length: WAREHOUSE_ROWS }, (_, row) =>
    Array.from({ length: WAREHOUSE_COLS }, (_, col) => {
      const isBoundary =
        row === 0 || col === 0 ||
        row === WAREHOUSE_ROWS - 1 || col === WAREHOUSE_COLS - 1;
      const isHumanLane = HUMAN_PATROLS.some((person) =>
        person.cells.some(([humanRow, humanCol]) => row === humanRow && col === humanCol)
      );
      const isDefaultObstacle = DEFAULT_OBSTACLES.some(
        ([obstacleRow, obstacleCol]) => row === obstacleRow && col === obstacleCol
      );
      return isBoundary || isRackCell(row, col) || isHumanLane || isDefaultObstacle ? 1 : 0;
    })
  );
  return grid;
}
