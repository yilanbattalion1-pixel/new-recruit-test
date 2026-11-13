/**
 * 義務役新兵問卷 V3 雲端後端
 * Apps Script Web App；僅使用 V3 專用試算表，不接觸 V2。
 *
 * Script Properties 必須設定：
 * SPREADSHEET_ID = 1x8Cj5kuQkrGlh4xFVJctA5YQKC5sluqtGZaXlCBYUHE
 * ADMIN_TOKEN = 自行設定一組長且不易猜測的管理 API 金鑰
 */

const V3 = {
  PUBLISHED: 'V3_Published',
  RESPONSES: 'Responses',
  AUDIT: 'Admin_Audit'
};

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = p.action || 'health';
    let result;

    if (action === 'health') {
      result = { ok: true, service: 'V3', status: 'ready' };
    } else if (action === 'getPublished') {
      result = getPublished_();
    } else if (action === 'getStats') {
      result = getStats_();
    } else if (action === 'getResponses') {
      requireAdmin_(p.token);
      result = getResponses_();
    } else {
      result = { ok: false, error: 'UNKNOWN_ACTION' };
    }

    return respond_(result, p.callback);
  } catch (err) {
    return respond_({ ok: false, error: String(err.message || err) },
      e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    let result;

    if (body.action === 'publish') {
      requireAdmin_(body.token);
      result = publish_(body.data);
    } else if (body.action === 'submit') {
      result = submit_(body.response);
    } else {
      result = { ok: false, error: 'UNKNOWN_ACTION' };
    }

    return respond_(result);
  } catch (err) {
    return respond_({ ok: false, error: String(err.message || err) });
  }
}

function respond_(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function getSS_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('尚未設定 SPREADSHEET_ID');
  return SpreadsheetApp.openById(id);
}

function requireAdmin_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!expected) throw new Error('尚未設定 ADMIN_TOKEN');
  if (!token || token !== expected) throw new Error('管理員驗證失敗');
}

function getPublished_() {
  const sh = getSS_().getSheetByName(V3.PUBLISHED);
  if (!sh || sh.getLastRow() < 2) {
    return { ok: true, published: false, title: '', version: 0, questions: [] };
  }
  const raw = sh.getRange(2, 2).getValue();
  if (!raw) return { ok: true, published: false, title: '', version: 0, questions: [] };
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Object.assign({ ok: true, published: true }, data);
}

function publish_(data) {
  if (!data || !Array.isArray(data.questions) || !String(data.title || '').trim()) {
    throw new Error('問卷標題或題目資料不完整');
  }
  const ids = {};
  data.questions.forEach((q, i) => {
    if (!q.id || !String(q.text || '').trim()) throw new Error('第 ' + (i + 1) + ' 題內容不完整');
    if (ids[q.id]) throw new Error('題目 ID 重複：' + q.id);
    ids[q.id] = true;
    if (q.type === 'choice') {
      if (!Array.isArray(q.options) || q.options.length !== 4 ||
          q.options.some(o => !String(o.text || '').trim())) {
        throw new Error('第 ' + (i + 1) + ' 題必須有 4 個完整選項');
      }
    } else if (!['fill', 'scale'].includes(q.type)) {
      throw new Error('第 ' + (i + 1) + ' 題類型不支援');
    }
  });

  const ss = getSS_();
  let sh = ss.getSheetByName(V3.PUBLISHED);
  if (!sh) sh = ss.insertSheet(V3.PUBLISHED);
  if (sh.getLastRow() === 0) sh.appendRow(['key', 'json', 'updated_at']);

  const old = getPublished_();
  const payload = {
    title: String(data.title).trim(),
    version: Math.max(Number(old.version || 0) + 1, Number(data.version || 1)),
    questions: data.questions,
    updated_at: new Date().toISOString()
  };
  const row = ['published', JSON.stringify(payload), new Date()];
  if (sh.getLastRow() < 2) sh.appendRow(row);
  else sh.getRange(2, 1, 1, 3).setValues([row]);

  audit_('PUBLISH', 'V3_Published', '發布 ' + data.questions.length + ' 題', 'SUCCESS');
  return { ok: true, published: true, version: payload.version, question_count: payload.questions.length, updated_at: payload.updated_at };
}

function submit_(r) {
  if (!r || r.consent !== true) throw new Error('請先確認資料使用同意事項');
  if (!r.answers || typeof r.answers !== 'object') throw new Error('沒有收到作答內容');

  const pub = getPublished_();
  if (!pub.published || !pub.questions.length) throw new Error('目前尚未發布問卷');
  const answers = {};
  pub.questions.forEach(q => {
    if (!Object.prototype.hasOwnProperty.call(r.answers, q.id)) throw new Error('尚有題目未完成');
    answers[q.id] = r.answers[q.id];
  });

  const sh = getSS_().getSheetByName(V3.RESPONSES);
  if (!sh) throw new Error('找不到 Responses 工作表');
  const id = Utilities.getUuid();
  const now = new Date();
  sh.appendRow([
    id, now, safe_(r.name, 100), safe_(r.family_structure, 100),
    safe_(r.family_income, 100), safe_(r.personal_debt, 100),
    safe_(r.education, 100), safe_(r.work_experience, 100),
    '', '', '', '',
    JSON.stringify({ version: pub.version || 1, answers: answers }),
    true
  ]);
  return { ok: true, response_id: id, submitted_at: now.toISOString() };
}

function getStats_() {
  const ss = getSS_();
  const pub = getPublished_();
  const sh = ss.getSheetByName(V3.RESPONSES);
  const count = sh ? Math.max(0, sh.getLastRow() - 1) : 0;
  const rows = sh && count ? sh.getRange(2, 1, count, 14).getValues() : [];
  const qStats = {};
  (pub.questions || []).forEach(q => {
    qStats[q.id] = { question_id: q.id, text: q.text, type: q.type, total: 0, counts: {}, sum: 0, average: null };
  });
  rows.forEach(row => {
    let parsed = {};
    try { parsed = JSON.parse(row[12] || '{}'); } catch (_) {}
    const answers = parsed.answers || {};
    Object.keys(qStats).forEach(id => {
      const s = qStats[id], a = answers[id];
      if (a === undefined || a === null || a === '') return;
      s.total++;
      const key = String(a);
      s.counts[key] = (s.counts[key] || 0) + 1;
      if (s.type === 'scale' && !isNaN(Number(a))) s.sum += Number(a);
    });
  });
  Object.keys(qStats).forEach(id => {
    const s = qStats[id];
    if (s.type === 'scale' && s.total) s.average = Math.round(s.sum / s.total * 100) / 100;
  });
  return { ok: true, total: count, question_stats: qStats, updated_at: new Date().toISOString() };
}

function getResponses_() {
  const sh = getSS_().getSheetByName(V3.RESPONSES);
  if (!sh || sh.getLastRow() < 2) return { ok: true, responses: [] };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 14).getValues();
  const responses = rows.map(row => {
    let parsed = {};
    try { parsed = JSON.parse(row[12] || '{}'); } catch (_) {}
    return {
      response_id: row[0],
      submitted_at: row[1] instanceof Date ? row[1].toISOString() : String(row[1]),
      name: row[2], family_structure: row[3], family_income: row[4],
      personal_debt: row[5], education: row[6], work_experience: row[7],
      answers: parsed.answers || {}, version: parsed.version || 1
    };
  }).reverse();
  return { ok: true, responses: responses };
}

function safe_(v, max) {
  return String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);
}

function audit_(action, target, details, result) {
  const ss = getSS_();
  let sh = ss.getSheetByName(V3.AUDIT);
  if (!sh) {
    sh = ss.insertSheet(V3.AUDIT);
    sh.appendRow(['audit_id', 'timestamp', 'admin_email', 'action', 'target', 'details', 'result']);
  }
  sh.appendRow([Utilities.getUuid(), new Date(), '', action, target, details, result]);
}

function initializeV3Backend() {
  const ss = getSS_();
  const schemas = {
    V3_Published: ['key', 'json', 'updated_at'],
    Responses: ['response_id', 'submitted_at', 'name', 'family_structure', 'family_income', 'personal_debt', 'education', 'work_experience', 'survival_score', 'survival_title', 'money_score', 'money_title', 'answers_json', 'consent'],
    Admin_Audit: ['audit_id', 'timestamp', 'admin_email', 'action', 'target', 'details', 'result']
  };
  Object.keys(schemas).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(schemas[name]);
  });
  return 'V3 雲端資料表初始化完成';
}
