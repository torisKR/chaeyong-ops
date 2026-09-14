# 모드: email — 지원 메일 초안

공식 지원·리크루터 팔로업·추천 요청·콜드 지원·ATS 장애 시 이메일 fallback 초안.

**전체 워크플로·variant(stuck/noshow)는 `modes/email.md`를 따릅니다.** 이 파일은 한국 채용 맥락 오버라이드만 정의합니다.

## 한국어 출력

- 제목·본문·체크리스트는 `language.output` (기본 `ko`).
- 명령어 `/chaeyong-ops email`은 그대로 (CLI 라우터).

## 한국형 이메일 규칙

| 항목 | 가이드 |
|------|--------|
| 인사 | `안녕하세요, {회사} 채용 담당자님` 또는 `안녕하세요, {리크루터명}님` |
| 자기소개 | 첫 문단: `{이름}입니다. {현재 역할/연차} 경력으로 {역할}에 지원합니다.` |
| 첨부 | `이력서 첨부드립니다` / tailored PDF 있으면 파일명 명시 |
| 마무리 | `검토 부탁드립니다` / `편한 시간에 연락 주시면 감사하겠습니다` |
| 톤 | 격식체(~습니다), 과도한 존칭·군더더기 금지 |

## 외국계·영문 JD

JD·report가 영어이면 본문 영어 가능 — 사용자에게 확인. `language.output: ko`여도 **수신자 언어** 우선 제안.

## 금지

- 전송·Submit·Send 클릭 금지 (draft only)
- cv.md에 없는 성과·수치

## Report 연동

`reports/{NNN}-*.md` + `data/pdf-index.tsv`에서 tailored PDF 확인. 없으면 `/chaeyong-ops pdf {slug}` 안내.
