---
title: 'Ari IME'
description: 'A Fcitx5 Traditional Chinese input method that naturally mixes English and Zhuyin in the same input without switching modes.'
date: 2026-06-30
tags: ['C++', 'Fcitx5', 'Linux', 'libchewing']
github: 'https://github.com/kaiyasi/Ari-IME'
featured: true
---

Ari IME is a Fcitx5 Traditional Chinese input method for Linux that allows English and Zhuyin to coexist in the same preedit text. Keystrokes initially remain as their original characters and are converted to Chinese only after forming a complete, tone-marked Zhuyin syllable. This eliminates the need to switch modes repeatedly when typing brand names, technical terms, or sentences that mix Chinese and English.

The project is developed in C++20 and uses libchewing for conversion, phrase handling, and personalized learning. In addition to Standard, Eten, Hsu, and IBM Zhuyin layouts, it also supports keyboard layouts such as Dvorak, Colemak, Colemak-DH, and Workman.

Key features include:

- Mixed Chinese and English input with flexible key ordering
- Cursor movement and character reselection throughout the entire preedit text
- Optional full-width punctuation and forced English mode
- Personalized learning from user character selections and phrase preferences
- Verification with CTest, sanitizers, coverage, and fuzz testing

Arch Linux package configuration and a CMake installation workflow are currently provided. The source code is publicly available under the GPL-3.0-or-later license.
