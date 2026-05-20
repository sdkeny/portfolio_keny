'use strict';

/* ════════════════════════════════════════════════
   IRVE Ile-de-France  —  app.js
   Cles JSON : ASCII pur (data_embed.js)
   ════════════════════════════════════════════════ */

/* ── Constantes ── */
const DEPTS = [
  {code:'75',nom:'Paris',             communes:20,  avec:20,  pdc:8523, stations:628,  pct_equip:100,  pop:2228406, pdc_10k:38.2},
  {code:'77',nom:'Seine-et-Marne',    communes:507, avec:286, pdc:4282, stations:913,  pct_equip:56.4, pop:1468108, pdc_10k:29.2},
  {code:'78',nom:'Yvelines',          communes:259, avec:215, pdc:3993, stations:1258, pct_equip:83,   pop:1485086, pdc_10k:26.9},
  {code:'91',nom:'Essonne',           communes:194, avec:83,  pdc:2426, stations:388,  pct_equip:42.8, pop:1338485, pdc_10k:18.1},
  {code:'92',nom:'Hauts-de-Seine',    communes:36,  avec:36,  pdc:2966, stations:828,  pct_equip:100,  pop:1654712, pdc_10k:17.9},
  {code:'93',nom:'Seine-Saint-Denis', communes:39,  avec:39,  pdc:1961, stations:294,  pct_equip:100,  pop:1704316, pdc_10k:11.5},
  {code:'94',nom:'Val-de-Marne',      communes:47,  avec:46,  pdc:2637, stations:574,  pct_equip:97.9, pop:1426929, pdc_10k:18.5},
  {code:'95',nom:"Val-d'Oise",        communes:183, avec:119, pdc:2051, stations:518,  pct_equip:65,   pop:1281653, pdc_10k:16.0},
];
const MAX_DEPT_PDC = Math.max(...DEPTS.map(d=>d.pdc));

const NIV_COLOR = {
  Excellent:'#00c853', Bon:'#1e88e5',
  Moyen:'#fb8c00',     Faible:'#e53935', Absent:'#9e9e9e'
};
const DEPT_COLOR = {
  '75':'#e53935','77':'#8e24aa','78':'#1e88e5','91':'#00897b',
  '92':'#f4511e','93':'#3949ab','94':'#00acc1','95':'#7cb342'
};
const DEPT_NAME = {
  '75':'Paris','77':'Seine-et-Marne','78':'Yvelines','91':'Essonne',
  '92':'Hauts-de-Seine','93':'Seine-Saint-Denis','94':'Val-de-Marne',"95":"Val-d'Oise"
};

/* ── Etat table ── */
const PER_PAGE = 25;
let tableData=[], filtered=[], page=1, sKey='pdc', sDir=-1;

/* ── Etat carte ── */
let map=null, mapReady=false, mapMode='all', markers=[], maxPDC=1;
let deptLayer=null, communeLayer=null, choroplethLayer=null;
let showDeptBorders=true, showCommuneBorders=false;
let pdcDetailGroup=null, pdcDetailActive=false;
const ZOOM_PDC = 12;   /* seuil d'affichage des PDC individuels */
let _deb;

/* ════════════════════════════════════════════════
   INIT — page chargée
   ════════════════════════════════════════════════ */
window.addEventListener('load', function() {
  if (typeof IRVE_DATA === 'undefined' || !IRVE_DATA.length) {
    document.body.innerHTML = '<div style="padding:60px;text-align:center;font-family:sans-serif;">'
      + '<h2 style="color:#e53935;">Erreur : données non chargées</h2>'
      + '<p>Le fichier <code>data_embed.js</code> est introuvable ou vide.</p></div>';
    return;
  }
  maxPDC = Math.max(...IRVE_DATA.map(r => +r.pdc||0));

  animateCounters();
  renderDepts();
  renderTopCommunes();
  renderConnectors();
  initTable();
  initHeroSearch();

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeFiche();
  });
});

/* ════════════════════════════════════════════════
   CARTE — initialisation lazy (au premier clic sur l'onglet)
   ════════════════════════════════════════════════ */
function initMap() {
  if (typeof L === 'undefined') {
    console.error('Leaflet non charge !');
    return;
  }
  var el = document.getElementById('mainMap');
  if (!el) { console.error('#mainMap absent'); return; }

  var tb = document.querySelector('.map-toolbar');
  var hdr = 56, tb_h = tb ? tb.offsetHeight : 48;
  var mob = window.innerWidth < 960 ? 44 : 0;
  var h = Math.max(window.innerHeight - hdr - mob - tb_h, 400);
  el.style.height = h + 'px';
  el.style.width  = '100%';

  map = L.map('mainMap', {
    center      : [48.72, 2.42],
    zoom        : 9,
    preferCanvas: true,
    zoomControl : true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributeurs &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  mapReady = true;

  /* Groupe de couche pour les PDC individuels */
  pdcDetailGroup = L.layerGroup().addTo(map);

  buildDeptLayer();
  buildCommuneLayer();
  updateMap();
  document.getElementById('mapLegend').classList.add('visible');

  /* Événements zoom / déplacement → PDC individuels */
  map.on('zoomend moveend', function() {
    refreshPdcDetail();
  });
}

/* ════════════════════════════════════════════════
   ONGLETS
   ════════════════════════════════════════════════ */
window.showTab = function(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn[data-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name));
  var panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');

  if (name === 'carte') {
    setTimeout(function() {
      if (!mapReady) {
        initMap();
      } else if (map) {
        var el = document.getElementById('mainMap');
        var tb = document.querySelector('.map-toolbar');
        var hdr = 56, tb_h = tb ? tb.offsetHeight : 48;
        var mob = window.innerWidth < 960 ? 44 : 0;
        var newH = Math.max(window.innerHeight - hdr - mob - tb_h, 400);
        el.style.height = newH + 'px';
        map.invalidateSize(true);
      }
    }, 50);
  }
  window.scrollTo(0, 0);
};

/* ════════════════════════════════════════════════
   COMPTEURS ANIMES
   ════════════════════════════════════════════════ */
function animateCounters() {
  document.querySelectorAll('.hstat-num[data-target]').forEach(function(el) {
    var target = parseInt(el.dataset.target, 10);
    var t0 = performance.now();
    (function tick(now) {
      var p = Math.min((now - t0) / 1400, 1);
      var e = 1 - Math.pow(1-p, 3);
      el.textContent = Math.floor(e * target).toLocaleString('fr-FR');
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString('fr-FR');
    })(t0);
  });
}

/* ════════════════════════════════════════════════
   DEPARTEMENTS
   ════════════════════════════════════════════════ */
function renderDepts() {
  var g = document.getElementById('deptGrid');
  if (!g) return;
  var MAX_PDC10K = Math.max(...DEPTS.map(d=>d.pdc_10k||0));
  g.innerHTML = DEPTS.map(function(d) {
    var pctBar = Math.round((d.pdc_10k||0) / MAX_PDC10K * 100);
    var pop    = d.pop ? Math.round(d.pop/1000) + ' k' : '—';
    return '<div class="dept-card" onclick="goToRecherche(\''+d.code+'\')">'
      +'<div class="dept-num">'+d.code+'</div>'
      +'<div class="dept-name">'+d.nom+'</div>'
      +'<div class="dept-stats">'
        +'<div class="dstat"><div class="dstat-val">'+d.pdc.toLocaleString('fr-FR')+'</div><div class="dstat-label">Points de charge</div></div>'
        +'<div class="dstat"><div class="dstat-val">'+d.stations.toLocaleString('fr-FR')+'</div><div class="dstat-label">Stations</div></div>'
        +'<div class="dstat"><div class="dstat-val">'+(d.pdc_10k||'—')+'</div><div class="dstat-label">PDC / 10 000 hab</div></div>'
        +'<div class="dstat"><div class="dstat-val">'+(d.pct_equip||'—')+' %</div><div class="dstat-label">Communes équip.</div></div>'
      +'</div>'
      +'<div class="dept-prog-wrap">'
        +'<div class="dept-prog-label"><span>Densité équip. (PDC/10 k hab)</span><span>'+(d.pdc_10k||0)+'</span></div>'
        +'<div class="dept-prog-bg"><div class="dept-prog-fill" style="width:'+pctBar+'%"></div></div>'
      +'</div>'
    +'</div>';
  }).join('');
}
window.goToRecherche = function(code) {
  showTab('recherche');
  var s = document.getElementById('filterDept'); if(s) s.value = code;
  applyFilters();
};

/* ════════════════════════════════════════════════
   TOP 10
   ════════════════════════════════════════════════ */
function renderTopCommunes() {
  var g = document.getElementById('topGrid');
  if (!g) return;
  var top = IRVE_DATA.filter(function(r){return r.irve==='Oui';})
    .sort(function(a,b){return (+b.pdc||0)-(+a.pdc||0);}).slice(0,10);
  g.innerHTML = top.map(function(r,i) {
    var rnk = i===0?'r1':i===1?'r2':i===2?'r3':'';
    return '<div class="top-card">'
      +'<div class="top-rank '+rnk+'">'+(i+1)+'</div>'
      +'<div class="top-name">'+r.commune+'</div>'
      +'<div class="top-dept">'+(DEPT_NAME[r.dept]||r.dept)+'</div>'
      +'<div class="top-pdc">'+(+r.pdc).toLocaleString('fr-FR')+'</div>'
      +'<div class="top-pdc-label">points de charge</div>'
      +'<div class="top-meta">'+r.stations+' stations &middot; max '+r.puiss_max+' kW</div>'
      +'<div><span class="niveau-pill np-'+r.niveau+'">'+r.niveau+'</span></div>'
    +'</div>';
  }).join('');
}

/* ════════════════════════════════════════════════
   CONNECTEURS
   ════════════════════════════════════════════════ */
function renderConnectors() {
  var sum = function(k){ return IRVE_DATA.reduce(function(a,r){return a+(+r[k]||0);},0); };
  var fmt = function(n){ return Math.round(n).toLocaleString('fr-FR'); };
  ['t2','ccs','chad','ef'].forEach(function(k){
    var el=document.getElementById('cnt-'+k);
    if(el) el.textContent = fmt(sum(k));
  });
}

/* ════════════════════════════════════════════════
   TABLE
   ════════════════════════════════════════════════ */
function initTable() {
  tableData = IRVE_DATA;
  applyFilters();
}
window.applyFilters = function() {
  var dept   = (document.getElementById('filterDept')?.value   || '');
  var niveau = (document.getElementById('filterNiveau')?.value || '');
  var classe = (document.getElementById('filterClasse')?.value || '');
  var txt    = (document.getElementById('filterText')?.value   || '').toLowerCase().trim();
  filtered = tableData.filter(function(r) {
    if (dept   && r.dept   !== dept)   return false;
    if (niveau && r.niveau !== niveau) return false;
    if (classe && r.classe !== classe) return false;
    if (txt && !(r.commune||'').toLowerCase().includes(txt) && !String(r.cp||'').startsWith(txt)) return false;
    return true;
  });
  sortRows(); page=1; renderTable(); renderPagination(); updateMeta();
  /* Auto-fiche quand la recherche texte identifie 1 seule commune */
  var txt2 = (document.getElementById('filterText')?.value || '').trim();
  if (txt2.length >= 2 && filtered.length === 1) {
    openFiche(filtered[0]);
  } else {
    closeFiche();
  }
};
window.debouncedFilter = function() {
  clearTimeout(_deb); _deb = setTimeout(applyFilters, 220);
};
function sortRows() {
  filtered.sort(function(a,b) {
    var va=a[sKey], vb=b[sKey];
    var na=parseFloat(va), nb=parseFloat(vb);
    if(!isNaN(na)&&!isNaN(nb)) return sDir*(nb-na);
    if(!va) return 1; if(!vb) return -1;
    return sDir*String(va).localeCompare(String(vb),'fr');
  });
}
/* ════════════════════════════════════════════════
   FICHE COMMUNE — 30 indicateurs
   ════════════════════════════════════════════════ */
window.openFiche = function(r) {
  if (!r) return;
  var niv = r.niveau || 'Absent';
  var c   = NIV_COLOR[niv] || '#9e9e9e';
  var has = r.irve === 'Oui';

  function n(v, unit, decimals) {
    var f = parseFloat(v);
    if (isNaN(f) || f === 0) return '—';
    return (decimals ? f.toFixed(decimals) : Math.round(f)).toLocaleString('fr-FR') + (unit ? ' ' + unit : '');
  }
  function s(v) { return v && String(v).trim() && String(v).trim() !== '0' ? String(v).trim() : '—'; }
  function pct(v) { var f=parseFloat(v); return isNaN(f)||f===0 ? '—' : f+' %'; }

  /* Opérateurs */
  var opStr = '—';
  if (r.operateurs && r.operateurs !== '—') {
    var ops = r.operateurs.split(';').map(function(o){ return o.trim(); }).filter(Boolean);
    opStr = ops.join('<br>');
  }

  /* Prises par type */
  var prisesArr = [];
  if (+r.t2 >0) prisesArr.push('<span class="fi-tag fi-t2">T2 : '+(+r.t2)+'</span>');
  if (+r.ccs>0) prisesArr.push('<span class="fi-tag fi-ccs">CCS : '+(+r.ccs)+'</span>');
  if (+r.chad>0) prisesArr.push('<span class="fi-tag fi-chad">CHAdeMO : '+(+r.chad)+'</span>');
  if (+r.ef >0) prisesArr.push('<span class="fi-tag fi-ef">EF : '+(+r.ef)+'</span>');

  /* Score équité avec couleur */
  var se = parseFloat(r.score_equite||0);
  var seCol = se >= 100 ? '#00c853' : se >= 50 ? '#1e88e5' : se >= 20 ? '#fb8c00' : '#e53935';
  var seStr = isNaN(se)||se===0 ? '—' : '<span style="color:'+seCol+';font-weight:700">'+se.toFixed(1)+'</span>';

  /* Écart IDF */
  var ei = parseFloat(r.ecart_idf||0);
  var eiStr = isNaN(ei) ? '—'
    : (ei >= 0 ? '<span style="color:#00c853">+'+ei.toFixed(2)+'</span>'
               : '<span style="color:#e53935">'+ei.toFixed(2)+'</span>');

  /* Satisfaction */
  var satVal = parseInt(r.satisfaction||0);
  var satCol = satVal >= 80 ? '#00c853' : satVal >= 60 ? '#fb8c00' : satVal > 0 ? '#e53935' : '#9e9e9e';
  var satStr = satVal > 0
    ? '<span style="color:'+satCol+';font-weight:700">'+satVal+' %</span>'
      + '<div class="fi-bar-wrap"><div class="fi-bar" style="width:'+Math.min(satVal,100)+'%;background:'+satCol+'"></div></div>'
    : '—';

  function row(label, val, icon) {
    return '<tr><td class="fi-lbl">'+(icon||'')+' '+label+'</td><td class="fi-val">'+val+'</td></tr>';
  }

  function section(title, icon, rows) {
    return '<div class="fi-section">'
      +'<div class="fi-section-title">'+icon+' '+title+'</div>'
      +'<table class="fi-table">'+rows.join('')+'</table>'
      +'</div>';
  }

  var html = '<div class="fi-header" style="border-left:4px solid '+c+'">'
    +'<div class="fi-commune">'+r.commune+'</div>'
    +'<div class="fi-meta">'
      +'<span class="fi-dept">Dép. '+r.dept+'</span>'
      +(r.cp ? ' · <span>'+r.cp+'</span>' : '')
      +' · <span>'+r.code+'</span>'
    +'</div>'
    +'<div class="fi-niveau-wrap">'
      +'<span class="fi-niveau" style="background:'+c+'22;color:'+c+';">'+niv+'</span>'
      +'<span class="fi-classe">'+s(r.classe)+'</span>'
    +'</div>'
    +'</div>';

  html += '<div class="fi-grid">';

  /* ── Section 1 : Démographie ── */
  html += section('Démographie', '&#128106;', [
    row('Population',        n(r.pop, 'hab')),
    row('Surface',           n(r.surface, 'km²', 2)),
    row('Densité',           n(r.densite, 'hab/km²')),
    row('Revenu médian',     n(r.revenu, '€/an')),
  ]);

  /* ── Section 2 : Infrastructure IRVE ── */
  html += section('Infrastructure IRVE', '&#9889;', [
    row('IRVE présente',     has ? '<span style="color:#00c853;font-weight:700">Oui</span>' : '<span style="color:#9e9e9e">Non</span>'),
    row('Nb PDC',            n(r.pdc, '')),
    row('Nb stations',       n(r.stations, '')),
    row('PDC / 10 000 hab',  n(r.pdc_10k, '', 2)),
    row('kW / 10 000 hab',   n(r.kw_10k, '', 1)),
    row('Puissance max',     n(r.puiss_max, 'kW')),
    row('Puissance moyenne', n(r.puiss_moy, 'kW', 1)),
    row('Puissance totale',  n(r.puiss_tot, 'kW')),
    row('% PDC rapides (>50kW)', pct(r.pct_rapide)),
  ]);

  /* ── Section 3 : Accessibilité ── */
  html += section('Accessibilité', '&#128275;', [
    row('% accès libre',     pct(r.pct_libre)),
    row('% gratuits',        pct(r.pct_grat)),
    row('Écart vs moy. IDF', eiStr + ' PDC/10k'),
  ]);

  /* ── Section 4 : Types de prises ── */
  html += section('Types de prises', '&#128268;', [
    row('Détail', prisesArr.length ? prisesArr.join(' ') : '—'),
    row('Total prises', n(r.total_prises, '')),
  ]);

  /* ── Section 5 : Opérateurs ── */
  html += section('Opérateurs', '&#127970;', [
    row('Nb opérateurs',   n(r.nb_operateurs, '')),
    row('Monopole',        s(r.monopole)),
    row('Liste',           opStr),
  ]);

  /* ── Section 6 : Qualité ── */
  html += section('Qualité & équité', '&#11088;', [
    row('Satisfaction',    satStr),
    row('Score équité',    seStr),
  ]);

  html += '</div>'; /* fi-grid */

  var zone = document.getElementById('ficheZone');
  if (!zone) return;
  zone.innerHTML = '<button class="fiche-zone-close" onclick="closeFiche()">&#8592; Retour au tableau</button>' + html;
  zone.style.display = 'block';
  zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.closeFiche = function() {
  var zone = document.getElementById('ficheZone');
  if (zone) { zone.style.display = 'none'; zone.innerHTML = ''; }
};

function renderTable() {
  var tbody = document.getElementById('communeTableBody');
  if(!tbody) return;
  var slice = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);
  if(!slice.length){
    tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:32px;color:#aaa;">Aucune commune</td></tr>';
    return;
  }
  var rows = slice.map(function(r, i) {
    var niv = r.niveau||'Absent';
    var idx = (page-1)*PER_PAGE + i;
    return '<tr class="tr-clickable" onclick="openFiche(filtered['+idx+'])" title="Voir la fiche complète">'
      +'<td class="td-commune">'+r.commune+' <span class="tr-hint">&#128196;</span></td>'
      +'<td><span class="td-dept">'+r.dept+'</span></td>'
      +'<td><strong>'+(+r.pdc||0).toLocaleString('fr-FR')+'</strong></td>'
      +'<td>'+(+r.stations||0)+'</td>'
      +'<td>'+((+r.puiss_max>0)?(+r.puiss_max)+' kW':'—')+'</td>'
      +'<td>'+((+r.pct_libre>0)?(+r.pct_libre)+' %':'—')+'</td>'
      +'<td>'+((+r.pdc_10k>0)?(+r.pdc_10k).toFixed(1):'—')+'</td>'
      +'<td><span class="niveau-pill np-'+niv+'">'+niv+'</span></td>'
    +'</tr>';
  });
  tbody.innerHTML = rows.join('');
}
function renderPagination() {
  var pag=document.getElementById('pagination'); if(!pag) return;
  var total=Math.ceil(filtered.length/PER_PAGE);
  if(total<=1){pag.innerHTML='';return;}
  var pages=[];
  if(total<=7) for(var i=1;i<=total;i++) pages.push(i);
  else{
    pages=[1];
    var lo=Math.max(2,page-2), hi=Math.min(total-1,page+2);
    if(lo>2) pages.push('…');
    for(var i=lo;i<=hi;i++) pages.push(i);
    if(hi<total-1) pages.push('…');
    pages.push(total);
  }
  pag.innerHTML =
    '<button class="page-btn '+(page===1?'disabled':'')+'" onclick="goPage('+(page-1)+')">&#8249;</button>' +
    pages.map(function(p){
      return p==='…' ? '<span class="page-btn disabled">&#8230;</span>'
        : '<button class="page-btn '+(p===page?'active':'')+'" onclick="goPage('+p+')">'+p+'</button>';
    }).join('') +
    '<button class="page-btn '+(page===total?'disabled':'')+'" onclick="goPage('+(page+1)+')">&#8250;</button>';
}
window.goPage = function(p) {
  var total=Math.ceil(filtered.length/PER_PAGE);
  if(p<1||p>total) return;
  page=p; renderTable(); renderPagination();
};
function updateMeta() {
  var el=document.getElementById('tableMeta'); if(!el) return;
  var avec=filtered.filter(function(r){return r.irve==='Oui';}).length;
  var tot=filtered.reduce(function(s,r){return s+(+r.pdc||0);},0);
  el.textContent = filtered.length.toLocaleString('fr-FR')+' communes · '
    +avec.toLocaleString('fr-FR')+' équipées · '+tot.toLocaleString('fr-FR')+' PDC';
}
window.sortTable = function(key) {
  if(sKey===key) sDir*=-1; else{sKey=key;sDir=-1;}
  document.querySelectorAll('.sort-arrow').forEach(function(e){e.textContent='';});
  var a=document.getElementById('sort-'+key); if(a) a.textContent=sDir>0?' ↑':' ↓';
  sortRows(); page=1; renderTable(); renderPagination();
};
window.resetFilters = function() {
  ['filterDept','filterNiveau','filterClasse','filterText'].forEach(function(id){
    var e=document.getElementById(id); if(e) e.value='';
  });
  applyFilters();
};

/* ════════════════════════════════════════════════
   HERO SEARCH
   ════════════════════════════════════════════════ */
function initHeroSearch() {
  var input=document.getElementById('heroSearch');
  var box=document.getElementById('heroSuggestions');
  if(!input||!box) return;
  input.addEventListener('input', function() {
    var q=input.value.trim().toLowerCase();
    if(q.length<2){box.classList.remove('open');return;}
    var hits=IRVE_DATA.filter(function(r){
      return (r.commune||'').toLowerCase().includes(q)||String(r.cp||'').startsWith(q);
    }).sort(function(a,b){return (+b.pdc||0)-(+a.pdc||0);}).slice(0,8);
    if(!hits.length){box.classList.remove('open');return;}
    box.innerHTML=hits.map(function(r){
      return '<div class="sug-item" onclick="selectSug(\''+r.commune.replace(/'/g,"\\'")
        +'\',\''+r.dept+'\')">'
        +'<span class="sug-dept">'+r.dept+'</span>'
        +'<span class="sug-name">'+r.commune+'</span>'
        +'<span class="sug-pdc">'+(r.irve==='Oui'?(+r.pdc).toLocaleString('fr-FR')+' PDC':'Aucune borne')+'</span>'
        +'</div>';
    }).join('');
    box.classList.add('open');
  });
  document.addEventListener('click',function(e){
    if(!input.contains(e.target)&&!box.contains(e.target)) box.classList.remove('open');
  });
}
window.selectSug = function(commune, dept) {
  document.getElementById('heroSuggestions')?.classList.remove('open');
  showTab('recherche');
  var fd=document.getElementById('filterDept'); if(fd) fd.value=dept;
  var ft=document.getElementById('filterText'); if(ft) ft.value=commune;
  ['filterNiveau','filterClasse'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  applyFilters();
};
window.heroSearchGo = function() {
  var q=document.getElementById('heroSearch')?.value.trim();
  showTab('recherche');
  var ft=document.getElementById('filterText'); if(ft&&q) ft.value=q;
  applyFilters();
};

/* ════════════════════════════════════════════════
   CARTE — COUCHES LIMITES (départements / communes)
   ════════════════════════════════════════════════ */
function buildDeptLayer() {
  if (!map || typeof DEPTS_GEO === 'undefined') return;
  if (deptLayer) map.removeLayer(deptLayer);
  deptLayer = L.geoJSON(DEPTS_GEO, {
    style: {
      color: '#1a1a2e', weight: 2.5, fillOpacity: 0,
      dashArray: null
    },
    onEachFeature: function(feat, layer) {
      var props = feat.properties;
      var nom = props.nom || props.dept || '';
      layer.bindTooltip('<strong>' + props.dept + ' — ' + nom + '</strong>',
        {sticky: true, className: 'dept-tooltip'});
    }
  });
  if (showDeptBorders) deptLayer.addTo(map);
}

function buildCommuneLayer() {
  if (!map || typeof COMMUNES_GEO === 'undefined') return;
  if (communeLayer) map.removeLayer(communeLayer);
  communeLayer = L.geoJSON(COMMUNES_GEO, {
    style: { color: '#555', weight: 0.6, fillOpacity: 0 },
    onEachFeature: function(feat, layer) {
      var p = feat.properties;
      var pdc = p.pdc || 0;
      var dens = p.densite ? p.densite.toLocaleString('fr-FR') + ' hab/km²' : '—';
      var rev  = p.revenu  ? p.revenu.toLocaleString('fr-FR')  + ' €/an'   : '—';
      layer.bindTooltip(
        '<strong>' + p.nom + '</strong> (' + p.dept + ')<br/>'
        + '&#128268; ' + pdc + ' PDC · Densité : ' + dens + '<br/>'
        + '&#128178; Revenu médian : ' + rev,
        {sticky: true, className: 'commune-tooltip'}
      );
    }
  });
  if (showCommuneBorders) communeLayer.addTo(map);
}

window.toggleBorder = function(type) {
  if (type === 'dept') {
    showDeptBorders = !showDeptBorders;
    document.getElementById('mapToggleDept')?.classList.toggle('active', showDeptBorders);
    if (deptLayer) {
      if (showDeptBorders) deptLayer.addTo(map); else map.removeLayer(deptLayer);
    }
  } else {
    showCommuneBorders = !showCommuneBorders;
    document.getElementById('mapToggleCommune')?.classList.toggle('active', showCommuneBorders);
    if (communeLayer) {
      if (showCommuneBorders) communeLayer.addTo(map); else map.removeLayer(communeLayer);
    }
  }
};

/* ════════════════════════════════════════════════
   CARTE — POINT D'ENTRÉE PRINCIPAL
   ════════════════════════════════════════════════ */
function updateMap() {
  if (!map) return;
  var colorBy = document.getElementById('mapColorBy')?.value || 'niveau';
  var isChoropleth = colorBy === 'densite' || colorBy === 'revenu';

  if (isChoropleth) {
    /* Masquer la couche de contours séparée (la choroplèthe inclut ses propres limites) */
    if (communeLayer && map.hasLayer(communeLayer)) map.removeLayer(communeLayer);

    /* 1. Trame de fond (choroplèthe) */
    var breaks = buildChoropleth(colorBy);

    /* 2. Marqueurs PDC superposés par-dessus */
    buildMapMarkers(true);

    /* 3. Limites dép. tout en haut */
    if (deptLayer && showDeptBorders) deptLayer.bringToFront();

    renderLegend(colorBy, breaks);
    updateMapStats(colorBy);
  } else {
    /* Supprimer la choroplèthe */
    if (choroplethLayer) { map.removeLayer(choroplethLayer); choroplethLayer = null; }
    /* Rétablir contours communes si actifs */
    if (communeLayer && showCommuneBorders && !map.hasLayer(communeLayer)) {
      communeLayer.addTo(map);
    }
    buildMapMarkers(false);
    renderLegend(colorBy, null);
  }
}

/* ════════════════════════════════════════════════
   CARTE — CHOROPLÈTHE (densité / revenu, 5 classes)
   ════════════════════════════════════════════════ */
function quantileBreaks(values, n) {
  var sorted = values.filter(function(v){ return v > 0; }).sort(function(a,b){ return a-b; });
  var len = sorted.length;
  var breaks = [];
  for (var i = 0; i <= n; i++) {
    breaks.push(sorted[Math.round(i * (len-1) / n)]);
  }
  return breaks; /* n+1 bornes → n classes */
}

var _choroBrks = {}; /* cache des breaks par variable */

function buildChoropleth(colorBy) {
  if (!map || typeof COMMUNES_GEO === 'undefined') return [];
  if (choroplethLayer) { map.removeLayer(choroplethLayer); choroplethLayer = null; }

  var deptF   = document.getElementById('mapFilterDept')?.value || '';
  var searchQ = (document.getElementById('mapSearch')?.value || '').toLowerCase().trim();

  /* Construire le lookup code → valeur et garder les données filtrées */
  var lookup = {};
  IRVE_DATA.forEach(function(r) {
    lookup[r.code] = colorBy === 'densite' ? +r.densite||0 : +r.revenu||0;
  });

  /* Calcul des breaks (quantiles, 5 classes) — mis en cache */
  if (!_choroBrks[colorBy]) {
    var allVals = IRVE_DATA.map(function(r){
      return colorBy === 'densite' ? +r.densite||0 : +r.revenu||0;
    });
    _choroBrks[colorBy] = quantileBreaks(allVals, 5);
  }
  var brks = _choroBrks[colorBy];

  var COLORS5 = colorBy === 'densite'
    ? ['#f3e5f5','#ce93d8','#ab47bc','#7b1fa2','#4a148c']
    : ['#f1f8e9','#a5d6a7','#66bb6a','#2e7d32','#1b5e20'];

  function getColor(val) {
    if (!val || val === 0) return '#e0e0e0';
    for (var i = 0; i < 5; i++) {
      if (val <= brks[i+1]) return COLORS5[i];
    }
    return COLORS5[4];
  }

  /* Lookup rapide par code commune depuis IRVE_DATA pour les filtres */
  var irveByCode = {};
  IRVE_DATA.forEach(function(r){ irveByCode[r.code] = r; });

  choroplethLayer = L.geoJSON(COMMUNES_GEO, {
    style: function(feature) {
      var code = feature.properties.code;
      var r = irveByCode[code];
      /* Appliquer les filtres */
      if (deptF && feature.properties.dept !== deptF) {
        return { fillOpacity: 0, color: '#999', weight: 0.4 };
      }
      if (searchQ) {
        var nom = (feature.properties.nom||'').toLowerCase();
        if (!nom.includes(searchQ)) return { fillOpacity: 0, color: '#999', weight: 0.4 };
      }
      if (mapMode === 'irve' && r && r.irve !== 'Oui') return { fillOpacity: 0, color: '#999', weight: 0.4 };
      if (mapMode === 'sans' && r && r.irve === 'Oui') return { fillOpacity: 0, color: '#999', weight: 0.4 };
      return {
        fillColor   : getColor(lookup[code]||0),
        fillOpacity : 0.78,
        color       : '#555',
        weight      : 0.7
      };
    },
    onEachFeature: function(feat, layer) {
      var p = feat.properties;
      var r = irveByCode[p.code] || {};
      var val  = lookup[p.code] || 0;
      var unit = colorBy === 'densite' ? ' hab/km²' : ' €/an';
      var label= colorBy === 'densite' ? 'Densité' : 'Revenu médian';
      var valStr = val ? val.toLocaleString('fr-FR') + unit : 'N/D';
      layer.bindTooltip(
        '<strong>' + p.nom + '</strong> (' + p.dept + ')<br/>'
        + label + ' : <strong>' + valStr + '</strong><br/>'
        + '&#128268; ' + (p.pdc||0) + ' PDC'
        + (r.niveau ? ' &nbsp;<em>'+r.niveau+'</em>' : ''),
        { sticky: true, className: 'commune-tooltip' }
      );
      layer.on('click', function() {
        if (r.commune) {
          var match = (typeof IRVE_DATA !== 'undefined')
            ? IRVE_DATA.find(function(d){ return d.code === r.code; })
            : null;
          if (match) { openFiche(match); return; }
          showTab('recherche');
          var ft = document.getElementById('filterText'); if(ft) ft.value = r.commune;
          var fd = document.getElementById('filterDept'); if(fd) fd.value = r.dept||'';
          ['filterNiveau','filterClasse'].forEach(function(id){
            var e=document.getElementById(id); if(e) e.value='';
          });
          applyFilters();
        }
      });
    }
  });

  choroplethLayer.addTo(map);
  if (deptLayer && showDeptBorders) deptLayer.bringToFront();

  return brks;
}

function updateMapStats(colorBy) {
  var deptF   = document.getElementById('mapFilterDept')?.value || '';
  var searchQ = (document.getElementById('mapSearch')?.value || '').toLowerCase().trim();
  var cnt=0, totPDC=0;
  IRVE_DATA.forEach(function(r) {
    var has = r.irve==='Oui';
    if (mapMode==='irve' && !has) return;
    if (mapMode==='sans' &&  has) return;
    if (deptF && r.dept!==deptF) return;
    if (searchQ && !(r.commune||'').toLowerCase().includes(searchQ)
      && !String(r.cp||'').startsWith(searchQ)) return;
    cnt++; totPDC += +r.pdc||0;
  });
  var ec=document.getElementById('mapStatCount'); if(ec) ec.textContent=cnt.toLocaleString('fr-FR');
  var ep=document.getElementById('mapStatPDC');   if(ep) ep.textContent=totPDC.toLocaleString('fr-FR');
}

/* ════════════════════════════════════════════════
   CARTE — MARQUEURS PDC
   overlay=false : mode standard (niveau/dept/pdc)
   overlay=true  : superposition sur choroplèthe
   ════════════════════════════════════════════════ */
function buildMapMarkers(overlay) {
  if (!map) return;
  markers.forEach(function(m){ map.removeLayer(m); });
  markers = [];

  var colorBy = document.getElementById('mapColorBy')?.value   || 'niveau';
  var deptF   = document.getElementById('mapFilterDept')?.value || '';
  var searchQ = (document.getElementById('mapSearch')?.value   || '').toLowerCase().trim();
  var cnt=0, totPDC=0;

  IRVE_DATA.forEach(function(r) {
    if (!r.lat || !r.lng) return;
    var pdc=+r.pdc||0, niv=r.niveau||'Absent', dept=r.dept, has=r.irve==='Oui';
    if (mapMode==='irve' && !has) return;
    if (mapMode==='sans' &&  has) return;
    if (deptF && dept!==deptF)   return;
    if (searchQ && !(r.commune||'').toLowerCase().includes(searchQ)
      && !String(r.cp||'').startsWith(searchQ)) return;

    var fill, borderColor, borderWeight, fillOpacity, radius;

    if (overlay) {
      /* ── Mode superposition ──────────────────────────
         Communes sans borne : petit point gris transparent
         Communes équipées   : cercle coloré par nb PDC,
                               bordure sombre pour contraste */
      if (!has) {
        /* masquer les communes sans borne en overlay pour ne pas surcharger */
        cnt++; totPDC+=pdc;
        return;
      }
      fill        = pdcColor(pdc);
      borderColor = '#1a1a2e';
      borderWeight= 1.2;
      fillOpacity = 0.88;
      radius      = Math.max(4, Math.min(16, 4 + (pdc / maxPDC) * 13));
    } else {
      /* ── Mode standard ── */
      if      (colorBy==='dept') fill = DEPT_COLOR[dept]||'#888';
      else if (colorBy==='pdc')  fill = pdcColor(pdc);
      else                       fill = NIV_COLOR[niv]||'#9e9e9e';
      borderColor = '#fff';
      borderWeight= 1;
      fillOpacity = has ? 0.82 : 0.28;
      radius      = has ? Math.max(5, Math.min(20, 5+(pdc/maxPDC)*16)) : 4;
    }

    var m = L.circleMarker([r.lat, r.lng], {
      radius: radius, color: borderColor, weight: borderWeight,
      fillColor: fill, fillOpacity: fillOpacity
    });
    m.bindPopup(buildPopup(r), {maxWidth:300, minWidth:240});
    m.addTo(map);
    markers.push(m);
    cnt++; totPDC+=pdc;
  });

  /* Si PDC individuels actifs, atténuer les agrégats fraîchement créés */
  if (pdcDetailActive) {
    markers.forEach(function(m) {
      if (!m._origOpacity) m._origOpacity = m.options.fillOpacity;
      m.setStyle({ fillOpacity: 0.12 });
    });
  }

  if (!overlay) {
    if (communeLayer && showCommuneBorders) communeLayer.bringToFront();
    if (deptLayer    && showDeptBorders)    deptLayer.bringToFront();
  }

  var ec=document.getElementById('mapStatCount'); if(ec) ec.textContent=cnt.toLocaleString('fr-FR');
  var ep=document.getElementById('mapStatPDC');   if(ep) ep.textContent=totPDC.toLocaleString('fr-FR');
}

/* ── Fonctions de couleur (marqueurs) ── */
function pdcColor(n) {
  if(!n)    return '#9e9e9e';
  if(n>=500)return '#00a040';
  if(n>=100)return '#43a047';
  if(n>=30) return '#8bc34a';
  if(n>=10) return '#cddc39';
  return '#fff176';
}

/* ── Popup ── */
function buildPopup(r) {
  var pdc=+r.pdc||0, stat=+r.stations||0, pmax=+r.puiss_max||0;
  var libre=+r.pct_libre||0, grat=+r.pct_grat||0;
  var niv=r.niveau||'Absent', has=r.irve==='Oui', c=NIV_COLOR[niv]||'#9e9e9e';
  var t2=+r.t2||0, ccs=+r.ccs||0, chad=+r.chad||0, ef=+r.ef||0;
  var prises=[t2?'T2:'+t2:'',ccs?'CCS:'+ccs:'',chad?'CHAdeMO:'+chad:'',ef?'EF:'+ef:'']
    .filter(Boolean).join(' · ');
  var dens = (+r.densite||0) ? (+r.densite).toLocaleString('fr-FR')+' hab/km²' : '—';
  var rev  = (+r.revenu||0)  ? (+r.revenu).toLocaleString('fr-FR')+' €/an'    : '—';

  var header = '<div class="mp-header"><div class="mp-commune">'+r.commune+'</div>'
    +'<span class="mp-dept">'+r.dept+'</span></div>';
  var socio = '<div class="mp-row mp-socio">'
    +'<span>&#128106; '+( (+r.pop||0).toLocaleString('fr-FR') )+' hab</span>'
    +'<span>&#127968; '+dens+'</span>'
    +'<span>&#128178; '+rev+'</span>'
    +'</div>';

  if(!has) return '<div class="map-popup">'+header
    +'<div class="mp-absent-msg">Aucune borne recensée</div>'
    +socio
    +'<div class="mp-footer"><span>'+r.classe+'</span>'
    +'<span class="mp-niveau" style="background:#f5f5f5;color:#9e9e9e;">Absent</span></div>'
    +'</div>';

  return '<div class="map-popup">'+header
    +'<div class="mp-stats">'
      +'<div class="mp-stat"><div class="mp-stat-val">'+pdc.toLocaleString('fr-FR')+'</div><div class="mp-stat-label">PDC</div></div>'
      +'<div class="mp-stat"><div class="mp-stat-val">'+stat+'</div><div class="mp-stat-label">Stations</div></div>'
      +'<div class="mp-stat"><div class="mp-stat-val">'+(pmax?pmax+' kW':'—')+'</div><div class="mp-stat-label">Puiss. max</div></div>'
    +'</div>'
    +(libre?'<div class="mp-row">&#128275; Accès libre : <strong>'+libre+' %</strong>'+(grat?' · Gratuit : '+grat+' %':'')+'</div>':'')
    +(prises?'<div class="mp-row">&#128268; '+prises+'</div>':'')
    +(r.gmap_note?'<div class="mp-row">&#11088; Satisfaction : <strong>'+r.gmap_note+'/5</strong> <em style="color:#666;font-size:11px;">'+r.gmap_cat+'</em></div>':'')
    +socio
    +'<div class="mp-footer"><span>'+(r.classe||'')+'</span>'
    +'<span class="mp-niveau" style="background:'+c+'22;color:'+c+';">'+niv+'</span>'
    +'</div></div>';
}

/* ── Légende ── */
function fmtBreak(v, colorBy) {
  return colorBy === 'densite'
    ? Math.round(v).toLocaleString('fr-FR') + ' hab/km²'
    : Math.round(v).toLocaleString('fr-FR') + ' €/an';
}

function renderLegend(colorBy, breaks) {
  var box=document.getElementById('mapLegend'); if(!box) return;
  var html='';

  if(colorBy==='niveau'){
    html='<div class="map-legend-title">Niveau équipement</div>';
    Object.entries(NIV_COLOR).forEach(function([l,c]){
      html+='<div class="legend-item"><span class="legend-dot" style="background:'+c+'"></span>'+l+'</div>';
    });
    html+='<div class="legend-note">Taille ∝ nb PDC</div>';

  } else if(colorBy==='dept'){
    html='<div class="map-legend-title">Département</div>';
    Object.entries(DEPT_COLOR).forEach(function([code,c]){
      html+='<div class="legend-item"><span class="legend-dot" style="background:'+c+'"></span>'+code+' – '+(DEPT_NAME[code]||code)+'</div>';
    });
    html+='<div class="legend-note">Taille ∝ nb PDC</div>';

  } else if(colorBy==='pdc'){
    html='<div class="map-legend-title">Nb PDC</div>'
      +[['#00a040','≥ 500'],['#43a047','100–499'],['#8bc34a','30–99'],
        ['#cddc39','10–29'],['#fff176','1–9'],['#9e9e9e','Absent']]
       .map(function(x){return '<div class="legend-item"><span class="legend-dot" style="background:'+x[0]+';border-color:#bbb"></span>'+x[1]+'</div>';}).join('');
    html+='<div class="legend-note">Taille ∝ nb PDC</div>';

  } else if((colorBy==='densite'||colorBy==='revenu') && breaks && breaks.length===6){
    var title  = colorBy==='densite' ? 'Densité (hab/km²)' : 'Revenu médian (€/an)';
    var COLORS5= colorBy==='densite'
      ? ['#f3e5f5','#ce93d8','#ab47bc','#7b1fa2','#4a148c']
      : ['#f1f8e9','#a5d6a7','#66bb6a','#2e7d32','#1b5e20'];
    html='<div class="map-legend-title">'+title+'</div>';
    html+='<div class="legend-item"><span class="legend-swatch" style="background:#e0e0e0"></span>N/D</div>';
    for(var i=4;i>=0;i--){
      var lo = fmtBreak(breaks[i],   colorBy);
      var hi = fmtBreak(breaks[i+1], colorBy);
      var label = i===0 ? '≤ '+hi : (i===4 ? '> '+lo : lo+' – '+hi);
      html+='<div class="legend-item"><span class="legend-swatch" style="background:'+COLORS5[i]+'"></span>'+label+'</div>';
    }
    html+='<div class="legend-note">5 classes · quantiles · clic = fiche</div>';
    /* Section PDC superposés */
    html+='<div class="legend-sep"></div>';
    html+='<div class="map-legend-title">Points de charge</div>';
    html+=[['#00a040','≥ 500'],['#43a047','100–499'],['#8bc34a','30–99'],['#cddc39','1–29']]
      .map(function(x){return '<div class="legend-item">'
        +'<span class="legend-dot" style="background:'+x[0]+';border:1.5px solid #1a1a2e"></span>'+x[1]+' PDC'
        +'</div>';}).join('');
    html+='<div class="legend-note">Taille ∝ nb PDC</div>';
  }

  box.innerHTML=html;
  box.classList.add('visible');
}

/* ── Contrôles publics ── */
window.setMapMode = function(mode) {
  mapMode=mode;
  ['All','Irve','Sans'].forEach(function(s){ document.getElementById('mapToggle'+s)?.classList.remove('active'); });
  document.getElementById('mapToggle'+mode.charAt(0).toUpperCase()+mode.slice(1))?.classList.add('active');
  updateMap();
};
window.updateMapColors = function() {
  _choroBrks = {}; /* forcer recalcul si filtre change */
  updateMap();
};
window.filterMap       = function() { updateMap(); };
window.filterMapSearch = function() { clearTimeout(_deb); _deb=setTimeout(updateMap, 250); };

/* ════════════════════════════════════════════════
   FAQ
   ════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════
   PDC INDIVIDUELS — affichage au zoom
   ════════════════════════════════════════════════ */

/* Lookup rapide code → commune IRVE_DATA */
var _irveByCode = null;
function irveByCode() {
  if (!_irveByCode) {
    _irveByCode = {};
    IRVE_DATA.forEach(function(r){ _irveByCode[r.code] = r; });
  }
  return _irveByCode;
}

function pdcKwColor(kw) {
  if (!kw)    return '#9e9e9e';
  if (kw>=150)return '#d32f2f';   /* ultra-rapide DC  — rouge   */
  if (kw>=50) return '#f57c00';   /* rapide DC        — orange  */
  if (kw>=22) return '#1565c0';   /* standard AC 22kW — bleu    */
  if (kw>=7)  return '#2e7d32';   /* semi-lent AC     — vert    */
  return '#78909c';               /* lent (<7kW)      — gris-bl */
}

function buildPdcPopup(pdc, communeData) {
  /* Prises individuelles depuis bitmask */
  var priseTypes = [];
  if (pdc[3] & 1) priseTypes.push('Type 2');
  if (pdc[3] & 2) priseTypes.push('CCS');
  if (pdc[3] & 4) priseTypes.push('CHAdeMO');
  if (pdc[3] & 8) priseTypes.push('EF');
  var nbPrises = priseTypes.length;

  var col = pdcKwColor(pdc[2]);
  var kwLabel = pdc[2] >= 150 ? 'Ultra-rapide DC'
              : pdc[2] >= 50  ? 'Rapide DC'
              : pdc[2] >= 22  ? 'Standard AC'
              : pdc[2] >= 7   ? 'Semi-lent AC' : 'Lent';

  /* Opérateurs : liste séparée par ';', max 2 affichés */
  var ops = '';
  if (communeData && communeData.operateurs) {
    var opList = communeData.operateurs.split(';').map(function(s){ return s.trim(); }).filter(Boolean);
    if (opList.length > 2) {
      ops = opList.slice(0,2).join(', ') + ' <span class="pdc-more">+' + (opList.length-2) + '</span>';
    } else {
      ops = opList.join(', ');
    }
  }

  /* Accès */
  var acces = '—';
  if (communeData) {
    var pl = communeData.pct_libre;
    if (pl >= 100)      acces = '<span style="color:#27ae60">Libre</span>';
    else if (pl <= 0)   acces = '<span style="color:#e74c3c">Privé</span>';
    else                acces = '<span style="color:#27ae60">'+pl+'% libre</span>';
  }

  /* Satisfaction */
  var sat = communeData && communeData.satisfaction ? communeData.satisfaction + ' %' : '—';

  var commune = communeData ? communeData.commune : '';
  var dept    = communeData ? communeData.dept : '';

  return '<div class="map-popup pdc-popup">'
    +'<div class="mp-header">'
    +'<div class="mp-commune">'+commune+'</div>'
    +'<span class="mp-dept">'+dept+'</span>'
    +'</div>'
    +'<table class="pdc-tbl">'
    +'<tr><td class="pdc-lbl">⚡ Puissance</td>'
    +'<td class="pdc-val" style="color:'+col+'">'+pdc[2]+' kW — '+kwLabel+'</td></tr>'
    +'<tr><td class="pdc-lbl">🔌 Type de prise</td>'
    +'<td class="pdc-val">'+(priseTypes.length ? priseTypes.join(' · ') : '—')+'</td></tr>'
    +'<tr><td class="pdc-lbl">🔢 Nb de prises</td>'
    +'<td class="pdc-val">'+nbPrises+'</td></tr>'
    +'<tr><td class="pdc-lbl">⭐ Satisfaction</td>'
    +'<td class="pdc-val">'+sat+'</td></tr>'
    +'<tr><td class="pdc-lbl">🏢 Opérateur</td>'
    +'<td class="pdc-val">'+(ops||'—')+'</td></tr>'
    +'<tr><td class="pdc-lbl">🔓 Accès</td>'
    +'<td class="pdc-val">'+acces+'</td></tr>'
    +'</table>'
    +'<div class="pdc-note">Données agrégées par commune</div>'
    +'</div>';
}

/* ── Construction unique de tous les PDC (lazy, une seule fois) ── */
var _pdcBuilt = false;

function ensureAllPdcBuilt() {
  if (_pdcBuilt || typeof PDC_DETAIL === 'undefined') return;

  var lookup = irveByCode();
  var renderer = L.canvas({ padding: 0.5 });

  Object.keys(PDC_DETAIL).forEach(function(code) {
    var communeData = lookup[code];
    (PDC_DETAIL[code] || []).forEach(function(pdc) {
      /* Fermeture locale pour le popup */
      (function(p, cd) {
        var m = L.circleMarker([p[0], p[1]], {
          radius      : 4,
          color       : '#fff',
          weight      : 0.8,
          fillColor   : pdcKwColor(p[2]),
          fillOpacity : 0.88,
          renderer    : renderer
        });
        m.on('click', function() {
          m.bindPopup(buildPdcPopup(p, cd), {maxWidth:260, minWidth:200}).openPopup();
        });
        pdcDetailGroup.addLayer(m);
      })(pdc, communeData);
    });
  });

  _pdcBuilt = true;
}

function refreshPdcDetail() {
  if (!map || !pdcDetailGroup || typeof PDC_DETAIL === 'undefined') return;
  var zoom = map.getZoom();

  if (zoom < ZOOM_PDC) {
    /* Zoom insuffisant : masquer PDC individuels, restaurer agrégats */
    if (pdcDetailActive) {
      map.removeLayer(pdcDetailGroup);
      pdcDetailActive = false;
      markers.forEach(function(m){
        m.setStyle({ fillOpacity: m._origOpacity || 0.82 });
      });
      var ind = document.getElementById('pdcZoomInfo');
      if (ind) ind.remove();
    }
    return;
  }

  /* ── Zoom suffisant : afficher tous les PDC individuels ── */

  /* 1. Construction unique au premier appel */
  ensureAllPdcBuilt();

  /* 2. Afficher la couche si pas encore visible */
  if (!pdcDetailActive) {
    pdcDetailGroup.addTo(map);
    pdcDetailActive = true;
  }

  /* 3. Atténuer les agrégats communaux */
  markers.forEach(function(m) {
    if (!m._origOpacity) m._origOpacity = m.options.fillOpacity;
    m.setStyle({ fillOpacity: 0.12 });
  });

  /* 4. Limites départements toujours au-dessus */
  if (deptLayer && showDeptBorders) deptLayer.bringToFront();

  /* 5. Bandeau info */
  showPdcZoomInfo();
}

function showPdcZoomInfo() {
  var el = document.getElementById('pdcZoomInfo');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pdcZoomInfo';
    el.className = 'pdc-zoom-info';
    document.getElementById('tab-carte').appendChild(el);
  }
  el.innerHTML =
    '&#128269; <strong>28 839</strong> points de charge'
    +' <span class="pdc-zoom-legend">'
    +'<span style="background:#d32f2f"></span>&nbsp;&#8805;150kW&nbsp;&nbsp;'
    +'<span style="background:#f57c00"></span>&nbsp;50–149kW&nbsp;&nbsp;'
    +'<span style="background:#1565c0"></span>&nbsp;22kW&nbsp;&nbsp;'
    +'<span style="background:#2e7d32"></span>&nbsp;7–21kW&nbsp;&nbsp;'
    +'<span style="background:#78909c"></span>&nbsp;&lt;7kW'
    +'</span>';
}

window.toggleFaq = function(btn) {
  var ans=btn.nextElementSibling, was=ans.classList.contains('open');
  document.querySelectorAll('.faq-a.open').forEach(function(el){
    el.classList.remove('open'); el.previousElementSibling.classList.remove('open');
  });
  if(!was){ans.classList.add('open');btn.classList.add('open');}
};
