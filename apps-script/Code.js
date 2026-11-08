// v2 開發版：只在正式部署後才會生效；保留既有「問卷回覆」工作表不變。
// 新版每筆資料使用一列，responsesJson 保留每題完整題目、答案與分數。
// 前端分數僅作為使用者回報值，不能視為伺服器驗證過的成績。
const V2_SHEET_NAME='問卷回覆_v2';
const V2_HEADERS=['提交時間','問卷版本','姓名','家庭結構','家庭每月收入','個人債務狀況','最高學歷','正式工作經驗','題數','作答明細JSON','前端回報總分','前端回報稱號','前端回報金錢規劃分數','前端回報金錢規劃稱號'];

function v2SafeCell(value){
  const s=String(value==null?'':value).trim().slice(0,500);
  return /^[=+\-@\t\r]/.test(s)?"'"+s:s;
}
function v2GetSheet(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('請將此程式綁定至目標試算表');
  let sheet=ss.getSheetByName(V2_SHEET_NAME);
  if(!sheet)sheet=ss.insertSheet(V2_SHEET_NAME);
  if(sheet.getLastRow()===0){
    sheet.getRange(1,1,1,V2_HEADERS.length).setValues([V2_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
function doPost(e){
  const lock=LockService.getScriptLock();
  try{
    if(!e||!e.parameter)throw new Error('缺少提交資料');
    const p=e.parameter;
    const required=['name','family','income','debt','education','work','responsesJson','quizVersion'];
    for(const key of required)if(!String(p[key]||'').trim())throw new Error('缺少欄位：'+key);
    if(p.consent!=='true')throw new Error('未同意資料蒐集');
    if(String(p.schemaVersion)!=='2')throw new Error('資料格式版本不符');
    if(p.responsesJson.length>45000)throw new Error('作答明細過長');
    const responses=JSON.parse(p.responsesJson);
    if(!Array.isArray(responses)||responses.length<1||responses.length>100)throw new Error('題目數量不合法');
    const ids=new Set();
    for(const r of responses){
      if(!r||typeof r.id!=='string'||!/^q[0-9]+$/.test(r.id)||ids.has(r.id)||
        typeof r.question!=='string'||!r.question.trim()||
        !/^[ABCD]$/.test(r.answer)||
        typeof r.answerText!=='string'||!r.answerText.trim()||
        typeof r.score!=='number'||!Number.isFinite(r.score)||r.score<0||r.score>100){
        throw new Error('作答資料格式錯誤');
      }
      ids.add(r.id);
    }
    lock.waitLock(20000);
    const sheet=v2GetSheet();
    sheet.appendRow([
      new Date(),v2SafeCell(p.quizVersion),v2SafeCell(p.name),v2SafeCell(p.family),
      v2SafeCell(p.income),v2SafeCell(p.debt),v2SafeCell(p.education),v2SafeCell(p.work),
      responses.length,"'"+JSON.stringify(responses),
      v2SafeCell(p.score),v2SafeCell(p.rank),v2SafeCell(p.moneyScore),v2SafeCell(p.moneyRank)
    ]);
    SpreadsheetApp.flush();
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  }catch(error){
    console.error(error);
    return ContentService.createTextOutput('ERROR').setMimeType(ContentService.MimeType.TEXT);
  }finally{
    if(lock.hasLock())lock.releaseLock();
  }
}
