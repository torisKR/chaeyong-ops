# 모드: contacto — LinkedIn / 네트워크 아웃리치

**연락처 유형별 메시지 구조·WebSearch는 `modes/contacto.md`를 따릅니다.**

## 한국어 출력

초안 메시지는 **`language.output`** (기본 `ko`). LinkedIn 프로필이 영어이면 영문 초안을 **대안으로** 제시하고 사용자가 선택.

## LinkedIn KR

| 항목 | 가이드 |
|------|--------|
| 연결 요청 한도 | Free 200자 / Premium·Sales Nav 300자 — 초안은 한도 내 |
| 톤 | 존댓말, 2–3문장, 자기 PR 과다 금지 |
| 리크루터 | `{회사} {역할} 공고 보고 연락드립니다` + 한 줄 proof |
| HM/동료 | 공통점(기술·이벤트) 1문장 + 가벼운 질문 |

## `linkedin-join.mjs`

```bash
node linkedin-join.mjs --company "원티드랩" --summary
```

Connections.csv는 user layer — 공개 repo에 커밋 금지.

## 금지

- 연결 요청 자동 전송
- cv.md에 없는 공동 프로젝트 주장
