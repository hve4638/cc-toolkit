---
name: rule-nodejs
description: "MANDATORY rules for ALL Node.js/TypeScript work. MUST be loaded before any Node.js project creation, initialization, package installation, or development. Non-negotiable conventions for package manager, boilerplate, and project setup."
user-invocable: false
---

Node.js 관련 프로젝트를 새로 생성할 때 아래 지침을 따릅니다.

## boilerplate 선택

### 일반 라이브러리/패키지 또는 기본형

```
git clone https://github.com/hve4638/npm-boilerplate.git <project-name>
```

### React / SPA 프론트엔드 프로젝트

```
git clone https://github.com/hve4638/react-template.git <project-name>
```

## 프로젝트 초기화 절차

1. 위 기준에 맞는 보일러플레이트를 `git clone`으로 가져온다
2. `.git/` 디렉토리를 제거하여 원본 히스토리를 분리한다
   ```
   rm -rf <project-name>/.git
   ```
3. 이후 사용자의 요구에 맞게 프로젝트를 설정한다

## 패키지 매니저

- **반드시 pnpm을 사용한다.** npm, yarn, bun 등 다른 패키지 매니저를 사용하지 않는다.
- 의존성 설치: `pnpm install`
- 패키지 추가: `pnpm add <package>`
- 스크립트 실행: `pnpm run <script>`
- `pnpm approve-builds`는 인터랙티브 명령어이므로 **사용 금지**

### post-install 허용

안전하다 여겨지는 패키지의 post-install 스크립트는 `package.json`의 `pnpm.onlyBuiltDependencies`에 추가하여 허용한다.

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild", "protobufjs"]
  }
}
```
