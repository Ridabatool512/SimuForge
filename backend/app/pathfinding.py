
from heapq import heappop, heappush
from itertools import count
from math import inf
from time import perf_counter


Grid = list[list[int]]
Cell = tuple[int, int]


def _validate_grid(grid: Grid, start: Cell, goal: Cell) -> None:
    if not grid or not grid[0]:
        raise ValueError("Grid must not be empty.")

    width = len(grid[0])

    if any(len(row) != width for row in grid):
        raise ValueError("Grid rows must have equal lengths.")

    rows = len(grid)

    for row in grid:
        if any(type(value) is not int or value not in (0, 1) for value in row):
            raise ValueError("Grid cells must be integers: 0 (walkable) or 1 (blocked).")

    for cell in (start, goal):
        row, col = cell
        if not (0 <= row < rows and 0 <= col < width):
            raise ValueError(f"Cell {cell} is outside the grid.")
        if grid[row][col] != 0:
            raise ValueError(f"Cell {cell} is blocked.")


def _neighbors(grid: Grid, cell: Cell):
    rows, cols = len(grid), len(grid[0])
    row, col = cell

    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nr, nc = row + dr, col + dc

        if (
            0 <= nr < rows
            and 0 <= nc < cols
            and grid[nr][nc] == 0
        ):
            yield nr, nc


def _heuristic(a: Cell, b: Cell) -> int:
    """Manhattan distance for four-directional movement."""
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def find_path(
    grid: Grid,
    start: Cell,
    goal: Cell,
    algorithm: str = "astar",
) -> dict:
    """
    Find a shortest four-directional route through a binary grid.

    0 = walkable
    1 = blocked

    Returns path, path length, explored node count and execution time.
    """
    _validate_grid(grid, start, goal)

    if algorithm not in {"astar", "dijkstra"}:
        raise ValueError("Algorithm must be 'astar' or 'dijkstra'.")

    started = perf_counter()
    sequence = count()

    frontier = []
    heappush(frontier, (0, next(sequence), 0, start))

    came_from: dict[Cell, Cell | None] = {start: None}
    cost_so_far: dict[Cell, int] = {start: 0}
    explored = 0

    while frontier:
        _, _, queued_cost, current = heappop(frontier)
        if queued_cost != cost_so_far.get(current):
            continue

        if current == goal:
            break

        explored += 1

        for neighbor in _neighbors(grid, current):
            new_cost = cost_so_far[current] + 1

            if new_cost >= cost_so_far.get(neighbor, inf):
                continue

            cost_so_far[neighbor] = new_cost
            came_from[neighbor] = current

            estimate = (
                _heuristic(neighbor, goal)
                if algorithm == "astar"
                else 0
            )

            heappush(
                frontier,
                (
                    new_cost + estimate,
                    next(sequence),
                    new_cost,
                    neighbor,
                ),
            )

    elapsed_ms = (perf_counter() - started) * 1000

    if goal not in came_from:
        return {
            "algorithm": algorithm,
            "path": [],
            "path_length": None,
            "explored_nodes": explored,
            "execution_ms": round(elapsed_ms, 4),
            "found": False,
        }

    path = []
    current = goal

    while current is not None:
        path.append(list(current))
        current = came_from[current]

    path.reverse()

    return {
        "algorithm": algorithm,
        "path": path,
        "path_length": len(path) - 1,
        "explored_nodes": explored,
        "execution_ms": round(elapsed_ms, 4),
        "found": True,
    }
