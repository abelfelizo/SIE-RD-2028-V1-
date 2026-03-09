// ================================================================
// SIE 2028 — ENTRY POINT v8.9
// Carga datasets 2024 + 2020, expone globals para engine + UI
// ================================================================

(async function boot() {
  const root = document.getElementById('view');

  function setMsg(msg, sub) {
    if (!root) return;
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:60vh;gap:1rem;color:var(--muted);">
        <div style="font-size:2rem">⚡</div>
        <div style="font-size:.9rem">${msg}</div>
        <div style="font-size:.75rem;color:var(--muted);text-align:center">${sub||''}</div>
      </div>`;
  }

  function setError(msg) {
    if (!root) return;
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:60vh;gap:1rem;">
        <div style="font-size:2rem">⚠️</div>
        <div style="font-size:.9rem;color:var(--red)">${msg}</div>
        <div style="font-size:.75rem;color:var(--muted);text-align:center;line-height:1.6">
          Verifica que estás sirviendo desde servidor local.<br>
          Usa: <code style="background:var(--bg3);padding:.1rem .4rem;border-radius:.3rem">python3 -m http.server 8080</code>
        </div>
      </div>`;
  }

  // ── Datasets 2024 ────────────────────────────────────────────
  const DS_2024 = [
    { key: '_DS_RESULTADOS',         file: 'resultados_2024.json'                 },
    { key: '_DS_RESULTADOS_PRES',    file: 'resultados_presidencial_2024.json'    },
    { key: '_DS_ALIANZAS',           file: 'alianzas_2024.json'                   },
    { key: '_DS_CURULES',            file: 'curules_resultado_2024.json'           },
    { key: '_DS_CURULES_CAT',        file: 'curules_catalogo.json'                },
    { key: '_DS_PARTIDOS',           file: 'partidos.json'                        },
    { key: '_DS_TERRITORIOS',        file: 'territorios_catalogo.json'            },
    { key: '_DS_PADRON',             file: 'padron_2024.json'                     },
    { key: '_DS_PADRON_PROV',        file: 'padron_provincial_2024.json'          },
    { key: '_DS_PADRON_CIRC',        file: 'padron_circ_2024.json'                },
    { key: '_DS_PADRON_EXT',         file: 'padron_exterior_2024.json'            },
    { key: '_PROV_METRICS_PRES',     file: 'prov_metrics_presidencial_2024.json'  },
    { key: '_PROV_METRICS_SEN',      file: 'prov_metrics_senadores_2024.json'     },
    { key: '_PROV_METRICS_DIP',      file: 'prov_metrics_diputados_2024.json'     },
    { key: '_PROV_METRICS',          file: 'prov_metrics_presidencial_2024.json'  },
  ];

  // ── Datasets 2020 ────────────────────────────────────────────
  const DS_2020 = [
    { key: '_DS_RESULTADOS_2020',        file: 'resultados_2020.json'                  },
    { key: '_DS_ALIANZAS_2020',          file: 'alianzas_2020.json'                    },
    { key: '_DS_CURULES_2020',           file: 'curules_resultado_2020.json'            },
    { key: '_DS_PADRON_PROV_2020',       file: 'padron_provincial_2020.json'           },
    { key: '_DS_PADRON_CIRC_2020',       file: 'padron_circ_2020.json'                 },
    { key: '_DS_PADRON_EXT_2020',        file: 'padron_exterior_2020.json'             },
    { key: '_PROV_METRICS_PRES_2020',    file: 'prov_metrics_presidencial_2020.json'   },
    { key: '_PROV_METRICS_SEN_2020',     file: 'prov_metrics_senadores_2020.json'      },
    { key: '_PROV_METRICS_DIP_2020',     file: 'prov_metrics_diputados_2020.json'      },
  ];

  const ALL_DS = [...DS_2024, ...DS_2020];
  const TOTAL_DS = ALL_DS.length;

  setMsg('Cargando datasets…', '');

  let loaded = 0;
  for (const ds of ALL_DS) {
    setMsg('Cargando ' + ds.file + '…', loaded + '/' + TOTAL_DS + ' archivos');
    try {
      const resp = await fetch('./data/' + ds.file);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      window[ds.key] = await resp.json();
      loaded++;
    } catch (err) {
      setError('Error cargando ' + ds.file + ': ' + err.message);
      return;
    }
  }

  // ── Aliases 2024 (ui.js los necesita sin sufijo de año para el año activo) ──
  window._PROV_PRES = window._PROV_METRICS_PRES;
  window._PROV_SEN  = window._PROV_METRICS_SEN;
  window._PROV_DIP  = window._PROV_METRICS_DIP;

  setMsg('Inicializando motores…', TOTAL_DS + '/' + TOTAL_DS + ' datasets listos');

  try {
    await loadScript('./core/engine.js');
    await loadScript('./core/ui.js');
  } catch (err) {
    setError('Error cargando motor: ' + err.message);
    return;
  }

  console.log('✅ SIE 2028 v8.9 · 2024 + 2020 ACTIVOS · Boot OK');
})();

function loadScript(src) {
  return new Promise(function(resolve, reject) {
    var s = document.createElement('script');
    s.src = src + '?v=89';
    s.onload = resolve;
    s.onerror = function() { reject(new Error('No se pudo cargar ' + src)); };
    document.body.appendChild(s);
  });
}
