---
title: "Ari IME"
description: "モードを切り替えることなく、同じ入力内で英語と注音を自然に混在できるFcitx5繁体字中国語入力メソッド。"
date: "2026-06-30"
tags:
  - "C++"
  - "Fcitx5"
  - "Linux"
  - "libchewing"
url: "https://aur.archlinux.org/packages/fcitx5-ari-ime"
github: "https://github.com/kaiyasi/Ari-IME"
featured: true
---

Ari IMEは、英語と注音を同じプリエディット文字列内で共存させられる、Linux向けのFcitx5繁体字中国語入力メソッドです。キー入力はまず元の文字のまま保持され、声調を含む完全な注音音節が成立した場合にのみ中国語へ変換されます。そのため、ブランド名や技術用語、英中混在の文章を入力する際に、モードを何度も切り替える必要がありません。

このプロジェクトはC++20で開発され、変換、語句、パーソナライズ学習の処理にlibchewingを使用しています。大千、倚天、許氏、IBMなどの配列に加え、Dvorak、Colemak、Colemak-DH、Workmanなどのキーボード配列にも対応しています。

主な機能：

- 中国語と英語の混在入力、および入力順序の誤りへの対応
- プリエディット文字列全体でのカーソル移動と候補の再選択
- オプションの全角句読点と英語強制入力モード
- ユーザーの候補選択と語句の好みに基づくパーソナライズ学習
- CTest、Sanitizer、Coverage、ファジングによる検証

現在、Arch Linux向けのパッケージ設定とCMakeによるインストール手順を提供しており、ソースコードはGPL-3.0-or-laterライセンスで公開されています。
