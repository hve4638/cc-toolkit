위의 검토 항목을 사용자와 함께 끝낸다. 그 다음 apply pane 을 연다 — 최종 확정은 사용자가 그 pane 에서 하고, 정책은 거기서 적용된다:

```
useterminal exec node "{TUI}" apply --path '{WS}'{ARGS}
```

사용자에게 pane 에서 마저 진행하라고 알리고 턴을 끝내고 기다린다. 끝났다는 말을 들으면 이 파일을 다시 읽고 따른다:

```
cat "{HANDOFF}"
```
