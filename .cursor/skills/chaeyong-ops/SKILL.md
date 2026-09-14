---
name: chaeyong-ops
description: >-
  한국형 AI 구직 파이프라인 — 잡코리아·사람인·원티드·리멤버 스캔, 채용 공고 A–G+H 평가,
  맞춤 이력서, 지원 추적. JD/URL 붙여넣기, scan, pdf, tracker, interview 등
  chaeyong-ops 모드 실행 시 사용. (career-ops 기반 포크)
arguments: mode
user_invocable: true
user-invocable: true
argument-hint: "[scan | gonggo | oferta | pipeline | pdf | apply | batch | tracker | ...]"
license: MIT
---

# 채용옵스 (Chaeyong Ops) — Router

한국 채용 시장용 구직 자동화. [career-ops](https://github.com/career-ops-hq/career-ops) 기반 포크이며, CLI별 스킬 경로만 다릅니다.

## Project Root Resolution

`SKILL.md` 위치에서 상위로 올라가 `AGENTS.md`와 `modes/`가 있는 디렉터리를 `PROJECT_ROOT`로 사용합니다. 모든 경로는 CWD가 아니라 `PROJECT_ROOT` 기준입니다.

## Market mode resolution

`config/profile.yml`을 읽습니다:

- `language.output` — 기본 `ko`
- `language.modes_dir` — 기본 `modes/ko`

평가 모드 파일 매핑:

| Router input | `modes/ko/` (default) | `modes/` (fallback) |
|--------------|----------------------|---------------------|
| JD/URL (no sub-command) | `modes/ko/auto-pipeline.md` | `modes/auto-pipeline.md` |
| `gonggo`, `oferta` | `modes/ko/gonggo.md` | `modes/oferta.md` |
| `jiwon`, `apply` | `modes/ko/jiwon.md` | `modes/apply.md` |
| `pipeline` | `modes/ko/pipeline.md` | `modes/pipeline.md` |
| `scan` | `modes/ko/scan.md` | `modes/scan.md` |
| `pdf` | `modes/ko/pdf.md` (+ `modes/pdf.md` pipeline) | `modes/pdf.md` |
| `triage` | `modes/ko/triage.md` | `modes/triage.md` |
| `batch` | `modes/ko/batch.md` (+ `batch/batch-prompt.ko.md` workers) | `modes/batch.md` |
| `cover` | `modes/ko/cover.md` (+ `modes/cover.md`) | `modes/cover.md` |
| `email` | `modes/ko/email.md` (+ `modes/email.md`) | `modes/email.md` |
| `tracker` | `modes/ko/tracker.md` (+ `modes/tracker.md`) | `modes/tracker.md` |
| `deep` | `modes/ko/deep.md` (+ `modes/deep.md`) | `modes/deep.md` |
| `contacto` | `modes/ko/contacto.md` (+ `modes/contacto.md`) | `modes/contacto.md` |
| `ofertas` | `modes/ko/ofertas.md` (+ `modes/ofertas.md`) | `modes/ofertas.md` |

`_shared.md`도 동일한 `modes_dir`에서 읽습니다 (`modes/ko/_shared.md`).

`language.output: ko`이면 `doctor.mjs`가 `modes/_brief.template.ko.md` → `modes/_brief.md`를 자동 복사합니다.

## Invocation Notes

- Cursor: `.cursor/skills/chaeyong-ops/`
- 슬래시 명령: `/chaeyong-ops` (또는 `/chaeyong-ops scan`)
- Codex: `codex exec "Run chaeyong-ops scan mode"`

## Mode Routing

| Input | Mode |
|-------|------|
| (empty) | discovery menu |
| JD text or URL | **auto-pipeline** |
| `gonggo` / `oferta` | evaluation A–G+H |
| `jiwon` / `apply` | application assistant |
| `scan` | portal scan (wanted, jobkorea, saramin, remember, …) |
| `pipeline` | process `data/pipeline.md` |
| `pdf` | tailored CV PDF |
| `tracker` | application status |
| (see career-ops router for full list) | same semantics |

**Auto-pipeline:** `$mode`가 알려진 sub-command가 아니고 JD/URL이면 `auto-pipeline` 실행.

---

## Output Language Directive

> Write all human-facing output in `{language.output}` (default `ko`). Market terms from `modes/ko` may stay (정규직, 포괄임금제) but explain when needed.

---

## Discovery Menu

```
채용옵스 (Chaeyong Ops) — Command Center

  /chaeyong-ops {JD or URL}  → 자동 평가 + report + PDF + tracker
  /chaeyong-ops scan         → portals.yml 스캔 (원티드·잡코리아·사람인·리멤버)
  /chaeyong-ops gonggo       → 채용 공고 A–G+H 평가만
  /chaeyong-ops triage       → 1차 빠른 점수 (go/no-go, 파일 없음)
  /chaeyong-ops pipeline     → pipeline.md inbox 처리
  /chaeyong-ops pdf          → 맞춤 이력서 PDF (ko-standard)
  /chaeyong-ops jiwon        → 지원서 작성 도우미
  /chaeyong-ops cover        → 자기소개서 / 커버레터
  /chaeyong-ops email        → 지원 메일 초안
  /chaeyong-ops batch        → 대량 평가 (batch-runner.sh)
  /chaeyong-ops tracker      → 지원 현황
  /chaeyong-ops deep         → 회사 심층 리서치
  /chaeyong-ops contacto     → LinkedIn 아웃리치
  /chaeyong-ops ofertas      → 여러 오퍼 비교

개인 데이터(cv.md, profile.yml)는 공개 저장소에 커밋하지 마세요.
지원 순서: docs/APPLY-KR.md (scan → gonggo ≥4.0 → 포털에서 직접 제출)
```

---

## Context Loading

`modes/_custom.md` → procedural rules only.

### `_shared.md` + mode file 필요

`{modes_dir}/_shared.md` + `modes/_profile.md` + `modes/_custom.md` + `{modes_dir}/{mode}.md`

Applies to: `auto-pipeline`, `gonggo`, `oferta`, `pdf`, `apply`, `pipeline`, `scan`, `batch`, …

### Subagent delegation

`scan`, `apply`, `pipeline` (3+ URLs): worker에 위 mode 파일 주입.

```python
Agent(
  subagent_type="general-purpose",
  prompt="[language directive]\n\n[shared + profile + custom + mode md]\n\n[data]",
  description="chaeyong-ops {mode}"
)
```

Execute the loaded mode file.
