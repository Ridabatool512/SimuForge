
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
  { id: "TABLE-1", row: 2, col: 2, type: "table" },
  { id: "CART-1", row: 5, col: 13, type: "cart" },
  { id: "PALLET-1", row: 9, col: 2, type: "pallet" },
  { id: "CONE-1", row: 9, col: 13, type: "cone" },
];

// Workers patrol clear floor aisles, away from racks and furniture.
// These cells are reserved in the navigation grid as a conservative safety buffer.
export const HUMAN_PATROLS = [
  { id: "P1", cells: [[5, 3], [5, 4], [5, 5], [5, 6]], axis: "x" },
  { id: "P2", cells: [[9, 10], [9, 11], [9, 12], [9, 13]], axis: "x" },
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
        (obstacle) => row === obstacle.row && col === obstacle.col
      );
      return isBoundary || isRackCell(row, col) || isHumanLane || isDefaultObstacle ? 1 : 0;
    })
  );
  return grid;
}
