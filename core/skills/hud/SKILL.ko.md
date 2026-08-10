---
name: hud
description: statusline 을 설치하거나 제거한다
argument-hint: "[setup|uninstall]"
disable-model-invocation: true
---

<hud_instruction>
# hud

## 분기

사용자가 준 인자의 첫 단어로 나눈다.

- `setup`, 또는 아무것도 없음 → **설치**
- `uninstall`, `remove` → **제거**
- 그 외 → 두 명령을 알리고 멈춘다

## 설치

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-install.mjs"
```

스크립트가 기존 `statusLine` 을 대체했다고 알리면 그대로 전한다.

이어서 어떤 생산자를 켤지 AskUserQuestion 으로 복수 선택하게 묻는다.

- `hud` — 디렉터리·git 브랜치·한도·컨텍스트·모델을 한 줄에
- `advertise` — 문구를 내놓는 플러그인들의 스킬 광고를 한 줄로 돌아가며

고른 것을 항목 하나씩 넘겨 켠다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-enable.mjs" feat:hud feat:advertise
```

광고를 한국어로 받으려면 `feat:advertise@lang=ko`.

Claude Code 를 재시작하라고 알린다.

## 제거

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-uninstall.mjs"
```

Claude Code 를 재시작하라고 알린다. 플러그인 자체는 남는다 — 그것까지 지우려면 `/plugin uninstall core@hve`.
</hud_instruction>

$ARGUMENTS
