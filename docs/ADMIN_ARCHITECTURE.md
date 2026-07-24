# 管理後台架構

目前 `/admin` 提供文章、About 頁面與留言管理。文章仍以 Markdown／MDX 檔案作為唯一來源，
但可直接在瀏覽器建立、編輯、儲存草稿與發布。

## About 頁面管理

- About 的文字、技能、Roadmap、專案、經歷、連結與引言集中在 `src/content/about.json`。
- 後台「關於」分頁可直接讀取、驗證並儲存完整 JSON；格式或必要欄位不正確時不會覆寫原檔。
- `about.astro` 在每次請求時讀取資料檔；啟用遠端同步時，儲存會提交來源檔並由部署流程更新正式站。
- 寫入使用同目錄暫存檔後原子取代，避免中斷時留下半份內容。

若部署時使用持久磁碟，可將 About 檔案位置設定為：

```sh
CONTENT_ABOUT_FILE=/absolute/persistent/path/about.json
```

## 文章管理

- 列出、搜尋並讀取 `src/content/posts/` 下的 `.md` 與 `.mdx`。
- 文章索引由後端搜尋與狀態篩選，每頁回傳 25 篇並顯示總頁數，避免大量文章一次建立所有 DOM 節點。
- 新文章建立為 `.md`，可編輯標題、slug、摘要、日期、標籤、封面、著作權與 Markdown 內容。
- 編輯器可在未儲存或仍為草稿時即時預覽，使用與網站相同的 Markdown 擴充與程式碼高亮；預覽 HTML 在禁止腳本的隔離 iframe 中顯示。
- Markdown 工具列提供標題、粗體、斜體、連結、清單、引用、程式碼、圖片、callout 與 embed 快速插入；語法視窗列出本站支援格式。
- 既有文章的 slug 與副檔名保持不變，避免編輯時意外改變公開網址或 MDX 行為。
- 可分別儲存草稿或發布；不提供永久刪除，文章可以改回草稿。
- 寫入前驗證 slug 與 frontmatter，並使用同目錄暫存檔後原子取代原檔。
- 修改中文來源後，`npm run build` 會依內容 hash 更新翻譯；後台儲存不會同步等待翻譯服務。

預設文章目錄是 `src/content/posts/`。若部署環境需要把文章放在持久磁碟，設定：

```sh
CONTENT_POSTS_DIRECTORY=/absolute/persistent/path/posts
```

容器可寫時會同步更新當次執行中的檔案；唯讀正式容器則以 repository file API
作為寫入目標。每次儲存都更新 GitHub 與 GitLab 的來源檔，GitLab commit 會接續觸發部署：

```sh
CONTENT_SYNC_REQUIRED=true
CONTENT_GITHUB_TOKEN=具有指定 repository Contents 寫入權限的 token
CONTENT_GITHUB_OWNER=kaiyasi
CONTENT_GITHUB_REPO=Blog
CONTENT_GITHUB_BRANCH=main
CONTENT_GITLAB_TOKEN=具有 Kaiyasi/given Repository API 寫入權限的 token
CONTENT_GITLAB_BASE_URL=https://gitlab.serelix.xyz
CONTENT_GITLAB_PROJECT=Kaiyasi/given
CONTENT_GITLAB_BRANCH=main
```

同步只更新 `src/content/posts/...` 或 `src/content/about.json`，不會覆蓋 GitLab
的 `.platform/`、`.gitlab-ci.yml` 等部署檔。兩邊都設定完成前可暫時維持
`CONTENT_SYNC_REQUIRED=false`；此時只同步已有 token 的平台。

### 大量文章測試

`npm run generate:placeholder-posts` 會在 `src/content/posts/admin-preview/` 產生
100 篇草稿文章，用來檢查分頁與搜尋。這個目錄不會進入自動翻譯流程，草稿也不會出現在公開文章列表。

## 留言管理

- 以 `ADMIN_PASSWORD` 登入，成功後使用 12 小時有效的 HttpOnly 簽章 Cookie。
- Session 簽章使用 `ADMIN_SESSION_SECRET`；未設定時可沿用
  `COMMUNITY_SESSION_SECRET`，secret 必須至少 32 字元。
- 管理員可以搜尋留言、依公開狀態篩選，以及隱藏或恢復留言。
- 隱藏是可逆操作，不會刪除 SQLite 資料。
- 登入每個來源位址每 15 分鐘最多嘗試 5 次；修改要求同源 JSON 請求，
  Cookie 使用 `SameSite=Strict`，正式 HTTPS 環境會自動加入 `Secure`。

部署環境必須設定：

```sh
ADMIN_PASSWORD=使用密碼管理器產生的獨立密碼
ADMIN_SESSION_SECRET=至少32字元的隨機值
```

若密碼或 secret 不完整，`/admin` 只會顯示設定提示，管理 API 不會啟用。

## 唯一內容來源

- `zh-TW` 是文章、專案與介面文字的唯一人工維護來源。
- `en`、`ja`、`ko` 是可重新產生的翻譯版本，不應在後台直接當成獨立文章編輯。
- 每份來源內容以 SHA-256 記錄版本；hash 沒變就不呼叫翻譯 API。
- 修改中文後，翻譯工作只重建該內容的三個語言版本。

目前 `npm run translate` 已實作這個流程，`npm run build` 也會先執行翻譯。
未來後台應把相同流程放入工作佇列，並顯示 `pending`、`translating`、
`ready`、`failed` 四種狀態。翻譯失敗時保留上一版，不覆蓋可用內容。

## 未來後台模組

1. 文章修訂：版本紀錄、差異比較與回復。
2. 翻譯狀態：來源 hash、各語言版本、最後成功時間、錯誤與手動重試。
3. 吉祥物事件：事件開關、冷卻、機率、節日日期、角色與場景適用範圍。
4. API 設定：base URL、模型與翻譯模型；API key 只能更新，不能從後台讀回。
5. 稽核擴充：多管理員、修改者、修改時間與發布紀錄。

公開端目前從 `src/config/mascot-events.json` 讀取事件規則。未來可將同一份
結構移入資料庫，SSR 在渲染時取得設定，不需要改變瀏覽器事件格式。

## 吉祥物事件資料

事件統一傳送有限的結構化情境：

- 角色、服裝場景、語言、時間與頁面位置
- 事件類型與 NavBar／控制項目標
- 文章標題、簡介、標籤、目前章節與閱讀進度
- 節日 ID，以及本次是否允許使用 GIVEN 相關話題

不會把整頁 DOM、完整文章或任意 HTML 傳給模型。節日使用瀏覽器本地日期，
成功顯示後以 `節日 + 日期` 寫入 localStorage，因此同一天不會重複顯示。

## Secret 管理

正式環境只需要長期保留固定的 `AI_BASE_URL` 與模型名稱，輪替
`AI_API_KEY`。Key 必須放在部署平台 secret 或伺服器端設定檔，不可存進
文章資料、事件 JSON、瀏覽器 localStorage 或回傳給管理後台。
