// 與先前提供的 Google Apps Script 程式碼一致的 GitHub 參考副本。
// 注意：尚未與線上 Apps Script 專案內容比對；此檔案不會自動部署。
const SHEET_NAME = '問卷回覆';
const HEADERS = ['提交時間','姓名','家庭結構','家庭每月收入','個人債務狀況','最高學歷','正式工作經驗','第1題','第2題','第3題','第4題','第5題','生存適應力總分','生存適應力稱號','金錢規劃分數','金錢規劃稱號'];

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#30354e')
      .setFontColor('#ffffff');
  }
  return sheet;
}

function safeText(value) {
  const text = String(value == null ? '' : value).trim().slice(0, 500);
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!e || !e.parameter) throw new Error('缺少提交資料');
    const p = e.parameter;
    const required = ['name','family','income','debt','education','work','q1','q2','q3','q4','q5'];
    for (const key of required) {
      if (!String(p[key] || '').trim()) throw new Error('缺少欄位：' + key);
    }
    if (p.consent !== 'true') throw new Error('未同意資料蒐集');
    const answers = [p.q1,p.q2,p.q3,p.q4,p.q5];
    if (!answers.every(a => /^[ABCD]$/.test(a))) {
      throw new Error('測驗答案格式錯誤');
    }
    const points = {A:15,B:45,C:75,D:90};
    const score = Math.round(answers.reduce((sum,a) => sum + points[a], 0) / 5);
    const ranks = [
      {max:30,name:'玻璃心菜鳥'},
      {max:60,name:'薪水小偷大師'},
      {max:85,name:'營區人情世故王'},
      {max:100,name:'老油條薪水強者'}
    ];
    const rank = ranks.find(r => score <= r.max).name;
    const moneyScore = points[p.q5];
    const moneyRanks = {
      A:'金錢規劃迷航兵',
      B:'月光享樂特攻隊',
      C:'佛系儲蓄小尖兵',
      D:'退伍財富規劃王'
    };
    lock.waitLock(20000);
    const sheet = setupSheet();
    sheet.appendRow([
      new Date(),
      safeText(p.name),
      safeText(p.family),
      safeText(p.income),
      safeText(p.debt),
      safeText(p.education),
      safeText(p.work),
      ...answers,
      score,
      rank,
      moneyScore,
      moneyRanks[p.q5]
    ]);
    SpreadsheetApp.flush();
    return ContentService.createTextOutput('OK')
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    console.error(error);
    return ContentService.createTextOutput('ERROR')
      .setMimeType(ContentService.MimeType.TEXT);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}
