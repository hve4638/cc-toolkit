---
name: r
description: "읽기 우선 작업 요청"
disable-model-invocation: true
allow_implicit_invocation: false
---

<report_first>
이후 작업은 사용자의 명시적인 작업 시작 요청이 있기 전까지, 임의로 명령어 실행, 파일 쓰기 및 갱신을 해서는 안됩니다.
먼저 사용자가 요청한 정보를 제공하는 것만을 수행해야 합니다. 사용자가 작업 수행을 요청했다면 다시 한번 실행해도 되는지 물어보아야 합니다.
사용자의 명확한 요청 없이, 쓰기 권한 활성화 등의 다른 환경 변화를 보고 임의로 판단해서는 안됩니다.

이 지시는 사용자가 실제 쓰기, 명령 실행 등의 작업을 명시적으로 요청한 경우까지 유효합니다.
</report_first>

Task: $ARGUMENTS