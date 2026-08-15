# Tools Cover Art Direction

這份文件是工具目錄封面的生成規範。目標是讓不同工具的圖片屬於同一個世界觀，但每張都有自己的場景、敘事與色彩性格。

## 核心概念

**原創日系動畫場景，不做角色海報。**

圖片應該像一部動畫中的場景截圖或片段，而不是典型的 AI 角色立繪、科技產品廣告或堆滿裝飾的概念圖。每張封面透過工具本身的功能來決定場景：剪貼簿就呈現資料同步，縮網址就呈現路線變短，字體工具就呈現字形被製作出來的過程。

## 共通規則

以下內容應在每個 prompt 中保留，讓系列維持一致：

- 原創 Japanese animation-inspired 2D illustration
- 手繪線稿、有限度 cel shading、紙張或印刷質感
- 物件與環境敘事優先，不使用大幅角色臉部或角色海報構圖
- 正方形 1:1 album-cover artwork
- 重要主體放在畫面中央約 80% 範圍內，避免裁切時失去重點
- 使用 3 個主要色，加上 1 個工具專屬強調色
- 保留邊緣呼吸感，不讓畫面每一處都塞滿細節
- 不在圖片內放任何文字、字母、數字、Logo、品牌標記或浮水印
- 不做 UI 截圖，不做產品 mockup，不使用現有動漫作品的角色或場景
- 圖片本身不放標題；工具名稱、分類與 OWN／3RD PARTY 標籤由網頁下方資訊區呈現

## 視覺語法

### 線條與質感

- `hand-drawn ink contours`
- `restrained cel shading`
- `textured gouache and colored-pencil finish`
- `subtle paper grain`
- `manga screentone` 可視工具主題使用，不要每張都使用
- 避免過度光滑、過度銳利、塑膠感、3D render 或攝影棚產品光

### 色彩

系列共通的基底色可以從以下範圍選擇：

- 深靛藍：夜景、背景、陰影
- 墨黑：線稿、字形、結構
- 青綠：資料、同步、工具感
- 暖米白：紙張、光線、留白
- 珊瑚紅：動態提示、路徑、局部焦點
- 芥末黃：燈光、紙膠帶、唯一的暖色強調

每張封面不要平均使用所有顏色。先選一個主色，再選一個輔助色與一個小面積強調色，讓工具之間有清楚差異。

### 構圖

每張封面要有不同的構圖動詞：

- **整理**：俯視、穩定、水平或網格結構
- **傳遞**：斜向、遠近、由混亂走向清楚
- **製作**：近距離、裁切、層疊、手作痕跡

不要讓三張圖片都使用同一個鏡頭角度、同一個中央主體或同一種霓虹背景。

## 工具專屬方向

| 工具 | 場景與敘事 | 構圖 | 主色方向 | 必須保留的識別物 |
| --- | --- | --- | --- | --- |
| 跨平台剪貼簿 | 放學後的房間書桌，資料在筆電、手機與剪貼簿之間同步 | 俯視或三分之四桌面，安靜且穩定 | 青綠、墨藍、暖黃，少量珊瑚紅 | 剪貼簿、紙張、兩個以上的裝置、同步中的色彩標記 |
| 縮網址工具 | 雨夜城市路口，複雜的長路收束成一條清楚的路線 | 左下混亂、右上清楚的斜向動線 | 深靛藍、電光青、珊瑚紅、芥末黃 | 糾結的紙帶或路線、單一箭頭、遠方目的地光 |
| EMTECH FONT | 黑白漫畫製作桌，抽象字形正在被剪裁、描繪與排列 | 近距離俯視或三分之四桌面，非對稱層疊 | 墨黑、暖米白、石墨灰，單一芥末黃 | 抽象字形、墨水、筆刷、描圖紙、網點與紙膠帶 |

## 可直接使用的 Prompt 模板

生成新封面時，保留下面的共通段落，只替換 `<工具專屬內容>`。不同工具應各自呼叫一次 `$imagegen`，不要用同一張圖做三個裁切版本。

```text
Use case: illustration-story
Asset type: square album-cover artwork for a personal tools directory
Primary request: Create an original Japanese animation-inspired illustration for <工具專屬內容>.
Scene/backdrop: <場景與環境>
Subject: <工具代表物件與視覺動作>; objects and environment are more important than a character portrait
Style/medium: hand-drawn 2D anime background art, restrained cel shading, textured gouache and colored-pencil finish, expressive ink contours, tactile paper grain
Composition/framing: square 1:1 cover, keep the important subject within the central 80% for object-fit cropping, use <構圖動詞> as the main visual motion, leave breathing room near the edges
Lighting/mood: <光線與情緒>
Color palette: <主色>, <輔助色>, one restrained <強調色>
Materials/textures: paper fibers, subtle print texture, imperfect hand-drawn marks
Text (verbatim): ""
Constraints: original setting and objects only; no readable writing, no letters, no numbers, no logos, no UI screenshot, no watermark, no border, no in-image title
Avoid: photorealism, 3D render, generic stock illustration, glossy AI concept art, giant character face, overfilled background, illegible pseudo-text
```

## 現有三張的 Prompt 方向

### Clipboard

```text
An after-school bedroom workspace at dusk. An open teal clipboard with loose notes sits between a small laptop and a phone. Luminous colored sync marks travel cleanly between the devices. The scene feels calm, practical and nostalgic, with a warm desk lamp and a blue-green city outside the window. Use a slightly top-down desk composition. No person is required.
```

### URL Shortener

```text
A rainy night city intersection with an elevated train line. A glowing paper route ribbon begins as a tangled mass in the lower-left and becomes one clean bright arrow leading toward a distant destination light in the upper-right. Use a strong diagonal composition, reflective pavement and energetic movement. A tiny anonymous courier may appear only as a scale cue.
```

### Font

```text
A quiet manga production desk with oversized abstract glyph-like paper shapes, ink brushes, a ruler, tracing sheets and a light table. Use near-black ink, warm cream paper, graphite gray and one restrained mustard accent. Make it feel like a close-up editorial worktable with halftone dots, taped edges and rough brush marks. Abstract shapes must not form readable words.
```

## 生成後檢查表

每次生成後，確認以下項目：

- 一眼能看出這張圖代表哪一種工具功能
- 三張圖共享手繪動畫質感，但鏡頭角度、場景與主色不重複
- 沒有任何可辨識的文字、Logo、數字或假文字
- 重要物件沒有貼到四個邊角，縮放成封面後仍看得懂
- 圖片不需要額外疊加標題就能成立
- 沒有過度發光、塑膠材質、攝影寫實或通用 AI 海報感
- 產出後先保留 PNG，再轉成網站使用的 WebP

## Loading 動畫

封面載入期間使用共用的 `tools-loading-v1.webp`，不要為每個工具再生成一張 loading 圖。動畫由 CSS 控制，生成素材只負責提供系列一致的紙張、墨線與 CD 意象：

- loading 素材保持低細節、低解析度，適合縮成 256px 以下
- 使用淡入淡出、緩慢漂移、掃光與細圓環旋轉，不使用快速閃爍
- 圖片載入完成後，placeholder 淡出，真實封面淡入
- 使用 `prefers-reduced-motion: reduce` 時停用所有動畫
- loading 素材不放文字，避免和工具資訊重複
- 目前 loading 素材路徑為 `public/images/tools/tools-loading-v1.webp`

## 專案檔案規則

封面存放於 `public/images/tools/`，使用工具 slug 與版本號命名：

```text
<tool-slug>-cover-v<version>.png
<tool-slug>-cover-v<version>.webp
```

網頁引用位置是 `src/pages/tools/index.astro` 的 `coverImages`。新增封面時先建立新版本，不直接覆蓋舊圖；確認頁面與 build 正常後，再決定是否清理舊版本。

目前使用的三張封面是：

- `clipboard-cover-v2.webp`
- `url-cover-v2.webp`
- `font-cover-v2.webp`
