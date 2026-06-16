---
name: rule-python
description: "MANDATORY rules for ALL Python work. MUST be loaded before any Python project creation, environment setup, dependency installation, or development. Non-negotiable conventions for package manager and project setup."
user-invocable: false
---

Python 관련 작업 시 아래 지침을 따릅니다.

## 패키지 매니저

- **반드시 uv를 사용한다.** pip, poetry, conda 등 다른 도구를 사용하지 않는다.
- uv가 설치되어 있지 않은 경우, 먼저 설치한 후 진행한다.
  ```
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```
- 프로젝트 초기화: `uv init <project-name>`
- 의존성 추가: `uv add <package>`
- 스크립트 실행: `uv run <script>`
