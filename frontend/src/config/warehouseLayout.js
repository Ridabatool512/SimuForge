
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

export function createWarehouseGrid() {
  return Array.from({ length: WAREHOUSE_ROWS }, (_, row) =>
    Array.from({ length: WAREHOUSE_COLS }, (_, col) => {
      const isBoundary =
        row === 0 ||
        col === 0 ||
        row === WAREHOUSE_ROWS - 1 ||
        col === WAREHOUSE_COLS - 1;

      return isBoundary || isRackCell(row, col) ? 1 : 0;
    })
  );
}
