(function(){
const {gebouwen:G, glasobjecten:O}=window.DATA;
const gById=Object.fromEntries(G.map(g=>[g.gebouwid,g]));
const oByG={};O.forEach(o=>(oByG[o.gebouwid]=oByG[o.gebouwid]||[]).push(o));
G.forEach(g=>g._n=(oByG[g.gebouwid]||[]).length);
const OF=['Datering','Circa ja/nee','Soort glas','Twijfel ja/nee','Kleur','Details_01','Details _02','Product/Producent','Ontwerper','Plaatsing','Foto?'];
const GF=['Plaats','Straat','Huisnr','Provincie','Pand','Monumentnr'];
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const val=v=>v==null||v===''?'<span class="muted">–</span>':esc(v);
const uniq=(a,f)=>[...new Set(a.map(f).filter(x=>x!=null&&x!==''))].sort((x,y)=>String(x).localeCompare(String(y),'nl'));
const adres=g=>[g.Straat,g.Huisnr].filter(x=>x!=null).join(' ');
const gName=g=>g.Pand||adres(g)||g.Plaats;
const oName=o=>'Glasobject '+o.objectid;
const ol=o=>'<a href="#/object/'+o.objectid+'">'+o.objectid+'</a>';
const gl=g=>'<a href="#/gebouw/'+g.gebouwid+'">'+esc(gName(g))+'</a>';
const monLink=g=>g.Monumentnr?'<a href="https://monumentenregister.cultureelerfgoed.nl/monumenten/'+g.Monumentnr+'" target="_blank" rel="noopener">'+g.Monumentnr+'</a>':null;
const dl=rows=>'<dl class="det">'+rows.map(([k,v,raw])=>'<dt>'+esc(k)+'</dt><dd>'+(raw?(v||'<span class="muted">–</span>'):val(v))+'</dd>').join('')+'</dl>';

// generieke tabel + filters
function overview(title,rows,cols,filters){
  const m=$('#main');
  m.innerHTML='<h1>'+title+'</h1><form class="filters" id="f"></form><p class="count" id="c"></p><div class="tw"><table><thead></thead><tbody></tbody></table></div>';
  const f=$('#f');
  f.innerHTML=filters.map((x,i)=>'<label>'+x.l+(x.t?'<input type="search" data-i="'+i+'" placeholder="zoeken…">':'<select data-i="'+i+'"><option value="">Alle</option>'+x.opts.map(o=>'<option>'+esc(o)+'</option>').join('')+'</select>')+'</label>').join('')+'<button type="button" id="rst">Wis filters</button>';
  let sk=null,sd=1;
  const th=$('thead');
  th.innerHTML='<tr>'+cols.map((c,i)=>'<th data-i="'+i+'">'+c.l+'</th>').join('')+'</tr>';
  function draw(){
    const vs=[...f.querySelectorAll('[data-i]')].map(e=>e.value.toLowerCase());
    let r=rows.filter(x=>filters.every((fl,i)=>{const v=vs[i];if(!v)return true;const d=fl.get(x);return fl.t?String(d).toLowerCase().includes(v):String(d).toLowerCase()===v}));
    if(sk!=null){const g=cols[sk].s;r=r.slice().sort((a,b)=>{const x=g(a),y=g(b);return (typeof x=='number'&&typeof y=='number'?x-y:String(x??'').localeCompare(String(y??''),'nl'))*sd})}
    $('#c').textContent=r.length+' van '+rows.length+' getoond';
    $('tbody').innerHTML=r.map(x=>'<tr>'+cols.map(c=>'<td>'+c.h(x)+'</td>').join('')+'</tr>').join('');
    th.querySelectorAll('th').forEach((e,i)=>{e.className=i===sk?'s'+(sd<0?' d':''):''});
  }
  f.addEventListener('input',draw);
  $('#rst').onclick=()=>{f.reset();draw()};
  th.onclick=e=>{const i=e.target.dataset.i;if(i==null)return;sd=sk==+i?-sd:1;sk=+i;draw()};
  draw();
}

const views={
objecten(){
  overview('Glasobjecten',O,[
    {l:'objectid',h:o=>ol(o),s:o=>o.objectid},
    {l:'Soort glas',h:o=>val(o['Soort glas']),s:o=>o['Soort glas']},
    {l:'Gebouw',h:o=>gl(gById[o.gebouwid]),s:o=>gName(gById[o.gebouwid])},
    {l:'Kleur',h:o=>val(o.Kleur),s:o=>o.Kleur},
    {l:'Datering',h:o=>val(o.Datering),s:o=>o.Datering},
    {l:'Ontwerper',h:o=>val(o.Ontwerper),s:o=>o.Ontwerper},
    {l:'Foto?',h:o=>val(o['Foto?']),s:o=>o['Foto?']}
  ],[
    {l:'Zoeken',t:1,get:o=>Object.values(o).concat(Object.values(gById[o.gebouwid])).join(' ')},
    {l:'Soort glas',opts:uniq(O,o=>o['Soort glas']),get:o=>o['Soort glas']},
    {l:'Kleur',opts:uniq(O,o=>o.Kleur),get:o=>o.Kleur},
    {l:'Foto?',opts:uniq(O,o=>o['Foto?']),get:o=>o['Foto?']},
    {l:'Twijfel?',opts:uniq(O,o=>o['Twijfel ja/nee']),get:o=>o['Twijfel ja/nee']}
  ]);
},
gebouwen(){
  overview('Gebouwen',G,[
    {l:'Pand',h:g=>gl(g),s:g=>gName(g)},
    {l:'Plaats',h:g=>val(g.Plaats),s:g=>g.Plaats},
    {l:'Adres',h:g=>val(adres(g)),s:g=>adres(g)},
    {l:'Provincie',h:g=>val(g.Provincie),s:g=>g.Provincie},
    {l:'Monumentnr',h:g=>g.Monumentnr?monLink(g):val(),s:g=>g.Monumentnr||0},
    {l:'Glasobjecten',h:g=>'<span class="pill">'+g._n+'</span>',s:g=>g._n}
  ],[
    {l:'Zoeken',t:1,get:g=>Object.values(g).join(' ')},
    {l:'Provincie',opts:uniq(G,g=>g.Provincie),get:g=>g.Provincie},
    {l:'Plaats',opts:uniq(G,g=>g.Plaats),get:g=>g.Plaats},
    {l:'Monument?',opts:['ja','nee'],get:g=>g.Monumentnr?'ja':'nee'},
    {l:'Aantal glasobjecten',opts:uniq(G,g=>g._n).sort((a,b)=>a-b),get:g=>g._n}
  ]);
},
object(id){
  const o=O.find(x=>x.objectid==id);if(!o)return nf();
  const g=gById[o.gebouwid],sib=(oByG[g.gebouwid]||[]).filter(x=>x!==o);
  $('#main').innerHTML='<p class="crumbs"><a href="#/objecten">Glasobjecten</a> › '+oName(o)+'</p><h1>'+esc(oName(o))+'</h1>'
   +'<h2>Glasobject</h2>'+dl([['objectid',o.objectid],['gebouwid',o.gebouwid]].concat(OF.map(k=>[k,o[k]])))
   +'<h2>Gebouw</h2>'+dl([['Pand',gl(g),1]].concat(GF.filter(k=>k!='Pand'&&k!='Monumentnr').map(k=>[k,g[k]]),[['Monumentnr',monLink(g),1]]))
   +'<h2>Andere glasobjecten in dit gebouw</h2>'
   +(sib.length?'<ul>'+sib.map(x=>'<li>'+ol(x)+(x['Soort glas']?' – '+esc(x['Soort glas']):'')+(x.Kleur?', '+esc(x.Kleur):'')+(x.Plaatsing?' ('+esc(x.Plaatsing)+')':'')+'</li>').join('')+'</ul>':'<p class="muted">Dit is het enige glasobject in dit gebouw.</p>');
},
gebouw(id){
  const g=gById[id];if(!g)return nf();
  const os=oByG[g.gebouwid]||[];
  $('#main').innerHTML='<p class="crumbs"><a href="#/gebouwen">Gebouwen</a> › gebouwid '+g.gebouwid+'</p><h1>'+esc(gName(g))+'</h1>'
   +dl([['gebouwid',g.gebouwid]].concat(GF.map(k=>k=='Monumentnr'?[k,monLink(g),1]:[k,g[k]])))
   +'<h2>Glasobjecten in dit gebouw <span class="pill">'+os.length+'</span></h2>'
   +(os.length?'<div class="tw"><table><thead><tr><th>objectid</th><th>Soort glas</th><th>Kleur</th><th>Datering</th><th>Plaatsing</th><th>Ontwerper</th></tr></thead><tbody>'
     +os.map(o=>'<tr><td>'+ol(o)+'</td><td>'+val(o['Soort glas'])+'</td><td>'+val(o.Kleur)+'</td><td>'+val(o.Datering)+'</td><td>'+val(o.Plaatsing)+'</td><td>'+val(o.Ontwerper)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Geen glasobjecten.</p>');
}};
function nf(){$('#main').innerHTML='<h1>Niet gevonden</h1><p><a href="#/objecten">Naar het overzicht</a></p>'}
function route(){
  const [,r,id]=(location.hash||'#/objecten').split('/');
  const k=views[r]?r:'objecten';
  (views[r]||views.objecten)(id);
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.r==(k=='object'?'objecten':k=='gebouw'?'gebouwen':k)));
  window.scrollTo(0,0);
}
addEventListener('hashchange',route);route();
})();
