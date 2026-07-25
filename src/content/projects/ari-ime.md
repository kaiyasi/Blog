---
title: 'Ari IME'
description: '不必切換模式，就能在同一段輸入中自然混用英文與注音的 Fcitx5 繁體中文輸入法。'
date: 2026-06-30
tags: ['C++', 'Fcitx5', 'Linux', 'libchewing']
github: 'https://github.com/kaiyasi/Ari-IME'
featured: true
---

Ari IME 是為 Linux 打造的 Fcitx5 繁體中文輸入法，讓英文與注音可以共存在同一段預編輯文字中。按鍵會先保留原始字元，只有形成完整且帶聲調的注音音節後才轉換成中文，因此輸入品牌名稱、技術名詞或中英混合句子時，不需要反覆切換模式。

專案以 C++20 開發，並使用 libchewing 處理轉換、詞組與個人化學習。除了大千、倚天、許氏與 IBM 等排列，也支援 Dvorak、Colemak、Colemak-DH、Workman 等鍵盤配置。

主要功能包含：

- 中英文混合輸入與順序容錯
- 在整段預編輯文字中移動並重新選字
- 可選的全形標點與強制英文模式
- 使用者選字與詞組偏好的個人化學習
- CTest、Sanitizer、Coverage 與模糊測試驗證

目前提供 Arch Linux 套件設定與 CMake 安裝流程，原始碼以 GPL-3.0-or-later 授權公開。
