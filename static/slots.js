const syms = ['🍒', '🍋', '🍉', '⭐', '💎', '🔥'];
const actx = new (window.AudioContext || window.webkitAudioContext)();

function snd(f, t, d) {
    try {
        let o = actx.createOscillator();
        let g = actx.createGain();
        o.type = t; o.frequency.value = f;
        g.gain.setValueAtTime(0.05, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + d);
        o.connect(g); g.connect(actx.destination);
        o.start(); o.stop(actx.currentTime + d);
    } catch (e) {}
}

function updateUI(res, loop, rls, bal, st, btn) {
    clearInterval(loop);
    for (let i = 0; i < rls.length; i++) {
        rls[i].classList.remove('spinning');
    }
    if (res.error) {
        st.className = 'status-message lose';
        st.innerText = res.error;
        btn.disabled = false;
        return;
    }
    let isSuper = true;
    for (let i = 0; i < res.reels.length; i++) {
        let val = res.reels[i];
        if (val !== '🔥') isSuper = false;
        if (val === '🔥') {
            rls[i].innerHTML = '<img src="/static/jackpot.png" alt="🔥">';
        } else {
            rls[i].innerText = val;
        }
    }
    if (bal) bal.innerText = res.balance;
    let topHeaderBal = document.getElementById('header-balance');
    if (topHeaderBal) topHeaderBal.innerText = res.balance;
    if (res.is_win) {
        st.className = 'status-message win';
        if (isSuper) {
            st.innerText = '🔥 МЕГА ДЖЕКПОТ: +' + res.win_amount + ' МОНЕТ! 🔥';
            snd(523, 'sine', 0.2);
            setTimeout(function() { snd(659, 'sine', 0.2); }, 100);
            setTimeout(function() { snd(784, 'sine', 0.4); }, 200);
        } else {
            st.innerText = 'Победа: +' + res.win_amount + ' монет';
            snd(523, 'sine', 0.15);
            setTimeout(function() { snd(659, 'sine', 0.3); }, 120);
        }
    } else {
        st.className = 'status-message lose';
        st.innerText = 'Попробуйте еще раз';
        snd(150, 'sine', 0.25);
    }
    btn.disabled = false;
}

function playSlots() {
    let btn = document.getElementById('spin-btn');
    let inp = document.getElementById('bet-input');
    let st = document.getElementById('status');
    let bal = document.getElementById('header-balance') || document.getElementById('balance-display');
    let rls = [document.getElementById('reel1'), document.getElementById('reel2'), document.getElementById('reel3')];
    st.innerHTML = '';
    btn.disabled = true;
    for (let i = 0; i < rls.length; i++) {
        rls[i].classList.add('spinning');
    }
    let loop = setInterval(function() {
        for (let i = 0; i < rls.length; i++) {
            let rand = syms[Math.floor(Math.random() * syms.length)];
            if (rand === '🔥') {
                rls[i].innerHTML = '<img src="/static/jackpot.png" alt="🔥">';
            } else {
                rls[i].innerText = rand;
            }
        }
        snd(120, 'sine', 0.04);
    }, 80);
    fetch('/slots/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bet: parseInt(inp.value) })
    })
    .then(res => res.json())
    .then(data => setTimeout(() => updateUI(data, loop, rls, bal, st, btn), 1000))
    .catch(() => setTimeout(() => updateUI({error: 'Ошибка соединения'}, loop, rls, bal, st, btn), 1000));
}
