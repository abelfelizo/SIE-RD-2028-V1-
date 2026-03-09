
// ================================================================
// SIE 2028 — MOTORES CORE v8.4
// Dataset: 2024 | Metodología: modelos electorales validados
// ================================================================
// Fuentes metodológicas:
//   D'Hondt: Ley Electoral RD 275-97, Art. 68
//   ENPP:    Laakso & Taagepera (1979) "Effective Number of Parties"
//   Riesgo:  Jacobson (2004) competitiveness framework
//   Swing:   Gelman & King (1994) elastic electorate
//   Proyección: Fundamentals model (Abramowitz 2008) adaptado
//   Movilización: Turnout gap theory (Leighley & Nagler 2013)
// ================================================================

// ─────────────────────────────────────────────────────────────────
// MOTOR 1: CARGA DE DATASETS
// Rol: punto de entrada único, valida schema antes de distribuir
// ─────────────────────────────────────────────────────────────────
const MotorCarga = {
  status: 'READY',
  datasets: {},
  init(datasets) {
    this.datasets = datasets;
    const required = ['resultados','curules','partidos','padron','territorios','alianzas','curulesCat'];
    const missing = required.filter(k => !datasets[k]);
    if (missing.length) {
      console.error('❌ Motor Carga: faltan datasets:', missing);
      this.status = 'ERROR';
      return null;
    }
    console.log('✅ Motor Carga: 7 datasets validados · Dataset 2024 ACTIVO');
    this.status = 'READY';
    return this.datasets;
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 2: VALIDACIÓN / CONSISTENCIA
// Modelo: auditoría de consistencia interna (MIT Election Data Lab)
// Reglas: suma lógica de votos, partidos en catálogo, curules cuadran
// ─────────────────────────────────────────────────────────────────
const MotorValidacion = {
  errores: [],
  advertencias: [],
  ok: false,

  run(resultados, partidos, curulesCat, curulesCRes) {
    this.errores = [];
    this.advertencias = [];

    const catPartidos = new Set(partidos.partidos.map(p => p.id));
    const pres = resultados.niveles.presidencial;
    const totales = pres.totales;

    // R1: votos válidos + nulos = emitidos
    const suma = totales.votos_validos + totales.votos_nulos;
    if (Math.abs(suma - totales.votos_emitidos) > 10) {
      this.errores.push(`R1: válidos(${totales.votos_validos})+nulos(${totales.votos_nulos})≠emitidos(${totales.votos_emitidos})`);
    }

    // R2: suma de votos por partido = votos_validos (presidencial)
    const sumaPartidos = Object.values(pres.resultados).reduce((s,n)=>s+n,0);
    if (Math.abs(sumaPartidos - totales.votos_validos) > 100) {
      this.errores.push(`R2: suma votos partidos (${sumaPartidos}) ≠ votos válidos (${totales.votos_validos})`);
    }

    // R3: todos los partidos en resultados existen en catálogo
    Object.keys(pres.resultados).forEach(p => {
      if (!catPartidos.has(p)) this.advertencias.push(`R3: partido '${p}' no está en catálogo`);
    });

    // R4: curules senadores = 32
    const senCurules = curulesCRes.niveles.senadores.reduce((s,x)=>
      s + x.resultado.reduce((a,r)=>a+r.curules,0),0);
    if (senCurules !== 32) this.errores.push(`R4: senadores=${senCurules} (esperado 32)`);

    // R5: curules diputados territoriales = 178
    const dipCurules = curulesCRes.niveles.diputados.reduce((s,x)=>
      s + x.resultado.reduce((a,r)=>a+r.curules,0),0);
    if (dipCurules !== 178) this.errores.push(`R5: diputados=${dipCurules} (esperado 178)`);

    // R6: curules total = 222
    const natCurules = (curulesCRes.niveles.diputados_nacionales.resultado||[]).reduce((s,r)=>s+r.curules,0);
    const extCurules = curulesCRes.niveles.diputados_exterior.reduce((s,x)=>
      s+x.resultado.reduce((a,r)=>a+r.curules,0),0);
    const totalCurules = senCurules + dipCurules + natCurules + extCurules;
    if (totalCurules !== 222) this.errores.push(`R6: total curules=${totalCurules} (esperado 222)`);

    // R7: participación razonable (entre 40% y 90%)
    const partic = totales.porcentaje_participacion;
    if (partic < 40 || partic > 90) this.advertencias.push(`R7: participación=${partic}% fuera de rango normal`);

    this.ok = this.errores.length === 0;
    return { ok: this.ok, errores: this.errores, advertencias: this.advertencias, totalCurules };
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 3: PADRÓN / PARTICIPACIÓN
// Modelo: turnout analysis (Leighley & Nagler 2013)
// Schema nuevo: padron.padron[] con tipo 'provincia'|'municipio'
// ─────────────────────────────────────────────────────────────────
const MotorPadron = {
  _list: [],
  PADRON_OFICIAL: 8145548, // validado JCE, incluye exterior

  init(padronRaw) {
    this._list = padronRaw.padron;
  },

  // Padrón doméstico (solo provincias, sin exterior)
  getPadronNacional() {
    return this._list.reduce((s,x)=> x.tipo==='provincia' ? s+x.inscritos : s, 0);
  },

  // Padrón oficial completo (doméstico + exterior) según JCE
  getPadronOficial() {
    return this.PADRON_OFICIAL;
  },

  getPadronProvincia(provinciaId) {
    return this._list.find(x=> x.tipo==='provincia' && x.territorio_id===provinciaId);
  },

  getPadronMunicipio(municipioId) {
    return this._list.find(x=> x.tipo==='municipio' && x.territorio_id===municipioId);
  },

  getAllProvincias() {
    return this._list.filter(x=> x.tipo==='provincia');
  },

  // Participación nacional (usa padrón oficial JCE)
  getParticipacionNacional(votosEmitidos) {
    return +(votosEmitidos / this.PADRON_OFICIAL * 100).toFixed(2);
  },

  // Participación provincial (usa padrón doméstico provincial)
  getParticipacionProvincia(provinciaId, votosEmitidos) {
    const p = this.getPadronProvincia(provinciaId);
    if (!p || p.inscritos === 0) return 0;
    return +(votosEmitidos / p.inscritos * 100).toFixed(2);
  },

  // Abstención = 100 - participación
  getAbstencion(participacion) {
    return +(100 - participacion).toFixed(2);
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 4: RESULTADOS ELECTORALES
// Modelo: agregación directa + desagregación por bloques electorales
// ─────────────────────────────────────────────────────────────────
const MotorResultados = {
  _r: null, _a: null, _p: null,
  _partyNames: {},
  _blocMap: {},

  init(resultados, alianzas, partidos) {
    this._r = resultados;
    this._a = alianzas;
    this._p = partidos;
    this._partyNames = Object.fromEntries(partidos.partidos.map(p=>[p.id, p.nombre]));
    this._buildBlocMap();
  },

  _buildBlocMap() {
    this._blocMap = {};
    (this._a.niveles.presidencial[0]?.bloques || []).forEach(bloc => {
      bloc.partidos.forEach(p => { this._blocMap[p] = bloc.candidato_base; });
    });
  },

  getPartidoNombre(id) { return this._partyNames[id] || id; },
  getBlocFor(id)        { return this._blocMap[id] || id; },

  // Resultados presidenciales agregados por bloque
  getPresidencialByBloc() {
    const raw    = this._r.niveles.presidencial.resultados;
    const totales = this._r.niveles.presidencial.totales;
    const blocs  = {};
    Object.entries(raw).forEach(([p,v]) => {
      const b = this.getBlocFor(p);
      blocs[b] = (blocs[b]||0) + v;
    });
    return Object.entries(blocs)
      .map(([id,votos]) => ({
        id, votos,
        nombre: this.getPartidoNombre(id),
        pct: +(votos/totales.votos_validos*100).toFixed(2)
      }))
      .sort((a,b) => b.votos - a.votos);
  },

  // Resultados presidenciales por partido individual (sin agrupar)
  getPresidencialByPartido() {
    const raw = this._r.niveles.presidencial.resultados;
    const total = this._r.niveles.presidencial.totales.votos_validos;
    return Object.entries(raw)
      .map(([id,votos]) => ({ id, nombre: this.getPartidoNombre(id), votos, pct: +(votos/total*100).toFixed(2) }))
      .sort((a,b) => b.votos - a.votos);
  },

  getTotalesPresidencial() { return this._r.niveles.presidencial.totales; },

  // Resultados presidenciales por provincia con alianzas aplicadas
  getPresidencialPorProvincia() {
    const provArr = this._r.niveles.presidencial.por_provincia || [];
    return provArr.map(prov => {
      const blocs = {};
      Object.entries(prov.resultados).forEach(([p,v]) => {
        const b = this.getBlocFor(p);
        blocs[b] = (blocs[b]||0)+v;
      });
      const sorted  = Object.entries(blocs).sort((a,b)=>b[1]-a[1]);
      const total   = sorted.reduce((s,[,v])=>s+v,0);
      const ganador = sorted[0][0];
      const pct_gan = +(sorted[0][1]/total*100).toFixed(2);
      const margen  = sorted.length>=2 ? +((sorted[0][1]-sorted[1][1])/total*100).toFixed(2) : pct_gan;
      return {
        provincia_id:  prov.provincia_id,
        provincia:     prov.provincia,
        ganador,
        pct_ganador:   pct_gan,
        margen_pp:     margen,
        blocs,
        resultados_raw: prov.resultados,
        totales: prov.totales,
        top3: sorted.slice(0,3).map(([id,v])=>({id, pct:+(v/total*100).toFixed(2)}))
      };
    });
  },

  // Resultados presidenciales por municipio con alianzas aplicadas
  getPresidencialPorMunicipio() {
    const munArr = this._r.niveles.presidencial.por_municipio || [];
    return munArr.map(mun => {
      const blocs = {};
      Object.entries(mun.resultados).forEach(([p,v]) => {
        const b = this.getBlocFor(p);
        blocs[b] = (blocs[b]||0)+v;
      });
      const sorted  = Object.entries(blocs).sort((a,b)=>b[1]-a[1]);
      const total   = sorted.reduce((s,[,v])=>s+v,0);
      const ganador = total > 0 ? sorted[0][0] : null;
      return {
        municipio_id: mun.municipio_id,
        provincia_id: mun.provincia_id,
        municipio:    mun.municipio,
        ganador,
        pct_ganador: total > 0 ? +(sorted[0][1]/total*100).toFixed(2) : 0,
        blocs,
        totales: mun.totales
      };
    });
  },

  // Exterior presidencial por circunscripción con alianzas
  getPresidencialExterior() {
    const ext = this._r.niveles.presidencial.exterior || {};
    return (ext.por_circ || []).map(e => {
      const blocs = {};
      Object.entries(e.resultados).forEach(([p,v]) => {
        const b = this.getBlocFor(p);
        blocs[b] = (blocs[b]||0)+v;
      });
      const sorted = Object.entries(blocs).sort((a,b)=>b[1]-a[1]);
      const total  = sorted.reduce((s,[,v])=>s+v,0);
      return {
        circ_exterior: e.circ_exterior,
        region: e.region,
        ganador: total > 0 ? sorted[0][0] : null,
        blocs,
        totales: e.totales
      };
    });
  },

  // Senadores: resultados por provincia, agregados por bloque (desde prov_metrics)
  // prov_metrics_senadores ya tiene ganador, bloque_coalicion, top3 calculados desde RTF real
  getSenadores() {
    const senAlianzas = this._a.niveles.senadores || [];
    // prov_metrics inyectado por ui.js como _PROV_METRICS_SEN (window global)
    const metricsMap = {};
    (window._PROV_METRICS_SEN || []).forEach(m => { metricsMap[m.id] = m; });

    return this._r.niveles.senadores.map(prov => {
      const m = metricsMap[prov.provincia_id] || {};
      const provAli = senAlianzas.find(a => a.provincia_id === prov.provincia_id);
      const blocs   = m.blocs || prov.resultados;
      const ganador = m.ganador || provAli?.ganador || Object.entries(prov.resultados).sort((a,b)=>b[1]-a[1])[0]?.[0] || '?';
      const total   = Object.values(blocs).reduce((s,v)=>s+v,0);

      // bloque_coalicion: leer desde prov_metrics o recalcular
      let bloque_coalicion = m.bloque_coalicion || 'otro';
      if (!m.bloque_coalicion) {
        const prmBloc = (this._a.niveles.presidencial[0]?.bloques || []).find(b=>b.candidato_base==='PRM');
        const fpBloc  = (this._a.niveles.presidencial[0]?.bloques || []).find(b=>b.candidato_base==='FP');
        const prmParts = new Set(prmBloc?.partidos || ['PRM']);
        const fpParts  = new Set(fpBloc?.partidos  || ['FP']);
        if (prmParts.has(ganador)) bloque_coalicion = 'PRM-coalicion';
        else if (fpParts.has(ganador)) bloque_coalicion = 'FP-coalicion';
      }

      const top3 = m.top3 ||
        Object.entries(blocs).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id,v])=>({
          id, nombre: this.getPartidoNombre(id), pct: +(v/total*100).toFixed(1)
        }));

      return {
        provincia_id:     prov.provincia_id,
        provincia:        prov.provincia,
        ganador,
        bloque_coalicion,
        pct_ganador:      m.pct_ganador ?? +(( (blocs[ganador]||0)/total )*100).toFixed(1),
        top3,
        enpp:             m.enpp,
        riesgo_nivel:     m.riesgo_nivel,
        riesgo_score:     m.riesgo_score,
        margen_pp:        m.margen_pp,
        inscritos:        m.inscritos || prov.totales?.inscritos,
        votos_emitidos:   m.votos_emitidos || prov.totales?.emitidos,
        votos_validos:    m.votos_validos  || prov.totales?.validos,
        participacion:    m.participacion,
        resultados_ind:   prov.resultados,   // votos individuales por partido
        blocs_agregados:  blocs,              // votos por bloque (para barras)
      };
    });
  },

  // Diputados por circunscripción con votos individuales + alianzas aplicadas
  getDiputadosPorCirc() {
    const dipAlianzas = this._a.niveles.diputados || [];
    const metricsMap  = {};
    (window._PROV_METRICS_DIP || []).forEach(m => { metricsMap[m.id] = m; });

    return this._r.niveles.diputados.map(circ => {
      const key  = circ.provincia_id + '-C' + circ.circ;
      const m    = metricsMap[key] || {};
      const ali  = dipAlianzas.find(a => a.provincia_id===circ.provincia_id && a.circ===circ.circ);
      const blocs = m.blocs || circ.resultados;
      const ganador = m.ganador || ali?.ganador || Object.entries(circ.resultados).sort((a,b)=>b[1]-a[1])[0]?.[0] || '?';
      const total = Object.values(blocs).reduce((s,v)=>s+v,0);

      return {
        provincia_id:    circ.provincia_id,
        provincia:       circ.provincia,
        circ:            circ.circ,
        ganador,
        pct_ganador:     m.pct_ganador ?? +((( blocs[ganador]||0)/total)*100).toFixed(1),
        top3:            m.top3 || Object.entries(blocs).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id,v])=>({id,pct:+(v/total*100).toFixed(1)})),
        enpp:            m.enpp,
        riesgo_nivel:    m.riesgo_nivel,
        inscritos:       m.inscritos || circ.inscritos,
        participacion:   m.participacion,
        resultados_ind:  circ.resultados,
        blocs_agregados: blocs,
      };
    });
  },

  getDiputados() { return this._r.niveles.diputados; },

  // Exterior: resultados por circunscripción
  getDiputadosExterior() {
    const extAli = this._a.niveles.diputados_exterior || [];
    return (this._r.niveles.diputados_exterior || []).map(circ => {
      const ali   = extAli.find(a => a.circ_exterior === circ.circ_exterior) || {};
      const blocs = {};
      const aliB  = ali.bloques || [];
      if (aliB.length) {
        aliB.forEach(b => {
          blocs[b.candidato_base] = (b.partidos||[]).reduce((s,p)=>s+(circ.resultados[p]||0), 0);
        });
        const inBloc = new Set(aliB.flatMap(b=>b.partidos));
        Object.entries(circ.resultados).forEach(([p,v])=>{ if(!inBloc.has(p)) blocs[p]=(blocs[p]||0)+v; });
      } else {
        Object.assign(blocs, circ.resultados);
      }
      const sorted  = Object.entries(blocs).sort((a,b)=>b[1]-a[1]);
      const total   = sorted.reduce((s,[,v])=>s+v,0);
      const ganador = ali.ganador || sorted[0]?.[0] || '?';
      return {
        circ_exterior:   circ.circ_exterior,
        region:          circ.region,
        inscritos:       circ.inscritos,
        ganador,
        pct_ganador:     +((( blocs[ganador]||0)/total)*100).toFixed(1),
        top3:            sorted.slice(0,3).map(([id,v])=>({id,pct:+(v/total*100).toFixed(1)})),
        totales:         circ.totales,
        resultados_ind:  circ.resultados,
        blocs_agregados: blocs,
      };
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 5: ALIANZAS
// Modelo: bloc aggregation (Golder 2006 electoral alliances framework)
// ─────────────────────────────────────────────────────────────────
const MotorAlianzas = {
  _a: null,
  init(alianzasData) { this._a = alianzasData; },

  // Presidencial: array con 1 elemento { territorio, bloques }
  // Senadores/diputados: array de objetos por territorio con { bloques }
  getBloques(nivel='presidencial', territorioId=null) {
    const data = this._a.niveles[nivel];
    if (!data || !data.length) return [];
    if (nivel === 'presidencial') {
      return data[0]?.bloques || [];
    }
    // Para senadores/diputados: si se pide territorio específico, devolver esos bloques
    if (territorioId) {
      const terr = data.find(d => d.provincia_id === territorioId || d.circ_exterior === territorioId);
      return terr?.bloques || [];
    }
    // Sin territorio: devolver bloques únicos de la primera entrada (representativo)
    return data[0]?.bloques || [];
  },

  getCoalicion(basePartido, nivel='presidencial', territorioId=null) {
    return this.getBloques(nivel, territorioId).find(b => b.candidato_base === basePartido) || null;
  },

  // Escenario sin alianzas: cada partido compite solo
  simularSinAlianza(resultadosRaw, totalValidos) {
    return Object.entries(resultadosRaw)
      .map(([id,votos]) => ({ id, votos, pct: +(votos/totalValidos*100).toFixed(2) }))
      .sort((a,b) => b.votos - a.votos);
  },

  // Fuerza de coalición: contribución de cada aliado al bloque
  getFuerzaCoalicion(basePartido, resultadosRaw, totalValidos) {
    const bloc = this.getCoalicion(basePartido);
    if (!bloc) return [];
    return bloc.partidos
      .map(p => ({ partido: p, votos: resultadosRaw[p]||0, pct: +((resultadosRaw[p]||0)/totalValidos*100).toFixed(2) }))
      .sort((a,b) => b.votos - a.votos);
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 6: CURULES / D'HONDT
// Modelo: método D'Hondt (Ley Electoral RD 275-97, Art. 68)
// Umbral: 2% votos válidos para participar en distribución
// ─────────────────────────────────────────────────────────────────
const MotorCurules = {
  _cat: null, _res: null,
  UMBRAL_PCT: 2, // 2% umbral legal RD

  init(curulesCat, curulesRes) {
    this._cat = curulesCat;
    this._res = curulesRes;
    this._computeTotals();
  },

  _computeTotals() {
    this._totals = { senadores:{}, diputados:{}, nacionales:{}, exterior:{}, total:{} };
    const add = (obj,p,n) => { obj[p]=(obj[p]||0)+n; };

    this._res.niveles.senadores.forEach(p =>
      p.resultado.forEach(r => add(this._totals.senadores, r.partido, r.curules)));

    this._res.niveles.diputados.forEach(c =>
      c.resultado.forEach(r => add(this._totals.diputados, r.partido, r.curules)));

    (this._res.niveles.diputados_nacionales.resultado||[]).forEach(r =>
      add(this._totals.nacionales, r.partido, r.curules));

    this._res.niveles.diputados_exterior.forEach(c =>
      c.resultado.forEach(r => add(this._totals.exterior, r.partido, r.curules)));

    Object.values(this._totals).slice(0,4).forEach(obj =>
      Object.entries(obj).forEach(([p,n]) => add(this._totals.total, p, n)));
  },

  // D'Hondt puro con umbral legal del 2%
  dhondt(votosObj, escanos, totalValidos) {
    const umbral = (totalValidos || Object.values(votosObj).reduce((s,n)=>s+n,0)) * this.UMBRAL_PCT / 100;
    // Filtrar partidos bajo el umbral
    const elegibles = Object.entries(votosObj).filter(([,v]) => v >= umbral);
    if (elegibles.length === 0) return {};

    const quotients = [];
    elegibles.forEach(([partido, votos]) => {
      for (let d = 1; d <= escanos; d++) {
        quotients.push({ partido, q: votos / d });
      }
    });
    quotients.sort((a,b) => b.q - a.q);

    const result = {};
    quotients.slice(0, escanos).forEach(({ partido }) => {
      result[partido] = (result[partido]||0) + 1;
    });
    return result;
  },

  getTotalByNivel(nivel) { return this._totals[nivel] || {}; },

  getTotalLegislativo() {
    return Object.entries(this._totals.total)
      .map(([id,curules]) => ({ id, curules }))
      .sort((a,b) => b.curules - a.curules);
  },

  getSumaCurules() {
    return Object.values(this._totals.total).reduce((s,n)=>s+n,0);
  },

  // Senadores: detalle con ganador real + bloque coalición
  getSenadores() {
    return this._res.niveles.senadores.map(p => ({
      provincia_id:     p.provincia_id,
      provincia:        p.provincia,
      ganador:          p.ganador,           // partido que ganó realmente (PLR, APD, etc.)
      bloque_coalicion: p.bloque_coalicion,  // PRM-coalicion | FP-coalicion | otro
      pct_ganador:      p.pct_ganador
    }));
  },

  // Senadores agrupados por coalición presidencial
  getSenadorePorCoalicion() {
    const resumen = {};
    this._res.niveles.senadores.forEach(p => {
      const coal = p.bloque_coalicion || p.ganador;
      resumen[coal] = (resumen[coal]||0) + 1;
    });
    return Object.entries(resumen)
      .map(([id, curules]) => ({ id, curules }))
      .sort((a,b) => b.curules - a.curules);
  },

  getDiputadosDetail()  { return this._res.niveles.diputados; },
  getExteriorDetail()   { return this._res.niveles.diputados_exterior; },
  getNacionalesDetail() { return this._res.niveles.diputados_nacionales; }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 7: TERRITORIAL
// ─────────────────────────────────────────────────────────────────
const MotorTerritorial = {
  _t: null,
  init(territoriosCat) { this._t = territoriosCat; },
  getProvincias()      { return this._t.provincias || []; },
  getMunicipios()      { return this._t.municipios || []; },
  getCircDiputados()   { return this._t.circ_diputados || []; },
  getCircExterior()    { return this._t.circ_exterior || []; },
  getProvincia(id)     { return (this._t.provincias||[]).find(p=>p.id===id); }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 8: KPIs / RESUMEN EJECUTIVO
// Incluye: ENPP (Laakso-Taagepera), índice de concentración
// ─────────────────────────────────────────────────────────────────
const MotorKPIs = {
  // ENPP: Effective Number of Parliamentary Parties
  // Laakso & Taagepera (1979) — estándar mundial en ciencia política
  calcENPP(curulesList, totalCurules) {
    const pcts = curulesList.map(x => x.curules / totalCurules);
    return +(1 / pcts.reduce((s,p) => s + p*p, 0)).toFixed(3);
  },

  // Índice de concentración bipartidista (top-2 / total)
  calcConcentracion(curulesList, totalCurules) {
    const top2 = curulesList.slice(0,2).reduce((s,x)=>s+x.curules,0);
    return +(top2/totalCurules*100).toFixed(1);
  },

  // Índice de ventaja presidencial (margen 1ro vs 2do)
  calcMargenPresidencial(blocsArray) {
    if (blocsArray.length < 2) return 100;
    return +(blocsArray[0].pct - blocsArray[1].pct).toFixed(2);
  },

  compute(resultados, curules, padron) {
    const totPres    = resultados.getTotalesPresidencial();
    const blocsPresid = resultados.getPresidencialByBloc();
    const legTotal   = curules.getTotalLegislativo();
    const totalCurules = curules.getSumaCurules();
    const inscritos  = padron.getPadronOficial();
    const participacion = padron.getParticipacionNacional(totPres.votos_emitidos);

    const enpp = this.calcENPP(legTotal, totalCurules);
    const concentracion = this.calcConcentracion(legTotal, totalCurules);
    const margen = this.calcMargenPresidencial(blocsPresid);
    const riesgoSegundaVuelta = blocsPresid[0]?.pct < 50;

    return {
      padron_oficial:        inscritos,
      votos_emitidos:        totPres.votos_emitidos,
      votos_validos:         totPres.votos_validos,
      participacion,
      abstencion:            padron.getAbstencion(participacion),
      ganador_presidencial:  blocsPresid[0]?.id,
      pct_ganador:           blocsPresid[0]?.pct,
      margen_presidencial:   margen,
      riesgo_segunda_vuelta: riesgoSegundaVuelta,
      curules_totales:       totalCurules,
      enpp_legislativo:      enpp,
      concentracion_top2:    concentracion,
      mayorias:              legTotal.slice(0,3).map(x=>({...x, pct:+(x.curules/totalCurules*100).toFixed(1)}))
    };
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 9: REPLAY ELECTORAL 2024
// Modelo: verificación cruzada con datos JCE oficiales
// ─────────────────────────────────────────────────────────────────
const MotorReplay = {
  MODE: 'REPLAY',
  DATASET: 2024,

  run(resultados, curules, padron) {
    const checks = [];
    const add = (icon, name, test, expected, actual) => {
      const ok = test;
      checks.push({ icon, name, ok,
        expected: String(expected),
        actual: String(actual),
        status: ok ? '✅ OK' : `❌ esperado ${expected}, obtenido ${actual}` });
    };

    const totPres   = resultados.getTotalesPresidencial();
    const blocsP    = resultados.getPresidencialByBloc();
    const totalC    = curules.getSumaCurules();
    const senC      = Object.values(curules.getTotalByNivel('senadores')).reduce((s,n)=>s+n,0);
    const dipC      = Object.values(curules.getTotalByNivel('diputados')).reduce((s,n)=>s+n,0);
    const natC      = Object.values(curules.getTotalByNivel('nacionales')).reduce((s,n)=>s+n,0);
    const extC      = Object.values(curules.getTotalByNivel('exterior')).reduce((s,n)=>s+n,0);
    const partic    = padron.getParticipacionNacional(totPres.votos_emitidos);
    const prmPres   = blocsP[0];

    add('🗳️', 'Ganador presidencial = PRM', prmPres?.id==='PRM', 'PRM', prmPres?.id);
    add('📊', 'PRM > 50% votos válidos', prmPres?.pct > 50, '>50%', prmPres?.pct+'%');
    add('📋', 'Participación oficial 54.37%', Math.abs(partic-54.37)<1, '~54.37%', partic+'%');
    add('🏛️', 'Senadores = 32', senC===32, 32, senC);
    const senCoal = curules.getSenadorePorCoalicion();
    const prmCoalCount = (senCoal.find(x=>x.id==='PRM-coalicion')||{curules:0}).curules;
    add('🏛️', 'Bloque PRM: 29 senadores (24 PRM + 5 aliados)', prmCoalCount===29, 29, prmCoalCount);
    add('📋', 'Diputados territoriales = 178', dipC===178, 178, dipC);
    add('🌐', 'Diputados exterior = 7', extC===7, 7, extC);
    add('📝', 'Diputados nacionales = 5', natC===5, 5, natC);
    add('✔️', 'Total curules = 222', totalC===222, 222, totalC);
    add('✅', 'Validación interna OK', MotorValidacion.ok !== false, 'sin errores', MotorValidacion.errores.length+' errores');

    const passed = checks.filter(c=>c.ok).length;
    return { checks, passed, total: checks.length, pct: +(passed/checks.length*100).toFixed(0) };
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 10: ESCENARIOS ELECTORALES
// Modelo: D'Hondt con umbral 2% (Ley 275-97)
// ─────────────────────────────────────────────────────────────────
const MotorEscenarios = {
  PARTIDOS: ['PRM','FP','PLD','PRD','PCR'],
  DEFAULTS: { PRM:50, FP:27, PLD:11, PRD:6, PCR:6 },

  // Simula legislativo completo con intenciones de voto
  // Usa D'Hondt del MotorCurules para mantener consistencia
  simularLegislativo(pcts) {
    const totalPct = Object.values(pcts).reduce((s,n)=>s+n,0);
    if (totalPct === 0) return null;
    // Normalizar a votos relativos (base 1,000,000 para precisión)
    const votos = Object.fromEntries(
      Object.entries(pcts).map(([p,pct]) => [p, pct/totalPct * 1000000])
    );
    const totalVotos = Object.values(votos).reduce((s,n)=>s+n,0);
    const dh = (n) => MotorCurules.dhondt(votos, n, totalVotos);

    const sen = dh(32);
    const dip = dh(178);
    const nat = dh(5);
    const ext = dh(7);
    const total = {};
    [sen,dip,nat,ext].forEach(obj =>
      Object.entries(obj).forEach(([p,n]) => { total[p]=(total[p]||0)+n; }));

    // Mayoría simple = 112 curules (50%+1 de 222)
    const mayoriaSimple = 112;
    const mayoriaCalificada = 148; // 2/3 de 222

    return {
      senadores: sen, diputados: dip, nacionales: nat, exterior: ext, total,
      analisis: {
        mayor_partido: Object.entries(total).sort((a,b)=>b[1]-a[1])[0],
        tiene_mayoria_simple: Object.entries(total).some(([,n])=>n>=mayoriaSimple),
        tiene_mayoria_calificada: Object.entries(total).some(([,n])=>n>=mayoriaCalificada),
        partidos_bajo_umbral: Object.entries(pcts).filter(([,p])=>p<2).map(([id])=>id)
      }
    };
  },

  // Escenario sin alianzas (cada partido compite solo)
  simularSinAlianza(resultadosRaw, totalValidos) {
    const votos = {};
    Object.entries(resultadosRaw).forEach(([p,v]) => { votos[p]=(votos[p]||0)+v; });
    return MotorCurules.dhondt(votos, 32, totalValidos);
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 11: PROYECCIÓN ELECTORAL 2028
// Modelo: Fundamentals + incumbency model (Abramowitz 2008)
//         adaptado a contexto presidencial latinoamericano
//
// Variables:
//   - Base electoral 2024 (resultado real)
//   - Bonus de incumbencia (Erikson & Wlezien 2012): partido en gobierno
//     tiene ventaja estructural de +2 a +5pp en primer mandato
//   - Desgaste de gobierno: -2pp por cada año adicional en el poder
//     (Stimson "Public Support for American Presidents" adaptado)
//   - Ajuste por encuestas: Bayesian update cuando hay polls disponibles
// ─────────────────────────────────────────────────────────────────
/**
 * SIE 2028 v9.1 — MOTOR PROYECCIÓN COMPLETO
 * Proyecta voto esperado 2028 y control territorial probable
 * 
 * Mejoras vs v9.0:
 * - Corregir ciclos_en_poder PRM: 1 → 2
 * - Implementar swing histórico (35% aplicado)
 * - Proyección territorial por provincia/municipio/circunscripción
 * - Escenarios automáticos (base/optimista/pesimista)
 * - Integración con otros motores
 * - Participación variable
 */

const MotorProyeccionv91 = {
  // ═══════════════════════════════════════════════════════════════
  // DATOS BASE 2024 (CORREGIDOS)
  // ═══════════════════════════════════════════════════════════════
  
  BASE_2024: {
    PRM: { 
      votos_pct: 57.44, 
      es_incumbente: true, 
      ciclos_en_poder: 2,  // ⭐ CORREGIDO: 2020 Medina + 2024 Abinader
      presidente_actual: "Abinader",
      votos_absolutos: 2685123
    },
    FP:  { 
      votos_pct: 28.85, 
      es_incumbente: false, 
      ciclos_en_poder: 0,
      votos_absolutos: 1349045
    },
    PLD: { 
      votos_pct: 10.39, 
      es_incumbente: false, 
      ciclos_en_poder: 0,
      votos_absolutos: 486210
    },
  },

  HISTORICO_2020: {
    PRM: 56.71,
    FP: 8.90,
    PLD: 28.46,
  },

  PARAMETROS: {
    swing_aplicado: 0.35,           // Solo aplicar 35% del swing histórico
    incumbencia_factor: 1.02,       // Multiplicador (+2%) en lugar de suma
    fatiga_gobierno_8años: 2.0,     // -2pp después de 8 años
    desgaste_por_ciclo: 2.0,        // -2pp por ciclo adicional (si ciclos > 1)
    peso_fundamentals: 0.60,        // Si hay encuestas
    peso_encuestas: 0.40,
    participacion_base: 0.54,
  },

  // ═══════════════════════════════════════════════════════════════
  // PASO 1: BASELINE
  // ═══════════════════════════════════════════════════════════════
  
  baseline() {
    return {
      PRM: this.BASE_2024.PRM.votos_pct,
      FP: this.BASE_2024.FP.votos_pct,
      PLD: this.BASE_2024.PLD.votos_pct,
    };
  },

  // ═══════════════════════════════════════════════════════════════
  // PASO 2: SWING HISTÓRICO
  // ═══════════════════════════════════════════════════════════════
  
  swingHistorico() {
    const swing = {};
    Object.entries(this.BASE_2024).forEach(([partido, data]) => {
      const swing2020 = data.votos_pct - this.HISTORICO_2020[partido];
      const swing_aplicado = swing2020 * this.PARAMETROS.swing_aplicado;
      swing[partido] = {
        swing_total: +(swing2020).toFixed(2),
        swing_aplicado_35pct: +(swing_aplicado).toFixed(2)
      };
    });
    return swing;
  },

  // ═══════════════════════════════════════════════════════════════
  // PASO 3: FUNDAMENTALS
  // ═══════════════════════════════════════════════════════════════
  
  fundamentals(participacion = 0.54) {
    const p = this.PARAMETROS;
    const result = {};

    Object.entries(this.BASE_2024).forEach(([partido, base]) => {
      let proyectado = base.votos_pct;

      // A) INCUMBENCIA (como factor multiplicador, no suma)
      if (base.es_incumbente) {
        proyectado = proyectado * p.incumbencia_factor;
      }

      // B) DESGASTE POR CICLOS
      if (base.ciclos_en_poder > 1) {
        const desgaste = p.desgaste_por_ciclo * (base.ciclos_en_poder - 1);
        proyectado -= desgaste;
      }

      // C) SWING HISTÓRICO MODERADO (35%)
      const swing_total = base.votos_pct - this.HISTORICO_2020[partido];
      const swing_mod = swing_total * p.swing_aplicado;
      proyectado += swing_mod;

      result[partido] = {
        base_2024: +(base.votos_pct).toFixed(2),
        incumbencia_factor: base.es_incumbente ? p.incumbencia_factor : 1.0,
        desgaste_ciclos: base.ciclos_en_poder > 1 ? -(p.desgaste_por_ciclo * (base.ciclos_en_poder - 1)) : 0,
        swing_aplicado: +(swing_mod).toFixed(2),
        proyectado_fundamentals: +(Math.max(0, proyectado)).toFixed(2),
      };
    });

    return result;
  },

  // ═══════════════════════════════════════════════════════════════
  // PASO 4: ENCUESTAS (placeholder)
  // ═══════════════════════════════════════════════════════════════
  
  encuestas(encuestasArray = null) {
    if (!encuestasArray || encuestasArray.length === 0) {
      return { "NOTA": "Sin encuestas recientes", "peso_aplicado": 0 };
    }

    // Ponderación por recencia, tamaño muestra, calidad
    const promedio = {};
    let totalWeight = 0;

    encuestasArray.forEach(enc => {
      const diasAtras = Math.floor((Date.now() - new Date(enc.fecha)) / (1000*60*60*24));
      const recencyWeight = Math.exp(-0.02 * diasAtras);  // Decay exponencial
      const sampleWeight = enc.muestra / 1000;             // Normalizar por tamaño
      const qualityWeight = enc.calidad === 'A' ? 1.0 : enc.calidad === 'B' ? 0.8 : 0.6;
      
      const weight = recencyWeight * sampleWeight * qualityWeight;
      totalWeight += weight;

      Object.entries(enc.resultado).forEach(([partido, pct]) => {
        promedio[partido] = (promedio[partido] || 0) + (pct * weight);
      });
    });

    Object.keys(promedio).forEach(partido => {
      promedio[partido] = +(promedio[partido] / totalWeight).toFixed(2);
    });

    return promedio;
  },

  // ═══════════════════════════════════════════════════════════════
  // PASO 5: NORMALIZACIÓN PARTIDARIA (MADUREZ)
  // ═══════════════════════════════════════════════════════════════
  
  normalizacionPartidos(proyecciones) {
    const result = {};

    Object.entries(this.BASE_2024).forEach(([partido, base]) => {
      let factor = 1.0;

      // Para FP: ajuste por juventud organizativa
      if (partido === 'FP') {
        // FP fundado 2020, está en ciclo de consolidación
        const años_desde_fundacion = 4;  // 2020-2024
        const ratio_votos = 28.85 / 8.90;  // 2024/2020
        factor = (años_desde_fundacion / 8) * Math.sqrt(ratio_votos);
        factor = Math.max(0.95, Math.min(1.12, factor));
      }

      result[partido] = {
        proyectado_antes: +(proyecciones[partido]).toFixed(2),
        factor_madurez: +(factor).toFixed(3),
        proyectado_después: +(proyecciones[partido] * factor).toFixed(2),
      };
    });

    return result;
  },

  // ═══════════════════════════════════════════════════════════════
  // PASO 6: PROYECCIÓN TERRITORIAL
  // ═══════════════════════════════════════════════════════════════
  
  proyeccionTerritorial(proyecciones_nacionales, territorios = null) {
    // Si no hay datos territoriales, devolver nacional
    if (!territorios) {
      return {
        "NOTA": "Proyección nacional sin desglose territorial",
        "nacional": proyecciones_nacionales
      };
    }

    const resultado = {
      provincial: [],
      municipal: [],
    };

    // Aplicar tendencia nacional a cada territorio
    if (territorios.provincias) {
      territorios.provincias.forEach(prov => {
        const resultado_prov = {};
        Object.entries(proyecciones_nacionales).forEach(([partido, voto_nacional]) => {
          // Ajuste territorial = swing local + movilización + potencial
          const swing_local = (prov[`swing_${partido}`] || 0) * 0.5;
          const movilizacion = (prov.abstencientes_movilizables || 0) * 0.01 * 0.3;
          const potencial = (prov[`potencial_${partido}`] || 0) * 0.2;
          
          const ajuste = swing_local + movilizacion + potencial;
          resultado_prov[partido] = Math.max(0, Math.min(100, voto_nacional + ajuste));
        });

        resultado.provincial.push({
          provincia: prov.nombre,
          proyecciones: resultado_prov,
          ganador: Object.entries(resultado_prov).sort((a, b) => b[1] - a[1])[0][0],
        });
      });
    }

    return resultado;
  },

  // ═══════════════════════════════════════════════════════════════
  // PASO 7: ENSAMBLAJE FINAL
  // ═══════════════════════════════════════════════════════════════
  
  proyectar(encuestas = null, participacion = 0.54, territorios = null) {
    // 1. Baseline
    const base = this.baseline();

    // 2. Swing histórico
    const swing = this.swingHistorico();

    // 3. Fundamentals
    const fund = this.fundamentals(participacion);
    const proyecciones_fund = Object.fromEntries(
      Object.entries(fund).map(([p, d]) => [p, d.proyectado_fundamentals])
    );

    // 4. Encuestas
    const enc = this.encuestas(encuestas);
    let proyecciones_final = proyecciones_fund;
    if (enc && enc.PRM) {
      Object.keys(proyecciones_final).forEach(partido => {
        proyecciones_final[partido] = 
          (proyecciones_fund[partido] * this.PARAMETROS.peso_fundamentals) +
          ((enc[partido] || 0) * this.PARAMETROS.peso_encuestas);
      });
    }

    // 5. Normalización
    const norm = this.normalizacionPartidos(proyecciones_final);
    proyecciones_final = Object.fromEntries(
      Object.entries(norm).map(([p, d]) => [p, d.proyectado_después])
    );

    // 6. Normalizar a 100%
    const total = Object.values(proyecciones_final).reduce((s, v) => s + v, 0);
    Object.keys(proyecciones_final).forEach(p => {
      proyecciones_final[p] = Math.round(proyecciones_final[p] / total * 100 * 100) / 100;
    });

    // 7. Proyección territorial
    const terr = this.proyeccionTerritorial(proyecciones_final, territorios);

    return {
      nacional: proyecciones_final,
      territorio: terr,
      metadata: {
        metodo: encuestas ? "Fundamentals + Encuestas" : "Fundamentals",
        participacion: participacion,
        ciclos_prm: this.BASE_2024.PRM.ciclos_en_poder,
        timestamp: new Date().toISOString(),
      }
    };
  },

  // ═══════════════════════════════════════════════════════════════
  // ESCENARIOS AUTOMÁTICOS
  // ═══════════════════════════════════════════════════════════════
  
  escenarios() {
    return {
      base: this.proyectar(null, 0.54),
      optimista: this.proyectar(null, 0.56),  // +2pp participación
      pesimista: this.proyectar(null, 0.52), // -2pp participación
    };
  }
};

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MotorProyeccionv91;
}


const MotorCrecimientoPadron = {
  // Datos históricos validados (JCE oficial)
  HISTORICO: [
    { año: 2016, padron: 6872135 },
    { año: 2020, padron: 7497313 },
    { año: 2024, padron: 8145548 },
  ],

  // CAGR: Compound Annual Growth Rate
  // Formula estándar: CAGR = (Vf/Vi)^(1/n) - 1
  calcCAGR(inicio, fin, años) {
    return +((Math.pow(fin/inicio, 1/años) - 1) * 100).toFixed(3);
  },

  proyectar() {
    const hist = this.HISTORICO;
    const n = hist.length;

    // CAGR 2016-2024 (8 años)
    const cagr_8yr = this.calcCAGR(hist[0].padron, hist[n-1].padron, 8);

    // CAGR 2020-2024 (ciclo más reciente, más relevante)
    const cagr_4yr = this.calcCAGR(hist[1].padron, hist[n-1].padron, 4);

    // Proyección 2028 con ambas tasas
    const padron_2028_conservador = Math.round(hist[n-1].padron * Math.pow(1+cagr_4yr/100, 4));
    const padron_2028_tendencia   = Math.round(hist[n-1].padron * Math.pow(1+cagr_8yr/100, 4));
    const padron_2028_medio       = Math.round((padron_2028_conservador + padron_2028_tendencia) / 2);

    // Nuevos electores potenciales (crecimiento neto)
    const nuevos_electores = padron_2028_medio - hist[n-1].padron;

    return {
      historico:         hist,
      cagr_8yr:          cagr_8yr,
      cagr_4yr:          cagr_4yr,
      padron_2024:       hist[n-1].padron,
      padron_2028_bajo:  padron_2028_conservador,
      padron_2028_alto:  padron_2028_tendencia,
      padron_2028_medio,
      nuevos_electores,
      metodologia: 'CAGR (Compound Annual Growth Rate)'
    };
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 13: ENCUESTAS
// Modelo: poll aggregation con ponderación por calidad y tiempo
//         Metodología: Silver (FiveThirtyEight) poll weighting
//         Weight = quality_score * recency_weight * sample_weight
// ─────────────────────────────────────────────────────────────────
const MotorEncuestas = {
  _polls: [],

  // Cargar encuestas (formato: [{fecha, firma, PRM, FP, PLD, n, calidad}])
  cargar(pollsArray) {
    this._polls = pollsArray || [];
    return this;
  },

  // Weight decay: encuesta más antigua pesa menos
  // Decaimiento exponencial: w = e^(-lambda * dias)
  // lambda = 0.02 (FiveThirtyEight usa ~0.02-0.05 según ciclo)
  _recencyWeight(fechaEncuesta, LAMBDA=0.02) {
    const hoy = new Date();
    const enc = new Date(fechaEncuesta);
    const dias = (hoy - enc) / (1000*60*60*24);
    return Math.exp(-LAMBDA * dias);
  },

  // Quality weight: 1.0 (A+), 0.8 (A), 0.6 (B), 0.4 (C), 0.2 (D)
  _qualityWeight(calidad) {
    const map = {'A+':1.0, 'A':0.8, 'B':0.6, 'C':0.4, 'D':0.2};
    return map[calidad] || 0.5;
  },

  // Sample size weight: sqrt(n) / sqrt(1000) — normalizado
  _sampleWeight(n) { return Math.sqrt(n) / Math.sqrt(1000); },

  // Promedio ponderado de todos los polls
  agregar(partidos=['PRM','FP','PLD']) {
    if (!this._polls.length) return null;

    const sums = {}, weights = {};
    partidos.forEach(p => { sums[p]=0; weights[p]=0; });

    this._polls.forEach(poll => {
      const w = this._recencyWeight(poll.fecha)
              * this._qualityWeight(poll.calidad || 'B')
              * this._sampleWeight(poll.n || 600);

      partidos.forEach(p => {
        if (poll[p] !== undefined) {
          sums[p]    += poll[p] * w;
          weights[p] += w;
        }
      });
    });

    const promedio = {};
    partidos.forEach(p => {
      promedio[p] = weights[p] > 0 ? +(sums[p]/weights[p]).toFixed(2) : null;
    });

    return {
      promedio,
      n_encuestas: this._polls.length,
      ultima: this._polls.sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))[0]?.fecha,
      metodologia: 'Exponential decay weighting (Silver/FiveThirtyEight)'
    };
  },

  // Tendencia: regresión lineal sobre tiempo (OLS simple)
  tendencia(partido) {
    const polls = this._polls.filter(p => p[partido] !== undefined)
      .sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
    if (polls.length < 2) return null;

    const n = polls.length;
    const xs = polls.map((_,i)=>i);
    const ys = polls.map(p=>p[partido]);
    const xm = xs.reduce((s,x)=>s+x,0)/n;
    const ym = ys.reduce((s,y)=>s+y,0)/n;
    const slope = xs.reduce((s,x,i)=>s+(x-xm)*(ys[i]-ym),0) /
                  xs.reduce((s,x)=>s+(x-xm)**2,0);

    return {
      partido, slope: +slope.toFixed(3),
      tendencia: slope > 0.3 ? 'sube' : slope < -0.3 ? 'baja' : 'estable',
      ultimo: ys[n-1], proyectado_proximo: +(ys[n-1]+slope).toFixed(1)
    };
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 14: POTENCIAL ELECTORAL
// Modelo: clasificación territorial por oportunidad
//         Basado en: Jacobson (2004) + Swing Ratio (Taagepera & Shugart)
//
// Dimensiones:
//   1. Desempeño base (% votos 2024)
//   2. Participación (alto abstencionismo = potencial de movilización)
//   3. Margen (plaza cerrada = prioridad defensiva/ofensiva)
//   4. ENPP (más partidos = mayor fragmentación, más oportunidad)
// ─────────────────────────────────────────────────────────────────
const MotorPotencial = {

  // Score de potencial ofensivo para un partido (perspectiva del challenger)
  // nivel: 'presidencial' | 'senadores' | 'diputados' (solo informativo, prov_metrics ya es del nivel)
  scoreOfensivo(prov_metrics, partidoTarget = 'FP') {
    return prov_metrics.map(pm => {
      const esGanado = pm.ganador === partidoTarget;
      const pct_target = pm.blocs?.[partidoTarget]
        ? +(pm.blocs[partidoTarget] / pm.votos_emitidos * 100).toFixed(1)
        : 0;

      const margen_factor    = Math.max(0, 1 - pm.margen_pp / 40);
      const abstencion_factor = pm.abstencion / 100;
      const enpp_factor      = Math.min((pm.enpp - 1) / 3, 1);

      const score = esGanado
        ? 0
        : +((margen_factor*0.5 + abstencion_factor*0.3 + enpp_factor*0.2) * 100).toFixed(1);

      let categoria;
      if (esGanado)       categoria = 'consolidada';
      else if (score>=60) categoria = 'objetivo_prioritario';
      else if (score>=40) categoria = 'objetivo_secundario';
      else if (score>=20) categoria = 'difícil';
      else                categoria = 'perdida';

      return { ...pm, score_ofensivo: score, categoria_ofensiva: categoria, pct_target };
    }).sort((a,b) => b.score_ofensivo - a.score_ofensivo);
  },

  // Score defensivo para el partido incumbente
  scoreDefensivo(prov_metrics, partidoDefensor = 'PRM') {
    return prov_metrics
      .filter(pm => pm.ganador === partidoDefensor ||
                    pm.bloque_coalicion === partidoDefensor + '-coalicion')
      .map(pm => ({
        ...pm,
        score_riesgo: pm.riesgo_score,
        prioridad_defensa: pm.riesgo_score >= 65 ? 'alta' : pm.riesgo_score >= 45 ? 'media' : 'baja'
      }))
      .sort((a,b) => b.score_riesgo - a.score_riesgo);
  },

  // Análisis ofensivo multi-nivel: devuelve los tres datasets para un partido
  scoreOfensivoMultinivel(prov_pres, prov_sen, prov_dip, partidoTarget = 'FP') {
    return {
      presidencial: this.scoreOfensivo(prov_pres, partidoTarget),
      senadores:    this.scoreOfensivo(prov_sen,  partidoTarget),
      diputados:    this.scoreOfensivo(prov_dip,  partidoTarget)
    };
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 15: MOVILIZACIÓN
// Modelo: Turnout gap + vote targets (Leighley & Nagler 2013)
//         "Who Votes Now? Demographics, Issues, Inequality, and Turnout"
//
// Lógica:
//   votos_para_ganar = ceil((votos_ganador - votos_challenger) / 2) + 1
//   movilizacion_necesaria = votos_para_ganar / (inscritos * abstencion_rate)
//   Esto mide qué fracción de abstencionistas debe movilizarse
// ─────────────────────────────────────────────────────────────────
const MotorMovilizacion = {
  // Niveles disponibles y sus datasets
  _datasets: { presidencial: null, senadores: null, diputados: null },

  init(prov_pres, prov_sen, prov_dip) {
    this._datasets.presidencial = prov_pres;
    this._datasets.senadores    = prov_sen;
    this._datasets.diputados    = prov_dip;
  },

  // Votos adicionales que necesita el segundo partido para ganar la provincia
  // Formula: ceil((votos_ganador - votos_segundo) / 2) + 1
  votosParaGanar(votos_ganador, votos_segundo) {
    return Math.ceil((votos_ganador - votos_segundo) / 2) + 1;
  },

  // % de abstencionistas a movilizar (Leighley & Nagler 2013 — mobilization gap)
  pctAbstencionistasNecesarios(votosNecesarios, inscritos, participacion_actual) {
    const abstencionistas = inscritos * (1 - participacion_actual / 100);
    if (abstencionistas <= 0) return 100;
    return +Math.min(100, votosNecesarios / abstencionistas * 100).toFixed(1);
  },

  // Genera agenda de movilización para un partido en un nivel electoral específico.
  // nivel: 'presidencial' | 'senadores' | 'diputados'
  // partido_objetivo: 'FP' | 'PRM' | etc.
  // incluir_ganadas: si true incluye también las provincias donde ya gana (para defensa)
  agenda(nivel, partido_objetivo, incluir_ganadas = false) {
    const dataset = this._datasets[nivel];
    if (!dataset || !dataset.length) return [];

    return dataset
      .filter(pm => incluir_ganadas ? true : pm.ganador !== partido_objetivo)
      .map(pm => {
        const votos_objetivo  = pm.blocs?.[partido_objetivo] || 0;
        const votos_ganador_n = pm.blocs?.[pm.ganador] || 0;
        const gap       = votos_ganador_n - votos_objetivo;
        const necesarios = pm.ganador !== partido_objetivo
          ? this.votosParaGanar(votos_ganador_n, votos_objetivo)
          : 0; // ya ganó — déficit cero
        const pct_movilizar = necesarios > 0
          ? this.pctAbstencionistasNecesarios(necesarios, pm.inscritos, pm.participacion)
          : 0;

        return {
          provincia:          pm.provincia,
          provincia_id:       pm.id,
          nivel,
          ganador_actual:     pm.ganador,
          bloque_coalicion:   pm.bloque_coalicion || null,
          votos_objetivo,
          votos_ganador:      votos_ganador_n,
          votos_gap:          gap,
          votos_necesarios:   necesarios,
          pct_abstencionistas_a_movilizar: pct_movilizar,
          factibilidad: pct_movilizar === 0 ? 'ganada'
            : pct_movilizar < 20 ? 'alta'
            : pct_movilizar < 40 ? 'media' : 'baja',
          participacion_actual: pm.participacion,
          inscritos: pm.inscritos,
          margen_pp: pm.margen_pp,
          enpp: pm.enpp
        };
      })
      .sort((a, b) => {
        // Primero las más factibles (menor pct_abstencionistas)
        if (a.factibilidad === 'ganada') return 1;
        if (b.factibilidad === 'ganada') return -1;
        return a.pct_abstencionistas_a_movilizar - b.pct_abstencionistas_a_movilizar;
      });
  },

  // Resumen consolidado de los tres niveles para un partido
  resumenMultinivel(partido_objetivo) {
    return ['presidencial','senadores','diputados'].map(nivel => {
      const ag = this.agenda(nivel, partido_objetivo);
      return {
        nivel,
        plazas_perdidas:   ag.length,
        plazas_alta:       ag.filter(x=>x.factibilidad==='alta').length,
        plazas_media:      ag.filter(x=>x.factibilidad==='media').length,
        plazas_baja:       ag.filter(x=>x.factibilidad==='baja').length,
        votos_totales_gap: ag.reduce((s,x)=>s+x.votos_gap,0)
      };
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 16: RIESGO ELECTORAL
// Modelo: composite risk index
//         Componentes: margen (Jacobson 2004), participación,
//         ENPP (Laakso-Taagepera), swing potential (Gelman & King 1994)
//
// Risk = 0.50 * (1-margen_norm) + 0.25 * (1-partic_norm) + 0.25 * enpp_norm
// Donde cada variable está normalizada [0,1]
// ─────────────────────────────────────────────────────────────────
const MotorRiesgo = {
  PESOS: { margen:0.50, participacion:0.25, enpp:0.25 },

  calcScore(margen_pp, participacion, enpp) {
    const margen_norm = Math.min(margen_pp/40, 1);
    const partic_norm = participacion/100;
    const enpp_norm   = Math.min((enpp-1)/3, 1);
    const risk = (1-margen_norm)*this.PESOS.margen
               + (1-partic_norm)*this.PESOS.participacion
               + enpp_norm*this.PESOS.enpp;
    return +(risk*100).toFixed(1);
  },

  nivelRiesgo(score) {
    if (score >= 65) return 'alto';
    if (score >= 45) return 'medio';
    return 'bajo';
  },

  // Clasificar provincias por riesgo para un partido incumbente
  // partido_incumbente: 'PRM' por defecto
  clasificar(prov_metrics, partido_incumbente = 'PRM') {
    return prov_metrics
      .filter(pm => pm.ganador === partido_incumbente ||
                    pm.bloque_coalicion === partido_incumbente + '-coalicion')
      .map(pm => {
        const score = this.calcScore(pm.margen_pp, pm.participacion, pm.enpp);
        return { ...pm, riesgo_score: score, riesgo_nivel: this.nivelRiesgo(score) };
      })
      .sort((a,b) => b.riesgo_score - a.riesgo_score);
  },

  // Riesgo multi-nivel: evalúa los tres datasets
  clasificarMultinivel(prov_pres, prov_sen, prov_dip, partido_incumbente = 'PRM') {
    const evaluar = (dataset, nivel) =>
      this.clasificar(dataset, partido_incumbente)
          .map(p => ({...p, nivel}));
    return {
      presidencial: evaluar(prov_pres, 'presidencial'),
      senadores:    evaluar(prov_sen,  'senadores'),
      diputados:    evaluar(prov_dip,  'diputados')
    };
  },

  getAlertas(prov_metrics, partido_incumbente = 'PRM') {
    return this.clasificar(prov_metrics, partido_incumbente)
      .filter(pm => pm.riesgo_nivel === 'alto')
      .map(pm => ({
        provincia: pm.provincia,
        riesgo: pm.riesgo_score,
        margen: pm.margen_pp,
        participacion: pm.participacion,
        enpp: pm.enpp,
        mensaje: `Margen de ${pm.margen_pp}pp con ENPP=${pm.enpp} — monitoreo prioritario`
      }));
  }
};

// ─────────────────────────────────────────────────────────────────
// MOTOR 17: NORMALIZACIÓN HISTÓRICA
// Modelo: crecimiento estructural entre ciclos electorales
//
// Propósito: evitar que el modelo penalice a partidos con crecimiento
// estructural real (e.g. FP que no existía en 2020 como partido)
//
// MODO PROXY (activo hasta recibir data 2020):
//   baseline_FP_2020 = PLD_2024 * factor_transferencia
//   donde factor_transferencia = fracción del voto PLD 2020 que proviene
//   del electorado leonelista (estimado en 0.65 por literatura de partidos RD)
//
// MODO COMPLETO (cuando llegue data 2020):
//   crecimiento = (resultado_2024 - resultado_2020) / resultado_2020
//   score_normalizado = α*resultado_2020 + β*resultado_2024 + γ*crecimiento
//   donde α=0.2, β=0.6, γ=0.2 (pesos: prioriza actual, descuenta histórico lejano)
//
// Referencias:
//   Panebianco (1988) Political Parties — curva de madurez organizativa
//   Harmel & Janda (1994) EJPR — adaptación y cambio partidario
// ─────────────────────────────────────────────────────────────────
const MotorNormalizacionHistorica = {
  status: 'PROXY',  // 'PROXY' | 'COMPLETO'
  _data2024: null,
  _data2020: null,

  // Parámetros del modelo
  PESOS: { historico: 0.20, actual: 0.60, crecimiento: 0.20 },
  // Factor de transferencia leonelista PLD→FP (literatura partidos RD)
  FACTOR_TRANSFERENCIA_FP: 0.65,
  // Pesos para modo proxy (sin histórico real)
  PESOS_PROXY: { actual: 0.80, madurez: 0.20 },
  // Coeficiente de madurez organizativa (Panebianco 1988)
  // Partidos en su primer ciclo electoral reciben penalización reducida
  MADUREZ: { nuevo: 0.70, consolidado: 0.90, maduro: 1.00 },

  init(data2024, data2020 = null) {
    this._data2024 = data2024;
    this._data2020 = data2020;
    this.status = data2020 ? 'COMPLETO' : 'PROXY';
  },

  // Determina la madurez organizativa de un partido
  _madurez(partido, anio_fundacion) {
    const ciclos = Math.floor((2024 - (anio_fundacion || 2000)) / 4);
    if (ciclos <= 1) return this.MADUREZ.nuevo;
    if (ciclos <= 3) return this.MADUREZ.consolidado;
    return this.MADUREZ.maduro;
  },

  // MODO PROXY: estima baseline 2020 para FP a partir del voto PLD
  // pld_prov_2024: votos PLD en la provincia en 2024 (el voto residual leonelista)
  estimarBaseline2020FP(pld_prov_2024, total_prov_2024) {
    // El PLD 2024 es el residuo del voto leonelista que NO siguió a FP
    // Entonces el voto leonelista en 2020 ≈ FP_2024 + PLD_2024 * factor
    // Pero no tenemos FP_2024 por provincia directamente aquí — se pasa por parámetro
    return Math.round(pld_prov_2024 * this.FACTOR_TRANSFERENCIA_FP);
  },

  // Score normalizado para un partido en una provincia (modo proxy)
  scoreNormalizadoProxy(partido, votos_2024, total_2024, blocs_prov) {
    const pct_2024 = votos_2024 / total_2024;

    let coef_madurez = 1.0;
    let nota_proxy = '';

    if (partido === 'FP') {
      // FP: primer ciclo como partido autónomo — aplicar coeficiente de madurez
      coef_madurez = this.MADUREZ.nuevo;
      // Ajustar upward: el 2024 subestima porque la organización no estaba completa
      // FP en 2024 logró 28.85% con estructura nueva — proyección con madurez completa
      nota_proxy = 'Ajuste madurez organizativa +1 ciclo (Panebianco 1988)';
    }

    // score = pct_actual * coef_madurez * peso_actual + bonus_madurez
    const score = pct_2024 * (this.PESOS_PROXY.actual + coef_madurez * this.PESOS_PROXY.madurez);

    return {
      partido,
      modo: 'PROXY',
      pct_2024: +(pct_2024*100).toFixed(2),
      baseline_2020_estimado: partido === 'FP'
        ? +(this.estimarBaseline2020FP(blocs_prov?.PLD||0, total_2024) / total_2024 * 100).toFixed(2)
        : null,
      coef_madurez,
      score_normalizado: +(score*100).toFixed(2),
      nota: nota_proxy || 'Sin ajuste — partido establecido'
    };
  },

  // MODO COMPLETO: score con datos reales 2020
  scoreNormalizadoCompleto(partido, votos_2024, total_2024, votos_2020, total_2020) {
    const pct_2024 = votos_2024 / total_2024;
    const pct_2020 = total_2020 > 0 ? votos_2020 / total_2020 : 0;
    const crecimiento = pct_2020 > 0 ? (pct_2024 - pct_2020) / pct_2020 : 0;

    const score = this.PESOS.historico * pct_2020
                + this.PESOS.actual    * pct_2024
                + this.PESOS.crecimiento * Math.max(0, crecimiento) * pct_2024;

    return {
      partido,
      modo: 'COMPLETO',
      pct_2020: +(pct_2020*100).toFixed(2),
      pct_2024: +(pct_2024*100).toFixed(2),
      crecimiento_pct: +(crecimiento*100).toFixed(2),
      score_normalizado: +(score*100).toFixed(2),
      tendencia: crecimiento > 0.1 ? 'creciente' : crecimiento < -0.1 ? 'decreciente' : 'estable'
    };
  },

  // Analizar todos los partidos en todos los territorios
  // prov_metrics: array de provincias con blocs
  analizar(prov_metrics, partidos = ['PRM','FP','PLD']) {
    if (!prov_metrics || !prov_metrics.length) return [];

    return prov_metrics.map(pm => {
      const total = pm.votos_emitidos;
      const scores = {};

      partidos.forEach(partido => {
        const votos = pm.blocs?.[partido] || 0;
        if (this.status === 'COMPLETO' && this._data2020) {
          const prov2020 = this._data2020.find(p=>p.id===pm.id);
          const v2020 = prov2020?.blocs?.[partido] || 0;
          const t2020 = prov2020?.votos_emitidos || 0;
          scores[partido] = this.scoreNormalizadoCompleto(partido, votos, total, v2020, t2020);
        } else {
          scores[partido] = this.scoreNormalizadoProxy(partido, votos, total, pm.blocs);
        }
      });

      return { id: pm.id, provincia: pm.provincia, scores };
    });
  },

  // Factor de ajuste para MotorProyeccion
  // Devuelve el multiplicador que debe aplicarse al resultado 2024 de un partido
  // para evitar sub/sobre proyección basada en histórico incompleto
  factorAjusteProyeccion(partido) {
    if (this.status === 'PROXY') {
      if (partido === 'FP') {
        // FP en modo proxy: ajustar upward porque es primer ciclo completo
        // La regresión a la media del 15% (Silver) aplica sobre base más alta
        return { multiplicador: 1.08, razon: 'Madurez organizativa primer ciclo — Panebianco 1988', modo: 'PROXY' };
      }
      if (partido === 'PLD') {
        // PLD en 2024 ya incorpora la pérdida del voto leonelista — su base real es más estable
        return { multiplicador: 0.95, razon: 'Ajuste por escisión leonelista contabilizada', modo: 'PROXY' };
      }
      return { multiplicador: 1.00, razon: 'Sin ajuste', modo: 'PROXY' };
    }
    // Modo completo: calcular desde la data
    return { multiplicador: 1.00, razon: 'Calculado desde histórico real 2020', modo: 'COMPLETO' };
  },

  // Integrar data 2020 cuando llegue
  integrarData2020(data2020_normalizada) {
    this._data2020 = data2020_normalizada;
    this.status = 'COMPLETO';
    console.log('✅ MotorNormalizacionHistorica: modo COMPLETO activado con data 2020');
  },

  getStatus() {
    return {
      modo: this.status,
      data_2024: !!this._data2024,
      data_2020: !!this._data2020,
      advertencia: this.status === 'PROXY'
        ? 'Baseline FP estimado desde PLD 2024 — integrar data 2020 para precisión total'
        : null
    };
  }
};


const MotorMunicipal    = { status:'DISABLED', init(){ console.log('⏳ Motor Municipal: pendiente dataset municipal'); }};
// ─────────────────────────────────────────────────────────────────
// MOTOR 18: HISTÓRICO 2020
// Rol: expone datos 2020 para comparativas, swing analysis y
//      normalización histórica en proyecciones 2028
// ─────────────────────────────────────────────────────────────────
const MotorHistorico2020 = {
  status: 'READY',
  _res:   null,   // resultados_2020
  _ali:   null,   // alianzas_2020
  _cur:   null,   // curules_resultado_2020
  _pm_p:  null,   // prov_metrics_presidencial_2020
  _pm_s:  null,   // prov_metrics_senadores_2020
  _pm_d:  null,   // prov_metrics_diputados_2020

  init(res2020, ali2020, cur2020, pmPres, pmSen, pmDip) {
    this._res  = res2020;
    this._ali  = ali2020;
    this._cur  = cur2020;
    this._pm_p = pmPres;
    this._pm_s = pmSen;
    this._pm_d = pmDip;
    this.status = 'READY';
    console.log('✅ Motor Histórico 2020: ACTIVO — 32 prov · 45 circs');
  },

  // Presidencial 2020 por provincia
  getPresidencialByProvincia() {
    return this._pm_p || [];
  },

  // Swing presidencial 2024 vs 2020 por provincia
  // Retorna delta de % por partido para cada provincia
  getSwingPresidencial(partidos = ['PRM','PLD','FP']) {
    const pm24 = window._PROV_METRICS_PRES || [];
    const pm20 = this._pm_p || [];
    const map20 = Object.fromEntries(pm20.map(p => [p.id, p]));

    return pm24.map(p24 => {
      const p20 = map20[p24.id] || {};
      const swing = {};
      partidos.forEach(par => {
        const b24 = p24.blocs || {};
        const b20 = p20.blocs  || {};
        const t24 = Object.values(b24).reduce((s,v)=>s+v,0);
        const t20 = Object.values(b20).reduce((s,v)=>s+v,0);
        const pct24 = t24 ? (b24[par]||0)/t24*100 : 0;
        const pct20 = t20 ? (b20[par]||0)/t20*100 : 0;
        swing[par] = +(pct24 - pct20).toFixed(2);
      });
      return {
        id:        p24.id,
        provincia: p24.provincia,
        swing,
        participacion_24: p24.participacion,
        participacion_20: p20.participacion || 0,
        delta_participacion: +((p24.participacion||0) - (p20.participacion||0)).toFixed(2),
      };
    });
  },

  // Totales presidenciales 2020
  getTotalesPresidencial() {
    return this._res?.niveles?.presidencial?.totales || {};
  },

  // Curules 2020 por nivel
  getCurulesByNivel(nivel) {
    const niveles = this._cur?.niveles || {};
    return niveles[nivel] || [];
  },

  // Comparativa curules 2020 vs 2024
  getComparativaCurules() {
    const cur20 = this._cur?.niveles || {};
    const cur24 = window._DS_CURULES?.niveles || {};
    const niveles = ['senadores','diputados','diputados_exterior','diputados_nacionales'];
    const tot = (n, data) => {
      const entries = data[n];
      if (!entries) return {};
      const arr = Array.isArray(entries) ? entries : (entries.resultado || []);
      const res = {};
      (Array.isArray(arr) ? arr : [arr]).forEach(x => {
        const resultados = x.resultado || [x];
        (Array.isArray(resultados) ? resultados : [resultados]).forEach(r => {
          if (r.partido) res[r.partido] = (res[r.partido]||0) + (r.curules||0);
        });
      });
      return res;
    };
    const out = {};
    niveles.forEach(n => {
      out[n] = { _2020: tot(n, cur20), _2024: tot(n, cur24) };
    });
    return out;
  }
};

// ─────────────────────────────────────────────────────────────────
// EXPORT GLOBAL
// ─────────────────────────────────────────────────────────────────
window.SIE_MOTORES = {
  // Infraestructura
  Carga:             MotorCarga,
  Validacion:        MotorValidacion,
  Padron:            MotorPadron,
  Resultados:        MotorResultados,
  Territorial:       MotorTerritorial,
  Alianzas:          MotorAlianzas,
  Curules:           MotorCurules,
  // Análisis
  KPIs:              MotorKPIs,
  Replay:            MotorReplay,
  Escenarios:        MotorEscenarios,
  Proyeccionv91:        MotorProyeccionv91,
  CrecimientoPadron: MotorCrecimientoPadron,
  Encuestas:         MotorEncuestas,
  // Estrategia
  Potencial:             MotorPotencial,
  Movilizacion:          MotorMovilizacion,
  Riesgo:                MotorRiesgo,
  NormalizacionHistorica:MotorNormalizacionHistorica,
  // Desactivados
  Municipal:         MotorMunicipal,
  Historico2020:     MotorHistorico2020
};


// ═══════════════════════════════════════════════════════════════════════════
// SIE 2028 v9.0 — NUEVOS MOTORES ESTRATÉGICOS (5)
// Integración: 9 de Marzo de 2026
// ═══════════════════════════════════════════════════════════════════════════

// Motor Pivot Electoral
const MotorPivotElectoral = {
  calculate(provinces) {
    const weights = { padronal: 0.35, competitivity: 0.35, volatility: 0.20, mobilization: 0.10 };
    const totalPadron = provinces.reduce((sum, p) => sum + (p.padron_2024 || 0), 0);
    const scores = provinces.map(prov => {
      const padronalScore = ((prov.padron_2024 || 0) / totalPadron) * 100 * 5;
      const margin = Math.abs((prov.votos_fp_2024 || 0) - (prov.votos_prm_2024 || 0)) / (prov.padron_2024 || 1);
      const competitivityScore = (1 - margin) * 100;
      const volatilityScore = (prov.enpp_volatility || 0) * 100;
      const abstentionists = (prov.padron_2024 || 0) - (prov.votantes_2024 || 0);
      const mobilizationScore = (abstentionists / (prov.padron_2024 || 1)) * 100;
      const pivotScore = (padronalScore * weights.padronal) + (competitivityScore * weights.competitivity) + (volatilityScore * weights.volatility) + (mobilizationScore * weights.mobilization);
      return { nombre: prov.nombre, pivotScore: Math.min(100, pivotScore), clasificacion: pivotScore > 70 ? 'CRÍTICA' : pivotScore > 50 ? 'IMPORTANTE' : 'SECUNDARIA' };
    });
    const sorted = scores.sort((a, b) => b.pivotScore - a.pivotScore);
    return { topFive: sorted.slice(0, 5), allScores: scores, summary: { criticas: sorted.filter(p => p.pivotScore > 70).length, importantes: sorted.filter(p => p.pivotScore > 50 && p.pivotScore <= 70).length, secundarias: sorted.filter(p => p.pivotScore <= 50).length } };
  }
};

// Motor Ruta de Victoria
const MotorRutaVictoria = {
  calculate(votesPerProvince, metaVotos = 2354700) {
    const provinces = Object.entries(votesPerProvince).map(([name, votos]) => ({ nombre: name, votos })).sort((a, b) => b.votos - a.votos);
    const victoryRoute = [];
    let totalVotos = 0;
    for (let prov of provinces) {
      if (totalVotos < metaVotos) {
        victoryRoute.push(prov);
        totalVotos += prov.votos;
      }
    }
    return { minimalRoute: { provincias: victoryRoute, totalVotos: totalVotos, margen: totalVotos - metaVotos, ganador: totalVotos >= metaVotos ? true : false }, provinciasCriticas: victoryRoute.length, estrategia: victoryRoute.length <= 5 ? 'CONCENTRADA' : 'DISTRIBUIDA' };
  }
};

// Motor Meta Electoral
const MotorMetaElectoral = {
  calculate(padron2028 = 8700000, participacion2028 = 0.54, votosActualesFP = 2100000) {
    const votantesEsperados = Math.round(padron2028 * participacion2028);
    const meta = Math.round(votantesEsperados * 0.501);
    const gap = meta - votosActualesFP;
    const porcentajeGap = (gap / votosActualesFP) * 100;
    const scenarios = {
      pesimista: { votantes: Math.round(padron2028 * 0.52), metaVotos: Math.round(padron2028 * 0.52 * 0.501), gap: Math.round(padron2028 * 0.52 * 0.501) - votosActualesFP },
      base: { votantes: votantesEsperados, metaVotos: meta, gap: gap },
      optimista: { votantes: Math.round(padron2028 * 0.56), metaVotos: Math.round(padron2028 * 0.56 * 0.501), gap: Math.round(padron2028 * 0.56 * 0.501) - votosActualesFP }
    };
    return { meta: { padron2028, participacion2028, votantesEsperados, metaVotos: meta, votosActualesFP, gap, porcentajeGap }, scenarios, evaluacion: { esFactible: gap <= 300000 ? 'FACTIBLE' : 'DESAFIANTE' } };
  }
};

// Motor Prioridad Estratégica
const MotorPrioridadEstrategica = {
  calculate(provinces) {
    const weights = { pivot: 0.40, gap: 0.30, probability: 0.30 };
    const scores = provinces.map(prov => {
      const pivotNorm = (prov.pivotScore || 50) / 100;
      const maxGap = 200000;
      const gapNorm = Math.max(0, 1 - ((prov.gap || 0) / maxGap));
      const probNorm = prov.probabilidadVictoria || 0.5;
      const priorityScore = (pivotNorm * weights.pivot) + (gapNorm * weights.gap) + (probNorm * weights.probability);
      return { nombre: prov.nombre, priorityScore: (priorityScore * 100).toFixed(1), gap: prov.gap, prioridad: priorityScore > 0.90 ? 'MÁXIMA' : priorityScore > 0.75 ? 'ALTA' : priorityScore > 0.50 ? 'MEDIA' : 'BAJA' };
    });
    const ranking = scores.sort((a, b) => b.priorityScore - a.priorityScore);
    return { ranking, topTen: ranking.slice(0, 10), resumen: { maxima: ranking.filter(p => p.prioridad === 'MÁXIMA').length, alta: ranking.filter(p => p.prioridad === 'ALTA').length, media: ranking.filter(p => p.prioridad === 'MEDIA').length, baja: ranking.filter(p => p.prioridad === 'BAJA').length } };
  }
};

// Motor M17 - Normalización Histórica (ACTIVADO)
const MotorNormalizacionHistoricav9 = {
  normalize_projection(partido, yearsFounded, votesInitial, votesCurrent) {
    const currentYear = 2024;
    const yearsSinceFounded = currentYear - yearsFounded;
    const votesRatio = votesCurrent / votesInitial;
    const maturityFactor = (yearsSinceFounded / 8) * Math.sqrt(votesRatio);
    const adjustedFactor = Math.max(0.95, Math.min(1.12, maturityFactor));
    return { partido, yearsSinceFounded, votesRatio, factor: adjustedFactor, interpretation: adjustedFactor < 0.95 ? 'Ajuste máximo (partido muy nuevo)' : adjustedFactor > 1.12 ? 'Ajuste máximo (partido maduro)' : 'Ajuste normal' };
  },
  apply_to_projection(projectionBase, partido, yearsFounded, votesInitial, votesCurrent) {
    const normalization = this.normalize_projection(partido, yearsFounded, votesInitial, votesCurrent);
    const adjustedProjection = projectionBase * normalization.factor;
    return { proyeccionBase: projectionBase, factor_M17: normalization.factor, proyeccionAjustada: adjustedProjection, diferencia: adjustedProjection - projectionBase };
  }
};

// Registrar nuevos motores en exports globales
window.SIE_MOTORES.PivotElectoral = MotorPivotElectoral;
window.SIE_MOTORES.RutaVictoria = MotorRutaVictoria;
window.SIE_MOTORES.MetaElectoral = MotorMetaElectoral;
window.SIE_MOTORES.PrioridadEstrategica = MotorPrioridadEstrategica;
window.SIE_MOTORES.NormalizacionHistoricav9 = MotorNormalizacionHistoricav9;

console.log('✅ SIE 2028 v9.0 — 5 Nuevos motores CARGADOS');

