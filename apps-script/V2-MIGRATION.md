# v2-development 開發版

此分支與正式 main 分支分離，**尚未部署**。

- `index.html`：GitHub 管理題目、A–D 選項、分數、稱號；提交 `responsesJson`、`quizVersion`。
- `apps-script/Code.js`：通用格式驗證，將作答資料存到新工作表 `問卷回覆_v2`，不覆蓋 `問卷回覆`。
- Apps Script 不再自行重算分數；試算表的分數欄位是「前端回報值」，不能當作防竄改成績。要取得可信的伺服器計分，需要額外的版本化計分規則或驗證服務。
- 新增或刪除題目時，前端目前仍需同步調整 `moneyQuestionId`（如變更金錢規劃題）以及作答呈現；答案儲存格式可支援變動題數。
- **不要將此版 HTML 併入 main，除非已先在 Google Apps Script 部署相容的 v2 接收端。** 現有正式接收端只接受 q1–q5，與 v2 的 `responsesJson` 不相容。
- 現有隱藏 iframe 只能得知載入狀態，不能驗證試算表寫入；完成頁面仍顯示「已送出（待確認）」。
- 手機使用者須自行於 Google Apps Script 編輯器更新程式並部署新版本。GitHub 更新不會自動修改 Google 端。

測試建議：先在獨立測試部署驗證 v2 資料寫入，再決定正式切換；不得用正式問卷直接測試不相容接收端。
