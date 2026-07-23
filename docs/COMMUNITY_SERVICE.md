# 社群互動服務

本站的社群功能由 Astro SSR endpoint 與 SQLite 提供，不依賴第三方留言平台。

## 公開留言

- 每篇文章使用 `post:<slug>` 作為獨立留言串。
- About 使用 `about` 作為公共留言板。
- 留言只儲存稱呼、內容、介面語言與時間。
- 頭像支援 Gravatar、GitHub 與 Discord OAuth。Gravatar Email 只用來產生
  SHA-256 hash，不保存原始 Email；Discord access token 不寫入資料庫或瀏覽器。
- 留言不提供按讚、排名或好友數，依抵達時間排列。

## 儲存與部署

預設資料庫位置是 `./data/community.sqlite`，可用環境變數覆寫：

```sh
COMMUNITY_DB_PATH=/var/lib/kaiyasi/community.sqlite
```

正式環境必須將該路徑掛載到持久磁碟。無狀態或唯讀檔案系統會讓 SQLite
無法可靠保存資料；若部署到這類平台，應將 `community-store.ts` 換成受管理的
Postgres／libSQL adapter，而 API 與前端元件可以維持不變。

備份時需要保存 `.sqlite`、`.sqlite-wal` 與 `.sqlite-shm`，或在服務停止後直接
複製主資料庫檔。舊版本可能仍保留已停用的 `friend_requests` 資料表；該表中的
私人聯絡資料不會由目前程式讀取，但備份仍不得公開存取。

## 防濫用邊界

- POST 限制為同源 JSON 請求。
- 留言每個來源位址每 10 分鐘最多 5 次。
- 留言表單包含蜜罐欄位與長度驗證。
- 速率限制目前保存在單一 Node process 記憶體；多 instance 部署時需移到共享儲存。

目前新留言會直接公開，管理員可在後台將不適當留言切換為 `hidden`；若未來改為
預先審核，可將新留言預設狀態改成 `hidden`，再由管理流程切換為 `visible`。

管理員可在 `/admin` 搜尋留言並切換 `visible`／`hidden`。後台只改變狀態，
不會永久刪除留言；登入與部署設定請參考 `ADMIN_ARCHITECTURE.md`。

## Discord 留言頭像

在 Discord Developer Portal 建立 OAuth2 application，加入 callback：

```text
https://kaiyasi.dev/api/community/avatar/discord/callback
```

伺服器需要以下設定：

```sh
COMMUNITY_SESSION_SECRET=至少 32 bytes 的隨機值
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
# 選填；未設定時由目前 request origin 組成
DISCORD_REDIRECT_URI=https://kaiyasi.dev/api/community/avatar/discord/callback
```

授權範圍只有 `identify`。OAuth callback 以 access token 讀取 `/users/@me` 後，
只把 Discord CDN 頭像 URL 與顯示名稱放進一小時有效的 HttpOnly 簽章 cookie。
留言送出後只保存 provider 與頭像 URL。
