/* Инвентарь апгрейдера в личном кабинете: показывает предметы, продаёт их и отправляет в апгрейд.
   Прогресс апгрейдера хранится на сервере, его отдаёт и принимает /api/upgrader. */
(()=>{
const box=document.getElementById('upgInv'); if(!box)return;
const upURL=box.dataset.upgraderUrl;
const nf=n=>Math.round(n).toLocaleString('ru-RU');
const wearOf=f=>WEAR.find(w=>f>=w[2]&&f<w[3])||WEAR[4];
const sellPrice=c=>Math.floor(CAT[c].price*.9);   // как в апгрейдере: при продаже 90% цены
let data=null;

function setBalance(b){document.querySelectorAll('#header-balance,#profile-balance').forEach(e=>e.textContent=b)}
function save(){
  return fetch('/api/upgrader',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({balance:data.balance,state:data.state})})
    .then(r=>r.json()).then(d=>{data.balance=d.balance;setBalance(d.balance)});
}
function card(x){
  const i=CAT[x.c], w=wearOf(x.f);
  return `<div class="col"><div class="card h-100 upg-item" style="--rc:${RAR[i.rar].c}">
    <div class="upg-art">${art(i)}</div>
    <div class="card-body p-2">
      <div class="small text-body-secondary">${TYPES[i.type]}</div>
      <div class="fw-semibold text-truncate" title="${i.skin}">${i.skin}</div>
      <div class="small upg-rar">${RAR[i.rar].n}</div>
      <div class="small text-body-secondary" title="Износ ${x.f.toFixed(4)}">${w[0]} · ${x.f.toFixed(3)}</div>
      <div class="fw-bold mt-1">${nf(i.price)} 🪙</div>
    </div>
    <div class="card-footer p-2 d-flex flex-column gap-1">
      <a class="btn btn-sm btn-outline-primary" href="${upURL}?up=${x.u}">В апгрейд</a>
      <button class="btn btn-sm btn-outline-secondary" data-sell="${x.u}">Продать · ${nf(sellPrice(x.c))}</button>
    </div></div></div>`;
}
function render(){
  const inv=(data.state&&Array.isArray(data.state.inv))?data.state.inv:[];
  const sum=document.getElementById('upgInvSum'), all=document.getElementById('upgSellAll');
  all.hidden=!inv.length;
  if(!inv.length){
    sum.textContent='';
    box.innerHTML=`<div class="text-center text-body-secondary py-4">Пока пусто. Предметы появятся после игры в <a href="${upURL}">апгрейдере</a>.</div>`;
    return;
  }
  sum.textContent=`${inv.length} шт. на ${nf(inv.reduce((s,x)=>s+CAT[x.c].price,0))} 🪙. При продаже вы получаете 90% цены.`;
  box.innerHTML=`<div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-lg-5 g-3">${[...inv].sort((a,b)=>CAT[b.c].price-CAT[a.c].price).map(card).join('')}</div>`;
}
function sell(uids){
  const st=data.state, out=st.inv.filter(x=>uids.includes(x.u));
  if(!out.length)return;
  st.inv=st.inv.filter(x=>!uids.includes(x.u));
  data.balance+=out.reduce((s,x)=>s+sellPrice(x.c),0);
  st.bal=data.balance;
  render(); save();
}

box.addEventListener('click',e=>{const b=e.target.closest('[data-sell]');if(b)sell([b.dataset.sell])});
document.getElementById('upgSellAll').addEventListener('click',()=>{
  if(confirm('Продать все предметы из инвентаря?'))sell(data.state.inv.map(x=>x.u));
});
fetch('/api/upgrader').then(r=>r.json()).then(d=>{
  if(d.error){box.innerHTML=`<div class="text-center text-body-secondary py-4">${d.error}</div>`;return}
  data=d; setBalance(d.balance); render();
});
})();
