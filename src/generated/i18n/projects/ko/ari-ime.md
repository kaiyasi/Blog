---
title: 'Ari IME'
description: '모드를 전환하지 않고도 같은 입력에서 영어와 주음을 자연스럽게 함께 사용할 수 있는 Fcitx5 번체 중국어 입력기.'
date: 2026-06-30
tags: ['C++', 'Fcitx5', 'Linux', 'libchewing']
github: 'https://github.com/kaiyasi/Ari-IME'
featured: true
---

Ari IME는 Linux용 Fcitx5 번체 중국어 입력기로, 하나의 조합 문자열에서 영어와 주음을 함께 사용할 수 있습니다. 키 입력은 먼저 원래 문자를 유지하며, 성조가 포함된 완전한 주음 음절이 만들어진 뒤에만 중국어로 변환됩니다. 따라서 브랜드명, 기술 용어, 또는 영문과 중문이 섞인 문장을 입력할 때 모드를 반복해서 전환할 필요가 없습니다.

이 프로젝트는 C++20으로 개발되었으며, 변환, 어구 및 개인화 학습 처리에 libchewing을 사용합니다. 대천(大千), 의천(倚天), 허씨(許氏), IBM 등의 배열뿐 아니라 Dvorak, Colemak, Colemak-DH, Workman 등의 키보드 배열도 지원합니다.

주요 기능:

- 중국어·영어 혼합 입력 및 입력 순서 오류 허용
- 전체 조합 문자열 내에서 이동 및 후보 재선택
- 선택 가능한 전각 문장부호 및 영어 강제 입력 모드
- 사용자 후보 선택 및 어구 선호도 기반 개인화 학습
- CTest, Sanitizer, Coverage 및 퍼징 테스트를 통한 검증

현재 Arch Linux 패키지 설정과 CMake 설치 절차를 제공하며, 소스 코드는 GPL-3.0-or-later 라이선스로 공개되어 있습니다.
