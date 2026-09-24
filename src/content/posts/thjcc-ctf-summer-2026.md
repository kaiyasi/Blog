---
title: '2026 THJCC CTF Summer Edition'
description: '從參與者到網管組長：解密 CTF 網管職責、賽前環境建置、賽中突發應變與賽後總結。'
date: '2026-08-22'
tags:
  - 'THJCC'
  - 'CTF'
  - 'Network Admin'
  - 'Infrastructure'
draft: false
copyright: true
---

## 2026 THJCC CTF Summer Edition：網管組 Writeup

```txt
2026 THJCC CTF Summer Edition | Network Team
Date: 2026/08/15
Role: CTF Network Admin Lead
```

### 前言

上一次參加 THJCC 網管組已經是第三屆的事情了。

那時候的我基本上就是一個水著身份組的組員，比賽結束之後甚至有種「蛤？所以剛剛到底發生了什麼，比賽怎麼就結束了 ww」的感覺。

結果一年後不知道為什麼，就變成網管組長了。

先簡單自我介紹一下，我是 Kaiyasi，目前就讀中興大學應用數學系一年級，同時擔任 `SCAICT 中部高中電資社團聯合會議` 資訊組長。平常比較常碰全端開發、系統架構、Linux 和一些資安相關的東西。

比賽結束後，總召丟了一個任務給我：寫一篇賽後 Writeup。

但網管組又沒什麼 Flag 可以 Write，所以這篇跟一般的 CTF Writeup 不太一樣。比起解題，我比較想記錄這次到底怎麼把整個比賽環境架起來，以及從賽前、賽中一路到賽後，網管到底都在做什麼的介紹。

---

### 賽前比賽環境建置

#### 1. 窮學生的救星：感謝國雲網路

辦學生競賽有一個非常現實的問題：

**機器哪裡來？**

CTFd 要一台、題目環境要機器，有些題目還會需要額外的 CPU、記憶體或獨立服務。全部自己租的話，比賽還沒開始，經費大概就先沒了。

這次 2026 THJCC Summer Edition 的伺服器資源由 **國雲網路 NCSE Network** 的社群贊助計畫提供，包含 VPS 與網路資源。

這點真的幫了我們非常多。

至少網管不用在籌備期間一邊算 CPU 和 RAM，一邊看著 VPS 價格思考自己這個月還能不能吃飯。

如果是高中、大學資訊社團、開源專案，或其他學生技術活動，有類似的主機需求，也可以去看看他們的社群贊助計畫。

![國雲網路 NCSE Network 社群贊助計畫官網首頁](../../assets/posts/thjcc-ctf-summer-2026/ncse-network-sponsor.png)

#### 2. 所以到底要申請多少資源？

有贊助歸有贊助，也不可能直接跟人家說：

> 給我最頂的，越多越好。

所以賽前第一件麻煩事，就是估算資源。

理想狀況下，可以大概寫成：

$$
\text{所需總資源}
=
(\text{預估參加人數} \times \text{同時存取量})
+
\sum(\text{題目數量} \times \text{單題預估資源})
+
\text{Buffer}
$$

我們主要會看幾件事情。

- **CTFd 本身需要多少資源**  
  參賽人數大概多少、開賽瞬間會有多少人一起登入、刷新題目、提交 Flag。

- **題目環境吃多少資源**  
  Misc、Crypto 這類題目可能只是提供檔案，但 Web、Pwn 或需要動態 Instance 的題目，資源需求就完全不一樣。

- **一定要留 Buffer**  
  資源如果估到剛剛好，通常就是準備出事。實際上會額外留大概 20%～30% 的空間，至少遇到瞬間流量或某題突然吃資源時還有地方可以撐。

聽起來很合理。

問題是——

**申請主機的時候，題目大概率根本還沒出完。**

這大概也是辦 CTF 的固定劇情。距離比賽還有一段時間時，題目表可能一半都是空的；等接近死線，大家才開始瘋狂交題。

所以你根本不可能精準知道最後會有幾題 Web、幾題 Pwn，又有哪一題會突然冒出一個超級吃 RAM 的服務。

最後還是只能參考往年參賽人數、題目數量和以前的資源使用狀況，先抓一個大概的區間。

好在國雲這次在資源配置上滿有彈性的，不需要一開始就把所有規格完全定死。

我們採用的方式是先把基本環境架起來，確保 CTFd 和主要題目服務有足夠資源；等出題進度比較完整之後，再根據實際題目需求調整配額。

不然前期真的只能通靈。

#### 3. CTFd 跟靶機不要塞在一起

在規劃架構時，很容易出現一個看起來很省事的想法：

> 一台大機器，把 CTFd 跟所有題目 Docker 全塞進去不就好了？

理論上可以。

但實務上不會這樣幹。

這次我們直接把環境拆成兩類：

- CTFd 平台主機
- 題目靶機主機

最直接的原因就是 **不要讓題目把平台一起拖下水**。

CTF 選手在解題時會做什麼大家都知道。爆破、多執行緒腳本、大量 Request、奇怪 Payload，甚至不小心讓某個服務卡死，全部都很正常。

假設某一題突然 OOM，或者 CPU 被打到 100%，如果 CTFd 剛好跟它住在同一台機器上，那就不是「一題掛了」，而是整個 Scoreboard 跟著一起掛。

然後所有人都不能交 Flag。

Discord 大概十秒後就會開始：

> 平台是不是死了  
> 502  
> 我這邊也 502  
> admin???

另外一個問題是隔離。

CTF 靶機本來就是故意放漏洞給選手打的，有些題目的目標甚至直接就是 RCE。就算 Docker 有做隔離，也沒必要把充滿漏洞的 Challenge Environment 跟 CTFd、Database 放在同一個 Host 上增加風險。

所以平台和題目環境分開，本質上就是在縮小影響範圍。

![THJCC CTF 雙主機架構與網路隔離示意圖](../../assets/posts/thjcc-ctf-summer-2026/ctf-network-architecture.svg)

#### 4. CTFd Theme

CTFd 本身很好用，但預設介面大家應該也看得很熟了。

既然 THJCC 有自己的視覺設計，我們這次也有另外做一套 CTFd Theme，讓比賽平台至少不要一打開就長得跟其他 CTF 一模一樣。

主要調整包含：

- THJCC 的整體配色
- 首頁資訊與賽事規則
- 獎金資訊卡片
- Challenge Board
- 題目分類篩選
- Challenge Card 排版

功能上當然還是 CTFd，但整體看起來至少比較有「這是 THJCC 的比賽」的感覺。

![THJCC CTF 客製化首頁與賽事規則展示](../../assets/posts/thjcc-ctf-summer-2026/ctfd-home-landing.png)

![THJCC CTF 挑戰看板與題目分類卡片介面](../../assets/posts/thjcc-ctf-summer-2026/ctfd-challenge-board.png)

#### 5. CTFd 部署時比較容易踩的東西

CTFd 官方本身就有 Docker Compose，所以單純「把它跑起來」其實不難。

難的是你要讓一群人在同一時間一起用它，而且最好不要突然爆炸。

這邊記幾個這次有特別注意的地方。

**Nginx Reverse Proxy 與 Rate Limit**

登入、提交 Flag 之類的 Endpoint 最好做基本的 Rate Limit。

因為正式開賽之後，你永遠不知道大家手上的腳本會怎麼敲你的 Server。

太寬鬆可能被大量 Request 灌爆，太嚴又可能影響正常玩家，所以還是要根據實際流量調。

**Redis**

CTFd 本身在多人同時操作的情況下會有不少 Session、快取與背景工作需求。

正式環境把 Redis 配好，可以減少一些不必要的負擔，也比全部事情都直接往 Database 丟來得合理。

**Cloudflare**

外層我們也有透過 Cloudflare 處理流量。

至少靜態資源可以交給 CDN，另外對一些很基本的掃描或異常流量，也多一層可以擋。

當然，Cloudflare 不是套上去就無敵，該做的 Server-side 防護還是得做。

**動態 Challenge 的生命週期**

如果題目是「一人一台 Instance」或動態建立 Container，那 Auto Cleanup 一定要測。

真的。

不然測試環境大家開一開，幾天後上去 `docker ps -a`，會發現裡面住著一整個墳場。

正式比賽前 RAM 跟 Disk 被測試 Container 吃光就好笑了。

---

### 賽中問題處理與救火現場

比賽一開始之後，網管基本上就進入：

> 希望今天不要發生奇怪的事情。

然後通常就會發生奇怪的事情。

#### 1. `btop`：網管的血壓監測器

比賽期間， Terminal 裡幾乎一直開著 `btop`。

CPU、Memory、Load Average、Process 狀況都可以直接看，出了什麼問題通常也會先從這邊發現。

直到它變成這樣：

![btop 監控畫面：CPU 8 核心全滿載與驚人的 Load Average](../../assets/posts/thjcc-ctf-summer-2026/btop-cpu-100-overload.png)

8 個 CPU Core 全滿。

Load Average：

```txt
166
```

嗯。

看起來非常健康。

Process List 裡面基本上被某些 Crypto 題目的 Python / Gunicorn Process 塞滿。

看到這個數字時大概就知道今天事情不會少了。

#### 2. 題目 Process 沒有正常回收

後來往下查，發現其中一部分問題來自題目的程式本身。

有些需要計算或另外 Spawn Process 的 Challenge，在 Client 連線之後沒有處理好 Timeout 或 Process Cleanup。

平常只有一兩個人測試時完全看不出來。

正式開賽之後，幾十、幾百個連線一起進來，Process 數量就開始瘋狂往上疊。

最後 CPU 直接滿載。

這時候就只能先處理現場，一邊把異常 Process 清掉，一邊找出題組確認是哪一題、哪段服務出了問題，再調整 Challenge 的啟動方式或限制。

這也是我這次很有感的一件事：

**驗題不能只驗 Flag 拿不拿得到。**

服務會不會正常結束、連線斷掉之後 Process 有沒有回收、多人同時打會不會炸，這些也都算驗題的一部分。

只是平常最容易漏掉。

#### 3. Port Mapping 靈異事件

另外一類問題就比較單純：

**Container 跑了，但玩家連不到。**

賽前測試有些題目主要確認本機環境正常，到了正式部署才發現 Port Mapping 寫錯、Entry Point 權限不對，或者 Service 根本沒有正確 Listen 在預期的 Interface 上。

開賽沒多久 Ticket 就開始出現：

> 這題連不上

然後網管開始：

```bash
docker ps
docker logs ...
ss -tulpn
```

一路往下翻。

最後發現：

> 喔，Port 寫錯了。

修掉、Restart、測試。

然後回 Ticket：

> 已修復～

#### 4. 題目被打掛

還有一種情況就是 Challenge 真的被玩家打到 Crash。

這種東西在 CTF 其實沒那麼罕見，尤其當大家開始寫自動化 Script 後，一個原本正常的服務可能突然收到非常密集的 Request。

發現題目下線之後，我們通常會先看：

- Nginx Access Log
- Container Log
- Request Pattern
- Source IP
- 同一來源的 Request Frequency

先判斷到底是正常解題行為觸發 Bug，還是某個 Script 完全沒有 Delay，短時間內狂打 Server。

如果確認某個來源造成明顯異常流量，就先針對來源做 Rate Limit 或 Drop，避免其他玩家也一起受到影響，再回頭處理 Challenge 本身。

有時候你本來只是來維護 CTF。

維護到後面會開始像在做 Incident Response。

---

### 賽後資料導出與收尾

比賽倒數歸零之後，選手可以關電腦去睡覺。

網管還不行，還有資料要整理與統計。

#### 1. CTFtime 與比賽資料

這次 THJCC Summer Edition 有登錄在 **CTFtime**，因此賽後需要整理 Scoreboard 等相關資料。

主要包含：

- **Scoreboard / CTFtime Feed**  
  整理隊伍名稱、分數、排名等資訊，供後續成績處理。

- **Submission Logs**  
  保留 Flag Submission、時間等紀錄。除了之後分析比賽狀況之外，如果需要調查異常提交，也會用到這些資料。

- **CTFd Database 與 Challenge Environment**  
  比賽結束後把 CTFd Database、題目設定和相關部署資料備份下來。

這些東西當下看起來可能只是「比賽結束記得打包」，但之後要做復盤或下一屆交接時非常有用。

不然一年後問：

> 去年這題到底怎麼 Deploy 的？

大家一起失憶。

### 網管組長心得

從第三屆那個比賽結束後連比賽都過了還不知道的網管組員，到今年直接接網管組長，差距其實滿大的。

以前參賽時注意的是題目能不能解、Flag 能不能交。

當網管之後看的東西變成：

```txt
CPU
RAM
Load Average
Container
Nginx Log
Port
Ticket
```

然後祈禱不要再多一個東西亮紅燈。

另外像是 Challenge Port 配錯、Container 掛掉、Process 沒有回收、玩家 Script 把服務打爆，這些問題其實單獨來看都不是什麼超級困難的技術問題。

麻煩的是它們會在正式比賽進行中的時候發生。

你沒有幾個小時可以慢慢 Debug，只能先把服務救回來，再去追真正的 Root Cause。

這大概也是這次最大的收穫。

以前做自己的 Server，炸了大不了自己晚點修。

但比賽環境不一樣。

你的每一次 Restart、每一條 Firewall Rule、每一次設定修改，後面都是正在比賽的玩家。

所以除了「會架 Server」之外，怎麼降低修改的影響、怎麼快速定位問題，以及怎麼在一堆 Ticket 同時進來時判斷哪件事情最急，反而才是比較難的部分。

另外再次感謝 **國雲網路 NCSE Network** 提供這次比賽所需要的 VPS 與網路資源。

總之，2026 THJCC CTF Summer Edition，網管存活。

下次看到 `Load Average 166` 的時候，希望不是在 THJCC 上。