// Regras de preço do WIL EVENTOS — usadas pela agenda pública e pelo link de orçamento.
// Os valores vêm do sistema (Administração → Agenda online → Preços e horários), publicados
// em agenda.json. Se não vierem, valem os padrões abaixo.
// Horas contadas a partir da meia-noite do dia do evento: 24 = 00h, 26 = 02h, 28 = 04h do dia seguinte.
(function (global) {
  'use strict';
  var PADRAO = {
    valorMinimo: 700,
    tetoDiaInteiro: 1200,
    janelaInicio: 9,
    janelaFim: 26,
    limiteInicio: 7,
    limiteFim: 28,
    duracaoMinima: 6,
    faixas: [
      { ini: 7, fim: 21, valor: 70 },
      { ini: 21, fim: 26, valor: 100 },
      { ini: 26, fim: 28, valor: 120 }
    ],
    atalhos: [
      { nome: 'Diurno', ini: 9, fim: 19 },
      { nome: 'Noturno', ini: 19, fim: 26 },
      { nome: 'Dia inteiro', ini: 9, fim: 26 }
    ]
  };

  function inteiro(v, min, max, padrao) {
    var n = Number(v);
    if (!isFinite(n) || Math.round(n) !== n || n < min || n > max) return padrao;
    return n;
  }
  function dinheiro(v, padrao) {
    var n = Number(v);
    return isFinite(n) && n >= 0 && n <= 100000 ? Math.round(n * 100) / 100 : padrao;
  }

  // Aceita só uma configuração coerente; qualquer coisa estranha volta ao padrão.
  function normalizar(p) {
    if (!p || typeof p !== 'object') return JSON.parse(JSON.stringify(PADRAO));
    var c = {
      valorMinimo: dinheiro(p.valorMinimo, PADRAO.valorMinimo),
      tetoDiaInteiro: dinheiro(p.tetoDiaInteiro, PADRAO.tetoDiaInteiro),
      janelaInicio: inteiro(p.janelaInicio, 0, 30, PADRAO.janelaInicio),
      janelaFim: inteiro(p.janelaFim, 0, 30, PADRAO.janelaFim),
      limiteInicio: inteiro(p.limiteInicio, 0, 23, PADRAO.limiteInicio),
      limiteFim: inteiro(p.limiteFim, 1, 30, PADRAO.limiteFim),
      duracaoMinima: inteiro(p.duracaoMinima, 1, 24, PADRAO.duracaoMinima)
    };
    var faixas = Array.isArray(p.faixas) ? p.faixas.slice(0, 6).map(function (f) {
      return { ini: inteiro(f && f.ini, 0, 30, -1), fim: inteiro(f && f.fim, 0, 30, -1), valor: dinheiro(f && f.valor, -1) };
    }) : [];
    var faixasOk = faixas.length > 0 && faixas.every(function (f, i) {
      return f.ini >= 0 && f.fim > f.ini && f.valor >= 0 && (i === 0 || f.ini === faixas[i - 1].fim);
    }) && faixas[0].ini <= c.limiteInicio && faixas[faixas.length - 1].fim >= c.limiteFim;
    c.faixas = faixasOk ? faixas : JSON.parse(JSON.stringify(PADRAO.faixas));
    var atalhos = Array.isArray(p.atalhos) ? p.atalhos.slice(0, 4).map(function (a) {
      return { nome: String(a && a.nome || '').replace(/[<>]/g, '').trim().slice(0, 20), ini: inteiro(a && a.ini, 0, 30, -1), fim: inteiro(a && a.fim, 0, 30, -1) };
    }).filter(function (a) { return a.nome && a.ini >= 0 && a.fim > a.ini; }) : [];
    c.atalhos = atalhos.length ? atalhos : JSON.parse(JSON.stringify(PADRAO.atalhos));
    if (c.limiteFim - c.limiteInicio < c.duracaoMinima || c.janelaFim <= c.janelaInicio) return JSON.parse(JSON.stringify(PADRAO));
    return c;
  }

  function valorHora(cfg, h) {
    for (var i = 0; i < cfg.faixas.length; i++) if (h >= cfg.faixas[i].ini && h < cfg.faixas[i].fim) return cfg.faixas[i].valor;
    return cfg.faixas[cfg.faixas.length - 1].valor;
  }
  function custoHoras(cfg, a, b) { var t = 0; for (var h = a; h < b; h++) t += valorHora(cfg, h); return t; }

  // Total = soma das horas; entre janelaInicio e janelaFim no máximo o teto do dia inteiro; nunca abaixo do mínimo.
  function calcular(cfg, ini, fim) {
    var soma = custoHoras(cfg, ini, fim);
    var dIni = Math.max(ini, cfg.janelaInicio), dFim = Math.min(fim, cfg.janelaFim);
    var dentro = dFim > dIni ? custoHoras(cfg, dIni, dFim) : 0;
    var comTeto = Math.min(dentro, cfg.tetoDiaInteiro) + (soma - dentro);
    var total = Math.max(cfg.valorMinimo, comTeto);
    var regra = '';
    if (comTeto < cfg.valorMinimo) regra = 'Valor mínimo aplicado: ' + brl(cfg.valorMinimo);
    else if (dentro > cfg.tetoDiaInteiro) regra = 'Teto do dia inteiro aplicado: no máximo ' + brl(cfg.tetoDiaInteiro) + ' entre ' + hh(cfg.janelaInicio) + ' e ' + hh(cfg.janelaFim);
    var partes = [], h = ini;
    while (h < fim) { var v = valorHora(cfg, h), n = 0; while (h < fim && valorHora(cfg, h) === v) { n++; h++; } partes.push(n + 'h × ' + brl(v).replace(',00', '')); }
    return { ini: ini, fim: fim, horas: fim - ini, soma: soma, total: total, regra: regra, conta: partes.join(' + ') };
  }

  function hh(h) { return String(((h % 24) + 24) % 24).padStart(2, '0') + 'h'; }
  function hhmm(h) { return String(((h % 24) + 24) % 24).padStart(2, '0') + ':00'; }
  function brl(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function nomeAtalho(cfg, ini, fim) { for (var i = 0; i < cfg.atalhos.length; i++) if (cfg.atalhos[i].ini === ini && cfg.atalhos[i].fim === fim) return cfg.atalhos[i].nome; return ''; }
  function descricaoFaixas(cfg) { return cfg.faixas.map(function (f) { return brl(f.valor).replace(',00', '') + ' (' + hh(f.ini) + '–' + hh(f.fim) + ')'; }).join(' · '); }

  global.WilPrecos = { PADRAO: PADRAO, normalizar: normalizar, calcular: calcular, valorHora: valorHora, hh: hh, hhmm: hhmm, brl: brl, nomeAtalho: nomeAtalho, descricaoFaixas: descricaoFaixas };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.WilPrecos;
})(typeof window !== 'undefined' ? window : globalThis);
