---
name: rule-docker-compose
description: "MANDATORY source-based layout for Docker Compose deployment. MUST be loaded before creating or restructuring a project's docker-compose files, or when containerizing a project for deployment."
---

## 구조

배포용 compose 파일은 저장소의 `deploy/` 아래에 본보기와 조각으로만 둔다.

```
<저장소>/deploy/
├── docker-compose.template.yml   # 배포 루트에 docker-compose.yml 로 복사해 쓴다
├── .env.template                 # 배포 루트에 .env 로 복사해 쓴다
└── partials/
    └── compose.base.yml          # 배포마다 같은 서비스 정의
```

배포 디렉터리는 저장소 밖에 두고, 저장소를 그 안에 `source/` 로 clone 한다.

```
<배포 디렉터리>/
├── docker-compose.yml   # 사용자 소유
├── .env                 # 사용자 소유
└── source/
```

## 파일별 내용

- `partials/compose.base.yml`: build, `env_file`, 배포마다 같은 environment 값, restart 를 둔다. 템플릿이 `project_directory: .` 로 include 하므로 경로는 배포 디렉터리 기준으로 쓴다.
- `docker-compose.template.yml`: base 를 include 하고, 포트·볼륨처럼 배포마다 달라지는 값만 같은 서비스 이름 아래 적는다. 같은 이름의 재정의는 Docker Compose 5.0.0 이상에서만 base 와 합쳐지고, 그 전 버전은 `services.<이름> conflicts with imported resource` 오류로 멈춘다. 첫머리 주석에 배포 루트로 복사해 쓰는 파일이며 사용자 소유라고 적는다.
- `.env.template`: compose 변수와 앱 설정을 변수마다 한 줄 주석과 함께 둔다. base 가 `env_file: .env` 로 `.env` 전체를 컨테이너에 넘기므로, 앱 설정 변수를 더할 때는 `.env.template` 만 고친다.

```yaml
# deploy/partials/compose.base.yml
services:
  app:
    build:
      context: source
    env_file: .env
    restart: unless-stopped
```

```yaml
# deploy/docker-compose.template.yml
include:
  - path:
      - source/deploy/partials/compose.base.yml
    project_directory: .

services:
  app:
    ports:
      - "${APP_PORT:-8080}:8080"
    volumes:
      - ${APP_DATA:-./data}:/data
```

## README

README 의 배포 절에 위 Compose 버전 요구와 아래 배포·갱신 절차를 적는다.

```sh
# 배포
mkdir <app> && cd <app>
git clone <repo> source
cp source/deploy/docker-compose.template.yml docker-compose.yml
cp source/deploy/.env.template .env
docker compose up -d --build

# 갱신
git -C source pull && docker compose up -d --build
```
