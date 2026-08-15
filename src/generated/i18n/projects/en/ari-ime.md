---
title: "Ari IME"
description: "A Fcitx5 Traditional Chinese input method that naturally mixes English and Zhuyin within the same input sequence without switching modes."
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

Ari IME is a Fcitx5 Traditional Chinese input method for Linux that lets English and Zhuyin coexist within the same preedit text. Keystrokes are initially preserved as raw characters and converted to Chinese only after they form a complete, tone-marked Zhuyin syllable. This eliminates the need to switch modes repeatedly when typing brand names, technical terms, or mixed Chinese-English sentences.

The project is developed in C++20 and uses libchewing for conversion, phrase handling, and personalized learning. In addition to Standard, Eten, Hsu, and IBM Zhuyin layouts, it supports keyboard layouts such as Dvorak, Colemak, Colemak-DH, and Workman.

Key features include:

- Mixed Chinese-English input with flexible character ordering
- Cursor movement and candidate reselection across the entire preedit text
- Optional full-width punctuation and forced English mode
- Personalized learning from user selections and phrase preferences
- Validation with CTest, sanitizers, coverage analysis, and fuzz testing

Arch Linux packaging and a CMake installation workflow are currently available. The source code is released under the GPL-3.0-or-later license.
