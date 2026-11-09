/* Glas in gebouwen — buildless, dependency-free interface. Leaflet loads on demand. */
(() => {
  'use strict';
  const D = window.GLAS_DATA;
  const main = document.getElementById('main');
  if (!D) { main.innerHTML = '<h1>Gegevens niet geladen</h1><p>Plaats de map data naast index.html en vernieuw de pagina.</p>'; return; }
  const buildings = new Map(D.gebouwen.map(b => [b.id, b]));
  const objects = new Map(D.glasobjecten.map(o => [o.id, o]));
  const children = new Map(D.gebouwen.map(b => [b.id, []]));
  D.glasobjecten.forEach(o => children.get(o.gebouw_id).push(o));
  const collator = new Intl.Collator('nl', {numeric: true, sensitivity: 'base'});
  const fmt = n => new Intl.NumberFormat('nl-NL').format(n);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl');
  const has = v => v !== null && v !== undefined && v !== '';
  const display = v => has(v) ? esc(v) : '<span class="missing">Niet ingevuld</span>';
  const name = b => b.naam || 'Naam niet ingevuld';
  const heading = b => b.naam || b.adres || `Gebouw ${b.id}`;
  const bhref = id => `#gebouw/${encodeURIComponent(id)}`;
  const ohref = id => `#glasobject/${encodeURIComponent(id)}`;
  const listFor = id => `#glasobjecten?gebouw=${encodeURIComponent(id)}`;
  const paths = {
    building: '<path d="M4 21V5l8-3 8 3v16M2 21h20M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1"/>',
    glass: '<path d="M5 21V10a7 7 0 0 1 14 0v11ZM12 3v18M5 13h14M7 6l12 15M17 6 5 21"/>',
    relation: '<rect x="2" y="8" width="6" height="8" rx="1"/><rect x="16" y="2" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M8 12h4V5h4M12 12v7h4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15M15 6v15"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    key: '<circle cx="8" cy="8" r="5"/><path d="m11.5 11.5 9 9M16 16l3-3M18 18l3-3"/>'
  };
  const icon = key => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[key] || paths.info}</svg>`;
  document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
  document.getElementById('nav-b-count').textContent = fmt(D.gebouwen.length);
  document.getElementById('nav-o-count').textContent = fmt(D.glasobjecten.length);
  const key = (id, foreign = false) => `<code class="key-code${foreign ? ' foreign' : ''}">${esc(id)}</code>`;
  const keyLabel = foreign => `<span class="key-label${foreign ? ' foreign' : ''}" title="${foreign ? 'Vreemde sleutel (foreign key)' : 'Primaire sleutel (primary key)'}">${foreign ? 'FK' : 'PK'}</span>`;
  const provenance = b => b.herkomst === 'afgeleid' ? '<span class="badge derived">Voorlopig</span>' : '<span class="badge">Bronbestand</span>';
  const matchBadge = o => ({naam_en_adres:'<span class="badge exact">Naam + adres</span>',naamsvariant:'<span class="badge suggested">Koppelvoorstel</span>',afgeleid_gebouw:'<span class="badge derived">Voorlopig gebouw</span>'})[o.koppeling];
  const count = (n, id) => n ? `<a class="count-pill" href="${listFor(id)}" aria-label="Bekijk ${n} glasobjecten van ${esc(heading(buildings.get(id)))}">${n} <span aria-hidden="true">↗</span></a>` : '<span class="count-zero" title="Geen glasobjecten gekoppeld in deze dataset">0</span>';
  const safeUrl = v => { try {const u = new URL(String(v).startsWith('www.') ? 'https://' + v : v); return ['https:','http:'].includes(u.protocol) ? u.href : null;} catch {return null;} };
  const defaults = type => type === 'gebouwen'
    ? {q:'',plaats:'',relatie:'',herkomst:'',status:'',sort:'aantal_glasobjecten',dir:'desc',page:1,size:20}
    : {q:'',gebouw:'',techniek:'',van:'',tot:'',koppeling:'',jaarstatus:'',sort:'id',dir:'asc',page:1,size:20};
  const states = {gebouwen:defaults('gebouwen'),glasobjecten:defaults('glasobjecten')};
  let route = {type:'gebouwen',id:null};
  let currentRows = [];
  let exampleId = 'G0005';
  let lastListRoute = '#gebouwen';
  let leafletPromise, map, markerLayer, mapBounds;
  const searchableB = new Map(D.gebouwen.map(b=>[b.id,norm([b.id,b.naam,b.adres,b.plaats,b.architect,b.rce,b.bag,b.bron].join(' '))]));
  const searchableO = new Map(D.glasobjecten.map(o=>[o.id,norm([o.id,o.naam,o.gebouw_id,heading(buildings.get(o.gebouw_id)),buildings.get(o.gebouw_id).adres,o.jaar,o.kunstenaar,o.ontwerper,o.atelier,o.thema,o.gebouwdeel,...o.technieken,...Object.values(o.source)].join(' '))]));

  function breadcrumbs(items) {
    return `<div class="breadcrumb"><a href="#gebouwen">Collectie</a>${items.map(([label,url])=>`<span class="chev" aria-hidden="true">/</span>${url ? `<a href="${url}">${esc(label)}</a>` : `<span>${esc(label)}</span>`}`).join('')}</div>`;
  }
  function metrics() {
    return `<section class="metrics" aria-label="Overzicht van de volledige dataset">
      <div class="metric"><span class="metric-symbol">${icon('building')}</span><div><strong>${fmt(D.gebouwen.length)}<span>gebouwen</span></strong><small>${fmt(D.meta.bron_gebouwen)} uit de bron · ${D.meta.afgeleide_gebouwen} voorlopig</small></div></div>
      <div class="metric"><span class="metric-symbol">${icon('glass')}</span><div><strong>${fmt(D.glasobjecten.length)}<span>glasobjecten</span></strong><small>Verdeeld over ${D.koppelingen.length} gebouwen</small></div></div>
      <div class="metric relationship"><span class="metric-symbol">${icon('relation')}</span><div><strong>1 : n <span>één-op-veel</span></strong><small>Gebouw is parent · glasobject is child</small></div></div></section>`;
  }
  const opt = (value,label,selected) => `<option value="${esc(value)}"${value===selected?' selected':''}>${esc(label)}</option>`;
  function selectField(id,label,value,options,first) {
    return `<div class="field"><label for="filter-${id}">${label}</label><select id="filter-${id}" name="${id}">${opt('',first,value)}${options.map(([v,l])=>opt(v,l,value)).join('')}</select></div>`;
  }
  function filters(type) {
    const s = states[type];
    const q = `<div class="field"><label for="filter-q">Zoeken in ${type}</label><div class="input-shell">${icon('search')}<input id="filter-q" name="q" type="search" value="${esc(s.q)}" placeholder="${type==='gebouwen'?'Zoek op naam, adres, plaats of ID…':'Zoek op object, kunstenaar, thema of ID…'}" autocomplete="off"></div></div>`;
    let primary, more;
    if (type==='gebouwen') {
      const places = [...new Set(D.gebouwen.map(b=>b.plaats).filter(Boolean))].sort(collator.compare);
      primary = q + selectField('plaats','Plaats (afgeleid)',s.plaats,places.map(p=>[p,p]),'Alle plaatsen') + selectField('relatie','Gekoppelde glasobjecten',s.relatie,[['met','Met glasobjecten'],['zonder','Zonder glasobjecten']],'Alle gebouwen');
      more = selectField('herkomst','Herkomst gebouw',s.herkomst,[['bronbestand','Uit gebouwenbestand'],['afgeleid','Voorlopig, uit glasobjecten']],'Alle herkomsten') + selectField('status','Status in bronbestand',s.status,[...new Set(D.gebouwen.map(b=>b.status).filter(Boolean))].map(v=>[v,v]),'Alle statussen');
    } else {
      const linked = D.gebouwen.filter(b=>b.aantal_glasobjecten).sort((a,b)=>collator.compare(heading(a),heading(b)));
      const techniques = [...new Set(D.glasobjecten.flatMap(o=>o.technieken).filter(Boolean))].sort(collator.compare);
      primary = q + selectField('gebouw','Gebouw (parent)',s.gebouw,linked.map(b=>[b.id,heading(b)]),'Alle gebouwen') + selectField('techniek','Glastechniek / eigenschap',s.techniek,techniques.map(t=>[t,t]),'Alle technieken');
      more = `<div class="field"><label for="filter-van">Ontstaan vanaf jaar</label><input id="filter-van" name="van" type="number" step="1" min="1" max="2100" placeholder="Bijv. 1900" value="${esc(s.van)}"></div><div class="field"><label for="filter-tot">Ontstaan tot en met jaar</label><input id="filter-tot" name="tot" type="number" step="1" min="1" max="2100" placeholder="Bijv. 2000" value="${esc(s.tot)}"></div>` + selectField('koppeling','Koppelmethode',s.koppeling,[['naam_en_adres','Naam en adres'],['naamsvariant','Koppelvoorstel (naamsvariant)'],['afgeleid_gebouw','Voorlopig gebouw']],'Alle koppelingen') + selectField('jaarstatus','Datering',s.jaarstatus,[['bekend','Jaar ingevuld'],['leeg','Jaar niet ingevuld'],['controle','Bronwaarde 999 (controleren)']],'Alle dateringen');
    }
    const open = type==='gebouwen' ? s.herkomst||s.status : s.van||s.tot||s.koppeling||s.jaarstatus;
    return `<form id="filters" data-filter-form="${type}" role="search"><div class="filters">${primary}</div><details class="filters-more"${open?' open':''}><summary>Meer filters</summary><div class="filters">${more}</div></details></form>`;
  }
  function filtered(type) {
    const s = states[type], words = norm(s.q).split(/\s+/).filter(Boolean);
    let rows = type==='gebouwen' ? D.gebouwen.filter(b=>
      words.every(w=>searchableB.get(b.id).includes(w)) && (!s.plaats||b.plaats===s.plaats) &&
      (!s.relatie||(s.relatie==='met'?b.aantal_glasobjecten>0:b.aantal_glasobjecten===0)) &&
      (!s.herkomst||b.herkomst===s.herkomst) && (!s.status||b.status===s.status))
      : D.glasobjecten.filter(o=>words.every(w=>searchableO.get(o.id).includes(w)) &&
      (!s.gebouw||o.gebouw_id===s.gebouw) && (!s.techniek||o.technieken.includes(s.techniek)) &&
      (!s.koppeling||o.koppeling===s.koppeling) &&
      (!s.van||(has(o.jaar)&&o.jaar>=Number(s.van))) && (!s.tot||(has(o.jaar)&&o.jaar<=Number(s.tot))) &&
      (!s.jaarstatus||(s.jaarstatus==='bekend'?has(o.jaar):s.jaarstatus==='leeg'?!has(o.jaar):o.jaar_controle)));
    const value = r=> s.sort==='gebouw' ? heading(buildings.get(r.gebouw_id)) : s.sort==='techniek' ? r.technieken.filter(Boolean).join(' ') : r[s.sort];
    rows.sort((a,b)=>{const av=value(a),bv=value(b); if(!has(av)&&has(bv))return 1;if(has(av)&&!has(bv))return -1;const n=typeof av==='number'&&typeof bv==='number'?av-bv:collator.compare(String(av??''),String(bv??''));return (s.dir==='desc'?-n:n)||collator.compare(a.id,b.id);});
    return rows;
  }
  function column(label,id,type,extra='') {
    const s=states[type], active=s.sort===id;
    return `<th scope="col" aria-sort="${active?(s.dir==='asc'?'ascending':'descending'):'none'}"><button class="sort-button${active?' sorted':''}" data-sort="${id}">${label}${extra}<span aria-hidden="true">${active?(s.dir==='asc'?'↑':'↓'):'↕'}</span></button></th>`;
  }
  function buildingRows(rows) {
    return rows.map(b=>`<tr><td><a href="${bhref(b.id)}">${key(b.id)}</a></td><td class="cell-name"><a href="${bhref(b.id)}" class="record-link${b.naam?'':' name-missing'}">${esc(name(b))}</a><span class="subtext">${b.rce?'RCE '+esc(b.rce):b.herkomst==='afgeleid'?'Afgeleid uit glasobjecten':'Gebouw uit bronbestand'}</span></td><td class="cell-address">${display(b.adres)}</td><td class="cell-place">${display(b.plaats)}</td><td>${count(b.aantal_glasobjecten,b.id)}</td><td>${provenance(b)}</td></tr>`).join('');
  }
  function objectRows(rows, withBuilding=true) {
    return rows.map(o=>{const b=buildings.get(o.gebouw_id);return `<tr><td><a href="${ohref(o.id)}">${key(o.id)}</a></td><td class="cell-name"><a href="${ohref(o.id)}" class="record-link">${esc(o.naam||'Naam niet ingevuld')}</a><span class="subtext">${esc(o.gebouwdeel||'Gebouwdeel niet ingevuld')}${o.kunstenaar?' · '+esc(o.kunstenaar):''}</span></td>${withBuilding?`<td class="cell-name"><a href="${bhref(b.id)}" class="record-link">${esc(heading(b))}</a><span class="subtext">${key(b.id,true)}</span></td>`:`<td>${key(b.id,true)}</td>`}<td class="nowrap">${display(o.jaar)}${o.jaar_controle?'<span class="subtext">Controleer bronwaarde</span>':''}</td><td>${o.technieken.filter(Boolean).length?`<span class="technique">${esc(o.technieken.find(Boolean))}</span><span class="subtext">${esc(o.technieken.filter(Boolean).slice(1).join(' · '))}</span>`:'<span class="missing">Niet ingevuld</span>'}</td></tr>`;}).join('');
  }
  function listPage(type) {
    const isB=type==='gebouwen', title=isB?'Gebouwen':'Glasobjecten';
    const description=isB?'Begin bij een gebouw en ontdek welke glasobjecten eraan gekoppeld zijn.':'Bekijk de glasobjecten en volg de verwijzing naar het bijbehorende gebouw.';
    main.innerHTML=breadcrumbs([[title]])+`<div class="page-heading"><div><p class="eyebrow">${isB?'DE PARENTTABEL':'DE CHILDTABEL'}</p><h1>${title}</h1><p>${description}</p></div><button class="button" data-action="map">${icon('map')} Toon kaart</button></div>`+metrics()+
      `<section class="collection-panel" aria-labelledby="table-title"><div class="panel-heading"><div><h2 id="table-title">Alle ${type}<small>${isB?'Eén rij per gebouw':'Eén rij per glasobject'}</small></h2></div><div class="panel-heading-actions"><button class="button" data-action="export">${icon('download')} CSV</button></div></div>${filters(type)}<div class="filter-state"><span id="result-count" aria-live="polite"></span><button class="text-button" data-action="reset">Wis filters</button></div><div id="results"></div></section>
      <p class="context-note">${icon('info')}<span>${isB?'Het aantal glasobjecten telt de gekoppelde records in deze dataset. Een 0 betekent niet dat een gebouw geen historisch glas bevat.':'De vreemde sleutel (FK) verwijst naar de primaire sleutel (PK) van het gebouw. Klik op een naam of ID om de relatie te volgen.'} <a href="#${isB?'verantwoording':'relaties'}">${isB?'Over de gegevens':'Zo werkt de koppeling'} →</a></span></p>`;
    updateResults();
  }
  function updateResults() {
    const type=route.type,s=states[type];
    if(!s)return;
    currentRows=filtered(type);
    const total=type==='gebouwen'?D.gebouwen.length:D.glasobjecten.length;
    const max=Math.max(1,Math.ceil(currentRows.length/s.size));s.page=Math.max(1,Math.min(s.page,max));
    const start=(s.page-1)*s.size,rows=currentRows.slice(start,start+s.size);
    let message=`<strong>${fmt(currentRows.length)}</strong> van ${fmt(total)} ${type}`;
    if(type==='glasobjecten'&&s.van&&s.tot&&Number(s.van)>Number(s.tot))message='Het beginjaar ligt na het eindjaar. Pas het jaarbereik aan.';
    document.getElementById('result-count').innerHTML=message;
    const columns=type==='gebouwen'
      ? column('Gebouw-ID','id',type,keyLabel(false))+column('Gebouw','naam',type)+column('Adres','adres',type)+column('Plaats','plaats',type)+column('Glasobjecten','aantal_glasobjecten',type)+column('Herkomst','herkomst',type)
      : column('Object-ID','id',type,keyLabel(false))+column('Glasobject','naam',type)+column('Gebouw','gebouw',type,keyLabel(true))+column('Jaar','jaar',type)+column('Techniek','techniek',type);
    document.getElementById('results').innerHTML=`<div class="table-wrap"><table class="data-table" aria-label="${type==='gebouwen'?'Gebouwen':'Glasobjecten'}"><thead><tr>${columns}</tr></thead><tbody>${rows.length?(type==='gebouwen'?buildingRows(rows):objectRows(rows)):`<tr><td colspan="${type==='gebouwen'?6:5}" class="empty"><strong>Geen ${type} gevonden</strong>Probeer een andere zoekterm of wis de filters.</td></tr>`}</tbody></table></div><div class="pagination"><span>${rows.length?`${fmt(start+1)}–${fmt(start+rows.length)} van ${fmt(currentRows.length)}`:'0 resultaten'}<span class="nowrap"> · <label for="page-size">Per pagina</label> <select id="page-size">${[20,50,100].map(n=>`<option value="${n}"${n===s.size?' selected':''}>${n}</option>`).join('')}</select></span></span><div class="pagination-controls"><button data-page="${s.page-1}"${s.page===1?' disabled':''} aria-label="Vorige pagina">← Vorige</button><span>Pagina ${s.page} / ${max}</span><button data-page="${s.page+1}"${s.page===max?' disabled':''} aria-label="Volgende pagina">Volgende →</button></div></div>`;
    storeRoute();
  }
  function storeRoute() {
    if(!states[route.type])return;
    const s=states[route.type],base=defaults(route.type),p=new URLSearchParams();
    for(const [k,v]of Object.entries(s))if(v!==base[k]&&v!=='')p.set(k,String(v));
    const hash='#'+route.type+(p.size?'?'+p:'');
    history.replaceState(null,'',hash);lastListRoute=hash;
  }
  function fact(label,value,full=false) { return `<div${full?' class="full"':''}><dt>${esc(label)}</dt><dd>${display(value)}</dd></div>`; }
  function rawFields(source,kind) {
    if(!Object.keys(source).length)return `<details class="source-details"><summary>Herkomst van dit voorlopige gebouw</summary><p>Dit record bestaat niet als afzonderlijke rij in het gebouwenbestand. Naam en adres zijn overgenomen uit de gekoppelde glasobjecten. Bij meerdere adressen is de meest voorkomende schrijfwijze gebruikt; de locatie is de mediaan van de beschikbare afgeleide objectlocaties. De oorspronkelijke velden zijn per glasobject in te zien.</p></details>`;
    return `<details class="source-details"><summary>Alle oorspronkelijke bronvelden (${Object.keys(source).length})</summary><p>De aangeleverde waarden uit het ${kind==='gebouw'?'gebouwenbestand':'glasobjectenbestand'}. Lege cellen blijven leeg. De nieuwe relationele sleutels zijn apart toegevoegd.</p><div class="table-wrap"><table class="source-table"><tbody>${Object.entries(source).map(([k,v])=>`<tr><th scope="row">${esc(k)}</th><td>${has(v)?esc(v):'<span class="missing">Leeg in bron</span>'}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
  function sourceLinks(source) {
    const links=Object.entries(source).filter(([k,v])=>/url|url_extra_info/i.test(k)&&has(v)).map(([k,v])=>[k,safeUrl(v)]).filter(([,v])=>v);
    return links.length?`<div class="source-links">${links.map(([k,v])=>`<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc(k.replace(/ URL$/,'').replace('url_extra_info','Extra informatie'))} ↗</a>`).join('')}</div>`:'';
  }
  function objectTable(rows,withBuilding=false) {
    return `<div class="table-wrap"><table class="data-table" aria-label="Gekoppelde glasobjecten"><thead><tr><th scope="col">Object-ID ${keyLabel(false)}</th><th scope="col">Glasobject</th><th scope="col">Gebouw-ID ${keyLabel(true)}</th><th scope="col">Jaar</th><th scope="col">Techniek</th></tr></thead><tbody>${objectRows(rows,withBuilding)}</tbody></table></div>`;
  }
  function buildingDetail(id) {
    const b=buildings.get(id);if(!b){notFound('Gebouw');return;}
    const cs=children.get(id),suggested=cs.some(o=>o.koppeling==='naamsvariant');
    main.innerHTML=breadcrumbs([['Gebouwen','#gebouwen'],[heading(b)]])+`<a href="${esc(lastListRoute.startsWith('#gebouwen')?lastListRoute:'#gebouwen')}" class="back-link">← Terug naar de gebouwen</a><div class="page-heading"><div><p class="eyebrow">GEBOUW · PARENT</p><h1>${esc(heading(b))}</h1><p>${esc(b.adres||'Adres niet ingevuld')}</p><div class="detail-meta">${key(b.id)} ${keyLabel(false)} ${provenance(b)}<span class="inline-note">Primaire sleutel van dit gebouw</span></div></div><button class="button" data-action="map"${b.positie?'':' disabled'}>${icon('map')} ${b.positie?'Toon op kaart':'Geen kaartlocatie'}</button></div>
      ${b.herkomst==='afgeleid'?`<p class="info-note"><strong>Voorlopig gebouw.</strong> ${esc(b.herkomst_uitleg)} <a href="#verantwoording">Bekijk de verantwoording.</a></p>`:''}
      ${suggested?'<p class="info-note purple"><strong>Koppelvoorstel.</strong> De glasobjecten noemen “St Servaas (Maastricht)”. De koppeling met deze basiliek is afgeleid uit de naam, plaats en indicatieve locatie en moet nog inhoudelijk worden bevestigd.</p>':''}
      <div class="detail-layout"><section class="card"><h2>Gebouwgegevens</h2><dl class="facts">${fact('Gebouwnaam',b.naam,true)}${fact('Adres',b.adres,true)}${fact('Plaats (afgeleid uit naam of adres)',b.plaats)}${fact('Gemeente (bron)',b.gemeente)}${fact('Provincie (bron)',b.provincie)}${fact('Architect',b.architect)}${fact('RCE-nummer',b.rce)}${fact('BAG pand-ID (bronwaarde)',b.bag)}${fact('Status in bronbestand',b.status)}${fact('Aantal ramen volgens bron',b.aantal_ramen_bron)}</dl>${sourceLinks(b.source)}</section>
      <section class="card relation-card"><p class="eyebrow">ZO ZIJN DE RECORDS VERBONDEN</p><h2>Van gebouw naar glasobject</h2><div class="relation-stack"><div class="entity"><span class="entity-type">Gebouw · parent</span>${key(b.id)}${keyLabel(false)}<a class="record-link" href="${bhref(b.id)}">${esc(heading(b))}</a></div><div class="relation-connector"><strong>1 → ${cs.length}</strong> ${cs.length===1?'gekoppeld glasobject':'gekoppelde glasobjecten'}</div><div class="entity"><span class="entity-type">Glasobject · child</span>${cs.length?`${key(b.id,true)}${keyLabel(true)}<span class="subtext">Elk van deze ${cs.length} records verwijst via <code>gebouw_id</code> naar ditzelfde gebouw.</span><a class="record-link" href="${listFor(b.id)}">Bekijk ${cs.length===1?'het glasobject':'alle '+cs.length+' glasobjecten'} →</a>`:'<span class="subtext">In deze dataset zijn nog geen glasobjecten aan dit gebouw gekoppeld.</span>'}</div></div><p class="subtext">De gebouwgegevens staan één keer in de parenttabel. Elk glasobject heeft een eigen record in de childtabel.</p><a class="text-button" href="#relaties">Meer over deze relatie</a></section></div>
      <section class="collection-panel"><div class="panel-heading"><div><h2>Gekoppelde glasobjecten <small>${cs.length} ${cs.length===1?'record':'records'}</small></h2><p>Alle glasobjecten met gebouw_id = ${esc(b.id)}</p></div>${cs.length?`<a class="button" href="${listFor(b.id)}">Filter deze objecten ${icon('arrow')}</a>`:''}</div>${cs.length?objectTable(cs):'<div class="empty"><strong>Nog geen glasobjecten gekoppeld</strong>Dit zegt alleen iets over deze dataset, niet over het aanwezige glas in het gebouw.</div>'}</section>${rawFields(b.source,'gebouw')}`;
    document.title=heading(b)+' · Glas in gebouwen';
  }
  function objectDetail(id) {
    const o=objects.get(id);if(!o){notFound('Glasobject');return;}
    const b=buildings.get(o.gebouw_id),siblings=children.get(b.id).filter(c=>c.id!==o.id);
    main.innerHTML=breadcrumbs([['Glasobjecten','#glasobjecten'],[o.naam||o.id]])+`<a href="${esc(lastListRoute.startsWith('#glasobjecten')?lastListRoute:'#glasobjecten')}" class="back-link">← Terug naar de glasobjecten</a><div class="page-heading"><div><p class="eyebrow">GLASOBJECT · CHILD</p><h1>${esc(o.naam||'Naam niet ingevuld')}</h1><p>Onderdeel van <a href="${bhref(b.id)}">${esc(heading(b))}</a></p><div class="detail-meta">${key(o.id)} ${keyLabel(false)} ${matchBadge(o)}</div></div><button class="button" data-action="map"${b.positie?'':' disabled'}>${icon('map')} ${b.positie?'Toon gebouw op kaart':'Geen kaartlocatie'}</button></div>
      ${o.koppeling!=='naam_en_adres'?`<p class="info-note${o.koppeling==='naamsvariant'?' purple':''}">${esc(o.koppeling_uitleg)}</p>`:''}
      ${o.jaar_controle?'<p class="info-note"><strong>Controleer de datering.</strong> De bron bevat het jaar 999. Deze waarde is ongewijzigd overgenomen; de betekenis is niet vastgesteld.</p>':''}
      <div class="detail-layout"><section class="card"><h2>Objectgegevens</h2><dl class="facts">${fact('Naam glasobject',o.naam,true)}${fact('Jaar ontstaan (bron)',o.jaar)}${fact('Volgnummer binnen gebouw',o.volgnummer)}${fact('Gebouwdeel',o.gebouwdeel)}${fact('Etage',o.etage)}${fact('Kunstenaar',o.kunstenaar)}${fact('Ontwerper',o.ontwerper)}${fact('Uitvoerend atelier',o.atelier)}${fact('Thema',o.thema)}${o.technieken.map((t,i)=>fact('Glastechniek '+(i+1),t)).join('')}${fact('Schenker',o.source.schenker)}${fact('Restaurateur',o.source.restaurateur)}${fact('Restauratiejaar',o.source.restauratie_jaar)}${fact('Fotograaf',o.source.fotograaf)}${fact('Opmerking',o.source.opmerking,true)}${fact('Volgtekst',o.source.volgtekst,true)}</dl>${sourceLinks(o.source)}</section>
      <section class="card relation-card"><p class="eyebrow">VOLG DE VREEMDE SLEUTEL</p><h2>Bij welk gebouw hoort dit?</h2><div class="relation-stack"><div class="entity"><span class="entity-type">Dit glasobject · child</span>${key(o.id)}${keyLabel(false)}<span class="subtext">gebouw_id = ${key(b.id,true)}${keyLabel(true)}</span></div><div class="relation-connector"><strong>n → 1</strong> verwijst naar één gebouw</div><div class="entity"><span class="entity-type">Gekoppeld gebouw · parent</span>${key(b.id)}${keyLabel(false)}<a class="record-link" href="${bhref(b.id)}">${esc(heading(b))} →</a><span class="subtext">${esc(b.adres||'Adres niet ingevuld')}</span></div></div><p class="subtext">De waarde <strong>${esc(b.id)}</strong> komt als primaire sleutel één keer voor in de gebouwentabel en mag als vreemde sleutel bij meerdere glasobjecten voorkomen.</p><a class="button soft" href="${bhref(b.id)}">${icon('building')} Open gebouw</a></section></div>
      <section class="collection-panel"><div class="panel-heading"><div><h2>Andere glasobjecten in dit gebouw <small>${siblings.length} ${siblings.length===1?'record':'records'}</small></h2><p>Ook deze objecten hebben gebouw_id = ${esc(b.id)}</p></div>${siblings.length?`<a class="button" href="${listFor(b.id)}">Alle ${siblings.length+1} bekijken ${icon('arrow')}</a>`:''}</div>${siblings.length?objectTable(siblings):'<div class="empty">In deze dataset zijn geen andere glasobjecten aan dit gebouw gekoppeld.</div>'}</section>${rawFields(o.source,'glasobject')}`;
    document.title=(o.naam||o.id)+' · Glas in gebouwen';
  }
  function relationPage() {
    const linked=D.gebouwen.filter(b=>b.aantal_glasobjecten).sort((a,b)=>collator.compare(heading(a),heading(b)));
    main.innerHTML=breadcrumbs([['Hoe werkt de relatie?']])+`<div class="page-heading"><div><p class="eyebrow">LEREN DOOR TE VERKENNEN</p><h1>Eén gebouw, meerdere glasobjecten</h1><p>Twee tabellen, verbonden door één sleutel. Kies een gebouw en volg de koppeling.</p></div></div>
      <section aria-label="Relationeel model"><div class="model-grid"><div class="model-table"><h2>Gebouw <span>PARENT</span></h2><div class="model-row highlight"><code>gebouw_id</code>${keyLabel(false)}</div><div class="model-row">naam</div><div class="model-row">adres</div><div class="model-row">architect</div></div><div class="model-line" aria-label="Een-op-veel-relatie"><span>1</span><span>0…n</span></div><div class="model-table child"><h2>Glasobject <span>CHILD</span></h2><div class="model-row"><code>glasobject_id</code>${keyLabel(false)}</div><div class="model-row child-key"><code>gebouw_id</code>${keyLabel(true)}</div><div class="model-row">naam</div><div class="model-row">jaar_ontstaan</div></div></div><p class="model-explanation">Een gebouw heeft nul, één of meer gekoppelde glasobjecten. Elk glasobject verwijst in dit lesmodel naar precies één gebouw.</p></section>
      <div class="explain-grid"><section class="card"><h3>${icon('key')} Primaire sleutel (PK)</h3><p>Identificeert één record. Een gebouw-ID is uniek binnen de tabel Gebouw. Twee gebouwen kunnen dezelfde naam hebben, maar nooit dezelfde primaire sleutel.</p></section><section class="card"><h3>${icon('relation')} Vreemde sleutel (FK)</h3><p>Verwijst naar een record in een andere tabel. Bij Glasobject is <code>gebouw_id</code> de verwijzing naar Gebouw. Deze waarde mag bij meerdere glasobjecten terugkomen.</p></section></div>
      <section class="card"><h2>Volg een koppeling in de collectie</h2><div class="relation-selector"><label for="example-building">Kies een gebouw</label><select id="example-building">${linked.map(b=>opt(b.id,`${heading(b)} · ${b.aantal_glasobjecten} objecten`,exampleId)).join('')}${opt('G0004','St Lambertus (Lith) · 0 objecten',exampleId)}</select></div><div id="live-example"></div></section>
      <section class="card" style="margin-top:24px"><h2>Probeer het zelf</h2><div class="exercise"><p><strong>1.</strong> Open een glasobject. Via welk veld vind je het bijbehorende gebouw?</p><details><summary>Bekijk het antwoord</summary><p>Via <code>gebouw_id</code>, de vreemde sleutel. Dezelfde waarde staat in de primaire sleutel van één gebouwrecord.</p></details></div><div class="exercise"><p><strong>2.</strong> Waarom staat het adres van een gebouw in de parenttabel?</p><details><summary>Bekijk het antwoord</summary><p>Dan hoef je een adreswijziging maar op één plaats te verwerken. De gekoppelde glasobjecten gebruiken die gebouwgegevens via hun vreemde sleutel. Zo voorkom je tegenstrijdige kopieën.</p></details></div><div class="exercise"><p><strong>3.</strong> Betekent een gebouw met 0 gekoppelde glasobjecten dat er geen glas aanwezig is?</p><details><summary>Bekijk het antwoord</summary><p>Nee. Het betekent alleen dat in deze dataset geen objectrecords aan dat gebouw zijn gekoppeld. Het veld “Aantal ramen” uit de bron is bovendien een andere telling.</p></details></div><div class="exercise"><p><strong>4.</strong> Kun je een glasobject koppelen aan een gebouw-ID dat niet bestaat?</p><details><summary>Bekijk het antwoord</summary><p>Een database met ingeschakelde foreign-keycontrole weigert die verwijzing. In de meegeleverde SQLite-database zet je deze controle per verbinding aan met <code>PRAGMA foreign_keys = ON;</code>. Dit heet referentiële integriteit.</p></details></div></section>`;
    updateExample();
  }
  function updateExample() {
    const b=buildings.get(exampleId),cs=children.get(exampleId);
    const sql=`SELECT g.gebouw_id, g.naam AS gebouw,\n       o.glasobject_id, o.naam AS glasobject\nFROM gebouw AS g\nLEFT JOIN glasobject AS o\n  ON g.gebouw_id = o.gebouw_id\nWHERE g.gebouw_id = '${b.id}';`;
    document.getElementById('live-example').innerHTML=`<div class="live-example"><div class="example-parent"><p class="eyebrow">1 GEBOUWRECORD</p>${key(b.id)} ${keyLabel(false)}<h3><a href="${bhref(b.id)}">${esc(heading(b))}</a></h3><p>${esc(b.adres||'Adres niet ingevuld')}</p>${provenance(b)}</div><div class="example-children">${cs.slice(0,3).map(o=>`<div class="example-child">${key(o.id)}<a href="${ohref(o.id)}">${esc(o.naam)}</a><small>gebouw_id</small>${key(b.id,true)}</div>`).join('')}${cs.length?`<p class="inline-note">${cs.length>3?`3 van ${cs.length} glasobjecten getoond. `:''}De waarde <strong>${b.id}</strong> verbindt deze records. <a href="${listFor(b.id)}">Bekijk alle ${cs.length} →</a></p>`:'<p class="inline-note">Geen gekoppelde glasobjecten in deze dataset. Het gebouwrecord kan zelfstandig bestaan.</p>'}</div></div><p class="inline-note">${cs.some(o=>o.koppeling==='naamsvariant')?'Dit voorbeeld gebruikt een koppelvoorstel op basis van een naamsvariant.':b.herkomst==='afgeleid'?'Dit voorbeeld gebruikt een voorlopig gebouw, afgeleid uit het glasobjectenbestand.':'Dit voorbeeld gebruikt een gebouw uit het gebouwenbestand.'}</p><details><summary class="inline-note">Bekijk de SQL-koppeling (JOIN)</summary><pre class="sql">${esc(sql)}</pre><p class="inline-note">Een LEFT JOIN bewaart ook gebouwen zonder glasobjecten. Hun objectvelden zijn dan NULL. <a href="data/historisch-glas.sqlite" download>Download de SQLite-database</a> om deze query uit te voeren.</p></details>`;
  }
  function aboutPage() {
    main.innerHTML=breadcrumbs([['Over de gegevens']])+`<div class="page-heading"><div><p class="eyebrow">BRONNEN EN BEWERKINGEN</p><h1>Van spreadsheets naar relaties</h1><p>De bronwaarden blijven zichtbaar. Nieuwe sleutels en afgeleide koppelingen zijn apart herkenbaar.</p></div></div><div class="prose">
      <div class="quality-grid"><div class="card"><strong>1.229</strong><span>Gebouwen uit het bronbestand</span></div><div class="card"><strong>82</strong><span>Glasobjecten uit het bronbestand</span></div><div class="card"><strong>10</strong><span>Voorlopige gebouwrecords toegevoegd</span></div></div>
      <h2>Hoe zijn de tabellen gekoppeld?</h2><p>De aangeleverde bestanden hebben geen gedeelde gebouwsleutel. De kolommen ObjectID en objectid identificeren verschillende records binnen hun eigen tabel. Voor dit lesmodel zijn daarom <code>gebouw_id</code> en <code>glasobject_id</code> toegevoegd. De bron-ID’s en GlobalID’s blijven beschikbaar bij de oorspronkelijke bronvelden.</p><p>Eén glasobject is gekoppeld op een exact overeenkomende gebouwnaam én adres (Broerenkerk). Voor 23 glasobjecten is een <strong>koppelvoorstel</strong> gemaakt tussen “St Servaas (Maastricht)” en “St Servaas basiliek (Maastricht)”. Voor de overige 58 objecten zijn tien <strong>voorlopige gebouwen</strong> afgeleid uit de gebouwverwijzingen. Daarmee bevat de interface 1.239 gebouwrecords. Deze tien records zijn geen bevestigde toevoegingen aan de oorspronkelijke inventarisatie.</p>
      <div class="quality-table"><div class="table-wrap"><table class="data-table" aria-label="Verantwoording van de koppelingen"><thead><tr><th>Gebouwverwijzing in glasobject</th><th>Parent-ID</th><th>Objecten</th><th>Koppelmethode</th></tr></thead><tbody>${D.koppelingen.map(m=>`<tr><td>${esc(m.gebouwnaam_glasobject)}</td><td><a href="${bhref(m.gebouw_id)}">${key(m.gebouw_id)}</a></td><td>${m.aantal_glasobjecten}</td><td>${matchBadge({koppeling:m.methode})}</td></tr>`).join('')}</tbody></table></div></div>
      <h2>De kaart is indicatief</h2><p>De x- en y-kolommen bevatten grote gehele getallen die op coördinaten zonder decimaalteken lijken. Voor de kaart is bij x een decimaal na het eerste cijfer geplaatst en bij y na het tweede. Alleen uitkomsten tussen 3–8° oosterlengte en 50–54° noorderbreedte worden getoond. Dit is een <strong>expliciete aanname</strong>, geen geografische validatie. Nulwaarden en ontbrekende coördinaten worden niet als locatie gebruikt.</p><p>Bij voorlopige gebouwen is de mediaan van de beschikbare afgeleide locaties van hun glasobjecten gebruikt. De kaart groepeert objecten per gebouw; er worden geen exacte raamposities gesuggereerd. Twee gebouwen hebben geen bruikbare kaartlocatie. De kaart volgt de actieve filters en wordt pas geladen wanneer je haar opent.</p>
      <h2>Ontbrekende waarden en bronkwaliteit</h2><p>Bij 610 oorspronkelijke gebouwen ontbreekt de gebouwnaam. Ze zijn wel te vinden via adres, plaats of ID. De plaatsnaam is waar mogelijk afgeleid uit de gebouwnaam of het adres en is geen gecontroleerde gemeentenaam. Bij twee glasobjecten staat jaar 999; deze waarde is bewaard en gemarkeerd om te controleren. Testrecords en verschillen in schrijfwijze zijn behouden. Het aantal gekoppelde glasobjecten is iets anders dan het bronveld “Aantal ramen”.</p><p>Identificaties zoals BAG pand-ID blijven als bronwaarde beschikbaar. Eventuele verloren voorloopnullen in Excel zijn niet automatisch aangevuld. Je kunt bij elk oorspronkelijk record alle bronvelden openklappen. Voorlopige gebouwrecords tonen waar hun gegevens vandaan komen.</p>
      <h2>Gebruik in de les</h2><p>Deze toepassing is een leesbare verkenner van twee relationeel gekoppelde tabellen. Zoeken, filteren en sorteren veranderen de brongegevens niet. De meegeleverde SQLite-database bevat de parent- en childtabellen met primaire en vreemde sleutels. De webinterface gebruikt een lokale JSON-export van diezelfde gegevens en werkt zonder serverdatabase.</p><div class="download-row"><a class="button primary" href="data/historisch-glas.sqlite" download>${icon('download')} SQLite-database</a><a class="button" href="data/koppelingen.csv" download>Koppeltabel (CSV)</a><a class="button" href="data/schema.sql" download>Databaseschema (SQL)</a><a class="button" href="data/dataset.json" download>Dataset (JSON)</a></div>
      <h2>Herkomst en vormgeving</h2><p>Gebaseerd op de twee aangeleverde Excelbestanden <em>historisch-glas-in-gebouwen_real-life_gebouw.xlsx</em> en <em>historisch-glas-in-gebouwen_real-life_glasobject.xlsx</em>, inclusief het werkblad Keuzelijstjes. Context: Van der Stok, <em>Glas in gebouwen</em>, Rijksdienst voor het Cultureel Erfgoed. De vormgeving sluit aan bij de cursus <a href="https://digitaal-erfgoed-trainingen.github.io/Dataorganisatie_spreadsheets_bouwhistorie/index.html" target="_blank" rel="noopener">Dataorganisatie in spreadsheets voor bouwhistorie</a>: een lichte pagina, paarse accenten, het lettertype Mulish en een vaste zijnavigatie.</p><p>De kaart gebruikt Leaflet en © OpenStreetMap-bijdragers. Lettertype: Mulish (SIL Open Font License). De bijbehorende licentieteksten zijn opgenomen in het pakket. Het pakket bevat ook een reproduceerbaar conversiescript en een publicatiehandleiding.</p></div>`;
  }
  function notFound(kind) {
    main.innerHTML=`<div class="page-heading"><div><h1>${kind} niet gevonden</h1><p>Deze sleutel komt niet voor in de dataset.</p></div></div><a class="button" href="#gebouwen">Naar de gebouwen</a>`;
  }
  function parseRoute() {
    const raw=location.hash.slice(1)||'gebouwen';
    if(raw==='main'){main.focus();return;}
    const [path,query]=raw.split('?'),[type,id]=path.split('/');
    const allowed=['gebouwen','glasobjecten','gebouw','glasobject','relaties','verantwoording'];
    route={type:allowed.includes(type)?type:'gebouwen',id:id||null};
    if(states[route.type]&&query){
      const p=new URLSearchParams(query),s=defaults(route.type);
      for(const k of Object.keys(s))if(p.has(k))s[k]=p.get(k);
      s.page=Math.max(1,Number.parseInt(s.page,10)||1);s.size=[20,50,100].includes(Number(s.size))?Number(s.size):20;
      const sortable=route.type==='gebouwen'?['id','naam','adres','plaats','aantal_glasobjecten','herkomst']:['id','naam','gebouw','jaar','techniek'];
      if(!sortable.includes(s.sort))s.sort=defaults(route.type).sort;
      s.dir=s.dir==='desc'?'desc':'asc';states[route.type]=s;
    }
    render();
    main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
  }
  function render() {
    document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===route.type||(route.type==='gebouw'&&a.dataset.nav==='gebouwen')||(route.type==='glasobject'&&a.dataset.nav==='glasobjecten');a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    document.title=({gebouwen:'Gebouwen',glasobjecten:'Glasobjecten',relaties:'Hoe werkt de relatie?',verantwoording:'Over de gegevens'}[route.type]||'Collectie')+' · Glas in gebouwen';
    if(states[route.type])listPage(route.type);
    else if(route.type==='gebouw')buildingDetail(route.id);
    else if(route.type==='glasobject')objectDetail(route.id);
    else if(route.type==='relaties')relationPage();
    else aboutPage();
  }
  function exportCsv() {
    const type=route.type,rows=filtered(type);
    const fields=type==='gebouwen'?['gebouw_id','gebouwnaam','adres','plaats_afgeleid','herkomst','aantal_glasobjecten','aantal_ramen_bron','rce_nummer','architect','status','lengtegraad_afgeleid','breedtegraad_afgeleid']:['glasobject_id','gebouw_id','naam_object','gebouwnaam','jaar_ontstaan','glastechniek_1','glastechniek_2','glastechniek_3','glastechniek_4','kunstenaar','gebouwdeel','koppelmethode'];
    const records=rows.map(r=>type==='gebouwen'?[r.id,r.naam,r.adres,r.plaats,r.herkomst,r.aantal_glasobjecten,r.aantal_ramen_bron,r.rce,r.architect,r.status,r.positie?.lon,r.positie?.lat]:[r.id,r.gebouw_id,r.naam,heading(buildings.get(r.gebouw_id)),r.jaar,...r.technieken,r.kunstenaar,r.gebouwdeel,r.koppeling]);
    const cell=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
    const csv='\uFEFF'+[fields,...records].map(r=>r.map(cell).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=type+'-selectie.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function loadLeaflet() {
    if(window.L)return Promise.resolve();
    if(leafletPromise)return leafletPromise;
    leafletPromise=new Promise((resolve,reject)=>{
      const css=document.createElement('link');css.rel='stylesheet';css.href='assets/vendor/leaflet.css';document.head.append(css);
      const script=document.createElement('script');script.src='assets/vendor/leaflet.js';script.onload=resolve;script.onerror=()=>{leafletPromise=null;reject(new Error('Kaartbibliotheek niet beschikbaar'));};document.head.append(script);
    });return leafletPromise;
  }
  function mapSelection() {
    if(route.type==='gebouwen')return {rows:filtered('gebouwen'),counts:new Map(D.gebouwen.map(b=>[b.id,b.aantal_glasobjecten])),kind:'gebouwen'};
    if(route.type==='glasobjecten'){
      const os=filtered('glasobjecten'),counts=new Map();os.forEach(o=>counts.set(o.gebouw_id,(counts.get(o.gebouw_id)||0)+1));
      return {rows:[...counts.keys()].map(id=>buildings.get(id)),counts,kind:'glasobjecten',objectCount:os.length};
    }
    const b=route.type==='gebouw'?buildings.get(route.id):buildings.get(objects.get(route.id)?.gebouw_id);
    return {rows:b?[b]:[],counts:new Map(b?[[b.id,b.aantal_glasobjecten]]:[]),kind:'detail'};
  }
  async function showMap() {
    const dialog=document.getElementById('map-dialog'),selection=mapSelection();
    const valid=selection.rows.filter(b=>b.positie),missing=selection.rows.length-valid.length;
    document.getElementById('map-title').textContent=selection.kind==='glasobjecten'?'Gebouwen bij de geselecteerde glasobjecten':'Gebouwen op de kaart';
    document.getElementById('map-summary').textContent=`${fmt(valid.length)} van ${fmt(selection.rows.length)} gebouwen op de kaart${selection.kind==='glasobjecten'?` · ${selection.objectCount} geselecteerde glasobjecten`:''}${missing?` · ${missing} zonder bruikbare locatie`:''}.`;
    dialog.showModal();document.body.style.overflow='hidden';
    if(!map)document.getElementById('map').innerHTML='<div class="map-loading">Kaart wordt geladen…</div>';
    try {
      await loadLeaflet();
      if(!map){
        document.getElementById('map').innerHTML='';
        map=L.map('map',{scrollWheelZoom:true}).setView([52.15,5.3],7);
        const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-bijdragers</a>'}).addTo(map);
        let errors=0;tiles.on('tileerror',()=>{if(++errors>=2)document.getElementById('map-network').hidden=false;});
        markerLayer=L.layerGroup().addTo(map);
      }
      markerLayer.clearLayers();
      for(const b of valid){
        const n=selection.counts.get(b.id)||0,size=n?30:12;
        const marker=L.marker([b.positie.lat,b.positie.lon],{icon:L.divIcon({className:`map-marker ${b.herkomst==='afgeleid'?'derived-marker ':''}${n?'':'zero-marker'}`,html:n?String(n):'',iconSize:[size,size],iconAnchor:[size/2,size/2]}),title:heading(b),alt:heading(b)+'; '+n+' glasobjecten',keyboard:true});
        marker.bindPopup(`<div class="map-popup"><strong>${esc(heading(b))}</strong><p>${esc(b.adres||'Adres niet ingevuld')}</p><p>${provenance(b)} · ${n} ${n===1?'glasobject':'glasobjecten'}${selection.kind==='glasobjecten'?' in selectie':''}</p><a class="button" data-close-map href="${bhref(b.id)}">Open gebouw →</a></div>`);marker.addTo(markerLayer);
      }
      mapBounds=valid.length?L.latLngBounds(valid.map(b=>[b.positie.lat,b.positie.lon])):null;
      requestAnimationFrame(()=>{map.invalidateSize();fitMap();});
    } catch(e){document.getElementById('map').innerHTML='<div class="map-loading">De kaart kon niet worden geladen. Controleer of de map assets/vendor is meegekopieerd.</div>';}
  }
  function fitMap(){if(!map)return;if(mapBounds)map.fitBounds(mapBounds,{padding:[35,35],maxZoom:16});else map.setView([52.15,5.3],7);}
  function closeMap(){document.getElementById('map-dialog').close();document.body.style.overflow='';}

  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-action],[data-sort],[data-page],[data-close-map]');if(!el)return;
    if(el.hasAttribute('data-close-map')){closeMap();return;}
    if(el.dataset.sort){const s=states[route.type];s.dir=s.sort===el.dataset.sort?(s.dir==='asc'?'desc':'asc'):'asc';s.sort=el.dataset.sort;s.page=1;updateResults();return;}
    if(el.dataset.page){states[route.type].page=Number(el.dataset.page);updateResults();document.querySelector('.collection-panel').scrollIntoView({block:'start',behavior:'instant'});return;}
    if(el.dataset.action==='map')showMap();
    if(el.dataset.action==='export')exportCsv();
    if(el.dataset.action==='reset'){states[route.type]=defaults(route.type);render();}
  });
  function onFilters(e){
    const form=e.target.closest('[data-filter-form]');if(!form)return;
    const s=states[form.dataset.filterForm];for(const [k,v]of new FormData(form))s[k]=v;s.page=1;updateResults();
  }
  document.addEventListener('input',e=>{if(e.target.matches('#filters input'))onFilters(e);});
  document.addEventListener('change',e=>{
    if(e.target.matches('#filters select'))onFilters(e);
    if(e.target.id==='page-size'){states[route.type].size=Number(e.target.value);states[route.type].page=1;updateResults();}
    if(e.target.id==='example-building'){exampleId=e.target.value;updateExample();}
  });
  document.addEventListener('submit',e=>{if(e.target.matches('[data-filter-form]'))e.preventDefault();});
  document.getElementById('close-map').addEventListener('click',closeMap);
  document.getElementById('fit-map').addEventListener('click',fitMap);
  document.getElementById('map-dialog').addEventListener('close',()=>{document.body.style.overflow='';});
  window.addEventListener('hashchange',parseRoute);
  parseRoute();
})();
