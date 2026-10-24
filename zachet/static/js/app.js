/* Логика сайта: состояние, апгрейд, ящики, магазин, инвентарь, профиль. */

/* ===== состояние ===== */
const $=id=>document.getElementById(id);
const uid=()=>Math.random().toString(36).slice(2,10);
function rollFloat(){const r=Math.random(),b=r<.1?0:r<.3?1:r<.72?2:r<.84?3:4,[,,lo,hi]=WEAR[b];return +(lo+Math.random()*(hi-lo)).toFixed(4)}
const inst=c=>({u:uid(),c,f:rollFloat()});
const fresh=()=>({bal:START,inv:[2,7,4,0].map(inst),hist:[],st:{ups:0,wins:0,cases:0,best:null},sound:true,bonusAt:0});
let S=fresh();
const save=()=>{fetch('/api/upgrader',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({balance:S.bal,state:S})})};
let sel=new Set(), coin=0, target=null, busy=false, page='upgrade', needleDeg=0, spun=null;

/* ===== отрисовка ===== */
const nf=n=>Math.round(n).toLocaleString('ru-RU');
const pc=n=>n.toFixed(2).replace('.',',');
const it=c=>CAT[c];
const wearOf=f=>WEAR.find(w=>f>=w[2]&&f<w[3])||WEAR[4];
const pr=n=>`<span class="pr">${nf(n)}<small>кр</small></span>`;
function slot(i,o={}){
  const t=o.btn?'button':'div', w=o.f!=null?wearOf(o.f):null;
  return `<${t} class="slot ${o.cls||''}" style="--rc:${RAR[i.rar].c}" ${o.attr||''}>${o.tag?`<span class="tag">${o.tag}</span>`:''}
   <div class="art">${art(i)}</div><div class="ty">${TYPES[i.type]}</div><div class="nm" title="${TYPES[i.type]} | ${i.skin}">${i.skin}</div>
   ${w?`<div class="flt" title="Float ${o.f.toFixed(4)}"><i></i><i></i><i></i><i></i><i></i><b style="left:${o.f*100}%"></b></div>`:''}
   <div class="ft">${w?`<span class="wr" title="${w[0]}">${w[1]} · ${o.f.toFixed(3)}</span>`:`<span class="wr">${RAR[i.rar].n}</span>`}${o.noPrice?'':pr(i.price)}</div>${o.extra||''}</${t}>`;
}
function crateArt(c){
  return `<svg viewBox="0 0 220 130" aria-hidden="true">
   <rect x="22" y="22" width="176" height="96" fill="${c.col}"/>
   <rect x="22" y="22" width="176" height="96" fill="url(#hatch)" opacity=".12"/>
   <rect x="22" y="22" width="176" height="12" fill="#000" opacity=".25"/>
   <rect x="22" y="22" width="14" height="96" fill="#000" opacity=".2"/><rect x="184" y="22" width="14" height="96" fill="#000" opacity=".2"/>
   <rect x="22" y="66" width="176" height="6" fill="#000" opacity=".22"/>
   <rect x="96" y="58" width="28" height="22" fill="#1b1b19"/><rect x="104" y="64" width="12" height="10" fill="#8d8a80"/>
   <text x="44" y="56" font-family="IBM Plex Mono,monospace" font-size="11" font-weight="600" fill="#000" opacity=".55">${c.code}</text>
   <text x="44" y="104" font-family="IBM Plex Mono,monospace" font-size="8" fill="#000" opacity=".45">НЕ КАНТОВАТЬ · ${c.pool.length} ПОЗ.</text>
   <rect x="40" y="118" width="20" height="6" fill="#000" opacity=".35"/><rect x="160" y="118" width="20" height="6" fill="#000" opacity=".35"/>
  </svg>`;
}
const invItems=()=>S.inv.map(x=>({...it(x.c),u:x.u,f:x.f}));
const sorter=v=>v==='d'?(a,b)=>b.price-a.price:(a,b)=>a.price-b.price;
const match=(i,q)=>!q||(TYPES[i.type]+' '+i.skin).toLowerCase().includes(q.trim().toLowerCase());

/* ===== звук ===== */
let AC;
function snd(k){
  if(!S.sound)return;
  try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume()}catch(e){return}
  const t=AC.currentTime;
  const tone=(f,d,type,v,at=0,f2)=>{const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t+at);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+at+d);g.gain.setValueAtTime(v,t+at);g.gain.exponentialRampToValueAtTime(.0001,t+at+d);o.connect(g);g.connect(AC.destination);o.start(t+at);o.stop(t+at+d+.02)};
  if(k==='tick')tone(2400,.018,'square',.02);
  else if(k==='click')tone(180,.06,'square',.04,0,90);
  else if(k==='coin'){tone(980,.06,'triangle',.06);tone(1470,.09,'triangle',.05,.05)}
  else if(k==='win'){tone(392,.12,'square',.05);tone(523,.12,'square',.05,.1);tone(784,.3,'square',.05,.2)}
  else if(k==='lose')tone(160,.45,'sawtooth',.07,0,45);
}
const sndIcon=()=>$('sndw').style.opacity=S.sound?1:.12;

/* ===== баланс ===== */
let shown=S.bal;
function renderBal(){const a=shown,b=S.bal,t0=performance.now();const s=n=>{const k=Math.min(1,(n-t0)/400);shown=a+(b-a)*(1-(1-k)**3);$('bal').textContent=nf(shown);if(k<1)requestAnimationFrame(s)};requestAnimationFrame(s)}

/* ===== апгрейд ===== */
const stakeVal=()=>[...sel].reduce((s,u)=>{const x=S.inv.find(i=>i.u===u);return s+(x?it(x.c).price:0)},0)+coin;
function calc(){
  const v=stakeVal();
  if(!v)return{v,ch:0,ok:false,why:'Выберите предметы ниже или добавьте кредиты'};
  if(target==null)return{v,ch:0,ok:false,why:'Выберите цель в правом списке'};
  const tp=it(target).price;
  if(tp<=v)return{v,ch:0,ok:false,why:'Цель должна стоить дороже ставки'};
  const ch=Math.min(MAXCH,v/tp*EDGE);
  if(ch<.01)return{v,ch,ok:false,why:'Шанс ниже 1%. Добавьте в ставку ещё предметы'};
  return{v,ch,ok:true,why:ch===MAXCH?'Шанс ограничен 80%':''};
}
function scaleSvg(){
  let h='';for(let i=0;i<100;i++){const a=i/100*Math.PI*2,big=i%10===0,mid=i%5===0,r1=138,r2=big?150:mid?146:143;
    h+=`<line x1="${(160+r1*Math.sin(a)).toFixed(2)}" y1="${(160-r1*Math.cos(a)).toFixed(2)}" x2="${(160+r2*Math.sin(a)).toFixed(2)}" y2="${(160-r2*Math.cos(a)).toFixed(2)}" stroke="var(--${big?'muted':'line2'})" stroke-width="${big?1.6:1}"/>`;
    if(big&&i){const rl=92;h+=`<text x="${(160+rl*Math.sin(a)).toFixed(1)}" y="${(160-rl*Math.cos(a)+3).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9" fill="var(--dim)">${i}</text>`}}
  $('scale').innerHTML=h;
}
function renderUpgrade(){
  let {v,ch,ok,why}=calc();
  if(busy&&spun)({v,ch}=spun); /* во время вращения ставка уже списана — показываем то, что было на момент запуска */
  $('stakeV').textContent=nf(v);
  $('selN').textContent=sel.size?sel.size+' шт.':'';
  $('stack').innerHTML=busy&&spun?`<div class="stake">${spun.items.map(x=>slot(it(x.c))).join('')}</div>`:sel.size?`<div class="stake">${[...sel].map(u=>{const x=S.inv.find(i=>i.u===u);return x?slot(it(x.c),{btn:1,attr:`data-unsel="${u}" title="Убрать из ставки"`}):''}).join('')}</div>`:'<div class="note">Нажмите на предмет в списке «Ваши предметы»</div>';
  const T=$('tgt');
  if(target!=null){const t=it(target);T.style.setProperty('--rc',RAR[t.rar].c);
    T.innerHTML=`<div class="pic">${art(t)}</div><div class="meta"><div><div class="ty">${TYPES[t.type]}</div><h3>${t.skin}</h3><div class="rr">${RAR[t.rar].n}</div></div>${pr(t.price)}</div>`;
  }else{T.style.setProperty('--rc','var(--line2)');T.innerHTML='<div class="note">Выберите предмет, который хотите получить</div>'}
  $('untgt').hidden=target==null||busy;
  if(!busy){
    $('face').classList.remove('win','lose');
    $('pct').textContent=pc(ch*100)+'%';$('pctL').textContent='шанс';
    $('mul').textContent=ok?'×'+(it(target).price/v).toFixed(2).replace('.',','):'—';
    $('zoneV').textContent=ok?'0–'+pc(ch*100):'—';
  }
  $('zone').setAttribute('stroke-dasharray',`${(ch*CIRC).toFixed(2)} ${CIRC}`);
  $('go').disabled=busy||!ok; $('why').textContent=busy?'':why;
  if(document.activeElement!==$('coin'))$('coin').value=coin; $('coin').disabled=busy;
  const inv=invItems().filter(i=>match(i,$('qInv').value)).sort(sorter($('sInv').value));
  $('gInv').innerHTML=inv.length?inv.map(i=>slot(i,{btn:1,f:i.f,cls:sel.has(i.u)?'on':'',tag:sel.has(i.u)?'В ставке':'',attr:`data-sel="${i.u}" ${busy?'disabled':''}`})).join('')
    :`<div class="empty"><b>${S.inv.length?'Ничего не найдено':'Инвентарь пуст'}</b>Купите предметы в магазине или откройте ящик</div>`;
  const tg=CAT.filter(i=>match(i,$('qTgt').value)).sort((a,b)=>a.price-b.price);
  $('gTgt').innerHTML=tg.map(i=>{const dis=busy||(v>0&&(i.price<=v||v/i.price*EDGE<.01));
    const chs=v>0&&!dis?`<span class="chance">${pc(Math.min(MAXCH,v/i.price*EDGE)*100)}%</span>`:'';
    return slot(i,{btn:1,cls:target===i.id?'on':'',tag:target===i.id?'Цель':'',attr:`data-tgt="${i.id}" ${dis?'disabled':''}`,extra:chs?`<div class="ft" style="margin-top:2px"><span class="wr">шанс</span>${chs}</div>`:''})}).join('');
}
function spin(){
  coin=Math.min(coin,S.bal);
  const {v,ch,ok}=calc(); if(!ok||busy)return;
  busy=true; snd('click');
  const t=it(target), roll=Math.random()*100, win=roll<ch*100;
  const items=[...sel].map(u=>S.inv.find(i=>i.u===u)).filter(Boolean), paid=coin;
  spun={v,ch,items}; S.inv=S.inv.filter(i=>!sel.has(i.u)); S.bal-=paid; renderBal(); save();
  renderUpgrade(); $('pctL').textContent='вращение'; $('roll').textContent='…';
  const n=$('needle'),cur=needleDeg%360;
  n.classList.add('now');n.style.transform=`rotate(${cur}deg)`;n.getBoundingClientRect();n.classList.remove('now');
  needleDeg=cur+360*5+((roll*3.6-cur)%360+360)%360;
  n.style.transform=`rotate(${needleDeg}deg)`;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last=-1;
  const trk=()=>{if(!busy)return;const m=new DOMMatrixReadOnly(getComputedStyle(n).transform);const ang=(Math.atan2(m.b,m.a)*180/Math.PI+360)%360;const idx=Math.floor(ang/7.2);if(idx!==last){last=idx;snd('tick')}$('pct').textContent=pc(ang/3.6);requestAnimationFrame(trk)};
  if(!reduce)requestAnimationFrame(trk);
  setTimeout(()=>{
    busy=false; spun=null;
    S.st.ups++;
    let wonInst=null;
    if(win){wonInst=inst(t.id);S.inv.push(wonInst);S.st.wins++;best(t.id)}
    const from=items.map(i=>it(i.c).skin).concat(paid?[nf(paid)+' кр']:[]).join(', ');
    S.hist.unshift({k:'up',win,from,to:t.skin,ch:ch*100,d:win?t.price-v:-v,at:Date.now()});S.hist=S.hist.slice(0,100);
    sel.clear();coin=0;target=null;save();
    renderUpgrade();     $('face').classList.add(win?'win':'lose');
    $('pct').textContent=pc(roll);$('pctL').textContent=win?'попадание':'мимо';
    $('roll').textContent=pc(roll);
    const B=$('bench');B.classList.remove('flash-win','flash-lose');void B.offsetWidth;B.classList.add(win?'flash-win':'flash-lose');
    snd(win?'win':'lose');
    if(win)feed(t.id,true);
    setTimeout(()=>result(win,t,wonInst,items,ch,roll,v),550);
  },reduce?120:5100);
}
function result(win,t,wonInst,items,ch,roll,v){
  if(win){
    const w=wearOf(wonInst.f);
    modal(`<div class="top"><h2>Апгрейд удался</h2><button class="x" data-close aria-label="Закрыть">✕</button></div>
    <div class="result" style="--rc:${RAR[t.rar].c}"><div class="pic">${art(t)}</div>
     <div class="info"><span class="rr">${RAR[t.rar].n}</span><div style="color:var(--muted)">${TYPES[t.type]}</div><h3>${t.skin}</h3>
      <dl><dt>Износ</dt><dd>${w[0]}</dd><dt>Float</dt><dd>${wonInst.f.toFixed(4)}</dd><dt>Шанс</dt><dd>${pc(ch*100)}%</dd><dt>Выпало</dt><dd>${pc(roll)} из 100</dd><dt>Ставка</dt><dd>${nf(v)} кр</dd><dt>Цена</dt><dd>${nf(t.price)} кр</dd></dl>
      <div class="actions"><button class="btn" data-sellu="${wonInst.u}" data-after="close">Продать за ${nf(t.price*.9)} кр</button><button class="btn pri" data-close>Забрать</button></div></div></div>`);
  }else{
    modal(`<div class="top"><h2>Мимо</h2><button class="x" data-close aria-label="Закрыть">✕</button></div>
    <div class="body"><p style="margin:0">Выпало <b class="mono">${pc(roll)}</b>, а нужно было меньше <b class="mono">${pc(ch*100)}</b>. Ставка на ${nf(v)} кр сгорела.</p>
     ${items.length?`<div class="lostlist">${items.map(x=>slot(it(x.c))).join('')}</div>`:''}
     <div class="actions"><button class="btn pri" data-close>Ещё попытка</button></div></div>`);
  }
}

/* ===== ящики ===== */
function renderCases(){
  $('gCases').innerHTML=CASES.map(c=>`<button class="crate" data-case="${c.id}">${crateArt(c)}<span class="lbl">${c.code}</span><h3>${c.name}</h3>
   <p>${c.pool.length} предметов, самый дорогой — ${nf(Math.max(...c.pool.map(i=>i.price)))} кр</p><div class="ft">${pr(c.price)}<span class="btn pri" style="pointer-events:none">${S.bal<c.price?'Мало кредитов':'Открыть'}</span></div></button>`).join('');
}
function pick(c){let r=Math.random()*c.W;for(const i of c.pool){r-=c.w[i.id];if(r<=0)return i}return c.pool[c.pool.length-1]}
function caseModal(id){
  const c=CASES.find(x=>x.id===id);
  const odds=Object.keys(RAR).map(r=>{const w=c.pool.filter(i=>i.rar===r).reduce((s,i)=>s+c.w[i.id],0);return w?`<div style="--rc:${RAR[r].c}">${RAR[r].n}<b>${pc(w/c.W*100)}%</b></div>`:''}).join('');
  modal(`<div class="top"><div><span class="lbl">${c.code}</span><h2>${c.name}</h2></div><button class="x" data-close aria-label="Закрыть">✕</button></div>
   <div class="body"><div class="odds">${odds}</div>
    <div class="reel"><div class="pin"></div><div class="tape" id="tape">${Array.from({length:9},()=>slot(pick(c),{noPrice:1})).join('')}</div></div>
    <div class="actions" id="cact"><span class="msg"></span><button class="btn pri" data-open="${c.id}" ${S.bal<c.price?'disabled':''}>Открыть за ${nf(c.price)} кр</button></div>
    <div class="lbl sub">Содержимое</div><div class="grid">${[...c.pool].sort((a,b)=>b.price-a.price).map(i=>slot(i,{extra:`<div class="ft" style="margin-top:2px"><span class="wr">шанс</span><span class="chance">${pc(c.w[i.id]/c.W*100)}%</span></div>`})).join('')}</div></div>`);
}
function openCase(id){
  const c=CASES.find(x=>x.id===id); if(busy||S.bal<c.price)return;
  busy=true; S.bal-=c.price; renderBal(); snd('click');
  const won=pick(c),N=58,W=47,CW=140;
  const list=Array.from({length:N},(_,k)=>k===W?won:pick(c));
  const tp=$('tape'); tp.innerHTML=list.map(i=>slot(i,{noPrice:1})).join('');
  $('cact').innerHTML='<span class="msg lbl">Открываем…</span>';
  const box=tp.parentElement.clientWidth, off=W*CW+69.5-box/2+(Math.random()*100-50);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  tp.style.transition='none';tp.style.transform='translateX(0)';tp.getBoundingClientRect();
  tp.style.transition=`transform ${reduce?.1:6.2}s cubic-bezier(.06,.6,.08,1)`;tp.style.transform=`translateX(${-off}px)`;
  let last=-1;const trk=()=>{if(!busy)return;const m=new DOMMatrixReadOnly(getComputedStyle(tp).transform);const idx=Math.floor((-m.m41+box/2)/CW);if(idx!==last){last=idx;snd('tick')}requestAnimationFrame(trk)};
  if(!reduce)requestAnimationFrame(trk);
  setTimeout(()=>{
    busy=false; tp.children[W].classList.add('hit');
    const x=inst(won.id);S.inv.push(x);S.st.cases++;best(won.id);
    S.hist.unshift({k:'case',from:'Ящик «'+c.name+'»',to:won.skin,d:won.price-c.price,at:Date.now()});S.hist=S.hist.slice(0,100);save();
    renderCases();snd(won.price>=c.price?'win':'coin');feed(won.id,true);
    const w=wearOf(x.f);
    $('cact').innerHTML=`<span class="msg">${TYPES[won.type]} «${won.skin}» · <span class="mono" style="color:var(--muted);font-weight:400">${w[1]} ${x.f.toFixed(3)}</span> · ${pr(won.price)}</span>
      <button class="btn" data-sellu="${x.u}">Продать за ${nf(won.price*.9)} кр</button><button class="btn pri" data-open="${c.id}" ${S.bal<c.price?'disabled':''}>Ещё раз за ${nf(c.price)} кр</button>`;
  },reduce?200:6350);
}

/* ===== магазин, инвентарь, профиль ===== */
function renderShop(){
  const list=CAT.filter(i=>match(i,$('qShop').value)&&(!$('fShop').value||i.rar===$('fShop').value)).sort(sorter($('sShop').value));
  $('shopN').textContent=list.length+' позиций';
  $('gShop').innerHTML=list.length?list.map(i=>slot(i,{extra:`<div class="acts"><button class="pri" data-buy="${i.id}" ${S.bal<i.price?'disabled':''}>${S.bal<i.price?'Не хватает':'Купить'}</button></div>`})).join(''):'<div class="empty"><b>Ничего не найдено</b>Измените поиск или фильтр</div>';
}
function renderProfile(){
  const st=S.st,tot=S.inv.reduce((s,i)=>s+it(i.c).price,0),b=st.best!=null?it(st.best):null;
  $('stats').innerHTML=[['Баланс',nf(S.bal)+' кр'],['Инвентарь',nf(tot)+' кр'],['Апгрейдов',st.ups],['Удачных',st.ups?`${st.wins} · ${Math.round(st.wins/st.ups*100)}%`:'—'],['Ящиков',st.cases],['Лучший предмет',b?`<span style="color:${RAR[b.rar].c}">${b.skin}</span>`:'—']]
    .map(([a,v])=>`<div><span class="lbl">${a}</span><b>${v}</b></div>`).join('');
  const tm=t=>new Date(t).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  $('hist').innerHTML=S.hist.length?`<table class="log"><thead><tr><th>Время</th><th>Тип</th><th>Ставка</th><th>Предмет</th><th class="n">Шанс</th><th class="n">Итог, кр</th></tr></thead><tbody>${S.hist.slice(0,60).map(h=>`<tr>
     <td class="mono" style="color:var(--muted)">${tm(h.at)}</td>
     <td><span class="st ${h.k==='case'?'c':h.win?'w':'l'}">${h.k==='case'?'Ящик':h.win?'Успех':'Мимо'}</span></td>
     <td>${h.from}</td><td>${h.to}</td><td class="n">${h.ch!=null?pc(h.ch)+'%':'—'}</td>
     <td class="n ${h.d>=0?'pos':'neg'}">${h.d>=0?'+':'−'}${nf(Math.abs(h.d))}</td></tr>`).join('')}</tbody></table>`
    :'<div class="empty"><b>Журнал пуст</b>Здесь появятся апгрейды и открытые ящики</div>';
}
function best(c){if(S.st.best==null||it(c).price>it(S.st.best).price)S.st.best=c}
function renderPage(){
  document.querySelectorAll('#tabs button').forEach(b=>b.dataset.p===page?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!=='p-'+page);
  ({upgrade:renderUpgrade,cases:renderCases,shop:renderShop,profile:renderProfile})[page]();
}
function go(p){page=p;try{history.replaceState(null,'','#'+p)}catch(e){}renderPage();scrollTo({top:0})}

/* ===== окно и уведомления ===== */
function modal(h){$('modal').innerHTML=`<div class="shade" id="shade"><div class="win-box" role="dialog" aria-modal="true">${h}</div></div>`}
function closeModal(){if(busy)return;$('modal').innerHTML='';renderPage()}
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),2000)}

/* ===== лента ===== */
const NICKS=['kotletka','sh4dow','Мурзик','neonwolf','bublik_','zloy_ded','kira.v','vortex','tapok','m1rage','lis_a','frostbyte','anchous','dr4gon','pelmen','ghostik','solaris','Артём','Даня_','vlad1k'];
let FEED=[];
function feed(id,me){
  FEED.unshift({id,n:me?'вы':NICKS[Math.random()*NICKS.length|0],me});FEED=FEED.slice(0,22);
  $('feed').innerHTML=FEED.map((f,k)=>{const i=it(f.id);return `<div class="chip ${f.me?'me':''} ${k===0?'new':''}" style="--rc:${RAR[i.rar].c}" title="${f.n}: ${TYPES[i.type]} «${i.skin}»">${art(i)}<div><b>${i.skin}</b><span>${f.n}</span></div></div>`}).join('');
}
for(let k=0;k<18;k++)feed(pick(CASES[Math.random()*5|0]).id,false);
$('feed').querySelector('.new')?.classList.remove('new');
setInterval(()=>{if(!document.hidden)feed(pick(CASES[Math.random()*5|0]).id,false)},3200);

/* ===== события ===== */
document.addEventListener('click',e=>{
  if(e.target.id==='shade'){closeModal();return}
  const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.p){if(!busy)go(d.p);return}
  if('close' in d&&!d.sellu){closeModal();return}
  if(d.open){openCase(d.open);return}
  if(busy)return;
  if(d.sel){sel.has(d.sel)?sel.delete(d.sel):sel.add(d.sel);snd('click');if(target!=null&&it(target).price<=stakeVal())target=null;renderUpgrade()}
  else if(d.unsel){sel.delete(d.unsel);renderUpgrade()}
  else if(d.tgt!=null){target=+d.tgt;snd('click');renderUpgrade();if(innerWidth<1040)$('bench').scrollIntoView({behavior:'smooth',block:'start'})}
  else if(b.id==='untgt'){target=null;renderUpgrade()}
  else if(d.x){const v=stakeVal();if(!v){toast('Сначала соберите ставку');return}
    const want=v*+d.x,c=CAT.filter(i=>i.price>v&&v/i.price*EDGE>=.01).sort((a,b)=>Math.abs(a.price-want)-Math.abs(b.price-want))[0];
    if(c){target=c.id;renderUpgrade()}else toast('Нет подходящих целей')}
  else if(d.coin){coin=d.coin==='max'?S.bal:d.coin==='half'?Math.floor(coin/2):Math.min(S.bal,Math.max(1,coin*2));$('coin').value=coin;renderUpgrade()}
  else if(d.case)caseModal(d.case);
  else if(d.buy!=null){const i=it(+d.buy);if(S.bal<i.price)return;S.bal-=i.price;S.inv.push(inst(i.id));save();renderBal();renderShop();snd('coin');toast(`Куплено: ${i.skin}`)}
  else if(d.sellu){const x=S.inv.find(i=>i.u===d.sellu);if(!x)return;const p=Math.floor(it(x.c).price*.9);S.bal+=p;S.inv=S.inv.filter(i=>i!==x);sel.delete(d.sellu);save();renderBal();snd('coin');toast(`Продано за ${nf(p)} кр`);
    if(d.after==='close')closeModal();else if($('cact')){b.disabled=true;b.textContent='Продано';renderCases()}else renderPage()}
});
$('go').onclick=spin;
$('clrSel').onclick=()=>{if(busy)return;sel.clear();coin=0;$('coin').value=0;renderUpgrade()};
$('coin').addEventListener('input',e=>{coin=Math.max(0,Math.min(S.bal,Math.floor(+e.target.value||0)));renderUpgrade()});
$('coin').addEventListener('change',e=>{e.target.value=coin});
['qInv','sInv','qTgt'].forEach(id=>$(id).addEventListener('input',renderUpgrade));
['qShop','fShop','sShop'].forEach(id=>$(id).addEventListener('input',renderShop));
$('fShop').insertAdjacentHTML('beforeend',Object.entries(RAR).map(([k,r])=>`<option value="${k}">${r.n}</option>`).join(''));
$('snd').onclick=()=>{S.sound=!S.sound;save();sndIcon();snd('click')};
function confirmBtn(b,label,orig,fn){if(!b.dataset.arm){b.dataset.arm=1;b.textContent=label;setTimeout(()=>{delete b.dataset.arm;b.textContent=orig},3000);return}delete b.dataset.arm;b.textContent=orig;fn()}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('modal').innerHTML)closeModal()});

/* ===== старт ===== */
scaleSvg();sndIcon();$('bal').textContent=nf(S.bal);
const h=location.hash.slice(1);if(['upgrade','cases','shop','profile'].includes(h))page=h;
renderPage();
function loadFromServer(){fetch('/api/upgrader').then(r=>r.json()).then(d=>{if(d.error){location.href='/login';return}if(d.state&&Array.isArray(d.state.inv))S=d.state;S.bal=d.balance;sel.clear();const up=new URLSearchParams(location.search).get('up');if(up){if(S.inv.some(i=>i.u===up)){sel.add(up);page='upgrade'}history.replaceState(null,'',location.pathname+'#'+page)}shown=S.bal;$('bal').textContent=nf(S.bal);renderPage()})}
loadFromServer();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)loadFromServer()});
