"""Демо-игра «Ракета» на Flask.

Вся логика раундов (момент краха, множитель, баланс) считается на сервере.
Браузер только показывает состояние и отправляет ставки и команды «забрать».
Это демо на виртуальные монеты: один общий игрок, без регистрации.
"""
import math
import random
import threading
import time

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

BET_TIME = 5.0        # секунд на ставки
PAUSE_AFTER = 2.5     # пауза после взрыва до следующего раунда
GROWTH = 0.36         # скорость роста множителя (как в клиенте: 0.12 * 3)
HOUSE_EDGE = 0.96     # возврат игрокам, ~4% в пользу казино
HISTORY_LEN = 20

lock = threading.Lock()

state = {
    "phase": "waiting",       # waiting | flying | crashed
    "round_id": 0,
    "bet_end": 0.0,           # когда закончится приём ставок
    "launch_time": 0.0,       # когда ракета взлетела
    "crash_at": 1.0,          # множитель краха (скрыт, пока не случился)
    "next_round_at": 0.0,     # когда начнётся следующий раунд
    "balance": 1000.0,
    "bet": 0.0,
    "cashed_out": None,       # множитель, на котором игрок забрал
    "history": [],            # последние краши
}


def gen_crash():
    """Множитель краха с преимуществом дома."""
    r = random.random()
    c = HOUSE_EDGE / (1 - r)
    return max(1.0, math.floor(c * 100) / 100)


def current_mult(now):
    t = now - state["launch_time"]
    return math.floor(math.exp(GROWTH * t) * 100) / 100


def new_round(now):
    state["round_id"] += 1
    state["phase"] = "waiting"
    state["bet_end"] = now + BET_TIME
    state["crash_at"] = gen_crash()
    state["bet"] = 0.0
    state["cashed_out"] = None


def advance(now):
    """Переводит раунд в следующую фазу по времени. Вызывается при каждом запросе."""
    if state["phase"] == "waiting" and now >= state["bet_end"]:
        state["phase"] = "flying"
        state["launch_time"] = state["bet_end"]

    if state["phase"] == "flying":
        if current_mult(now) >= state["crash_at"]:
            state["phase"] = "crashed"
            state["next_round_at"] = now + PAUSE_AFTER
            state["history"].insert(0, state["crash_at"])
            del state["history"][HISTORY_LEN:]

    if state["phase"] == "crashed" and now >= state["next_round_at"]:
        new_round(now)


def snapshot(now):
    phase = state["phase"]
    if phase == "flying":
        mult = min(current_mult(now), state["crash_at"])
    elif phase == "crashed":
        mult = state["crash_at"]
    else:
        mult = 1.0
    return {
        "phase": phase,
        "round_id": state["round_id"],
        "multiplier": mult,
        "crash_at": state["crash_at"] if phase == "crashed" else None,
        "bet_left": max(0.0, state["bet_end"] - now) if phase == "waiting" else 0.0,
        "balance": round(state["balance"], 2),
        "bet": state["bet"],
        "cashed_out": state["cashed_out"],
        "history": state["history"],
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/state")
def api_state():
    with lock:
        now = time.time()
        advance(now)
        return jsonify(snapshot(now))


@app.route("/api/bet", methods=["POST"])
def api_bet():
    data = request.get_json(silent=True) or {}
    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return jsonify(error="Некорректная ставка"), 400

    with lock:
        now = time.time()
        advance(now)
        if state["phase"] != "waiting":
            return jsonify(error="Ставки принимаются только перед взлётом"), 409
        if state["bet"] > 0:
            return jsonify(error="Ставка уже сделана"), 409
        if amount <= 0 or amount > state["balance"]:
            return jsonify(error="Недостаточно средств или неверная ставка"), 400
        state["balance"] = round(state["balance"] - amount, 2)
        state["bet"] = amount
        return jsonify(snapshot(now))


@app.route("/api/cashout", methods=["POST"])
def api_cashout():
    with lock:
        now = time.time()
        advance(now)
        if state["phase"] != "flying" or state["bet"] <= 0 or state["cashed_out"] is not None:
            return jsonify(error="Забрать сейчас нельзя"), 409
        mult = min(current_mult(now), state["crash_at"])
        if mult >= state["crash_at"]:
            # ракета уже взорвалась в этот момент
            advance(now)
            return jsonify(error="Ракета уже взорвалась"), 409
        state["cashed_out"] = mult
        state["balance"] = round(state["balance"] + state["bet"] * mult, 2)
        state["bet"] = 0.0
        return jsonify(snapshot(now))


new_round(time.time())   # первый раунд при запуске сервера

if __name__ == "__main__":
    app.run(debug=True)
