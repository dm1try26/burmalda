/* Внешний вид предметов: узор каждого скина и функция, которая рисует иконку.
   Нужен на странице апгрейдера и в личном кабинете. Требует data.js и блок #defs с иконками. */

const art=i=>`<svg viewBox="0 0 120 60"><use href="#i-${i.type}" fill="url(#f${i.id})"/></svg>`;
document.getElementById('defs').insertAdjacentHTML('beforeend',CAT.map(i=>{
  const s=8+(i.id%4)*2;
  if(i.pat===0)return `<pattern id="f${i.id}" patternUnits="userSpaceOnUse" width="${s}" height="${s}" patternTransform="rotate(${30+i.id*17%60})"><rect width="${s}" height="${s}" fill="${i.c1}"/><rect width="${s*.4}" height="${s}" fill="${i.c2}"/></pattern>`;
  if(i.pat===1){let h=`<pattern id="f${i.id}" patternUnits="userSpaceOnUse" width="40" height="30"><rect width="40" height="30" fill="${i.c1}"/>`;let x=i.id*7+3;for(let k=0;k<6;k++){x=(x*37+11)%97;h+=`<ellipse cx="${x%40}" cy="${(x*3)%30}" rx="${5+x%6}" ry="${3+x%4}" fill="${i.c2}" opacity="${k%2?.9:.6}"/>`}return h+'</pattern>'}
  return `<linearGradient id="f${i.id}" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stop-color="${i.c2}"/><stop offset=".5" stop-color="${i.c1}"/><stop offset="1" stop-color="${i.c2}"/></linearGradient>`;
}).join(''));
