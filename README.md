# Blog

Kaiyasi 的個人 Blog 與音樂日誌，以文章閱讀與寫作為核心。網站使用 Astro SSR 建置，並延伸作品、關於我、留言、朋友申請與私人文章管理後台。

## Requirements

- Node.js 22.12 或更新版本
- npm 10 或更新版本

## Development

```sh
npm ci
npx astro dev --background
```

背景伺服器可用以下指令管理：

```sh
npx astro dev status
npx astro dev logs
npx astro dev stop
```

正式建置：

```sh
npm run build
```

建置結果使用 `@astrojs/node` standalone adapter，入口為 `dist/server/entry.mjs`。

## Environment

將 `.env.example` 複製為本機 `.env`，再設定需要的服務。`.env` 與正式環境機密不會被 Git 追蹤。

主要設定：

- `COMMUNITY_DB_PATH`：留言與朋友申請使用的 SQLite 路徑。
- `COMMUNITY_SESSION_SECRET`：留言身分簽章密鑰。
- `ADMIN_ENTRY_PATH`：不公開的管理後台路徑。
- `ADMIN_PASSWORD`、`ADMIN_SESSION_SECRET`：後台登入資訊。
- `CONTENT_POSTS_DIRECTORY`：後台建立文章時使用的可寫入目錄。
- `CONTENT_GITHUB_TOKEN`、`CONTENT_GITLAB_TOKEN`：後台儲存後提交來源檔；兩邊完成後設定 `CONTENT_SYNC_REQUIRED=true`。
- `DISCORD_CLIENT_ID`、`DISCORD_CLIENT_SECRET`、`DISCORD_REDIRECT_URI`：Discord 頭像 OAuth。
- `AI_API_KEY`：文章翻譯與吉祥物對話使用的伺服器端金鑰。

完整範例請參考 [`.env.example`](./.env.example)，服務設計說明位於 [`docs/`](./docs/)。

## Content

文章來源位於 `src/content/posts/`，支援 Markdown、MDX，以及專案自訂的 callout 與 embed 語法。正式環境的瀏覽器後台會透過 repository file API 提交來源檔，再由部署流程發布。

## Security

- 不要提交 `.env`、SQLite 資料庫或平台 Token。
- 正式環境的 session secret 應至少 32 字元。
- 管理入口同時使用私密路徑、短效入口票證與登入密碼，不應把 `/admin` 當作公開入口。
