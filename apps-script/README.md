# Google Apps Script（clasp 同步準備）

本目錄綁定現有的 Google Apps Script 專案，並不會自動更新線上程式。

## 第一次同步：只下載、不上傳

在本機安裝 Node.js 後，於終端機執行：

```bash
npm install -g @google/clasp
clasp login
git clone https://github.com/yilanbattalion1-pixel/new-recruit-test.git
cd new-recruit-test/apps-script
clasp pull
```

`clasp pull` 會將 Google Apps Script **現有的程式碼下載到這個目錄**，請先確認下載的 `Code.js`、`appsscript.json` 等檔案內容，再將它們提交到 GitHub。若本目錄已有同名檔案，請先備份並檢查差異。

## 安全原則

- **不要**在首次下載並比對現有程式之前執行 `clasp push`。
- `clasp push` 會改寫 Google Apps Script 專案中的程式檔案；須經明確確認後才執行。
- `clasp deploy` 可能建立新部署；現有正式 Web App 部署是否更新需另行確認，不能假設 push 後就自動更新正式網址。
- 不要將 `~/.clasprc.json`、OAuth token、帳號密碼或其他憑證提交到 GitHub。
- GitHub Pages 網站仍由儲存庫根目錄的 `index.html` 提供，不受此目錄的建立影響。

Apps Script Script ID 已記錄於 `.clasp.json`，它不是 OAuth 授權憑證。請以具有該 Apps Script 專案編輯權限的 Google 帳號登入。
