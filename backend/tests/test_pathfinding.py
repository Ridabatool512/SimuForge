
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
    assert result["path_length"] is None


def test_invalid_algorithm_is_rejected():
    with pytest.raises(ValueError):
        find_path([[0, 0]], (0, 0), (0, 1), "invalid")


def test_path_never_crosses_obstacles():
    grid = [
        [0, 1, 0],
        [0, 1, 0],
        [0, 0, 0],
    ]

    result = find_path(grid, (0, 0), (0, 2))

    assert result["found"] is True

    for row, col in result["path"]:
        assert grid[row][col] == 0


def test_out_of_bounds_start_is_rejected():
    with pytest.raises(ValueError, match="outside the grid"):
        find_path([[0, 0], [0, 0]], (-1, 0), (1, 1))


def test_out_of_bounds_goal_is_rejected():
    with pytest.raises(ValueError, match="outside the grid"):
        find_path([[0, 0], [0, 0]], (0, 0), (2, 1))


def test_start_equals_goal():
    result = find_path([[0, 0], [0, 0]], (1, 1), (1, 1))

    assert result["found"] is True
    assert result["path"] == [[1, 1]]
    assert result["path_length"] == 0


def test_astar_and_dijkstra_return_equal_path_lengths():
    grid = [
        [0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0],
        [1, 0, 1, 0, 1],
        [0, 0, 0, 0, 0],
    ]

    astar_result = find_path(grid, (0, 0), (3, 4), "astar")
    dijkstra_result = find_path(grid, (0, 0), (3, 4), "dijkstra")

    assert astar_result["found"] is True
    assert dijkstra_result["found"] is True
    assert astar_result["path_length"] == dijkstra_result["path_length"]
