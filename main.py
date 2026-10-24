import math
import random
import threading
import json
import time
import os

from flask import Flask, jsonify, render_template, request, redirect, url_for, session

app = Flask(__name__)
app.secret_key = 'burmalda-secret'  # нужен, чтобы работала session

app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-me")

#апгрейдер «Зачёт» подключается отдельным модулем из папки zachet
from zachet import bp as zachet_bp
app.register_blueprint(zachet_bp, url_prefix='/upgrader')

from double import double_bp
app.register_blueprint(double_bp, url_prefix="/double")

for rule in app.url_map.iter_rules():
    print(rule.endpoint, '->', rule.rule)


USERS_FILE = 'users.json'
USER_BALANCE = 5000 #балик
START_BALANCE = 5000

def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


# сохраняет всех пользователей в файл
def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=4)


# возвращает баланс того, кто сейчас вошёл (или None, если никто не вошёл)
def get_balance():
    login_name = session.get('user')
    users = load_users()
    if login_name not in users:
        return None
    return users[login_name]['balance']


# записывает новый баланс тому, кто сейчас вошёл
def set_balance(new_balance):
    login_name = session.get('user')
    users = load_users()
    if login_name in users:
        users[login_name]['balance'] = new_balance
        save_users(users)


# передаёт логин и баланс во ВСЕ шаблоны, чтобы шапка знала, кто вошёл
@app.context_processor
def inject_user():
    return {'current_user': session.get('user'), 'current_balance': get_balance()}

# функция для открытия главной страницы (также по дефолту)
@app.route('/main_page')
@app.route('/')
def main_page():
    return render_template('main_page.html')



@app.route('/rocket')
def rocket():
    if get_balance() is None:  # никто не вошёл — отправляем на вход
        return redirect(url_for('login'))
    return render_template('index_rocket.html')

# функция для открытия слотов (передает баланс в шаблон)
@app.route('/slots')
def slots():
    balance = get_balance()
    if balance is None:  # никто не вошёл — отправляем на вход
        return redirect(url_for('login'))
    return render_template('slots.html', balance=balance)


# Эндпоинт для обработки вращения барабанов (POST-запрос)
@app.route('/slots/spin', methods=['POST'])
def slots_spin():
    USER_BALANCE = get_balance()  # баланс вошедшего игрока из users.json
    if USER_BALANCE is None:
        return jsonify({'error': 'Сначала войди в аккаунт'}), 401
    data = request.json or {}
    bet = int(data.get('bet', 100))

    if bet > USER_BALANCE or bet <= 0:
        return jsonify({'error': 'Недостаточно средств!'}), 400

    USER_BALANCE -= bet

    # Список доступных символов
    symbols = ['🍒', '🍋', '🍉', '⭐', '💎', '🔥']

    # Задаем веса (вероятности) для каждого символа по порядку. Чем больше число, тем выше шанс выпадения элемента.
    weights = [22, 22, 22, 17, 15, 2]

    # Генерируем каждый барабан отдельно с учетом весов
    r1 = random.choices(symbols, weights=weights)[0]
    r2 = random.choices(symbols, weights=weights)[0]
    r3 = random.choices(symbols, weights=weights)[0]

    # 1. ГЛАВНЫЙ СУПЕРПРИЗ: Три редких элемента '🔥' подряд. в фронтэнде заменится на Никола
    if r1 == '🔥' and r2 == '🔥' and r3 == '🔥':
        win_amount = bet * 100  # Мега-джекпот х100!
        USER_BALANCE += win_amount
        is_win = True
    # 2. Обычный джекпот (все 3 совпали)
    elif r1 == r2 and r2 == r3:
        win_amount = bet * 10
        USER_BALANCE += win_amount
        is_win = True
    # 3. Утешительный приз (любая пара картинок)
    elif r1 == r2 or r2 == r3 or r1 == r3:
        win_amount = round(bet * 1.5)
        USER_BALANCE += win_amount
        is_win = True
    else:
        win_amount = 0
        is_win = False
    set_balance(USER_BALANCE)
    return jsonify({
        'reels': [r1, r2, r3],
        'is_win': is_win,
        'win_amount': win_amount,
        'balance': USER_BALANCE
    })


# функция для открытия тапалки
@app.route('/vorona combat', methods=['GET', 'POST'])
def vorona_combat():
    if request.method == 'POST':
        balance = get_balance()
        if balance is None:  # никто не вошёл
            return jsonify({'error': 'Сначала войди в аккаунт'}), 401
        balance += 1000
        set_balance(balance)
        return jsonify({'balance': balance})
    return render_template('vorona_combat.html')

# ---- игра «Ракета»: раунды и баланс считает сервер ----
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
    "bets": {},          # {логин: ставка} в текущем раунде
    "cashed_out": {},    # {логин: множитель, на котором забрал}
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
    state["bets"] = {}
    state["cashed_out"] = {}


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


def snapshot(now, user=None):
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
        "balance": get_balance() or 0,
        "bet": state["bets"].get(user, 0),
        "cashed_out": state["cashed_out"].get(user),
        "history": state["history"],
    }

@app.route("/api/state")
def api_state():
    with lock:
        now = time.time()
        advance(now)
        return jsonify(snapshot(now, session.get('user')))


@app.route("/api/bet", methods=["POST"])
def api_bet():
    user = session.get('user')
    if get_balance() is None:
        return jsonify(error="Сначала войди в аккаунт"), 401
    data = request.get_json(silent=True) or {}
    try:
        amount = int(float(data.get("amount", 0)))
    except (TypeError, ValueError):
        return jsonify(error="Некорректная ставка"), 400

    with lock:
        now = time.time()
        advance(now)
        if state["phase"] != "waiting":
            return jsonify(error="Ставки принимаются только перед взлётом"), 409
        if state["bets"].get(user, 0) > 0:
            return jsonify(error="Ставка уже сделана"), 409
        balance = get_balance()
        if amount <= 0 or amount > balance:
            return jsonify(error="Недостаточно средств или неверная ставка"), 400
        set_balance(balance - amount)      # списали ставку с аккаунта
        state["bets"][user] = amount
        return jsonify(snapshot(now, user))


@app.route("/api/cashout", methods=["POST"])
def api_cashout():
    user = session.get('user')
    if get_balance() is None:
        return jsonify(error="Сначала войди в аккаунт"), 401
    with lock:
        now = time.time()
        advance(now)
        bet = state["bets"].get(user, 0)
        if state["phase"] != "flying" or bet <= 0 or user in state["cashed_out"]:
            return jsonify(error="Забрать сейчас нельзя"), 409
        mult = min(current_mult(now), state["crash_at"])
        if mult >= state["crash_at"]:
            # ракета уже взорвалась в этот момент
            advance(now)
            return jsonify(error="Ракета уже взорвалась"), 409
        state["cashed_out"][user] = mult
        set_balance(get_balance() + int(bet * mult))   # выигрыш на аккаунт
        return jsonify(snapshot(now, user))

new_round(time.time())   # первый раунд при запуске сервера

for rule in app.url_map.iter_rules():
    print(rule.endpoint, "->", rule.rule)

# апгрейдер: отдаёт и сохраняет баланс и прогресс (инвентарь, история) в users.json
@app.route('/api/upgrader', methods=['GET', 'POST'])
def api_upgrader():
    login_name = session.get('user')
    users = load_users()
    if login_name not in users:  # никто не вошёл
        return jsonify({'error': 'Сначала войди в аккаунт'}), 401
    user = users[login_name]
    if request.method == 'POST':
        data = request.json
        user['balance'] = int(data['balance'])
        user['upgrader'] = data['state']  # инвентарь, история, статистика
        save_users(users)
    return jsonify({'balance': user['balance'], 'state': user.get('upgrader')})

# страница входа
@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        login_name = request.form['login']
        password = request.form['password']
        users = load_users()

        if login_name in users and users[login_name]['password'] == password:
            session['user'] = login_name  # запоминаем, кто вошёл
            return redirect(url_for('profile'))
        error = 'Неверный логин или пароль'

    return render_template('login.html', error=error)


# страница регистрации
@app.route('/register', methods=['GET', 'POST'])
def register():
    error = None
    if request.method == 'POST':
        login_name = request.form['login']
        password = request.form['password']
        users = load_users()

        if not login_name or not password:
            error = 'Заполни оба поля'
        elif login_name in users:
            error = 'Такой логин уже занят'
        else:
            users[login_name] = {'password': password, 'balance': START_BALANCE}
            save_users(users)
            return redirect(url_for('login'))

    return render_template('register.html', error=error)


# личный кабинет
@app.route('/profile')
def profile():
    if get_balance() is None:  # никто не вошёл — отправляем на вход
        return redirect(url_for('login'))
    return render_template('profile.html')


# выход из аккаунта
@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('main_page'))


# в этом ифе само тело программы
if __name__ == '__main__':
    app.run(debug=True)