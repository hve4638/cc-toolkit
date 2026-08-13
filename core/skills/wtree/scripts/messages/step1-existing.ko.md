<status>Required Answer</status>
<info>
## status
{FACTS}

커밋된 정책 {DOTWTREE} 가 이미 있다. 그 rules 를 읽고 요약해 사용자에게 보여준다.
</info>
<require>
- path: "{DOTWTREE}" | "/tmp/<새 폴더>"
- allow_overwrite: true — 폐기 재구성일 때만
</require>
<question>
1. 기존 정책의 처분 (select one)
- 그대로 적용: 발견된 정책을 이 repo 에 그대로 쓴다 (path: "{DOTWTREE}")
- 폐기 재구성: 기존은 .wtree.old 로 밀리고 — 이미 있던 .old 는 삭제 — 새로 짓는다 (path: "{DOTWTREE}", allow_overwrite: true)
- 보존 재구성: 기존은 건드리지 않고 다른 곳에 짓는다 (path: "/tmp/<새 폴더>")
</question>
<next>
읽은 내용을 전달한 뒤 처분은 AskUserQuestion 도구로 묻고, 답에 맞는 키를 채워 재실행:

```
node {STEP1} --answer '<완성된 JSON>'
```
</next>
