

(function() {

var PC = {PRM:'#2563EB',FP:'#7C3AED',PLD:'#DC2626',PRD:'#D97706',PCR:'#059669',OTHER:'#4B5563'};
function pc(id){ return PC[id]||PC.OTHER; }

// Init motores
var M = SIE_MOTORES;
// Fusionar resultados: nivel presidencial viene de _DS_RESULTADOS_PRES
// _DS_RESULTADOS_PRES usa la clave 'nacional' con {resultados, totales}
var _DS_MERGED = JSON.parse(JSON.stringify(_DS_RESULTADOS));
if (_DS_RESULTADOS_PRES && _DS_RESULTADOS_PRES.nacional) {
  // Normalizar totales: el JSON usa 'emitidos' pero engine espera 'votos_emitidos'
  var _rawTot = _DS_RESULTADOS_PRES.nacional.totales || {};
  var _totNorm = {
    votos_emitidos:           _rawTot.votos_emitidos   || _rawTot.emitidos         || 0,
    votos_validos:            _rawTot.votos_validos     || _rawTot.validos          || 0,
    votos_nulos:              _rawTot.votos_nulos       || _rawTot.nulos            || 0,
    inscritos:                _rawTot.inscritos                                     || 0,
    porcentaje_participacion: _rawTot.porcentaje_participacion                      || 0
  };
  _DS_MERGED.niveles.presidencial = {
    territorio:    'nacional',
    resultados:    _DS_RESULTADOS_PRES.nacional.resultados || {},
    totales:       _totNorm,
    por_provincia: _DS_RESULTADOS_PRES.por_provincia || [],
    por_municipio: _DS_RESULTADOS_PRES.por_municipio || [],
    exterior:      _DS_RESULTADOS_PRES.exterior      || {}
  };
}

// Totales nacionales de senadores (sum de 32 provincias)
var _TOTALES_SEN = (function(){
  var provs = (_DS_RESULTADOS && _DS_RESULTADOS.niveles && _DS_RESULTADOS.niveles.senadores) || [];
  var emitidos = 0, validos = 0, nulos = 0;
  provs.forEach(function(p){
    var t = p.totales||{};
    emitidos += t.votos_emitidos||t.emitidos||0;
    validos  += t.votos_validos ||t.validos ||0;
    nulos    += t.votos_nulos   ||t.nulos   ||0;
  });
  // inscritos desde padron_provincial (mismo padrón que presidencial)
  var inscritos = _DS_PADRON_PROV && _DS_PADRON_PROV.padron
    ? _DS_PADRON_PROV.padron.reduce(function(s,p){return s+(p.inscritos||0);},0)
    : (_DS_PADRON ? _DS_PADRON.total_inscritos || 0 : 0);
  return { votos_emitidos:emitidos, votos_validos:validos, votos_nulos:nulos, inscritos:inscritos,
           porcentaje_participacion: inscritos ? +(emitidos/inscritos*100).toFixed(2) : 0 };
})();

// Totales nacionales de diputados (sum de 45 circs)
var _TOTALES_DIP = (function(){
  var circs = (_DS_RESULTADOS && _DS_RESULTADOS.niveles && _DS_RESULTADOS.niveles.diputados) || [];
  var emitidos=0, validos=0, nulos=0;
  circs.forEach(function(c){
    var t=c.totales||{};
    emitidos+=t.votos_emitidos||t.emitidos||0;
    validos +=t.votos_validos ||t.validos ||0;
    nulos   +=t.votos_nulos  ||t.nulos   ||0;
  });
  var inscritos = _DS_PADRON_PROV && _DS_PADRON_PROV.padron
    ? _DS_PADRON_PROV.padron.reduce(function(s,p){return s+(p.inscritos||0);},0) : 0;
  return { votos_emitidos:emitidos, votos_validos:validos, votos_nulos:nulos, inscritos:inscritos,
           porcentaje_participacion: inscritos ? +(emitidos/inscritos*100).toFixed(2) : 0 };
})();

M.Carga.init({resultados:_DS_MERGED,curules:_DS_CURULES,partidos:_DS_PARTIDOS,
              padron:_DS_PADRON,territorios:_DS_TERRITORIOS,alianzas:_DS_ALIANZAS,
              curulesCat:_DS_CURULES_CAT});
var valResult = M.Validacion.run(_DS_MERGED,_DS_PARTIDOS,_DS_CURULES_CAT,_DS_CURULES);
M.Padron.init(_DS_PADRON);
M.Resultados.init(_DS_MERGED,_DS_ALIANZAS,_DS_PARTIDOS);
M.Alianzas.init(_DS_ALIANZAS);
M.Curules.init(_DS_CURULES_CAT,_DS_CURULES);
M.Territorial.init(_DS_TERRITORIOS);
M.CrecimientoPadron.proyectar();
// Inicializar motores multi-nivel con prov_metrics por nivel (v8.7)
M.Movilizacion.init(_PROV_PRES, _PROV_SEN, _PROV_DIP);
// Motor 17: NormalizacionHistorica — modo COMPLETO ahora que tenemos data 2020
M.NormalizacionHistorica.init(_PROV_PRES, _PROV_METRICS_PRES_2020);
// Motor 18: Histórico 2020 — activo
M.Historico2020.init(
  _DS_RESULTADOS_2020,
  _DS_ALIANZAS_2020,
  _DS_CURULES_2020,
  _PROV_METRICS_PRES_2020,
  _PROV_METRICS_SEN_2020,
  _PROV_METRICS_DIP_2020
);

document.getElementById('sys-status').textContent =
  valResult.ok ? '\u2705 Sistema listo \u00b7 Dataset 2024' : '\u26a0\ufe0f ' + valResult.errores.length + ' errores';

// Nav
document.getElementById('main-nav').addEventListener('click', function(e){
  var btn = e.target.closest('.nav-btn');
  if(!btn) return;
  var id = btn.dataset.view;
  if(!id) return;
  document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active');});
  document.querySelectorAll('.nav-btn').forEach(function(b){b.classList.remove('active');});
  var el = document.getElementById('view-'+id);
  if(el) el.classList.add('active');
  btn.classList.add('active');
  if(id==='dashboard')   renderDashboard();
  if(id==='presidencial') renderPresidencial();
  if(id==='senadores')    renderSenadores();
  if(id==='diputados')    renderDiputados();
  if(id==='exterior')     renderExterior();
  if(id==='potencial')    renderPotencial();
  if(id==='movilizacion') renderMovilizacion();
  if(id==='riesgo')       renderRiesgo();
  if(id==='historico')    renderHistorico();
  if(id==='replay')       renderReplay();
  if(id==='simulador' && !window._simInit) initSimulador();
  if(id==='simulador' && window._simInit)  runSimulation();
  if(id==='proyeccion' && !window._proyInit) initProyeccion();
  if(id==='proyeccion' && window._proyInit)  renderProyeccion();
  if(id==='objetivo') renderObjetivo();
  if(id==='motores')  renderMotores();
});

// Helpers
function fmt(n){ return Number(n).toLocaleString('es-DO'); }
function bar(label,pctVal,color,sub){
  return '<div class="bar-item">'
    +'<div class="bar-hdr"><span class="bar-label">'+label+'</span><span class="bar-pct">'+pctVal+'%</span></div>'
    +(sub?'<div style="font-size:.7rem;color:var(--muted);margin-bottom:.2rem">'+sub+'</div>':'')
    +'<div class="bar-track"><div class="bar-fill" style="width:'+pctVal+'%;background:'+color+'"></div></div>'
    +'</div>';
}
function kpi(cls,label,val,sub){
  return '<div class="kpi '+cls+'"><div class="kpi-label">'+label+'</div>'
    +'<div class="kpi-val">'+val+'</div><div class="kpi-sub">'+sub+'</div></div>';
}
function rowStat(label,val,color){
  return '<div class="flex jb" style="padding:.32rem 0;border-bottom:1px solid var(--border)">'
    +'<span class="text-sm">'+label+'</span>'
    +'<strong style="font-size:.83rem;'+(color?'color:'+color:'')+'">'+val+'</strong></div>';
}

// ====== DASHBOARD ======
function renderDashboard(){
  var kpis = M.KPIs.compute(M.Resultados, M.Curules, M.Padron);
  var blocsP = M.Resultados.getPresidencialByBloc();
  var legT = M.Curules.getTotalLegislativo();
  var total = M.Curules.getSumaCurules();

  document.getElementById('kpi-section').innerHTML = '<div class="kpi-grid">'
    +kpi('blue','Ganador Presidencial',kpis.ganador_presidencial,kpis.pct_ganador+'% \u2014 bloque')
    +kpi('green','Padr\u00f3n Oficial',fmt(kpis.padron_oficial),'Inscritos JCE 2024')
    +kpi('gold','Participaci\u00f3n',kpis.participacion+'%',fmt(kpis.votos_emitidos)+' emitidos')
    +kpi('blue','PRM Senadores','32/32','Todas las provincias')
    +kpi('purple','Curules',kpis.curules_totales,'Legislativo total')
    +kpi('blue','ENPP Legislativo',kpis.enpp_legislativo,'Laakso-Taagepera 1979')
    +kpi('orange','Margen Presidencial',kpis.margen_presidencial+'pp','1ro vs 2do bloque')
    +kpi(kpis.riesgo_segunda_vuelta?'red':'green','Riesgo 2da Vuelta',kpis.riesgo_segunda_vuelta?'SI':'NO',kpis.riesgo_segunda_vuelta?'<50% en 1ra vuelta':'Mayor\u00eda en 1ra vuelta')
    +'</div>';

  document.getElementById('pres-bar-list').innerHTML =
    blocsP.slice(0,6).map(function(b){return bar(b.id+' \u00b7 '+b.nombre.substring(0,26),b.pct,pc(b.id),fmt(b.votos)+' votos');}).join('');

  document.getElementById('leg-bar-list').innerHTML =
    legT.map(function(x){return bar(x.id+' \u00b7 '+M.Resultados.getPartidoNombre(x.id).substring(0,24),+(x.curules/total*100).toFixed(1),pc(x.id),x.curules+' curules');}).join('');

  drawParliament('parl-canvas', legT, total);
  document.getElementById('parl-legend').innerHTML =
    legT.map(function(x){return '<div style="display:flex;align-items:center;gap:.35rem;font-size:.75rem">'
      +'<div style="width:9px;height:9px;border-radius:50%;background:'+pc(x.id)+'"></div>'
      +'<span>'+x.id+': <strong>'+x.curules+'</strong></span></div>';}).join('');

  var totP = M.Resultados.getTotalesPresidencial();
  document.getElementById('dash-padron').innerHTML = [
    rowStat('Inscritos (oficial)',fmt(M.Padron.getPadronOficial()),'var(--text)'),
    rowStat('Votos emitidos',fmt(totP.votos_emitidos)),
    rowStat('Votos v\u00e1lidos',fmt(totP.votos_validos)),
    rowStat('Votos nulos',fmt(totP.votos_nulos)),
    rowStat('Participaci\u00f3n',kpis.participacion+'%','var(--green)'),
    rowStat('Abstenci\u00f3n',kpis.abstencion+'%','var(--gold)'),
  ].join('');

  document.getElementById('dash-indicadores').innerHTML = [
    rowStat('ENPP legislativo',kpis.enpp_legislativo),
    rowStat('Concentraci\u00f3n top-2',kpis.concentracion_top2+'%'),
    rowStat('Margen presidencial',kpis.margen_presidencial+'pp'),
    rowStat('PRM mayor\u00eda calificada (2/3)',179>=148?'SI':'NO','var(--green)'),
    rowStat('Validaci\u00f3n interna',valResult.ok?'\u2705 OK':'\u274c '+valResult.errores.length+' errores'),
  ].join('');

  var bloc = M.Alianzas.getCoalicion('PRM');
  var partidos = bloc && bloc.partidos ? bloc.partidos : [];
  document.getElementById('dash-coalicion').innerHTML =
    '<div style="font-size:.72rem;color:var(--muted);margin-bottom:.5rem">'+partidos.length+' partidos en coalici\u00f3n</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:.3rem">'
    +partidos.map(function(p){return '<span style="background:var(--bg3);border:1px solid var(--border);border-radius:.25rem;padding:.1rem .35rem;font-size:.7rem;font-weight:700">'+p+'</span>';}).join('')
    +'</div>';
}

// Parliament arc
function drawParliament(canvasId, data, total){
  var cv = document.getElementById(canvasId); if(!cv) return;
  var ctx = cv.getContext('2d');
  var W=cv.width,H=cv.height,cx=W/2,cy=H-15,R1=75,R2=145;
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='#1E2A40'; ctx.lineWidth=1;
  [R1,R2].forEach(function(r){ctx.beginPath();ctx.arc(cx,cy,r,Math.PI,0);ctx.stroke();});
  var cursor=Math.PI;
  data.forEach(function(item){
    var id=item.id, curules=item.curules;
    var span=(curules/total)*Math.PI;
    ctx.fillStyle=pc(id);
    for(var i=0;i<curules;i++){
      var a=cursor+(i+0.5)*(span/curules);
      var row=i%3;
      var rr=R1+(row+0.5)*((R2-R1)/3);
      var x=cx+rr*Math.cos(a), y=cy+rr*Math.sin(a);
      ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();
    }
    cursor+=span;
  });
}

// ====== PRESIDENCIAL ======
function renderPresidencial(){
  var blocsP = M.Resultados.getPresidencialByBloc();
  var byPart = M.Resultados.getPresidencialByPartido();
  var totP = M.Resultados.getTotalesPresidencial();
  var partic = M.Padron.getParticipacionNacional(totP.votos_emitidos);

  document.getElementById('pres-blocs-bars').innerHTML =
    blocsP.map(function(b){return bar(b.id+' \u00b7 '+b.nombre,b.pct,pc(b.id),fmt(b.votos)+' votos');}).join('');

  var _pEmitidos = totP.votos_emitidos || 0;
  var _pInscritos = M.Padron.getPadronOficial() || 1;
  var _pParticJCE = totP.porcentaje_participacion || +(_pEmitidos/_pInscritos*100).toFixed(2);
  document.getElementById('pres-stats').innerHTML = [
    rowStat('Padr\u00f3n oficial',fmt(_pInscritos),'var(--text)'),
    rowStat('Votos emitidos',fmt(_pEmitidos),'var(--text)'),
    rowStat('Votos v\u00e1lidos',fmt(totP.votos_validos||0)),
    rowStat('Votos nulos',fmt(totP.votos_nulos||0)),
    rowStat('Participaci\u00f3n',_pParticJCE+'%','var(--green)'),
    rowStat('Abstenci\u00f3n',+(100-_pParticJCE).toFixed(2)+'%','var(--gold)'),
    rowStat('Ganador',blocsP[0]?blocsP[0].id+' \u00b7 Luis Abinader':'','var(--prm)'),
    rowStat('% ganador (bloque)',blocsP[0]?blocsP[0].pct+'%':'','var(--prm)'),
    rowStat('Margen vs 2do',blocsP[1]?+(blocsP[0].pct-blocsP[1].pct).toFixed(2)+'pp':''),
    rowStat('Ballotage',blocsP[0]&&blocsP[0].pct>=50?'No \u2014 1ra vuelta':'S\u00ed \u2014 2da vuelta'),
  ].join('');

  document.getElementById('pres-all-parties').innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.4rem">'
    +byPart.map(function(p){return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.5rem .7rem;display:flex;justify-content:space-between;align-items:center">'
      +'<span style="font-weight:700;font-size:.8rem;color:'+pc(p.id)+'">'+p.id+'</span>'
      +'<span style="font-size:.74rem;color:var(--muted)">'+fmt(p.votos)+' <strong style="color:var(--text)">'+p.pct+'%</strong></span>'
      +'</div>';}).join('')
    +'</div>';
}

// ====== SENADORES ======
function renderSenadores(){
  var senData = M.Resultados.getSenadores();
  var senC    = M.Curules.getTotalByNivel('senadores');
  var senCoal = M.Curules.getSenadorePorCoalicion();

  var prmCoal = (senCoal.find(function(x){return x.id==='PRM-coalicion';})||{curules:0}).curules;
  var fpCoal  = (senCoal.find(function(x){return x.id==='FP-coalicion';})||{curules:0}).curules;
  var otros   = 32 - prmCoal - fpCoal;
  var prmReal = senC['PRM']||0;
  var fpReal  = senC['FP']||0;

  var _senPartic = _TOTALES_SEN.porcentaje_participacion || 0;
  var _senEmitidos = _TOTALES_SEN.votos_emitidos || 0;
  document.getElementById('sen-kpis').innerHTML =
    kpi('blue','PRM directo',prmReal,'bloque PRM: '+prmCoal+' (+'+(prmCoal-prmReal)+' aliados)')
    +kpi('purple','FP directo',fpReal,'bloque FP: '+fpCoal+' (+'+(fpCoal-fpReal)+' aliados)')
    +kpi('red','Otros partidos',otros,'partidos aliados ganadores')
    +kpi('gold','Total','32','1 senador por provincia')
    +kpi('green','Participaci\u00f3n',_senPartic+'%',fmt(_senEmitidos)+' emitidos')
    +kpi('orange','Abstenci\u00f3n',+(100-_senPartic).toFixed(1)+'%',fmt((_TOTALES_SEN.inscritos||0)-_senEmitidos)+' abstencionistas');

  document.getElementById('sen-prov-grid').innerHTML = senData.map(function(prov){
    var rn = prov.riesgo_nivel||'';
    var rs = prov.riesgo_score||'';
    var esAliadoPRM = prov.ganador !== 'PRM' && prov.bloque_coalicion === 'PRM-coalicion';
    var esAliadoFP  = prov.ganador !== 'FP'  && prov.bloque_coalicion === 'FP-coalicion';
    var coalbadge = esAliadoPRM
      ? '<span style="font-size:.65rem;background:rgba(37,99,235,.15);color:var(--accent);padding:.1rem .35rem;border-radius:.25rem;margin-left:.3rem">aliado PRM</span>'
      : (esAliadoFP ? '<span style="font-size:.65rem;background:rgba(124,58,237,.15);color:#7C3AED;padding:.1rem .35rem;border-radius:.25rem;margin-left:.3rem">aliado FP</span>' : '');
    var partBars = (prov.top3||[]).map(function(t){
      return '<div style="flex:'+t.pct+';background:'+pc(t.id)+';height:100%"></div>';
    }).join('');
    var ind = prov.resultados_ind || {};
    var topInd = Object.entries(ind).sort(function(a,b){return b[1]-a[1];}).slice(0,4);
    var totalInd = Object.values(ind).reduce(function(s,v){return s+v;},0);
    var indHtml = topInd.map(function(e){
      return '<div style="display:flex;justify-content:space-between;font-size:.68rem;padding:.1rem 0">'
        +'<span style="color:'+pc(e[0])+'">'+e[0]+'</span>'
        +'<span>'+fmt(e[1])+' <strong>'+(totalInd?+(e[1]/totalInd*100).toFixed(1):0)+'%</strong></span></div>';
    }).join('');
    return '<div class="prov-card">'
      +'<div class="prov-name">'+prov.provincia+'</div>'
      +'<div class="prov-winner" style="color:'+pc(prov.ganador)+'">'+prov.ganador+coalbadge+'</div>'
      +'<div class="prov-pct">'+prov.pct_ganador+'% &middot; ENPP '+(prov.enpp||'?')
        +' &middot; Part. '+(prov.participacion||'?')+'%</div>'
      +(rn?'<span class="risk-badge risk-'+rn+'">Riesgo '+rs+'</span>':'')
      +'<div class="prov-bar">'+partBars+'</div>'
      +'<div style="margin-top:.35rem;border-top:1px solid var(--border);padding-top:.3rem">'+indHtml+'</div>'
      +'</div>';
  }).join('');

  // ── Tab coalición: participación real por bloque ──
  var coalData = M.Curules.getSenadorePorCoalicion ? M.Curules.getSenadorePorCoalicion() : [];
  var coalHtml = coalData.length ? coalData.map(function(c){
    var col = c.id==='PRM-coalicion'?'var(--prm)':c.id==='FP-coalicion'?'var(--fp)':'var(--muted)';
    return '<div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 0;border-bottom:1px solid var(--border)">'
      +'<div style="flex:1"><div style="font-size:.85rem;font-weight:700;color:'+col+'">'+c.id+'</div>'
      +'<div style="font-size:.7rem;color:var(--muted)">'+
      (c.partidos?c.partidos.join(', '):'')+'</div></div>'
      +'<div style="text-align:right"><div style="font-size:1.5rem;font-weight:800;color:'+col+'">'+c.curules+'</div>'
      +'<div style="font-size:.68rem;color:var(--muted)">senadores</div></div></div>';
  }).join('') : '<p class="text-muted text-sm" style="padding:.75rem 0">Datos de coalición no disponibles.</p>';

  var senCoalDetail = document.getElementById('sen-coal-detail');
  if(senCoalDetail) senCoalDetail.innerHTML =
    '<div style="margin-bottom:.75rem">'
    +kpi('blue','PRM coalición',prmCoal,'de 32 senadores')
    +kpi('purple','FP coalición',fpCoal,'de 32 senadores')
    +'</div>'
    +coalHtml;
}

// ====== DIPUTADOS ======
function renderDiputados(){
  var dipC=M.Curules.getTotalByNivel('diputados');
  var natC=M.Curules.getTotalByNivel('nacionales');
  var extC=M.Curules.getTotalByNivel('exterior');
  var combined={};
  [dipC,natC,extC].forEach(function(obj){
    Object.entries(obj).forEach(function(e){combined[e[0]]=(combined[e[0]]||0)+e[1];});
  });
  var sortedC=Object.entries(combined).sort(function(a,b){return b[1]-a[1];});
  var totalC=sortedC.reduce(function(s,e){return s+e[1];},0);

  document.getElementById('dip-kpis').innerHTML =
    kpi('blue','PRM Territoriales',dipC.PRM||0,'de 178 esca\u00f1os')
    +kpi('purple','FP Territoriales',dipC.FP||0,'')
    +kpi('red','PLD Territoriales',dipC.PLD||0,'')
    +kpi('gold','Total C\u00e1mara Baja',totalC,'Terr.+Nac.+Ext.');

  document.getElementById('dip-bar-list').innerHTML =
    sortedC.map(function(e){
      return bar(e[0]+' \u00b7 '+M.Resultados.getPartidoNombre(e[0]).substring(0,24),+(e[1]/totalC*100).toFixed(1),pc(e[0]),e[1]+' curules');
    }).join('');

  var ext=M.Curules.getExteriorDetail();
  document.getElementById('ext-detail').innerHTML = (ext||[]).map(function(c){
    return '<div style="display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--border);font-size:.8rem">'
      +'<span>'+(c.region||'Exterior')+'</span>'
      +'<strong style="color:'+pc(c.resultado&&c.resultado[0]&&c.resultado[0].partido)+'">'+
      (c.resultado||[]).map(function(r){return r.partido+':'+r.curules;}).join(', ')+'</strong></div>';
  }).join('');

  var nat=M.Curules.getNacionalesDetail();
  document.getElementById('nat-detail').innerHTML =
    '<div class="text-muted" style="font-size:.7rem;margin-bottom:.4rem">'+(nat.criterio||'Lista cerrada bloqueada')+'</div>'
    +(nat.resultado||[]).map(function(r){
      return '<div style="display:flex;justify-content:space-between;padding:.35rem 0;border-bottom:1px solid var(--border);font-size:.8rem">'
        +'<span>'+r.partido+'</span>'
        +'<strong style="color:'+pc(r.partido)+'">'+r.curules+' curul'+(r.curules>1?'es':'')+'</strong></div>';
    }).join('');

  var circData = M.Resultados.getDiputadosPorCirc();
  document.getElementById('dip-circ-grid').innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:.4rem">'
    +circData.map(function(c){
      var ind = c.resultados_ind || {};
      var topInd = Object.entries(ind).sort(function(a,b){return b[1]-a[1];}).slice(0,3);
      var totalInd = Object.values(ind).reduce(function(s,v){return s+v;},0);
      var indRows = topInd.map(function(e){
        return '<div style="display:flex;justify-content:space-between;font-size:.67rem;padding:.08rem 0">'
          +'<span style="color:'+pc(e[0])+'">'+e[0]+'</span>'
          +'<span>'+fmt(e[1])+' <strong>'+(totalInd?+(e[1]/totalInd*100).toFixed(1):0)+'%</strong></span></div>';
      }).join('');
      var curulesDetail = M.Curules.getDiputadosDetail().find(function(d){
        return d.provincia_id===c.provincia_id && d.circ===c.circ;
      }) || {};
      var curulesHtml = (curulesDetail.resultado||[]).map(function(r){
        return '<span style="background:'+pc(r.partido)+'22;border:1px solid '+pc(r.partido)+'44;border-radius:.2rem;padding:.06rem .25rem;font-size:.66rem;font-weight:700;color:'+pc(r.partido)+'">'+r.partido+':'+r.curules+'</span>';
      }).join('');
      return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.55rem .75rem">'
        +'<div style="font-size:.76rem;font-weight:700;margin-bottom:.1rem">'+c.provincia+' C'+c.circ+'</div>'
        +'<div style="font-size:.68rem;color:var(--muted);margin-bottom:.2rem">'
          +'Part: '+(c.participacion||'?')+'% \u00b7 Inscritos: '+fmt(c.inscritos||0)+'</div>'
        +'<div style="font-size:.7rem;font-weight:700;color:'+pc(c.ganador)+';margin-bottom:.15rem">'
          +c.ganador+' '+c.pct_ganador+'%</div>'
        +'<div style="margin-bottom:.3rem">'+indRows+'</div>'
        +'<div style="display:flex;gap:.2rem;flex-wrap:wrap">'+curulesHtml+'</div>'
        +'</div>';
    }).join('')
    +'</div>';
}

// ====== EXTERIOR ======
function renderExterior(){
  var extVotos   = M.Resultados.getDiputadosExterior();
  var extCurules = M.Curules.getExteriorDetail();
  var padExt     = _DS_PADRON_EXT && _DS_PADRON_EXT.padron ? _DS_PADRON_EXT.padron : [];
  var totalInsExt= _DS_PADRON_EXT ? (_DS_PADRON_EXT.total_inscrito_exterior||0) : 0;
  var totalEmit  = extVotos.reduce(function(s,c){return s+(c.totales&&c.totales.emitidos||0);},0);
  var partExt    = totalInsExt ? +(totalEmit/totalInsExt*100).toFixed(1) : 0;

  document.getElementById('ext-kpis').innerHTML =
    kpi('blue','Inscritos Exterior',fmt(totalInsExt),'Pres. + Diputados')
    +kpi('gold','Participaci\u00f3n',partExt+'%',fmt(totalEmit)+' emitidos')
    +kpi('blue','PRM Diputados',(M.Curules.getTotalByNivel('exterior').PRM||0)+' cur.','exterior')
    +kpi('green','3 Circunscripciones','','General \u00b7 Caribe \u00b7 Europa');

  document.getElementById('ext-circs').innerHTML = extVotos.map(function(circ){
    var padC = padExt.find(function(p){return p.circ_exterior===circ.circ_exterior;})||{};
    var curC = (extCurules||[]).find(function(c){return c.circ_exterior===circ.circ_exterior;})||{};
    var ind  = circ.resultados_ind||{};
    var topInd  = Object.entries(ind).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    var totalInd= Object.values(ind).reduce(function(s,v){return s+v;},0);
    var indRows = topInd.map(function(e){
      return '<div style="display:flex;justify-content:space-between;padding:.2rem 0;border-bottom:1px solid var(--border);font-size:.78rem">'
        +'<span style="color:'+pc(e[0])+';font-weight:700">'+e[0]+'</span>'
        +'<span>'+fmt(e[1])+' \u00b7 <strong>'+(totalInd?+(e[1]/totalInd*100).toFixed(2):0)+'%</strong></span></div>';
    }).join('');
    var curulesHtml = (curC.resultado||[]).map(function(r){
      return '<span style="background:'+pc(r.partido)+'22;border:1px solid '+pc(r.partido)+'44;border-radius:.2rem;padding:.06rem .28rem;font-size:.72rem;font-weight:700;color:'+pc(r.partido)+'">'+r.partido+': '+r.curules+' cur.</span>';
    }).join('');
    return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem 1rem;margin-bottom:.5rem">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.5rem">'
        +'<div>'
          +'<div style="font-weight:700;font-size:.9rem">Circ. '+circ.circ_exterior+' \u2014 '+circ.region+'</div>'
          +'<div style="font-size:.74rem;color:var(--muted)">'+fmt(padC.inscritos||circ.inscritos||0)+' inscritos \u00b7 Pres. + Diputados</div>'
        +'</div>'
        +'<div style="text-align:right">'
          +'<div style="font-weight:700;color:'+pc(circ.ganador)+'">'+circ.ganador+' '+circ.pct_ganador+'%</div>'
          +'<div style="font-size:.7rem;color:var(--muted)">'+fmt(circ.totales&&circ.totales.emitidos||0)+' votos</div>'
        +'</div>'
      +'</div>'
      +'<div style="margin-bottom:.4rem">'+indRows+'</div>'
      +(curulesHtml?'<div style="display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.35rem">'+curulesHtml+'</div>':'')
      +'</div>';
  }).join('');
}

// ====== HISTÓRICO 2020 ======
function renderHistorico(){
  var H    = M.Historico2020;
  var tot  = H.getTotalesPresidencial();
  var pm20 = H.getPresidencialByProvincia();
  var pm24 = _PROV_METRICS_PRES || [];
  var swing= H.getSwingPresidencial(['PRM','PLD','FP']);

  // ── KPIs ──────────────────────────────────────────────────────
  var ins20  = tot.inscritos || 0;
  var emit20 = tot.votos_emitidos || 0;
  var par20  = ins20 ? +(emit20/ins20*100).toFixed(1) : 0;
  var res20  = _DS_RESULTADOS_2020 && _DS_RESULTADOS_2020.niveles.presidencial.resultados || {};
  var val20  = tot.votos_validos || 0;
  var ganador20 = Object.entries(res20).sort(function(a,b){return b[1]-a[1];})[0];

  document.getElementById('hist-kpis').innerHTML =
    kpi('blue','Ganador 2020', ganador20?ganador20[0]:'?',
        ganador20?+(ganador20[1]/val20*100).toFixed(2)+'%':'')
    +kpi('green','Padrón 2020', fmt(ins20+595879), 'Dom. '+fmt(ins20)+' + Ext. 595,879')
    +kpi('gold','Participación 2020', par20+'%', fmt(emit20)+' emitidos')
    +kpi('red','PLD 2020', +((_DS_RESULTADOS_2020&&res20.PLD||0)/val20*100).toFixed(1)+'%',
        'vs PLD 2024: '+((window._PROV_METRICS_PRES&&_PROV_METRICS_PRES.reduce(function(s,p){return s+(p.blocs&&p.blocs.PLD||0);},0)||0))+' votos');

  // ── Barras presidencial 2020 ──────────────────────────────────
  var sorted20 = Object.entries(res20).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
  document.getElementById('hist-pres-bars').innerHTML =
    sorted20.map(function(e){
      var pct = val20 ? +(e[1]/val20*100).toFixed(2) : 0;
      return bar(e[0]+' \u00b7 '+M.Resultados.getPartidoNombre(e[0]).substring(0,22),
                 pct, pc(e[0]), fmt(e[1])+' votos');
    }).join('');

  // ── Comparativa curules ───────────────────────────────────────
  var comp = H.getComparativaCurules();
  var NIVELES_COMP = [
    {key:'senadores',          label:'Senadores',     total:32},
    {key:'diputados',          label:'Diputados',     total:178},
    {key:'diputados_nacionales',label:'Nacionales',   total:5},
    {key:'diputados_exterior', label:'Exterior',      total:7},
  ];
  var compRows = NIVELES_COMP.map(function(n){
    var d20 = comp[n.key] && comp[n.key]._2020 || {};
    var d24 = comp[n.key] && comp[n.key]._2024 || {};
    var partidos = Array.from(new Set([
      ...Object.keys(d20),...Object.keys(d24)
    ])).sort(function(a,b){return (d24[b]||0)-(d24[a]||0);}).slice(0,4);
    return '<div style="margin-bottom:.7rem">'
      +'<div style="font-size:.78rem;font-weight:700;margin-bottom:.3rem;color:var(--accent)">'+n.label+' ('+n.total+')</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.25rem">'
      +partidos.map(function(p){
        var c20 = d20[p]||0, c24 = d24[p]||0, delta = c24-c20;
        return '<div style="display:flex;justify-content:space-between;font-size:.75rem;padding:.2rem .4rem;background:var(--bg3);border-radius:.25rem">'
          +'<span style="color:'+pc(p)+';font-weight:700">'+p+'</span>'
          +'<span>2020: <strong>'+c20+'</strong> &rarr; 2024: <strong>'+c24+'</strong> '
          +'<span style="color:'+(delta>0?'var(--green)':delta<0?'var(--red)':'var(--muted)')+'">('+(delta>0?'+':'')+delta+')</span></span>'
          +'</div>';
      }).join('')
      +'</div></div>';
  }).join('');
  document.getElementById('hist-curules-comp').innerHTML = compRows;

  // ── Swing grid ────────────────────────────────────────────────
  document.getElementById('hist-swing-grid').innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.35rem">'
    +swing.map(function(p){
      var prm = p.swing.PRM||0, pld = p.swing.PLD||0, fp = p.swing.FP||0;
      var dprt = p.delta_participacion;
      return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.45rem .65rem">'
        +'<div style="font-size:.74rem;font-weight:700;margin-bottom:.25rem">'+p.provincia+'</div>'
        +'<div style="font-size:.68rem;display:flex;flex-direction:column;gap:.1rem">'
        +['PRM','PLD','FP'].map(function(par){
          var val = p.swing[par]||0;
          return '<div style="display:flex;justify-content:space-between">'
            +'<span style="color:'+pc(par)+'">'+par+'</span>'
            +'<strong style="color:'+(val>0?'var(--green)':val<0?'var(--red)':'var(--muted)')+'">'+
            (val>0?'+':'')+val+'pp</strong></div>';
        }).join('')
        +'<div style="border-top:1px solid var(--border);margin-top:.15rem;padding-top:.15rem;display:flex;justify-content:space-between;color:var(--muted)">'
        +'<span>Part.\u0394</span><strong style="color:'+(dprt>0?'var(--green)':dprt<0?'var(--red)':'var(--muted)')+'">'+
        (dprt>0?'+':'')+dprt+'pp</strong></div>'
        +'</div></div>';
    }).join('')
    +'</div>';

  // ── Senadores 2020 grid ───────────────────────────────────────
  var pm20sen = _PROV_METRICS_SEN_2020 || [];
  document.getElementById('hist-sen-grid').innerHTML = pm20sen.map(function(prov){
    var top = prov.top3||[];
    var bars = top.map(function(t){
      return '<div style="flex:'+t.pct+';background:'+pc(t.id)+';height:100%"></div>';
    }).join('');
    return '<div class="prov-card">'
      +'<div class="prov-name">'+prov.provincia+'</div>'
      +'<div class="prov-winner" style="color:'+pc(prov.ganador)+'">'+prov.ganador+'</div>'
      +'<div class="prov-pct">'+prov.pct_ganador+'% \u00b7 ENPP '+(prov.enpp||'?')+'</div>'
      +'<div class="prov-bar">'+bars+'</div>'
      +'</div>';
  }).join('');
}

// ====== POTENCIAL ======
var _POT_NIVEL = 'presidencial';
function _getProvDS(n){
  if(n==='senadores') return _PROV_SEN;
  if(n==='diputados') return _PROV_DIP;
  if(n==='municipio'){
    // Construir dataset municipal desde resultados_2024
    var muns = (_DS_RESULTADOS_PRES && _DS_RESULTADOS_PRES.por_municipio) || [];
    return muns.map(function(m){
      var total = Object.values(m.resultados||{}).reduce(function(s,v){return s+v;},0);
      var sorted = Object.entries(m.resultados||{}).sort(function(a,b){return b[1]-a[1];});
      var ganador = sorted[0]?sorted[0][0]:'?';
      var pctG = total ? +(sorted[0][1]/total*100).toFixed(1) : 0;
      var pctFP = total && m.resultados.FP ? +(m.resultados.FP/total*100).toFixed(1) : 0;
      var pctPRM = total && m.resultados.PRM ? +(m.resultados.PRM/total*100).toFixed(1) : 0;
      var margin = sorted.length>=2 ? +(sorted[0][1]/total*100 - sorted[1][1]/total*100).toFixed(1) : 0;
      return {
        id: m.municipio_id,
        provincia: m.municipio,
        provincia_id: m.provincia_id,
        ganador: ganador,
        pct_ganador: pctG,
        pct_fp: pctFP,
        pct_prm: pctPRM,
        margen_pp: Math.abs(margin),
        abstencion: m.participacion ? +(100-m.participacion).toFixed(1) : 0,
        participacion: m.participacion||0,
        votos_emitidos: total,
        inscritos: m.inscritos||0,
        enpp: 2.0,
        riesgo_score: Math.round(50 + (100-margin*2)*0.3),
        riesgo_nivel: margin<5?'alto':margin<15?'medio':'bajo',
        competitividad: margin<5?'alta':margin<15?'media':'baja',
        score_ofensivo_fp: Math.round(pctFP * 1.5),
        categoria_ofensiva_fp: pctFP>40?'consolidada':pctFP>30?'objetivo_prioritario':pctFP>20?'objetivo_secundario':'perdida',
        votos_gap_fp: m.resultados.PRM && m.resultados.FP ? Math.max(0,m.resultados.PRM-m.resultados.FP+1) : 0,
        votos_necesarios: 0,
        pct_abstencionistas_a_movilizar: 0,
        factibilidad: margin<5?'alta':margin<15?'media':'baja',
        blocs: m.resultados||{},
        top3: sorted.slice(0,3).map(function(e){return {id:e[0],pct:total?+(e[1]/total*100).toFixed(1):0};}),
        prioridad_defensa: pctPRM<45?'alta':pctPRM<55?'media':'baja'
      };
    });
  }
  return _PROV_PRES;
}

function nivelTabs(idPrefix, activo, onChange) {
  return ['presidencial','senadores','diputados'].map(function(n){
    var isAct = n===activo;
    return '<button onclick="'+onChange+'(\''+n+'\')" style="background:'+(isAct?'var(--accent)':'var(--bg3)')+';color:'+(isAct?'#fff':'var(--muted)')+';border:none;padding:.28rem .75rem;border-radius:.3rem;font-size:.72rem;font-weight:700;cursor:pointer;text-transform:capitalize">'+n+'</button>';
  }).join('');
}

function renderPotencial(){
  var ds = _getProvDS(_POT_NIVEL);
  var ofensivo = M.Potencial.scoreOfensivo(ds,'FP');
  var defensivo = M.Potencial.scoreDefensivo(ds,'PRM');

  document.getElementById('potencial-ofensivo').innerHTML =
    ofensivo.filter(function(p){return p.categoria_ofensiva!=='perdida'&&p.categoria_ofensiva!=='consolidada';}).slice(0,10).map(function(pm){
      var catColor = pm.categoria_ofensiva==='objetivo_prioritario'?'var(--fp)':pm.categoria_ofensiva==='objetivo_secundario'?'var(--gold)':'var(--muted)';
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:.42rem 0;border-bottom:1px solid var(--border)">'
        +'<div><div style="font-size:.82rem;font-weight:700">'+pm.provincia+'</div>'
        +'<div style="font-size:.7rem;color:var(--muted)">Margen: '+pm.margen_pp+'pp \u00b7 Abst: '+pm.abstencion+'% \u00b7 FP: '+pm.pct_target+'%</div></div>'
        +'<div style="text-align:right">'
        +'<div style="font-size:.9rem;font-weight:800;color:'+catColor+'">'+pm.score_ofensivo+'</div>'
        +'<div style="font-size:.67rem;color:var(--muted)">'+pm.categoria_ofensiva.replace(/_/g,' ')+'</div></div></div>';
    }).join('');

  document.getElementById('potencial-defensivo').innerHTML =
    defensivo.slice(0,10).map(function(pm){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:.42rem 0;border-bottom:1px solid var(--border)">'
        +'<div><div style="font-size:.82rem;font-weight:700">'+pm.provincia+'</div>'
        +'<div style="font-size:.7rem;color:var(--muted)">Margen: '+pm.margen_pp+'pp \u00b7 ENPP: '+pm.enpp+'</div></div>'
        +'<div style="text-align:right">'
        +'<span class="risk-badge risk-'+pm.riesgo_nivel+'">'+pm.riesgo_score+'</span>'
        +'<div style="font-size:.67rem;color:var(--muted)">'+pm.prioridad_defensa+'</div></div></div>';
    }).join('');

  document.getElementById('competitividad-grid').innerHTML = ds.map(function(pm){
    return '<div class="prov-card">'
      +'<div class="prov-name">'+pm.provincia+'</div>'
      +'<div class="prov-winner" style="color:'+pc(pm.ganador)+'">'+pm.ganador+'</div>'
      +'<div class="prov-pct">ENPP '+pm.enpp+' \u00b7 '+pm.competitividad+'</div>'
      +'<span class="risk-badge risk-'+pm.riesgo_nivel+'">Riesgo '+pm.riesgo_score+'</span>'
      +'</div>';
  }).join('');
}

window.setPotNivel = function(n){ _POT_NIVEL=n; renderPotencial(); };

// ====== MOVILIZACION ======
var _MOV_NIVEL = 'presidencial';
var _MOV_PARTIDO = 'FP';

function renderMovilizacion(){
  var agenda = M.Movilizacion.agenda(_MOV_NIVEL, _MOV_PARTIDO);
  var resumen = M.Movilizacion.resumenMultinivel(_MOV_PARTIDO);

  // KPIs del nivel activo
  var kpisEl = document.getElementById('mov-kpis');
  if(kpisEl){
    var n_alta = agenda.filter(function(a){return a.factibilidad==='alta';}).length;
    var n_media = agenda.filter(function(a){return a.factibilidad==='media';}).length;
    var n_baja = agenda.filter(function(a){return a.factibilidad==='baja';}).length;
    var gap_total = agenda.reduce(function(s,a){return s+a.votos_gap;},0);
    kpisEl.innerHTML =
      kpi('green','Factibilidad Alta',n_alta,'plazas recuperables')
      +kpi('gold','Factibilidad Media',n_media,'requieren esfuerzo')
      +kpi('red','Factibilidad Baja',n_baja,'objetivo difícil')
      +kpi('purple','Gap total '+_MOV_NIVEL,fmt(gap_total),'votos a recuperar');
  }

  document.getElementById('movilizacion-list').innerHTML = agenda.slice(0,20).map(function(a){
    var factColor = a.factibilidad==='alta'?'var(--green)':a.factibilidad==='media'?'var(--gold)':'var(--red)';
    return '<div class="mov-card">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start">'
      +'<div><div style="font-size:.85rem;font-weight:700">'+a.provincia+'</div>'
      +'<div style="font-size:.7rem;color:var(--muted)">Ganador actual: <strong style="color:'+pc(a.ganador_actual)+'">'+a.ganador_actual+'</strong>'
      +(a.bloque_coalicion?' ['+a.bloque_coalicion+']':'')+' \u00b7 Partic. '+a.participacion_actual+'% \u00b7 ENPP '+a.enpp+'</div></div>'
      +'<span style="font-size:.78rem;font-weight:700;color:'+factColor+'">'+a.factibilidad.toUpperCase()+'</span></div>'
      +'<div style="margin-top:.5rem;display:grid;grid-template-columns:1fr 1fr 1fr;gap:.35rem">'
      +'<div style="background:var(--bg);border-radius:var(--r);padding:.38rem;text-align:center">'
      +'<div style="font-size:.63rem;color:var(--muted)">Gap votos</div>'
      +'<div style="font-size:.83rem;font-weight:800">'+fmt(a.votos_gap)+'</div></div>'
      +'<div style="background:var(--bg);border-radius:var(--r);padding:.38rem;text-align:center">'
      +'<div style="font-size:.63rem;color:var(--muted)">Votos necesarios</div>'
      +'<div style="font-size:.83rem;font-weight:800;color:var(--fp)">'+fmt(a.votos_necesarios)+'</div></div>'
      +'<div style="background:var(--bg);border-radius:var(--r);padding:.38rem;text-align:center">'
      +'<div style="font-size:.63rem;color:var(--muted)">% abstencionistas</div>'
      +'<div style="font-size:.83rem;font-weight:800;color:'+factColor+'">'+a.pct_abstencionistas_a_movilizar+'%</div></div>'
      +'</div></div>';
  }).join('');

  // Resumen multi-nivel compacto
  var rsEl = document.getElementById('mov-resumen');
  if(rsEl){
    rsEl.innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem">'
      +resumen.map(function(r){
        return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.65rem">'
          +'<div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:.3rem">'+r.nivel+'</div>'
          +'<div style="font-size:.78rem"><span style="color:var(--green)">'+r.plazas_alta+'A</span> '
          +'<span style="color:var(--gold)">'+r.plazas_media+'M</span> '
          +'<span style="color:var(--red)">'+r.plazas_baja+'B</span>'
          +' / <span style="color:var(--muted)">'+r.plazas_perdidas+' perdidas</span></div></div>';
      }).join('')+'</div>';
  }
}

window.setMovNivel = function(n){ _MOV_NIVEL=n; renderMovilizacion(); };

// ====== RIESGO ======
var _RIE_NIVEL   = 'presidencial';
var _RIE_PARTIDO = 'PRM';

function renderRiesgo(){
  var ds = _getProvDS(_RIE_NIVEL);
  var clasificados = M.Riesgo.clasificar(ds, _RIE_PARTIDO);
  var alertas = M.Riesgo.getAlertas(ds, _RIE_PARTIDO);
  var n_alto = clasificados.filter(function(p){return p.riesgo_nivel==='alto';}).length;
  var n_medio = clasificados.filter(function(p){return p.riesgo_nivel==='medio';}).length;
  var n_bajo = clasificados.filter(function(p){return p.riesgo_nivel==='bajo';}).length;

  document.getElementById('riesgo-kpis').innerHTML =
    kpi('red','Riesgo Alto',n_alto,'provincias \u2014 monitoreo inmediato')
    +kpi('gold','Riesgo Medio',n_medio,'provincias \u2014 seguimiento')
    +kpi('green','Riesgo Bajo',n_bajo,'provincias \u2014 consolidadas')
    +kpi('blue','Total '+_RIE_PARTIDO,clasificados.length,'provincias ganadas');

  document.getElementById('riesgo-list').innerHTML = clasificados.map(function(pm){
    var col = pm.riesgo_nivel==='alto'?'var(--red)':pm.riesgo_nivel==='medio'?'var(--gold)':'var(--green)';
    return '<div style="display:flex;align-items:center;gap:.55rem;padding:.42rem 0;border-bottom:1px solid var(--border)">'
      +'<div style="flex:1"><div style="font-size:.8rem;font-weight:700">'+pm.provincia+'</div>'
      +'<div style="font-size:.68rem;color:var(--muted)">Margen '+pm.margen_pp+'pp \u00b7 Partic '+pm.participacion+'% \u00b7 ENPP '+pm.enpp+'</div></div>'
      +'<div class="score-wrap" style="width:95px">'
      +'<div class="score-track"><div class="score-fill" style="width:'+pm.riesgo_score+'%;background:'+col+'"></div></div>'
      +'<span style="font-size:.73rem;font-weight:700;min-width:26px;text-align:right">'+pm.riesgo_score+'</span></div>'
      +'<span class="risk-badge risk-'+pm.riesgo_nivel+'">'+pm.riesgo_nivel+'</span></div>';
  }).join('');

  document.getElementById('riesgo-alertas').innerHTML = alertas.length
    ? alertas.map(function(a){
        return '<div style="background:#1F0D0D;border:1px solid #EF444422;border-radius:var(--r);padding:.7rem;margin-bottom:.4rem">'
          +'<div style="font-size:.83rem;font-weight:700;color:var(--red)">\u26a0\ufe0f '+a.provincia+'</div>'
          +'<div style="font-size:.73rem;color:var(--muted);margin-top:.2rem">'+a.mensaje+'</div>'
          +'<div style="font-size:.7rem;color:var(--muted);margin-top:.12rem">Score: '+a.riesgo+' \u00b7 Margen: '+a.margen+'pp \u00b7 ENPP: '+a.enpp+'</div></div>';
      }).join('')
    : '<p class="text-muted text-sm">Sin alertas de alto riesgo.</p>';
}

window.setRieNivel = function(n){ _RIE_NIVEL=n; renderRiesgo(); };


// ====== OBJETIVO 2028 ======
var _OBJ_NIVEL = 'presidencial';
var _OBJ_TARGETS = {
  presidencial: { partido:'FP', meta_pct:50.1, descripcion:'Mayoría en 1ra vuelta' },
  senadores:    { partido:'FP', meta_curules:17, descripcion:'Mayoría simple (17/32)' },
  diputados:    { partido:'FP', meta_curules:90, descripcion:'Mayoría simple (90/178)' }
};

function renderObjetivo(){
  var nivel = _OBJ_NIVEL;
  var target = _OBJ_TARGETS[nivel];

  if(nivel==='presidencial'){
    _renderObjetivoPresidencial(target);
  } else if(nivel==='senadores'){
    _renderObjetivoSenadores(target);
  } else {
    _renderObjetivoDiputados(target);
  }
}

function _renderObjetivoPresidencial(target){
  var padron2028 = 8700000;
  var votosActFP = 1655462;  // votos reales FP 2024
  var partic     = { pes:0.50, base:0.54, opt:0.58 };
  var metaPes    = Math.round(padron2028 * partic.pes  * (target.meta_pct/100));
  var metaBase   = Math.round(padron2028 * partic.base * (target.meta_pct/100));
  var metaOpt    = Math.round(padron2028 * partic.opt  * (target.meta_pct/100));
  var gapBase    = metaBase - votosActFP;
  var gapPct     = +(votosActFP/metaBase*100).toFixed(1);

  document.getElementById('obj-kpis').innerHTML =
    kpi('purple','Votos FP 2024',fmt(votosActFP),'28.85% — Base real')
    +kpi('gold','Meta base 2028',fmt(metaBase),target.descripcion)
    +kpi('red','Gap a cerrar',fmt(gapBase),'votos adicionales')
    +kpi('green','Progreso',gapPct+'%','del objetivo base');

  document.getElementById('obj-meta-detalle').innerHTML =
    '<div style="margin-bottom:.75rem">'
    +'<div style="font-size:.75rem;font-weight:700;color:var(--muted);margin-bottom:.3rem">Progreso acumulado hacia meta</div>'
    +'<div class="meta-progress-track"><div class="meta-progress-fill" style="width:'+Math.min(100,gapPct)+'%;background:var(--fp)"></div></div>'
    +'<div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--muted);margin-top:.2rem">'
    +'<span>'+fmt(votosActFP)+' actuales</span><span>Meta: '+fmt(metaBase)+'</span></div>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:.75rem">'
    +[
      {l:'Escenario pesimista',v:fmt(metaPes),sub:'Part. 50% · Gap: '+fmt(metaPes-votosActFP),col:'var(--red)'},
      {l:'Escenario base',v:fmt(metaBase),sub:'Part. 54% · Gap: '+fmt(gapBase),col:'var(--gold)'},
      {l:'Escenario optimista',v:fmt(metaOpt),sub:'Part. 58% · Gap: '+fmt(metaOpt-votosActFP),col:'var(--green)'}
    ].map(function(e){
      return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.7rem">'
        +'<div style="font-size:.65rem;font-weight:700;color:var(--muted);margin-bottom:.2rem">'+e.l+'</div>'
        +'<div style="font-size:1.1rem;font-weight:800;color:'+e.col+'">'+e.v+'</div>'
        +'<div style="font-size:.67rem;color:var(--muted)">'+e.sub+'</div></div>';
    }).join('')
    +'</div>'
    +[
      {l:'Para ganar sin alianzas',v:fmt(metaBase)+' votos',c:'var(--text)'},
      {l:'Con alianza FP+PLD',v:fmt(Math.round(metaBase*0.72))+' votos FP',c:'var(--green)'},
      {l:'Nuevos electores 2024→2028',v:fmt(padron2028-8145548),c:'var(--accent)'},
      {l:'Votos abstencionistas a capturar',v:fmt(Math.round(8145548*0.46*0.3)),c:'var(--gold)'},
      {l:'Evaluación viabilidad',v:gapBase<=500000?'FACTIBLE':'DESAFIANTE',c:gapBase<=500000?'var(--green)':'var(--red)'}
    ].map(function(r){return rowStat(r.l,r.v,r.c);}).join('');

  // Ruta mínima por provincias
  var provVotos = (_PROV_METRICS_PRES||[]).map(function(p){
    return { nombre:p.provincia, votos_fp:Math.round((p.pct_fp||0)/100*(p.votos_emitidos||0)),
             pct_fp:p.pct_fp||0, pct_prm:p.pct_prm||0,
             margen:p.margen_pp||0, inscritos:p.inscritos||0 };
  }).sort(function(a,b){ return b.votos_fp-a.votos_fp; });

  var rutaAcum=0, ruta=[];
  for(var i=0;i<provVotos.length;i++){
    ruta.push(provVotos[i]);
    rutaAcum+=provVotos[i].votos_fp;
    if(rutaAcum>=votosActFP) break;
  }
  document.getElementById('obj-ruta').innerHTML =
    '<div style="font-size:.72rem;color:var(--muted);margin-bottom:.5rem">'
    +'Provincias clave FP (top por votos actuales) · '+ruta.length+' concentran base actual</div>'
    +ruta.slice(0,8).map(function(p,i){
      var gana2028 = (p.pct_fp + 2) > p.pct_prm;
      return '<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;border-bottom:1px solid var(--border)">'
        +'<span style="font-size:.65rem;color:var(--muted);min-width:18px">'+(i+1)+'</span>'
        +'<div style="flex:1"><div style="font-size:.78rem;font-weight:600">'+p.nombre+'</div>'
        +'<div style="font-size:.67rem;color:var(--muted)">FP: '+p.pct_fp+'% · PRM: '+p.pct_prm+'%</div></div>'
        +'<div style="text-align:right">'
        +'<div style="font-size:.75rem;font-weight:700;color:var(--fp)">'+fmt(p.votos_fp)+'</div>'
        +'<span style="font-size:.62rem;color:'+(gana2028?'var(--green)':'var(--muted)')+'">'+(gana2028?'✅ base ganadora':'Δ'+p.margen.toFixed(1)+'pp')+'</span></div></div>';
    }).join('');

  // Pivot y prioridad — misma lógica que antes
  _renderPivotYPrioridad(_PROV_METRICS_PRES||[]);
}

function _renderObjetivoSenadores(target){
  var senData = _PROV_SEN || [];
  var fpActual = senData.filter(function(p){return p.bloque_coalicion==='FP-coalicion';}).length;
  var prmActual = senData.filter(function(p){return p.bloque_coalicion==='PRM-coalicion';}).length;
  var metaCurules = target.meta_curules;
  var gapCurules = metaCurules - fpActual;

  document.getElementById('obj-kpis').innerHTML =
    kpi('purple','FP Senadores 2024',fpActual,'de 32 provincias')
    +kpi('blue','PRM Senadores 2024',prmActual,'de 32 provincias')
    +kpi('gold','Meta FP 2028',metaCurules,target.descripcion)
    +kpi('red','Faltan',Math.max(0,gapCurules),'senadores adicionales');

  // Provincias recuperables para senadores
  var recuperables = senData.filter(function(p){
    return p.bloque_coalicion!=='FP-coalicion' && p.margen_pp<15;
  }).sort(function(a,b){return a.margen_pp-b.margen_pp;});

  var necesarias = Math.max(0,gapCurules);
  document.getElementById('obj-meta-detalle').innerHTML =
    '<div style="margin-bottom:.75rem">'
    +'<div class="meta-progress-track"><div class="meta-progress-fill" style="width:'+Math.min(100,+(fpActual/metaCurules*100).toFixed(0))+'%;background:var(--fp)"></div></div>'
    +'<div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--muted);margin-top:.2rem">'
    +'<span>'+fpActual+' actuales</span><span>Meta: '+metaCurules+'</span></div>'
    +'</div>'
    +'<div style="font-size:.8rem;font-weight:700;margin-bottom:.5rem;color:var(--muted)">Necesita ganar '+necesarias+' provincia(s) adicional(es)</div>'
    +recuperables.slice(0,8).map(function(p){
      var col = p.margen_pp<5?'var(--green)':p.margen_pp<10?'var(--gold)':'var(--red)';
      return '<div style="display:flex;align-items:center;gap:.5rem;padding:.32rem 0;border-bottom:1px solid var(--border)">'
        +'<div style="flex:1"><div style="font-size:.78rem;font-weight:600">'+p.provincia+'</div>'
        +'<div style="font-size:.67rem;color:var(--muted)">Actual: '+p.ganador+' · Margen: '+p.margen_pp+'pp</div></div>'
        +'<span style="font-size:.75rem;font-weight:700;color:'+col+'">'+p.margen_pp.toFixed(1)+'pp</span>'
        +'<span style="font-size:.65rem;color:var(--muted)">'+(p.margen_pp<5?'Alcanzable':p.margen_pp<10?'Difícil':'Muy difícil')+'</span></div>';
    }).join('');

  document.getElementById('obj-ruta').innerHTML =
    '<div style="font-size:.72rem;color:var(--muted);margin-bottom:.5rem">Escenarios de composición del Senado 2028</div>'
    +[
      {esc:'Conservador',fp:fpActual,prm:prmActual,otros:32-fpActual-prmActual},
      {esc:'Base (+'+Math.min(necesarias,5)+')',fp:fpActual+Math.min(necesarias,5),prm:prmActual-Math.min(necesarias,5)+1,otros:0},
      {esc:'Optimista (mayoría)',fp:metaCurules,prm:32-metaCurules,otros:0}
    ].map(function(e){
      return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.7rem;margin-bottom:.4rem">'
        +'<div style="font-size:.72rem;font-weight:700;color:var(--muted);margin-bottom:.35rem">'+e.esc+'</div>'
        +'<div style="display:flex;gap:.5rem">'
        +'<div style="flex:'+e.fp+';background:var(--fp);height:8px;border-radius:99px"></div>'
        +'<div style="flex:'+Math.max(0,e.prm)+';background:var(--prm);height:8px;border-radius:99px"></div>'
        +(e.otros>0?'<div style="flex:'+e.otros+';background:var(--muted);height:8px;border-radius:99px"></div>':'')
        +'</div>'
        +'<div style="font-size:.68rem;color:var(--muted);margin-top:.2rem">FP:'+e.fp+' PRM:'+Math.max(0,e.prm)+' Otros:'+e.otros+'</div></div>';
    }).join('');

  _renderPivotYPrioridad(_PROV_SEN);
}

function _renderObjetivoDiputados(target){
  var dipData = _PROV_DIP || [];
  var dipCurules = M.Curules.getTotalByNivel('diputados');
  var fpActual = dipCurules.FP||0;
  var prmActual = dipCurules.PRM||0;
  var metaCurules = target.meta_curules;
  var gapCurules = metaCurules - fpActual;

  document.getElementById('obj-kpis').innerHTML =
    kpi('purple','FP Diputados 2024',fpActual,'de 178 territoriales')
    +kpi('blue','PRM Diputados 2024',prmActual,'de 178 territoriales')
    +kpi('gold','Meta FP 2028',metaCurules,target.descripcion)
    +kpi('red','Faltan',Math.max(0,gapCurules),'diputados adicionales');

  document.getElementById('obj-meta-detalle').innerHTML =
    '<div style="margin-bottom:.75rem">'
    +'<div class="meta-progress-track"><div class="meta-progress-fill" style="width:'+Math.min(100,+(fpActual/metaCurules*100).toFixed(0))+'%;background:var(--fp)"></div></div>'
    +'<div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--muted);margin-top:.2rem">'
    +'<span>'+fpActual+' actuales</span><span>Meta: '+metaCurules+'</span></div>'
    +'</div>'
    +'<div style="font-size:.78rem;font-weight:700;margin-bottom:.5rem;color:var(--muted)">Proyección escenarios diputados 2028</div>'
    +[
      {l:'Conservador (tendencia actual)',v:(fpActual+2)+' cur.',c:'var(--muted)'},
      {l:'Base (swing histórico)',v:(fpActual+8)+' cur.',c:'var(--gold)'},
      {l:'Optimista (alianza FP+PLD)',v:(fpActual+30)+' cur.',c:'var(--green)'},
      {l:'Meta establecida',v:metaCurules+' cur.',c:'var(--fp)'}
    ].map(function(r){return rowStat(r.l,r.v,r.c);}).join('');

  document.getElementById('obj-ruta').innerHTML =
    '<div style="font-size:.72rem;color:var(--muted);margin-bottom:.5rem">Circunscripciones con mayor potencial FP</div>'
    +dipData.slice().sort(function(a,b){return (b.pct_fp||0)-(a.pct_fp||0);}).slice(0,8).map(function(p,i){
      return '<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;border-bottom:1px solid var(--border)">'
        +'<span style="font-size:.65rem;color:var(--muted);min-width:18px">'+(i+1)+'</span>'
        +'<div style="flex:1"><div style="font-size:.78rem;font-weight:600">'+p.provincia+'</div>'
        +'<div style="font-size:.67rem;color:var(--muted)">FP: '+(p.pct_fp||0)+'% · PRM: '+(p.pct_prm||0)+'%</div></div>'
        +'<span style="font-size:.75rem;font-weight:700;color:var(--fp)">'+(p.pct_fp||0)+'%</span></div>';
    }).join('');

  _renderPivotYPrioridad(dipData);
}

function _renderPivotYPrioridad(ds){
  if(!ds||!ds.length){ 
    ['obj-pivot','obj-prioridad'].forEach(function(id){
      var el=document.getElementById(id);
      if(el) el.innerHTML='<p class="text-muted text-sm">Sin datos.</p>';
    });
    return;
  }
  var pivotData = ds.map(function(p){
    var inscritos = p.inscritos||1;
    var padronShare = (inscritos/8145548)*100*5;
    var margin = p.margen_pp||0;
    var competScore = (1-margin/100)*100;
    var mobScore = p.abstencion||0;
    var pivot = Math.min(100, padronShare*0.35 + competScore*0.35 + mobScore*0.30);
    return { nombre:p.provincia, pivot:+pivot.toFixed(1),
             margen:margin, fp:p.pct_fp||0, prm:p.pct_prm||0,
             cat: pivot>60?'CRÍTICA':pivot>40?'IMPORTANTE':'SECUNDARIA',
             inscritos:inscritos };
  }).sort(function(a,b){return b.pivot-a.pivot;});

  var pivotEl=document.getElementById('obj-pivot');
  if(pivotEl) pivotEl.innerHTML = pivotData.slice(0,10).map(function(p){
    var col=p.cat==='CRÍTICA'?'var(--red)':p.cat==='IMPORTANTE'?'var(--gold)':'var(--muted)';
    return '<div style="display:flex;align-items:center;gap:.5rem;padding:.35rem 0;border-bottom:1px solid var(--border)">'
      +'<div style="flex:1"><div style="font-size:.8rem;font-weight:700">'+p.nombre+'</div>'
      +'<div style="font-size:.68rem;color:var(--muted)">Margen: '+p.margen.toFixed(1)+'pp · FP: '+p.fp+'%</div></div>'
      +'<div style="text-align:right">'
      +'<div style="font-size:.9rem;font-weight:800;color:var(--fp)">'+p.pivot+'</div>'
      +'<span style="font-size:.62rem;font-weight:700;color:'+col+'">'+p.cat+'</span></div></div>';
  }).join('');

  var priorData = pivotData.map(function(p){
    var metricOrig = ds.find(function(x){return x.provincia===p.nombre;})||{};
    var gap = metricOrig.votos_gap_fp||0;
    var gapNorm = Math.max(0,1-(gap/200000));
    var probNorm = (p.fp/100)*1.2;
    var score = (p.pivot/100)*0.40 + gapNorm*0.30 + Math.min(1,probNorm)*0.30;
    return { nombre:p.nombre, score:+(score*100).toFixed(1), gap:gap, fp:p.fp,
             prioridad: score>0.65?'MÁXIMA':score>0.50?'ALTA':score>0.35?'MEDIA':'BAJA' };
  }).sort(function(a,b){return b.score-a.score;});

  var priorEl=document.getElementById('obj-prioridad');
  if(priorEl) priorEl.innerHTML = priorData.slice(0,10).map(function(p,i){
    var col=p.prioridad==='MÁXIMA'?'var(--red)':p.prioridad==='ALTA'?'var(--orange)':p.prioridad==='MEDIA'?'var(--gold)':'var(--muted)';
    return '<div style="display:flex;align-items:center;gap:.5rem;padding:.35rem 0;border-bottom:1px solid var(--border)">'
      +'<span style="font-size:.65rem;color:var(--muted);min-width:18px">'+(i+1)+'</span>'
      +'<div style="flex:1"><div style="font-size:.8rem;font-weight:700">'+p.nombre+'</div>'
      +'<div style="font-size:.68rem;color:var(--muted)">FP: '+p.fp+'% · Gap: '+fmt(p.gap)+'</div></div>'
      +'<div style="text-align:right">'
      +'<div style="font-size:.85rem;font-weight:800;color:var(--accent)">'+p.score+'</div>'
      +'<span style="font-size:.62rem;font-weight:700;color:'+col+'">'+p.prioridad+'</span></div></div>';
  }).join('');
}

// ====== SIMULADOR TRI-NIVEL ======
var SIM_P = ['PRM','FP','PLD','PRD','PCR'];
var SIM_DEFAULTS = {
  presidencial: {PRM:57,FP:29,PLD:10,PRD:2,PCR:2},
  senadores:    {PRM:45,FP:32,PLD:12,PRD:5,PCR:6},
  diputados:    {PRM:46,FP:29,PLD:12,PRD:7,PCR:6}
};
var _SIM_NIVEL = 'presidencial';
window._simInit = false;

function initSimulador(){
  window._simInit = true;
  _renderSimSliders();
  document.getElementById('btn-simular').addEventListener('click', runSimulation);
  var resetBtn = document.getElementById('btn-sim-reset');
  if(resetBtn) resetBtn.addEventListener('click', function(){
    var defs = SIM_DEFAULTS[_SIM_NIVEL];
    SIM_P.forEach(function(p){
      var sl=document.getElementById('sim-'+p); var sv=document.getElementById('sv-'+p);
      if(sl){sl.value=defs[p]||0;} if(sv){sv.textContent=(defs[p]||0)+'%';}
    });
    runSimulation();
  });
}

function _renderSimSliders(){
  var defs = SIM_DEFAULTS[_SIM_NIVEL];
  document.getElementById('sim-sliders').innerHTML = SIM_P.map(function(p){
    var v=defs[p]||0;
    return '<div class="slider-row">'
      +'<span class="slider-party" style="color:'+pc(p)+'">'+p+'</span>'
      +'<input type="range" id="sim-'+p+'" min="0" max="80" value="'+v+'" style="accent-color:'+pc(p)+'"'
      +' oninput="document.getElementById(\'sv-'+p+'\').textContent=this.value+\'%\'" onchange="runSimulation()">'
      +'<span class="slider-val" id="sv-'+p+'">'+v+'%</span>'
      +'</div>';
  }).join('');
}


// ── Simulación presidencial ──
function _simPresidencial(pcts, partFactor){
  var totalPct = Object.values(pcts).reduce(function(s,n){return s+n;},0)||1;
  var padron2028 = 8700000;
  var votantesProy = Math.round(padron2028 * (partFactor * 0.54));
  var votosParC = {};
  SIM_P.forEach(function(p){ votosParC[p] = Math.round((pcts[p]||0)/totalPct * votantesProy * 0.97); });
  var totalVotos = Object.values(votosParC).reduce(function(s,n){return s+n;},0);
  var sortedP = Object.entries(votosParC).sort(function(a,b){return b[1]-a[1];});
  var ganador = sortedP[0]; var segundo = sortedP[1];
  var pctGanador = totalVotos ? +(ganador[1]/totalVotos*100).toFixed(2) : 0;
  var pctSegundo = totalVotos ? +(segundo[1]/totalVotos*100).toFixed(2) : 0;
  var leg = M.Escenarios.simularLegislativo(pcts);
  var legTotal = leg ? leg.total : {};
  return {
    tipo:'presidencial', votos:votosParC, total_votos:totalVotos, total:legTotal,
    ganador:{id:ganador[0],votos:ganador[1],pct:pctGanador},
    segundo:{id:segundo[0],votos:segundo[1],pct:pctSegundo},
    ballotage:pctGanador<50, margen:+(pctGanador-pctSegundo).toFixed(2),
    participacion:+(votantesProy/padron2028*100).toFixed(1),
    padron_proyectado:padron2028, votantes_proyectados:votantesProy,
    analisis: leg ? leg.analisis : {partidos_bajo_umbral:[]}
  };
}

// ── Simulación senadores ──
function _simSenadores(pcts, partFactor){
  var provSen = _PROV_SEN || [];
  var senResult = {};
  SIM_P.forEach(function(p){ senResult[p]=0; });
  if(provSen.length){
    provSen.forEach(function(prov){
      var best=null, bestPct=0;
      SIM_P.forEach(function(p){
        var pp=(pcts[p]||0)+(Math.random()-0.5)*6;
        if(pp>bestPct){bestPct=pp;best=p;}
      });
      if(best) senResult[best]=(senResult[best]||0)+1;
    });
  } else {
    var dh=M.Escenarios.simularLegislativo(pcts);
    if(dh) return Object.assign({tipo:'senadores',total:dh.senadores,analisis:dh.analisis},{senadores:dh.senadores});
  }
  var leg=M.Escenarios.simularLegislativo(pcts);
  return {
    tipo:'senadores', senadores:senResult, total:senResult,
    total_legislativo:leg?leg.total:{},
    analisis:{partidos_bajo_umbral:SIM_P.filter(function(p){return (pcts[p]||0)<2;})}
  };
}


function runSimulation(){
  var pcts = {};
  SIM_P.forEach(function(p){ pcts[p]=parseInt(document.getElementById('sim-'+p).value)||0; });

  // Alianza FP+PLD
  var alianza = document.getElementById('sim-alianza') && document.getElementById('sim-alianza').value==='si';
  var pctsEff = Object.assign({},pcts);
  if(alianza){ pctsEff.FP=(pctsEff.FP||0)+(pctsEff.PLD||0); pctsEff.PLD=0; }

  // Encuesta override (50/50 Bayesian)
  var encPRM=parseFloat(document.getElementById('sim-enc-prm')&&document.getElementById('sim-enc-prm').value)||0;
  var encFP =parseFloat(document.getElementById('sim-enc-fp') &&document.getElementById('sim-enc-fp').value) ||0;
  if(encPRM>0||encFP>0){
    pctsEff.PRM=Math.round(pctsEff.PRM*0.5+encPRM*0.5);
    pctsEff.FP =Math.round(pctsEff.FP *0.5+encFP *0.5);
  }

  // Participación
  var partInput=parseFloat(document.getElementById('sim-participacion')&&document.getElementById('sim-participacion').value)||54;
  var partFactor=partInput/54;

  var result;
  if(_SIM_NIVEL==='presidencial'){
    result=_simPresidencial(pctsEff,partFactor);
  } else if(_SIM_NIVEL==='senadores'){
    result=_simSenadores(pctsEff,partFactor);
  } else {
    result=M.Escenarios.simularLegislativo(pctsEff);
  }
  if(!result){ document.getElementById('sim-results').innerHTML='<p class="text-muted text-sm">Ajusta los valores.</p>'; return; }

  var total = result.total ? Object.values(result.total).reduce(function(s,n){return s+n;},0) : 0;
  var sorted = result.total ? Object.entries(result.total).sort(function(a,b){return b[1]-a[1];}) : [];
  var analisis = result.analisis || {partidos_bajo_umbral:[]};

  // Badge escenario
  var badge=document.getElementById('sim-escenario-badge');
  if(badge) badge.textContent = _SIM_NIVEL.charAt(0).toUpperCase()+_SIM_NIVEL.slice(1)+(alianza?' + Alianza FP+PLD':'');

  // Render principal según nivel
  var mainHtml = '';
  if(_SIM_NIVEL==='presidencial' && result.ganador){
    var ganador=result.ganador;
    var ballotage=result.ballotage;
    mainHtml += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.9rem;margin-bottom:.75rem">'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem">'
      +'<div><div style="font-size:.65rem;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:.2rem">Ganador presidencial</div>'
      +'<div style="font-size:1.3rem;font-weight:800;color:'+pc(ganador.id)+'">'+ganador.id+' '+ganador.pct+'%</div>'
      +'<div style="font-size:.7rem;color:var(--muted)">'+fmt(ganador.votos)+' votos proy.</div></div>'
      +'<div><div style="font-size:.65rem;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:.2rem">Ballotage</div>'
      +'<div style="font-size:1.3rem;font-weight:800;color:'+(ballotage?'var(--red)':'var(--green)')+'">'+( ballotage?'SÍ':'NO')+'</div>'
      +'<div style="font-size:.7rem;color:var(--muted)">Margen: '+result.margen+'pp</div></div>'
      +'</div>'
      +'<div style="font-size:.7rem;color:var(--muted)">Participación proyectada: '+result.participacion+'% · Padrón 2028: '+fmt(result.padron_proyectado)+'</div>'
      +'</div>';
  } else if(_SIM_NIVEL==='senadores' && result.senadores){
    var senSorted=Object.entries(result.senadores).sort(function(a,b){return b[1]-a[1];});
    mainHtml += '<div style="margin-bottom:.75rem">'
      +'<div style="font-size:.72rem;color:var(--muted);margin-bottom:.4rem">Distribución Senado 2028 (32 escaños · mayoría: 17)</div>'
      +'<div style="display:flex;gap:2px;height:28px;border-radius:4px;overflow:hidden;margin-bottom:.4rem">'
      +senSorted.filter(function(e){return e[1]>0;}).map(function(e){
        return '<div style="flex:'+e[1]+';background:'+pc(e[0])+'" title="'+e[0]+': '+e[1]+'"></div>';
      }).join('')+'</div>'
      +senSorted.filter(function(e){return e[1]>0;}).map(function(e){
        return '<div style="display:flex;align-items:center;gap:.4rem;padding:.2rem 0">'
          +'<div style="width:9px;height:9px;border-radius:2px;background:'+pc(e[0])+'"></div>'
          +'<span style="font-size:.78rem;font-weight:700;color:'+pc(e[0])+'">'+e[0]+'</span>'
          +'<span style="font-size:.78rem;font-weight:800;color:var(--text)">'+e[1]+'</span></div>';
      }).join('')
      +'<p class="note" style="margin-top:.4rem">Simulación por mayoría simple · Varianza territorial ±6pp</p>'
      +'</div>';
    sorted=[]; // Ya renderizado
  }

  if(sorted.length){
    mainHtml += '<div style="margin-bottom:.75rem;font-size:.72rem;color:var(--muted)">'
      +'Total curules: '+total+' · May. simple: 112 · May. calif.: 148<br>'
      +(analisis.partidos_bajo_umbral.length?'Bajo umbral 2%: '+analisis.partidos_bajo_umbral.join(', '):'Todos sobre umbral 2%')+'</div>'
      +sorted.map(function(e){
        var diffA = alianza && result.total_sin_alianza ? (result.total[e[0]]||0)-(result.total_sin_alianza[e[0]]||0) : 0;
        return '<div style="display:flex;align-items:center;gap:.5rem;padding:.32rem 0;border-bottom:1px solid var(--border)">'
          +'<span style="font-size:.8rem;font-weight:700;color:'+pc(e[0])+';min-width:38px">'+e[0]+'</span>'
          +'<div class="bar-track" style="flex:1"><div class="bar-fill" style="width:'+(total?+(e[1]/total*100).toFixed(0):0)+'%;background:'+pc(e[0])+'"></div></div>'
          +'<span style="font-size:.95rem;font-weight:800;color:'+pc(e[0])+';min-width:26px;text-align:right">'+e[1]+'</span></div>';
      }).join('')
      +'<div class="divider"></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem;font-size:.7rem">'
      +(_SIM_NIVEL==='diputados'||result.tipo==='presidencial'?
        '<div><span class="text-muted">Senadores:</span> '+Object.entries(result.senadores||{}).filter(function(e){return e[1]>0;}).map(function(e){return e[0]+':'+e[1];}).join(', ')+'</div>'
        +'<div><span class="text-muted">Diputados:</span> '+Object.entries(result.diputados||{}).filter(function(e){return e[1]>0;}).map(function(e){return e[0]+':'+e[1];}).join(', ')+'</div>'
        :'')
      +'</div>';
  }

  document.getElementById('sim-results').innerHTML = mainHtml
    +'<p class="note">D\u0027Hondt con umbral 2% \u2014 Ley Electoral RD 275-97, Art. 68</p>';

  // KPIs y análisis presidencial
  var simKpis=document.getElementById('sim-kpis');
  if(simKpis){
    var kpiGanador = result.ganador ? result.ganador : (sorted[0]?{id:sorted[0][0],pct:+(sorted[0][1]/total*100).toFixed(1)}:{id:'?',pct:0});
    simKpis.innerHTML =
      kpi('blue','Ganador '+_SIM_NIVEL,kpiGanador.id,kpiGanador.pct+'%')
      +kpi(result.ballotage?'red':'green','Ballotage',result.ballotage?'SÍ':'NO',result.ballotage?'2da vuelta':'1ra vuelta')
      +kpi('purple','FP curules',result.total&&result.total.FP?result.total.FP:'—','legislativo')
      +kpi('gold','Participación',partInput+'%','escenario simulado');
  }
  var presAnalysis=document.getElementById('sim-pres-analysis');
  if(presAnalysis){
    presAnalysis.innerHTML = [
      rowStat('Nivel simulado',_SIM_NIVEL,'var(--text)'),
      rowStat('Alianza FP+PLD',alianza?'ACTIVA':'INACTIVA',alianza?'var(--green)':'var(--muted)'),
      rowStat('Participación configurada',partInput+'%'),
      rowStat('Encuesta override',encPRM>0||encFP>0?'PRM:'+encPRM+'% FP:'+encFP+'%':'No aplicada','var(--muted)'),
      rowStat('Mayoría simple (112 cur.)',(result.total&&(result.total.PRM>=112||result.total.FP>=112))?'SÍ':'NO',(result.total&&(result.total.PRM>=112||result.total.FP>=112))?'var(--green)':'var(--muted)'),
    ].join('');
  }
}


// ====== PROYECCION v9.1 ======
window._proyInit = false;

function _calcSwingNacional(){
  // Swing histórico 2020→2024 desde datos reales
  var res20 = _DS_RESULTADOS_2020 && _DS_RESULTADOS_2020.niveles &&
              _DS_RESULTADOS_2020.niveles.presidencial &&
              _DS_RESULTADOS_2020.niveles.presidencial.resultados || {};
  var tot20 = Object.values(res20).reduce(function(s,v){return s+v;},0);
  var res24 = {};
  (_PROV_METRICS_PRES||[]).forEach(function(p){
    Object.entries(p.blocs||{}).forEach(function(e){ res24[e[0]]=(res24[e[0]]||0)+e[1]; });
  });
  var tot24 = Object.values(res24).reduce(function(s,v){return s+v;},0);
  var swing = {};
  ['PRM','FP','PLD'].forEach(function(p){
    var pct20 = tot20 ? +(( res20[p]||0)/tot20*100).toFixed(2) : 0;
    var pct24 = tot24 ? +((res24[p]||0)/tot24*100).toFixed(2) : 0;
    swing[p] = { pct20:pct20, pct24:pct24, delta:+(pct24-pct20).toFixed(2) };
  });
  return swing;
}

function _proyectarConParticipacion(participacion){
  var swing = _calcSwingNacional();
  var PARTIDOS = ['PRM','FP','PLD'];
  var BASE = { PRM:{votos_pct:57.44,es_incumbente:true,ciclos:1},
               FP: {votos_pct:28.85,es_incumbente:false,ciclos:0},
               PLD:{votos_pct:10.39,es_incumbente:false,ciclos:0} };
  var result = {};
  PARTIDOS.forEach(function(p){
    var base = BASE[p];
    var proy = base.votos_pct;
    // Swing histórico × 0.35
    var sw = swing[p] ? swing[p].delta * 0.35 : 0;
    proy += sw;
    // Incumbencia × 1.02 (no aditivo)
    if(base.es_incumbente){ proy *= 1.02; }
    // Fatiga 8 años
    if(base.es_incumbente && base.ciclos>=2){ proy -= 2.0; }
    // Normalización histórica
    var factorH = M.NormalizacionHistorica.factorAjusteProyeccion(p);
    if(factorH && factorH.multiplicador !== 1.00){ proy = proy * factorH.multiplicador; }
    // Ajuste participación relativa a base 54%
    var adj_partic = ((participacion - 0.54) / 0.54) * (p==='FP'?2.5:p==='PRM'?-1.5:0);
    proy += adj_partic;
    result[p] = { base_2024:base.votos_pct, proyectado:+Math.max(0,Math.min(100,proy)).toFixed(2),
                  swing_aplicado:sw, es_incumbente:base.es_incumbente,
                  normalizacion: factorH && factorH.multiplicador!==1 ? factorH : null };
  });
  var total = Object.values(result).reduce(function(s,x){return s+x.proyectado;},0);
  Object.values(result).forEach(function(x){ x.proyectado_norm = +(x.proyectado/total*100).toFixed(2); });
  return result;
}

function initProyeccion(){
  window._proyInit = true;
  renderProyFundamentals(null);

  var crec = M.CrecimientoPadron.proyectar();
  document.getElementById('proy-padron').innerHTML = [
    rowStat('Padr\u00f3n 2016',fmt(crec.historico[0].padron)),
    rowStat('Padr\u00f3n 2020',fmt(crec.historico[1].padron)),
    rowStat('Padr\u00f3n 2024',fmt(crec.historico[2].padron),'var(--text)'),
    rowStat('CAGR 2020-2024',crec.cagr_4yr+'%'),
    rowStat('CAGR 2016-2024',crec.cagr_8yr+'%'),
    rowStat('Proyecci\u00f3n 2028 (bajo)',fmt(crec.padron_2028_bajo)),
    rowStat('Proyecci\u00f3n 2028 (alto)',fmt(crec.padron_2028_alto)),
    rowStat('Proyecci\u00f3n 2028 (medio)',fmt(crec.padron_2028_medio),'var(--green)'),
    rowStat('Nuevos electores netos',fmt(crec.nuevos_electores),'var(--gold)'),
  ].join('')+'<p class="note">'+crec.metodologia+' \u2014 Fuente: JCE 2016, 2020, 2024</p>';

  document.getElementById('encuestas-panel').innerHTML =
    '<div style="margin-bottom:.75rem;font-size:.8rem;color:var(--muted)">Ingresa encuestas para activar el modelo Bayesiano (Fundamentals + Encuestas).</div>'
    +'<div id="polls-list" style="margin-bottom:.75rem"></div>'
    +'<div style="display:grid;grid-template-columns:repeat(5,1fr) auto;gap:.4rem;align-items:end">'
    +'<div><div style="font-size:.68rem;color:var(--muted);margin-bottom:.2rem">Fecha</div>'
    +'<input id="poll-fecha" type="date" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:.32rem .45rem;border-radius:var(--r);font-size:.76rem;width:100%"></div>'
    +'<div><div style="font-size:.68rem;color:var(--muted);margin-bottom:.2rem">PRM%</div>'
    +'<input id="poll-prm" type="number" min="0" max="100" placeholder="48" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:.32rem .45rem;border-radius:var(--r);font-size:.76rem;width:100%"></div>'
    +'<div><div style="font-size:.68rem;color:var(--muted);margin-bottom:.2rem">FP%</div>'
    +'<input id="poll-fp" type="number" min="0" max="100" placeholder="27" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:.32rem .45rem;border-radius:var(--r);font-size:.76rem;width:100%"></div>'
    +'<div><div style="font-size:.68rem;color:var(--muted);margin-bottom:.2rem">N muestral</div>'
    +'<input id="poll-n" type="number" min="100" max="5000" placeholder="600" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:.32rem .45rem;border-radius:var(--r);font-size:.76rem;width:100%"></div>'
    +'<div><div style="font-size:.68rem;color:var(--muted);margin-bottom:.2rem">Calidad</div>'
    +'<select id="poll-cal" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:.32rem .45rem;border-radius:var(--r);font-size:.76rem;width:100%">'
    +'<option>A+</option><option>A</option><option selected>B</option><option>C</option><option>D</option></select></div>'
    +'<button id="btn-add-poll" style="background:var(--accent);color:#fff;border:none;padding:.32rem .7rem;border-radius:var(--r);font-weight:700;cursor:pointer;font-size:.78rem;white-space:nowrap">+ A\u00f1adir</button></div>';

  window._polls = [];
  document.getElementById('btn-add-poll').addEventListener('click', function(){
    var fecha = document.getElementById('poll-fecha').value;
    var prm   = parseFloat(document.getElementById('poll-prm').value);
    var fp    = parseFloat(document.getElementById('poll-fp').value);
    var n     = parseInt(document.getElementById('poll-n').value)||600;
    var cal   = document.getElementById('poll-cal').value;
    if(!fecha||isNaN(prm)||isNaN(fp)) return;
    window._polls.push({fecha:fecha,PRM:prm,FP:fp,n:n,calidad:cal});
    M.Encuestas.cargar(window._polls);
    var agg = M.Encuestas.agregar(['PRM','FP','PLD']);
    renderProyFundamentals(agg);
    document.getElementById('polls-list').innerHTML =
      '<div style="font-size:.73rem;color:var(--green);margin-bottom:.35rem">\u2705 '+window._polls.length+' encuesta(s) \u2014 Promedio: PRM '+agg.promedio.PRM+'% / FP '+agg.promedio.FP+'%</div>'
      +window._polls.map(function(p){return '<div style="font-size:.7rem;color:var(--muted)">'+p.fecha+' \u00b7 PRM:'+p.PRM+'% FP:'+p.FP+'% \u00b7 n='+p.n+' \u00b7 cal:'+p.calidad+'</div>';}).join('');
  });

  // Escenarios automáticos + swing + territorial
  renderProyEscenarios();
  renderProySwing();
  renderProyTerritorial();
  renderProyTerritorialSenadores();
  renderProyTerritorialDiputados();
}

// renderProyeccion: puede llamarse N veces (refresh) desde el nav
function renderProyeccion(){
  renderProyFundamentals(window._polls && window._polls.length
    ? M.Encuestas.agregar(['PRM','FP','PLD'])
    : null);
  renderProyEscenarios();
  renderProySwing();
  renderProyTerritorial();
  renderProyTerritorialSenadores();
  renderProyTerritorialDiputados();
}

function renderProyEscenarios(){
  var esc = {
    pesimista: _proyectarConParticipacion(0.50),
    base:      _proyectarConParticipacion(0.54),
    optimista: _proyectarConParticipacion(0.58)
  };
  ['pesimista','base','optimista'].forEach(function(e){
    var pFP = esc[e].FP ? esc[e].FP.proyectado_norm : '?';
    var pPRM = esc[e].PRM ? esc[e].PRM.proyectado_norm : '?';
    var elId = e==='pesimista'?'esc-p-fp':e==='base'?'esc-b-fp':'esc-o-fp';
    var el = document.getElementById(elId);
    if(el) el.innerHTML = '<span style="color:var(--fp)">FP '+pFP+'%</span>'
      +'<br><span style="font-size:.78rem;color:var(--prm)">PRM '+pPRM+'%</span>';
  });
}

function renderProySwing(){
  var swing = _calcSwingNacional();
  var el = document.getElementById('proy-swing');
  if(!el) return;
  el.innerHTML = ['PRM','FP','PLD'].map(function(p){
    var s = swing[p]||{pct20:0,pct24:0,delta:0};
    var col = s.delta>0?'var(--green)':s.delta<0?'var(--red)':'var(--muted)';
    var aplicado = +(s.delta*0.35).toFixed(2);
    return '<div style="padding:.55rem 0;border-bottom:1px solid var(--border)">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem">'
      +'<span style="font-weight:700;color:'+pc(p)+'">'+p+'</span>'
      +'<div style="text-align:right"><span style="font-size:.9rem;font-weight:800;color:'+col+'">'+(s.delta>0?'+':'')+s.delta+'pp</span>'
      +'<span style="font-size:.68rem;color:var(--muted);margin-left:.35rem">→ aplica '+(aplicado>0?'+':'')+aplicado+'pp</span></div></div>'
      +'<div style="font-size:.7rem;color:var(--muted)">2020: '+s.pct20+'% · 2024: '+s.pct24+'% · Factor swing: ×0.35</div>'
      +'<div class="bar-track" style="margin-top:.2rem">'
      +'<div class="bar-fill" style="width:'+Math.min(100,Math.abs(s.delta)*5)+'%;background:'+col+'"></div></div>'
      +'</div>';
  }).join('');
}

function renderProyTerritorial(){
  var el = document.getElementById('proy-territorial');
  if(!el) return;
  var swing = _calcSwingNacional();
  var swingFP = swing.FP ? swing.FP.delta : 0;
  var provData = (_PROV_METRICS_PRES||[]).slice().sort(function(a,b){
    // Ordenar por proximidad a FP ganar
    var mA = a.pct_fp||0, mB = b.pct_fp||0;
    return mB - mA;
  }).slice(0,12);

  el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:.4rem">'
  +provData.map(function(p){
    var fpBase = p.pct_fp||0;
    var prmBase = p.pct_prm||0;
    var fpProy = +(fpBase + swingFP*0.35).toFixed(1);
    var diff = +(fpProy - fpBase).toFixed(1);
    var gana = fpProy > prmBase;
    var colGana = gana ? 'var(--green)' : 'var(--muted)';
    return '<div style="background:var(--bg3);border:1px solid '+(gana?'var(--fp)':'var(--border)')+';border-radius:var(--r);padding:.55rem .75rem">'
      +'<div style="font-size:.76rem;font-weight:700;margin-bottom:.15rem">'+p.provincia+'</div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center">'
      +'<div style="font-size:.7rem;color:var(--muted)">FP actual: '+fpBase+'%</div>'
      +'<div style="font-size:.85rem;font-weight:800;color:var(--fp)">→ '+fpProy+'%'
      +'<span style="font-size:.65rem;color:'+(diff>0?'var(--green)':'var(--red)')+';margin-left:.25rem">'+(diff>0?'+':'')+diff+'pp</span></div></div>'
      +'<div style="font-size:.68rem;margin-top:.2rem;color:'+colGana+'">'+(gana?'✅ Proyecta victoria FP':'PRM: '+prmBase+'% · Brecha '+(prmBase-fpProy).toFixed(1)+'pp')+'</div>'
      +'</div>';
  }).join('')+'</div>';
}

function renderProyFundamentals(polls_agg){
  var proy = M.Proyeccion.proyectar({}, polls_agg ? polls_agg.promedio : null);
  var partidos = Object.keys(proy);
  var statusNorm = M.NormalizacionHistorica.getStatus();
  var normBanner = '<div style="background:var(--bg3);border:1px solid '+(statusNorm.modo==='PROXY'?'var(--gold)':'var(--green)')+';border-radius:var(--r);padding:.5rem .75rem;margin-bottom:.75rem;font-size:.72rem">'
    +'<span style="font-weight:700;color:'+(statusNorm.modo==='PROXY'?'var(--gold)':'var(--green)')+'">MotorNormalizacionHistorica: '+statusNorm.modo+'</span>'
    +(statusNorm.advertencia?' <span style="color:var(--muted)">\u2014 '+statusNorm.advertencia+'</span>':'')
    +'</div>';

  document.getElementById('proy-fundamentals').innerHTML = normBanner + partidos.map(function(p){
    var d = proy[p];
    var diff = +(d.proyectado - d.base_2024).toFixed(2);
    var diffStr = diff>=0?'+'+diff:''+diff;
    var normTag = d.ajuste_normalizacion
      ? '<span style="font-size:.62rem;background:var(--bg3);color:var(--gold);border:1px solid var(--gold)33;border-radius:.2rem;padding:.08rem .3rem;margin-left:.35rem">norm x'+d.ajuste_normalizacion.multiplicador+'</span>'
      : '';
    return '<div style="padding:.55rem 0;border-bottom:1px solid var(--border)">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.28rem">'
      +'<span style="font-weight:700;color:'+pc(p)+'">'+p+(d.es_incumbente?' \ud83c\udfc6':'')+normTag+'</span>'
      +'<div style="text-align:right">'
      +'<span style="font-size:1.05rem;font-weight:800;color:'+pc(p)+'">'+d.proyectado_norm+'%</span>'
      +'<span style="font-size:.7rem;color:'+(diff>=0?'var(--green)':'var(--red)')+';margin-left:.4rem">'+diffStr+'pp</span></div></div>'
      +'<div class="bar-track"><div class="bar-fill" style="width:'+d.proyectado_norm+'%;background:'+pc(p)+'"></div></div>'
      +'<div style="font-size:.68rem;color:var(--muted);margin-top:.2rem">Base 2024: '+d.base_2024+'% \u00b7 '+d.metodologia
      +(d.ajuste_normalizacion?' \u00b7 '+d.ajuste_normalizacion.razon:'')+'</div></div>';
  }).join('');
}


// ── Proyección territorial senadores 2028 ──
function renderProyTerritorialSenadores(){
  var el = document.getElementById('proy-sen-territorial');
  if(!el) return;
  var provSen = _PROV_SEN || [];
  if(!provSen.length){ el.innerHTML='<p class="text-muted text-sm">Sin datos de senadores.</p>'; return; }
  var swing = M.Proyeccion.calcularSwingHistorico ? M.Proyeccion.calcularSwingHistorico() : {};
  var swingFP = swing.FP ? swing.FP.delta : 2.5;
  var data = provSen.map(function(p){
    var fpBase = p.pct_fp || (p.bloque_coalicion==='FP-coalicion'?p.pct_ganador:0);
    var fpProy = +(fpBase + swingFP * 0.35).toFixed(1);
    var prmBase = p.pct_prm || (p.bloque_coalicion==='PRM-coalicion'?p.pct_ganador:0);
    var prmProy = +(prmBase - swingFP * 0.2).toFixed(1);
    return { nombre:p.provincia, fpBase:fpBase, fpProy:fpProy, prmBase:prmBase, prmProy:prmProy,
             ganadorActual:p.ganador, gana2028:fpProy>prmProy,
             margen:p.margen_pp||0 };
  });
  var ganaFP = data.filter(function(d){return d.gana2028;}).length;
  el.innerHTML = '<div style="font-size:.72rem;color:var(--muted);margin-bottom:.5rem">FP proyecta ganar '+ganaFP+'/32 provincias · Swing aplicado: '+(swingFP>0?'+':'')+swingFP+'pp × 0.35</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:.35rem">'
    +data.map(function(d){
      var col = d.gana2028?'var(--fp)':'var(--muted)';
      return '<div style="background:var(--bg3);border:1px solid '+(d.gana2028?'var(--fp)':'var(--border)')+';border-radius:var(--r);padding:.45rem .65rem">'
        +'<div style="font-size:.75rem;font-weight:700;margin-bottom:.15rem">'+d.nombre+'</div>'
        +'<div style="display:flex;justify-content:space-between;font-size:.7rem">'
        +'<span style="color:var(--fp)">FP: '+d.fpBase+'% → '+d.fpProy+'%</span>'
        +'<span style="color:'+col+'">'+(d.gana2028?'✅ WIN':'—')+'</span></div>'
        +'<div style="font-size:.67rem;color:var(--muted)">PRM: '+d.prmBase+'% → '+d.prmProy+'%</div></div>';
    }).join('')+'</div>';
}

// ── Proyección territorial diputados 2028 ──
function renderProyTerritorialDiputados(){
  var el = document.getElementById('proy-dip-territorial');
  if(!el) return;
  var provDip = _PROV_DIP || [];
  if(!provDip.length){ el.innerHTML='<p class="text-muted text-sm">Sin datos de diputados.</p>'; return; }
  var swing = M.Proyeccion.calcularSwingHistorico ? M.Proyeccion.calcularSwingHistorico() : {};
  var swingFP = swing.FP ? swing.FP.delta : 2.5;
  var data = provDip.map(function(p){
    var fpBase = p.pct_fp||0;
    var fpProy = +(fpBase + swingFP * 0.35).toFixed(1);
    return { nombre:p.provincia, fpBase:fpBase, fpProy:fpProy, curules:p.curules_fp||0 };
  }).sort(function(a,b){return b.fpProy-a.fpProy;});
  el.innerHTML = '<div style="font-size:.72rem;color:var(--muted);margin-bottom:.4rem">Top circunscripciones FP — proyección 2028</div>'
    +data.slice(0,12).map(function(d,i){
      return '<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;border-bottom:1px solid var(--border)">'
        +'<span style="font-size:.65rem;color:var(--muted);min-width:18px">'+(i+1)+'</span>'
        +'<div style="flex:1"><div style="font-size:.77rem;font-weight:600">'+d.nombre+'</div></div>'
        +'<span style="color:var(--fp);font-size:.8rem;font-weight:700">'+d.fpBase+'% → '+d.fpProy+'%</span></div>';
    }).join('');
}

// ====== REPLAY ======
function renderReplay(){
  var result = M.Replay.run(M.Resultados, M.Curules, M.Padron);
  document.getElementById('replay-checks').innerHTML = result.checks.map(function(c){
    return '<div class="replay-step '+(c.ok?'ok':'fail')+'">'
      +'<span class="replay-icon">'+c.icon+'</span>'
      +'<span class="replay-name">'+c.name+'</span>'
      +'<span class="replay-status">'+c.status+'</span></div>';
  }).join('');

  document.getElementById('replay-summary').innerHTML =
    '<div style="text-align:center;padding:1.5rem 0">'
    +'<div style="font-size:2.8rem">'+(result.pct>=100?'\ud83c\udf89':'\u26a0\ufe0f')+'</div>'
    +'<div style="font-size:1.25rem;font-weight:800;margin:.5rem 0;color:'+(result.pct>=100?'var(--green)':'var(--gold)')+'">'+result.passed+'/'+result.total+' verificaciones</div>'
    +'<div class="text-muted text-sm">Modo REPLAY \u00b7 Dataset 2024</div>'
    +(valResult.errores.length?'<div style="margin-top:.75rem;color:var(--red);font-size:.76rem">Errores: '+valResult.errores.join(', ')+'</div>'
      :'<div style="margin-top:.75rem;color:var(--green);font-size:.76rem">\u2705 Validaci\u00f3n interna OK \u2014 sin errores</div>')
    +'</div>';
}

// ====== MOTORES ======
function renderMotores(){
  var MOTORES_ON = [
    {n:'Motor Carga',          d:'Datasets 2024 embebidos, validados al inicio'},
    {n:'Motor Validaci\u00f3n', d:'Consistencia interna: votos, partidos, curules (MIT Election Data Lab)'},
    {n:'Motor Padr\u00f3n',     d:'padron.padron[] \u2014 getPadronNacional/Prov/Mun (Leighley & Nagler 2013)'},
    {n:'Motor Resultados',     d:'Agregaci\u00f3n por bloques electorales (Golder 2006)'},
    {n:'Motor Territorial',    d:'Cat\u00e1logo provincias/municipios/circunscripciones'},
    {n:'Motor Alianzas',       d:'Fuerza de coalici\u00f3n, escenario sin alianza (Golder 2006)'},
    {n:'Motor Curules/D\'Hondt',d:'D\'Hondt con umbral 2% (Ley Electoral RD 275-97, Art. 68)'},
    {n:'Motor KPIs',           d:'ENPP Laakso-Taagepera (1979), concentraci\u00f3n, margen, riesgo 2da vuelta'},
    {n:'Motor Replay 2024',    d:'10 checkpoints cruzados contra datos JCE'},
    {n:'Motor Escenarios',     d:'Simulaci\u00f3n D\'Hondt multivariable con umbral legal'},
    {n:'Motor Proyecci\u00f3n 2028 v9.1',d:'Fundamentals+Swing hist.+Incumbencia+Fatiga+Normalizaci\u00f3n+Encuestas+Territorial (Abramowitz 2008)'},
    {n:'Motor Crecimiento Padr\u00f3n',d:'CAGR (Vf/Vi)^(1/n)-1 \u2014 Fuente JCE 2016-2024'},
    {n:'Motor Encuestas',      d:'Ponderaci\u00f3n exponencial tiempo/calidad/n (Silver/FiveThirtyEight)'},
    {n:'Motor Potencial',      d:'Score ofensivo/defensivo territorial (Jacobson 2004, Taagepera-Shugart)'},
    {n:'Motor Movilizaci\u00f3n',d:'Multi-nivel (presidencial/senadores/diputados) \u00b7 Turnout gap (Leighley & Nagler 2013)'},
    {n:'Motor Riesgo',         d:'Multi-nivel \u00b7 Composite risk index: margen(50%) + participaci\u00f3n(25%) + ENPP(25%)'},
    {n:'Motor Normalizaci\u00f3n Hist\u00f3rica',d:'Madurez organizativa + crecimiento estructural \u00b7 Modo COMPLETO con data 2020 (Panebianco 1988)'},
    {n:'Motor Hist\u00f3rico 2020',d:'Comparativo 2020-2024 \u00b7 Swing analysis \u00b7 45 circs diputados \u00b7 32 prov senadores'},
    {n:'Motor Pivot Electoral (M19)',d:'Provincias que deciden la elecci\u00f3n \u00b7 Score = padr\u00f3n(35%) + competitividad(35%) + volatilidad(20%) + movilizaci\u00f3n(10%)'},
    {n:'Motor Ruta de Victoria (M20)',d:'Combinaciones m\u00ednimas de provincias para alcanzar la meta electoral 2028'},
    {n:'Motor Meta Electoral (M21)',d:'C\u00e1lculo de votos necesarios 2028 \u00b7 Escenarios pesimista / base / optimista'},
    {n:'Motor Prioridad Estrat\u00e9gica (M22)',d:'Ranking de inversi\u00f3n por provincia \u00b7 Score = pivot(40%) + gap(30%) + probabilidad(30%)'},
  ];
  var MOTORES_OFF = [
    {n:'Motor Municipal',      d:'Alcaldes y Directores DM \u2014 pendiente dataset municipal 2020/2024'},
  ];

  document.getElementById('motores-on').innerHTML = MOTORES_ON.map(function(m){
    return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:.42rem 0;border-bottom:1px solid var(--border)">'
      +'<div><div style="font-size:.8rem;font-weight:700">'+m.n+'</div>'
      +'<div class="text-muted" style="font-size:.68rem">'+m.d+'</div></div>'
      +'<span class="tag tag-on" style="margin-left:.5rem;white-space:nowrap">ACTIVO</span></div>';
  }).join('');

  document.getElementById('motores-off').innerHTML = MOTORES_OFF.map(function(m){
    return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:.42rem 0;border-bottom:1px solid var(--border)">'
      +'<div><div style="font-size:.8rem;font-weight:700">'+m.n+'</div>'
      +'<div class="text-muted" style="font-size:.68rem">'+m.d+'</div></div>'
      +'<span class="tag tag-off" style="margin-left:.5rem;white-space:nowrap">INACTIVO</span></div>';
  }).join('');

  var DS = [
    {f:'resultados_2024.json',s:'44 KB (sin municipal)'},
    {f:'padron_provincial_2024.json',s:'Presidencial + senadores \u00b7 32 provincias'},
    {f:'padron_circ_2024.json',s:'Diputados \u00b7 45 circs (estimado proporcional)'},
    {f:'padron_exterior_2024.json',s:'Exterior \u00b7 3 regiones (estimado)'},
    {f:'prov_metrics_presidencial_2024.json',s:'32 prov \u00b7 bloques presidenciales'},
    {f:'prov_metrics_senadores_2024.json',s:'32 prov \u00b7 alianzas senatoriales'},
    {f:'prov_metrics_diputados_2024.json',s:'32 prov \u00b7 agregado por provincia'},
    {f:'curules_resultado_2024.json',s:'22 KB'},
    {f:'partidos.json',s:'2 KB \u00b7 39 partidos'},
    {f:'padron_2024.json',s:'24 KB \u00b7 190 entradas'},
    {f:'territorios_catalogo.json',s:'57 KB'},
    {f:'prov_pres_2024.json',s:'32 provincias — nivel presidencial'},
    {f:'prov_sen_2024.json', s:'32 provincias — nivel senadores'},
    {f:'prov_dip_2024.json', s:'32 provincias — nivel diputados'},
    {f:'alianzas_2024.json',s:'111 KB'},
    {f:'curules_catalogo.json',s:'8 KB'},
  ];
  document.getElementById('datasets-status').innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:.4rem">'
    +DS.map(function(d){
      return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.48rem .7rem;display:flex;justify-content:space-between">'
        +'<div><div style="font-size:.76rem;font-weight:700">'+d.f+'</div>'
        +'<div class="text-muted" style="font-size:.68rem">'+d.s+'</div></div>'
        +'<span style="color:var(--green)">\u2705</span></div>';
    }).join('')+'</div>';

  var REFS = [
    ['D\'Hondt','Ley Electoral RD 275-97, Art. 68 \u2014 umbral 2%'],
    ['ENPP','Laakso & Taagepera (1979) Comparative Political Studies 12(1)'],
    ['Competitividad','Jacobson (2004) The Politics of Congressional Elections, 6th ed.'],
    ['Swing/Elasticidad','Gelman & King (1994) AJPS 38(2)'],
    ['Incumbencia','Erikson & Wlezien (2012) The Timeline of Presidential Elections'],
    ['Proyecci\u00f3n','Abramowitz (2008) PS: Political Science & Politics 41(4)'],
    ['Mean reversion','Silver (2020) FiveThirtyEight presidential model documentation'],
    ['Encuestas','Silver (2014) FiveThirtyEight pollster ratings methodology'],
    ['Movilizaci\u00f3n','Leighley & Nagler (2013) Who Votes Now? Princeton UP'],
    ['CAGR','F\u00f3rmula est\u00e1ndar: (Vf/Vi)^(1/n) - 1'],
  ];
  document.getElementById('metodologia-refs').innerHTML =
    '<div style="display:flex;flex-direction:column;gap:.32rem;font-size:.76rem">'
    +REFS.map(function(r){
      return '<div style="padding:.28rem 0;border-bottom:1px solid var(--border)">'
        +'<span style="font-weight:700;color:var(--accent)">'+r[0]+':</span> '+r[1]+'</div>';
    }).join('')+'</div>';
}

// ====== BOOT ======
renderDashboard();
renderPresidencial();
renderSenadores();
renderDiputados();
renderExterior();
renderHistorico();
renderPotencial();
renderMovilizacion();
renderRiesgo();
renderObjetivo();
renderMotores();
setTimeout(function(){drawParliament('parl-canvas',M.Curules.getTotalLegislativo(),M.Curules.getSumaCurules());},50);

// ── Listeners para selectores de nivel del HTML (level-btn) ──
function bindLevelBtns(containerId, onChange) {
  var cont = document.getElementById(containerId);
  if (!cont) return;
  cont.addEventListener('click', function(e) {
    var btn = e.target.closest('.level-btn');
    if (!btn) return;
    var nivel = btn.dataset.level || btn.dataset.nivel;
    var partido = btn.dataset.partido;
    if (nivel) {
      cont.querySelectorAll('[data-level],[data-nivel]').forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active');
      onChange(nivel, null);
    }
    if (partido) {
      cont.querySelectorAll('[data-partido]').forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active');
      onChange(null, partido);
    }
  });
}

bindLevelBtns('sim-nivel-bar', function(nivel){
  if(nivel){ _SIM_NIVEL=nivel; _renderSimSliders(); runSimulation(); }
});
bindLevelBtns('obj-nivel-bar', function(nivel){
  if(nivel){ _OBJ_NIVEL=nivel; renderObjetivo(); }
});
bindLevelBtns('pot-level-bar', function(nivel){ if(nivel){_POT_NIVEL=nivel; renderPotencial();} });
bindLevelBtns('mov-controls', function(nivel, partido){
  if(nivel){ _MOV_NIVEL=nivel; }
  if(partido){ _MOV_PARTIDO=partido; }
  renderMovilizacion();
});
bindLevelBtns('riesgo-controls', function(nivel, partido){
  if(nivel){ _RIE_NIVEL=nivel; }
  if(partido){ _RIE_PARTIDO=partido; }
  renderRiesgo();
});

})();

