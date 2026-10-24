"""Flask Blueprint игры Double."""
from dataclasses import asdict

from flask import Blueprint, jsonify, render_template, request

from . import wallet
from .logic import MAX_BET, MIN_BET, PAYOUTS, SLOT_COLORS, BetError, play_round

double_bp = Blueprint(
    "double",
    __name__,
    template_folder="templates",
    static_folder="static",
)


@double_bp.get("/")
def index():
    return render_template(
        "double.html",
        balance=wallet.get_balance(),
        history=wallet.get_history(),
        payouts=PAYOUTS,
        slot_colors=SLOT_COLORS,
        min_bet=MIN_BET,
        max_bet=MAX_BET,
    )


@double_bp.post("/api/spin")
def api_spin():
    data = request.get_json(silent=True) or {}
    balance = wallet.get_balance()
    try:
        result = play_round(data.get("color"), data.get("amount"), balance)
    except BetError as err:
        return jsonify(error=str(err)), 400

    new_balance = balance + result.profit
    wallet.set_balance(new_balance)
    wallet.add_history(result.number)
    return jsonify(
        result=asdict(result),
        balance=new_balance,
        history=wallet.get_history(),
    )


@double_bp.get("/api/state")
def api_state():
    return jsonify(balance=wallet.get_balance(), history=wallet.get_history())


@double_bp.post("/api/reset")
def api_reset():
    wallet.reset()
    return jsonify(balance=wallet.get_balance(), history=wallet.get_history())
