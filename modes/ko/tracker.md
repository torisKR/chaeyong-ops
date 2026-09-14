# 모드: tracker — 지원 현황

**로직·상태값·`set-status.mjs` 사용법은 `modes/tracker.md`와 동일합니다.**

## 한국어 출력

- 요약, funnel 설명, 권장 next action, follow-up 제안은 **`language.output`** (기본 `ko`).
- **tracker 테이블 Status 열**은 canonical EN (`Evaluated`, `Applied`, `Interview`, …) — `templates/states.yml` 준수, 번역하지 않음.
- Notes 열은 한국어 자유.

## 한국 시장 맥락 (설명용)

보고 시 아래 용어를 필요할 때 한국어로 설명:

| 상태 | 한국어 설명 예 |
|------|----------------|
| Evaluated | 평가 완료, 지원 전 |
| Applied | 지원 완료 |
| Interview | 면접 진행 중 |
| Offer | 오퍼 수령 |
| Rejected | 불합격 |
| Discarded | 본인이 포기 / 공고 마감 |

## 명령

```bash
node set-status.mjs <report#|회사> <State> [--note "한국어 메모"]
node stats.mjs --summary
node funnel-velocity.mjs --summary
```

상태 변경은 hand-edit 금지 — `set-status.mjs`만 사용.
