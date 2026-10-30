
import pytest

from app.pathfinding import find_path


def test_astar_finds_shortest_path():
    grid = [
        [0, 0, 0, 0],
        [1, 1, 0, 1],
        [0, 0, 0, 0],
    ]

    result = find_path(grid, (0, 0), (2, 3), "astar")

    assert result["found"] is True
    assert result["path_length"] == 5
    assert result["path"][0] == [0, 0]
    assert result["path"][-1] == [2, 3]


def test_dijkstra_finds_shortest_path():
    grid = [[0] * 5 for _ in range(5)]

    result = find_path(grid, (0, 0), (4, 4), "dijkstra")

    assert result["found"] is True
    assert result["path_length"] == 8


def test_blocked_goal_is_rejected():
    grid = [[0, 0], [0, 1]]

    with pytest.raises(ValueError):
        find_path(grid, (0, 0), (1, 1))


def test_unreachable_goal():
    grid = [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
    ]

    result = find_path(grid, (0, 0), (0, 2))

    assert result["found"] is False
    assert result["path"] == []


def test_invalid_algorithm_is_rejected():
    with pytest.raises(ValueError):
        find_path([[0, 0]], (0, 0), (0, 1), "invalid")


def test_grid_rejects_non_binary_values():
    with pytest.raises(ValueError, match="Grid cells must be integers"):
        find_path([[0, 2], [0, 0]], (0, 0), (1, 1))


def test_grid_rejects_boolean_cells():
    with pytest.raises(ValueError, match="Grid cells must be integers"):
        find_path([[0, True], [0, 0]], (0, 0), (1, 1))


def test_start_equals_goal_returns_single_cell_path():
    result = find_path([[0, 0], [0, 0]], (1, 1), (1, 1))
    assert result["found"] is True
    assert result["path"] == [[1, 1]]
    assert result["path_length"] == 0


def test_grid_rejects_ragged_rows():
    with pytest.raises(ValueError, match="equal lengths"):
        find_path([[0, 0], [0]], (0, 0), (0, 1))


def test_out_of_bounds_start_is_rejected():
    with pytest.raises(ValueError, match="outside the grid"):
        find_path([[0, 0]], (-1, 0), (0, 1))
