
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
