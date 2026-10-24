"""Чистая игровая логика Double (без Flask) — её легко тестировать.

Правила (как в классическом Double):
    * 15 ячеек: 0 (зелёная), 1-7 (красные), 8-14 (чёрные).
    * Ставка на красное или чёрное платит x2, на зелёное — x14.
    * Шансы: красное 7/15, чёрное 7/15, зелёное 1/15.
      Возврат игроку (RTP) одинаков для всех ставок: 2*7/15 = 14/15 ≈ 93,3 %.
"""
import random
from dataclasses import dataclass

COLORS = ("red", "black", "green")

# Цвет каждой ячейки: индекс списка = выпавшее число.
SLOT_COLORS = ["green"] + ["red"] * 7 + ["black"] * 7

# Во сколько раз умножается ставка при выигрыше.
PAYOUTS = {"red": 2, "black": 2, "green": 14}

MIN_BET = 1
MAX_BET = 10**100


class BetError(ValueError):
    """Некорректная ставка (текст ошибки можно показывать игроку)."""


@dataclass(frozen=True)
class SpinResult:
    number: int       # выпавшее число 0..14
    color: str        # цвет выпавшей ячейки
    bet_color: str    # на что ставил игрок
    bet: int          # размер ставки
    won: bool         # выиграл ли игрок
    payout: int       # сколько вернулось на баланс (0 при проигрыше)
    profit: int       # чистый результат раунда (+выигрыш / -ставка)


def spin(rng=None):
    """Крутит рулетку и возвращает выпавшее число 0..14."""
    rng = rng or random.SystemRandom()
    return rng.randrange(len(SLOT_COLORS))


def parse_amount(raw):
    """Приводит сумму ставки из JSON к int или бросает BetError."""
    if isinstance(raw, bool) or raw is None:
        raise BetError("Введите сумму ставки")
    if isinstance(raw, float):
        if not raw.is_integer():
            raise BetError("Ставка должна быть целым числом")
        raw = int(raw)
    if isinstance(raw, str):
        raw = raw.strip()
        if not raw.lstrip("-").isdigit():
            raise BetError("Ставка должна быть целым числом")
        raw = int(raw)
    if not isinstance(raw, int):
        raise BetError("Ставка должна быть целым числом")
    return raw


def validate_bet(color, amount, balance):
    """Проверяет ставку и возвращает сумму как int."""
    if color not in COLORS:
        raise BetError("Выберите цвет: красное, чёрное или зелёное")
    amount = parse_amount(amount)
    if amount < MIN_BET:
        raise BetError(f"Минимальная ставка — {MIN_BET}")
    if amount > MAX_BET:
        raise BetError(f"Максимальная ставка — {MAX_BET}")
    if amount > balance:
        raise BetError("Недостаточно средств на балансе")
    return amount


def play_round(color, amount, balance, rng=None):
    """Один раунд: валидация ставки, розыгрыш, расчёт выигрыша."""
    amount = validate_bet(color, amount, balance)
    number = spin(rng)
    result_color = SLOT_COLORS[number]
    won = result_color == color
    payout = amount * PAYOUTS[color] if won else 0
    return SpinResult(
        number=number,
        color=result_color,
        bet_color=color,
        bet=amount,
        won=won,
        payout=payout,
        profit=payout - amount,
    )
