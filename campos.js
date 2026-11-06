// Travas de digitação, validação e leitura de mensagens — usadas pela agenda pública e pelo link de orçamento.
(function (global) {
  'use strict';
  function digitos(v, max) { return String(v || '').replace(/\D/g, '').slice(0, max); }
  function texto(v, max, proibido) { return String(v || '').replace(proibido, '').replace(/\s{2,}/g, ' ').replace(/^\s+/, '').slice(0, max); }
  function telefone(v) {
    var d = digitos(v, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }
  var MASCARA = {
    nome: function (v) { return texto(v, 80, /[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g); },
    cpf: function (v) { var d = digitos(v, 11); return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2'); },
    telefone: telefone,
    endereco: function (v) { return texto(v, 100, /[^0-9A-Za-zÀ-ÖØ-öø-ÿ'.,º°ª\/ -]/g); },
    numero: function (v) { return String(v || '').toUpperCase().replace(/[^0-9A-Z\/ -]/g, '').slice(0, 8); },
    cep: function (v) { var d = digitos(v, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; },
    bairro: function (v) { return texto(v, 60, /[^0-9A-Za-zÀ-ÖØ-öø-ÿ'. -]/g); },
    tipo: function (v) { return texto(v, 60, /[^0-9A-Za-zÀ-ÖØ-öø-ÿ'.,&\/ -]/g); },
    obs: function (v) { return String(v || '').replace(/[<>]/g, '').slice(0, 300); },
    item: function (v) { return texto(v, 40, /[^0-9A-Za-zÀ-ÖØ-öø-ÿ'.,&\/()+ -]/g); }
  };
  function cpfValido(c) {
    var d = digitos(c, 11); if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    function dv(t) { var s = 0; for (var i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i); var r = (s * 10) % 11; return r === 10 ? 0 : r; }
    return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
  }
  // Valida os dados do cliente. opcional: lista de campos que podem ficar vazios (mas, se preenchidos, têm de estar completos).
  function validar(d, opcional) {
    var e = {}, op = {}; (opcional || []).forEach(function (k) { op[k] = true; });
    var vazio = function (k) { return !String(d[k] || '').trim(); };
    var nome = String(d.nome || '').trim();
    if (!nome) e.nome = 'Informe o nome completo.';
    else if (nome.split(/\s+/).filter(function (p) { return p.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '').length >= 2; }).length < 2) e.nome = 'Informe nome e sobrenome.';
    var cpf = digitos(d.cpf, 11);
    if (!cpf) { if (!op.cpf) e.cpf = 'Informe o CPF.'; } else if (cpf.length < 11) e.cpf = 'CPF incompleto.'; else if (!cpfValido(cpf)) e.cpf = 'CPF inválido.';
    var tel = digitos(d.telefone, 11);
    if (!tel) { if (!op.telefone) e.telefone = 'Informe o telefone.'; } else if (tel.length < 10) e.telefone = 'Telefone incompleto.'; else if (tel.length === 11 && tel[2] !== '9') e.telefone = 'Celular deve começar com 9.';
    if (vazio('endereco')) { if (!op.endereco) e.endereco = 'Informe o endereço.'; } else if (String(d.endereco).trim().length < 3) e.endereco = 'Endereço muito curto.';
    if (vazio('numero') && !op.numero) e.numero = 'Informe o número (ou S/N).';
    var cep = digitos(d.cep, 8);
    if (!cep) { if (!op.cep) e.cep = 'Informe o CEP.'; } else if (cep.length < 8) e.cep = 'CEP incompleto.';
    if (vazio('bairro')) { if (!op.bairro) e.bairro = 'Informe o bairro.'; } else if (String(d.bairro).trim().length < 2) e.bairro = 'Bairro muito curto.';
    if (vazio('tipo')) { if (!op.tipo) e.tipo = 'Informe o tipo de evento.'; } else if (String(d.tipo).trim().length < 3) e.tipo = 'Tipo de evento muito curto.';
    return e;
  }

  // Lê a mensagem gerada pela agenda (ou pelo orçamento). Devolve campos brutos.
  var CHAVES = {
    'data': 'data', 'inicio': 'inicio', 'termino': 'fim', 'tipo de evento': 'tipo', 'nome': 'nome', 'cpf': 'cpf',
    'telefone': 'telefone', 'endereco': 'endereco', 'numero': 'numero', 'bairro': 'bairro', 'cep': 'cep', 'observacoes': 'obs',
    'periodo': 'periodo', 'valor estimado': 'valorEstimado', 'valor da locacao': 'valorLocacao', 'desconto': 'desconto', 'total': 'total'
  };
  function chave(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim(); }
  function lerMensagem(txt) {
    var bruto = { adicionais: [] }, n = 0;
    String(txt || '').replace(/\r/g, '').split('\n').forEach(function (linha) {
      var l = linha.replace(/[*_~]/g, '').trim();
      var mOrc = /ORÇAMENTO WIL EVENTOS N[ºo°]\s*([0-9A-Z-]+)/i.exec(l);
      if (mOrc) { bruto.orcamento = mOrc[1]; return; }
      var m = /^([^:]{2,30}):\s*(.*)$/.exec(l); if (!m) return;
      var k = chave(m[1]);
      if (k === 'adicional') { var p = m[2].split('|').map(function (x) { return x.trim(); }); if (p[0]) bruto.adicionais.push({ desc: p[0], qtd: parseInt(p[1], 10) || 1, valor: numero(p[2]) }); return; }
      var c = CHAVES[k]; if (c && bruto[c] === undefined) { bruto[c] = m[2].trim(); n++; }
    });
    bruto.reconhecida = n >= 6;
    var md = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(bruto.data || '').trim());
    bruto.dataISO = '';
    if (md) { var iso = md[3] + '-' + md[2] + '-' + md[1], t = new Date(iso + 'T12:00:00'); if (!isNaN(t) && t.getMonth() + 1 === Number(md[2])) bruto.dataISO = iso; }
    return bruto;
  }
  // "R$ 1.234,56" -> 1234.56
  function numero(v) { var s = String(v || '').replace(/[^\d,.-]/g, ''); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isFinite(n) ? Math.round(n * 100) / 100 : 0; }
  // "18:00" / "02:00 (dia seguinte)" -> horas desde a meia-noite do dia do evento (26 = 02h do dia seguinte), relativo ao início
  function horaParaNumero(v, inicio) { var m = /(\d{1,2}):(\d{2})/.exec(String(v || '')); if (!m) return NaN; var h = Number(m[1]); if (inicio !== undefined && h <= inicio % 24 && inicio < 24) h += 24; return h; }

  global.WilCampos = { MASCARA: MASCARA, digitos: digitos, cpfValido: cpfValido, validar: validar, lerMensagem: lerMensagem, numero: numero, horaParaNumero: horaParaNumero };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.WilCampos;
})(typeof window !== 'undefined' ? window : globalThis);
