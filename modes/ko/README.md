# 채용옵스 — 한국어 모드 (`modes/ko/`)

한국어권 후보자와 한국 채용 시장을 위한 모드 세트입니다.

## 활성화

```yaml
# config/profile.yml (채용옵스 기본값)
language:
  output: ko
  modes_dir: modes/ko
```

## 모드 목록

| 파일 | EN 기준 | 역할 |
|------|---------|------|
| `_shared.md` | `modes/_shared.md` | archetype, scoring, 한국 채용 맥락 |
| `gonggo.md` | `modes/oferta.md` | A–G+H 전체 평가 |
| `auto-pipeline.md` | `modes/auto-pipeline.md` | URL → 평가+PDF+tracker |
| `jiwon.md` | `modes/apply.md` | 지원서 폼 assistant |
| `pipeline.md` | `modes/pipeline.md` | `data/pipeline.md` inbox |
| `scan.md` | `modes/scan.md` | 원티드·잡코리아·사람인 스캔 |
| `pdf.md` | `modes/pdf.md` | 한국어 PDF (`ko-standard`, A4) |
| `triage.md` | `modes/triage.md` | 1차 go/no-go |
| `batch.md` | `modes/batch.md` | 대량 처리 (`batch-prompt.ko.md`) |
| `cover.md` | `modes/cover.md` | 자기소개서 / 커버레터 |
| `email.md` | `modes/email.md` | 지원 메일 초안 |
| `tracker.md` | `modes/tracker.md` | 지원 현황 (출력 한국어) |
| `deep.md` | `modes/deep.md` | 회사 심층 리서치 |
| `contacto.md` | `modes/contacto.md` | LinkedIn 아웃리치 |
| `ofertas.md` | `modes/ofertas.md` | 오퍼 비교 |

### Brief 템플릿

`doctor.mjs` first run 시 `language.output: ko`이면 `modes/_brief.template.ko.md` → `modes/_brief.md` 자동 복사.

### EN 모드 그대로 사용

`interview-prep`, `patterns`, `upskill`, `intake`, `training`, `project`, `outcome`, `followup`, `reply-watch` 등 — `language.output: ko`로 출력만 한국어화.

## 영어로 유지하는 것

- `cv.md`, `pipeline`, `tracker`, `report`, `score`, `archetype`
- tracker Status 값 (`Evaluated`, `Applied`, …)
- 도구명·경로·명령어

## 기준 용어집

| 영어 | 한국어 |
|------|--------|
| Job posting | 채용 공고 |
| Cover letter | 커버레터 / 자기소개서 |
| Gross annual salary | 세전 연봉 |
| Permanent employment | 정규직 |
| Inclusive wage system | 포괄임금제 |
| Remote work | 재택근무 |

전체 표는 이전 버전과 동일 — `modes/ko/_shared.md` 보상·근무 섹션 참고.
