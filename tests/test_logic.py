import random
from collections import Counter

import pytest

from double.logic import (
    MAX_BET,
    PAYOUTS,
    SLOT_COLORS,
    BetError,
    parse_amount,
    play_round,
    spin,
    validate_bet,
)


class FixedRng:
    """Генератор, который всегда возвращает заданное число."""

    def __init__(self, value):
        self.value = value

    def randrange(self, _n):
        return self.value


def test_slot_layout():
    assert len(SLOT_COLORS) == 15
    assert SLOT_COLORS[0] == "green"
    assert SLOT_COLORS.count("red") == 7
    assert SLOT_COLORS.count("black") == 7


def test_spin_in_range():
    rng = random.Random(1)
    assert all(0 <= spin(rng) <= 14 for _ in range(500))


def test_distribution_is_roughly_fair():
    rng = random.Random(42)
    n = 30_000
    counts = Counter(SLOT_COLORS[spin(rng)] for _ in range(n))
    assert counts["red"] / n == pytest.approx(7 / 15, abs=0.02)
    assert counts["black"] / n == pytest.approx(7 / 15, abs=0.02)
    assert counts["green"] / n == pytest.approx(1 / 15, abs=0.01)


@pytest.mark.parametrize("color,number", [("red", 3), ("black", 10), ("green", 0)])
def test_win(color, number):
    r = play_round(color, 100, 1000, FixedRng(number))
    assert r.won is True
    assert r.payout == 100 * PAYOUTS[color]
    assert r.profit == 100 * (PAYOUTS[color] - 1)


@pytest.mark.parametrize("color,number", [("red", 10), ("black", 3), ("green", 5), ("red", 0)])
def test_loss(color, number):
    r = play_round(color, 100, 1000, FixedRng(number))
    assert r.won is False
    assert r.payout == 0
    assert r.profit == -100


def test_green_pays_14x():
    assert play_round("green", 10, 100, FixedRng(0)).payout == 140


@pytest.mark.parametrize(
    "color,amount,balance",
    [
        ("blue", 10, 100),        # неизвестный цвет
        (None, 10, 100),          # цвет не выбран
        ("red", 0, 100),          # ставка ниже минимума
        ("red", -5, 100),         # отрицательная ставка
        ("red", 101, 100),        # больше баланса
        ("red", MAX_BET + 1, 10**9),  # больше максимума
        ("red", 1.5, 100),        # дробная ставка
        ("red", "abc", 100),      # не число
        ("red", None, 100),       # пусто
        ("red", True, 100),       # bool — не число
    ],
)
def test_invalid_bets(color, amount, balance):
    with pytest.raises(BetError):
        validate_bet(color, amount, balance)


def test_parse_amount_accepts_valid_forms():
    assert parse_amount(10) == 10
    assert parse_amount("25") == 25
    assert parse_amount(" 7 ") == 7
    assert parse_amount(5.0) == 5


def test_bet_equal_to_balance_is_ok():
    assert validate_bet("red", 100, 100) == 100
