"""Хранилище баланса и истории.

Баланс общий для всех игр казино: он берётся из аккаунта игрока в users.json
(тот же файл, что использует main.py). История чисел — своя, в сессии.
"""
import json
import os

from flask import session

USERS_FILE = "users.json"
START_BALANCE = 1000
HISTORY_LIMIT = 15


def _load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=4)


def get_balance():
    users = _load_users()
    login_name = session.get("user")
    if login_name not in users:
        return 0  # никто не вошёл — играть не на что
    return users[login_name]["balance"]


def set_balance(value):
    users = _load_users()
    login_name = session.get("user")
    if login_name in users:
        users[login_name]["balance"] = int(value)
        _save_users(users)


def get_history():
    return list(session.get("double_history", []))


def add_history(number):
    history = get_history()
    history.append(int(number))
    session["double_history"] = history[-HISTORY_LIMIT:]


def reset():
    if get_balance() < 1:  # «Начать заново» только если проигрался в ноль
        set_balance(START_BALANCE)
    session["double_history"] = []