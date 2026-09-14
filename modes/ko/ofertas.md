# 모드: ofertas — 여러 오퍼 비교

**비교 테이블·가중치·report 로드 규칙은 `modes/ofertas.md`를 따릅니다.**

## 한국어 출력

비교 narrative, 권장사항, trade-off 설명은 **`language.output`** (기본 `ko`).

## 한국 보상 비교 축

여러 report를 비교할 때 아래를 Block C·comp 행에 반영:

| 축 | 체크 |
|----|------|
| 연봉 | 세전 연봉(KRW), 상한·하한, 면접 후 결정 여부 |
| 성과급 | 목표급 vs 실지급, 지급률 범위 |
| 스톡옵션/RSU | grant 규모, vesting, cliff |
| 포괄임금제 | 고정+연장 가산, 주 52시간 |
| 수습 | 3개월 일반, 급여 90% 등 |
| 퇴직금 | DB형 vs DC형 |
| 4대 보험 | 가입 여부 (프리랜서/파견 제외) |
| 근무 | 재택·하이브리드·상시 출근, 지역 |

`advertised_comp`는 각 report Machine Summary에서 verbatim — 추정치로 대체 금지.

## 입력

report 번호 2개 이상 또는 tracker 행. 없으면 사용자에게 번호 요청.
