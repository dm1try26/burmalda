import pytest

from app import create_app
from double import routes
from double.logic import PAYOUTS


@pytest.fixture
def client():
    app = create_app({"TESTING": True, "SECRET_KEY": "test"})
    return app.test_client()


def force_number(monkeypatch, number):
    """Подменяет розыгрыш, чтобы результат был предсказуемым."""

    class Rng:
        def randrange(self, _n):
            return number

    monkeypatch.setattr("double.logic.random.SystemRandom", Rng)


def test_index_page_renders(client):
    resp = client.get("/double/")
    assert resp.status_code == 200
    assert "Double".encode() in resp.data


def test_root_redirects_to_game(client):
    resp = client.get("/")
    assert resp.status_code == 302
    assert resp.headers["Location"].endswith("/double/")


def test_static_files_served(client):
    assert client.get("/double/static/double.js").status_code == 200
    assert client.get("/double/static/double.css").status_code == 200


def test_initial_state(client):
    data = client.get("/double/api/state").get_json()
    assert data == {"balance": 1000, "history": []}


def test_winning_spin_updates_balance(client, monkeypatch):
    force_number(monkeypatch, 3)  # красное
    resp = client.post("/double/api/spin", json={"color": "red", "amount": 100})
    data = resp.get_json()
    assert resp.status_code == 200
    assert data["result"]["won"] is True
    assert data["balance"] == 1000 + 100 * (PAYOUTS["red"] - 1)
    assert data["history"] == [3]


def test_losing_spin_updates_balance(client, monkeypatch):
    force_number(monkeypatch, 10)  # чёрное
    data = client.post("/double/api/spin", json={"color": "red", "amount": 100}).get_json()
    assert data["result"]["won"] is False
    assert data["balance"] == 900


def test_green_win(client, monkeypatch):
    force_number(monkeypatch, 0)
    data = client.post("/double/api/spin", json={"color": "green", "amount": 10}).get_json()
    assert data["balance"] == 1000 + 10 * 13


def test_balance_persists_between_requests(client, monkeypatch):
    force_number(monkeypatch, 10)
    client.post("/double/api/spin", json={"color": "red", "amount": 50})
    assert client.get("/double/api/state").get_json()["balance"] == 950


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"color": "red"},
        {"amount": 10},
        {"color": "purple", "amount": 10},
        {"color": "red", "amount": 0},
        {"color": "red", "amount": 5000},  # больше баланса 1000
        {"color": "red", "amount": "abc"},
    ],
)
def test_invalid_bet_returns_400_and_keeps_balance(client, payload):
    resp = client.post("/double/api/spin", json=payload)
    assert resp.status_code == 400
    assert "error" in resp.get_json()
    assert client.get("/double/api/state").get_json()["balance"] == 1000


def test_non_json_body_is_rejected(client):
    resp = client.post("/double/api/spin", data="oops")
    assert resp.status_code == 400


def test_history_is_limited(client):
    for _ in range(25):
        client.post("/double/api/spin", json={"color": "red", "amount": 1})
    assert len(client.get("/double/api/state").get_json()["history"]) <= 15


def test_reset(client, monkeypatch):
    force_number(monkeypatch, 10)
    client.post("/double/api/spin", json={"color": "red", "amount": 500})
    data = client.post("/double/api/reset").get_json()
    assert data == {"balance": 1000, "history": []}
