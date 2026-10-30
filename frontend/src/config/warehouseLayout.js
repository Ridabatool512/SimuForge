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

// Every visible furniture item has a matching grid-cell obstacle.
// Four table cells are placed in front of Racks A/B and four in front
// of Racks G/H, matching the furniture layout shown in the 3D scene.
export const DEFAULT_OBSTACLES = [
  ...[4, 5, 6, 7].map((col) => ({
    id: `TABLE-AB-${col}`,
    row: 5,
    col,
    type: "table",
  })),
  ...[8, 9, 10, 11].map((col) => ({
    id: `TABLE-GH-${col}`,
    row: 9,
    col,
    type: "table",
  })),
  { id: "CART-1", row: 5, col: 13, type: "cart" },
  { id: "CONE-1", row: 9, col: 13, type: "cone" },
];

// Keep people in the side aisles; do not animate them along the table rows.
export const HUMAN_PATROLS = [
  { id: "P1", cells: [[2, 2], [3, 2], [4, 2], [5, 2]], axis: "z" },
  { id: "P2", cells: [[10, 12], [10, 13], [10, 14], [10, 15]], axis: "x" },
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
