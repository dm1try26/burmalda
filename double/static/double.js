(() => {
  const root = document.getElementById("double");
  const SLOT_COLORS = JSON.parse(root.dataset.slotColors);
  const URLS = { spin: root.dataset.spinUrl, reset: root.dataset.resetUrl };
  const MIN_BET = Number(root.dataset.minBet);
  const MAX_BET = Number(root.dataset.maxBet);
  const START_BALANCE = 1000;

  // Порядок плиток на ленте (цвета чередуются, ноль в начале).
  const SEQUENCE = [0, 8, 1, 9, 2, 10, 3, 11, 4, 12, 5, 13, 6, 14, 7];
  const REPEATS = 9;
  const SPIN_MS = 4000;

  const strip = document.getElementById("strip");
  const viewport = strip.parentElement;
  const balanceEl = document.getElementById("balance");
  const messageEl = document.getElementById("message");
  const historyEl = document.getElementById("history");
  const amountEl = document.getElementById("amount");
  const spinBtn = document.getElementById("spin");
  const resetBtn = document.getElementById("reset");
  const colorBtns = document.querySelectorAll(".color-btn");

  const state = {
    balance: Number(root.dataset.balance),
    history: JSON.parse(root.dataset.history),
    color: null,
    spinning: false,
    lastNumber: 0,
  };
  if (state.history.length) state.lastNumber = state.history[state.history.length - 1];

  const tileSize = () => strip.querySelector(".tile").offsetWidth;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Лента ----------
  function buildStrip() {
    const frag = document.createDocumentFragment();
    for (let r = 0; r < REPEATS; r++) {
      for (const n of SEQUENCE) {
        const tile = document.createElement("div");
        tile.className = `tile ${SLOT_COLORS[n]}`;
        tile.textContent = n;
        frag.appendChild(tile);
      }
    }
    strip.appendChild(frag);
  }

  const indexOf = (repeat, number) => repeat * SEQUENCE.length + SEQUENCE.indexOf(number);

  function offsetFor(index, jitter = 0) {
    const t = tileSize();
    return -(index * t + t / 2 + jitter - viewport.clientWidth / 2);
  }

  function place(index, jitter, animated) {
    strip.classList.toggle("animating", animated);
    strip.style.transform = `translateX(${offsetFor(index, jitter)}px)`;
  }

  async function animateTo(number) {
    // Мгновенно ставим ленту в «стартовую» позицию, затем катим к цели.
    place(indexOf(2, state.lastNumber), 0, false);
    void strip.offsetWidth; // перерисовка, чтобы переход сработал
    const jitter = (Math.random() - 0.5) * tileSize() * 0.7;
    place(indexOf(6, number), jitter, true);
    await sleep(SPIN_MS + 100);
    state.lastNumber = number;
  }

  // ---------- Интерфейс ----------
  function setBalance(value) {
    state.balance = value;
    if (balanceEl) balanceEl.textContent = value;
    // Синхронизация с верхним балансом в шапке сайта
    const topBal = document.getElementById("header-balance");
    if (topBal) topBal.textContent = value;
    const broke = value < MIN_BET;
    resetBtn.hidden = !broke;
    spinBtn.disabled = state.spinning || broke;
  }

  function renderHistory() {
    historyEl.innerHTML = "";
    [...state.history].reverse().forEach((n) => {
      const dot = document.createElement("div");
      dot.className = `dot ${SLOT_COLORS[n]}`;
      dot.textContent = n;
      historyEl.appendChild(dot);
    });
  }

  function showMessage(text, kind = "") {
    messageEl.textContent = text;
    messageEl.className = `message ${kind}`;
  }

  function setBusy(busy) {
    state.spinning = busy;
    spinBtn.disabled = busy || state.balance < MIN_BET;
    amountEl.disabled = busy;
    colorBtns.forEach((b) => (b.disabled = busy));
    document.querySelectorAll(".quick button").forEach((b) => (b.disabled = busy));
  }

  const clampAmount = (v) => Math.max(MIN_BET, Math.min(MAX_BET, Math.floor(v) || MIN_BET));
  const currentAmount = () => Number(amountEl.value);

  const COLOR_NAMES = { red: "красное", black: "чёрное", green: "зелёное" };

  // ---------- События ----------
  colorBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      state.color = btn.dataset.color;
      colorBtns.forEach((b) => b.classList.toggle("selected", b === btn));
    })
  );

  document.querySelectorAll(".quick button").forEach((btn) =>
    btn.addEventListener("click", () => {
      const cur = currentAmount() || MIN_BET;
      const action = btn.dataset.action;
      let next = cur;
      if (action === "min") next = MIN_BET;
      if (action === "half") next = Math.floor(cur / 2);
      if (action === "double") next = cur * 2;
      if (action === "max") next = Math.min(state.balance, MAX_BET);
      amountEl.value = clampAmount(next);
    })
  );

  spinBtn.addEventListener("click", async () => {
    if (state.spinning) return;
    if (!state.color) return showMessage("Сначала выберите цвет", "error");

    setBusy(true);
    showMessage("Крутим…");
    try {
      const resp = await fetch(URLS.spin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color: state.color, amount: currentAmount() }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        showMessage(data.error || "Ошибка ставки", "error");
        return;
      }

      const res = data.result;
      await animateTo(res.number);

      state.history = data.history;
      renderHistory();
      setBalance(data.balance);

      const name = COLOR_NAMES[res.color];
      if (res.won) {
        showMessage(`Выпало ${res.number} (${name}). Выигрыш: +${res.profit}`, "win");
      } else {
        showMessage(`Выпало ${res.number} (${name}). Проигрыш: −${res.bet}`, "lose");
      }
    } catch (e) {
      showMessage("Нет связи с сервером", "error");
    } finally {
      setBusy(false);
      setBalance(state.balance);
    }
  });

  resetBtn.addEventListener("click", async () => {
    const resp = await fetch(URLS.reset, { method: "POST" });
    const data = await resp.json();
    state.history = data.history;
    state.lastNumber = 0;
    renderHistory();
    setBalance(data.balance ?? START_BALANCE);
    showMessage("Баланс восстановлен. Удачи!");
  });

  window.addEventListener("resize", () => {
    if (!state.spinning) place(indexOf(2, state.lastNumber), 0, false);
  });

  // ---------- Старт ----------
  buildStrip();
  place(indexOf(2, state.lastNumber), 0, false);
  renderHistory();
  setBalance(state.balance);
})();
