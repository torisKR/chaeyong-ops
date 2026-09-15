---
name: chaeyong-ops
description: >-
  한국형 AI 구직 파이프라인 — 잡코리아·사람인·원티드 스캔, 채용 공고 A–G+H 평가,
  맞춤 이력서, 지원 추적. JD/URL 붙여넣기, scan, pdf, tracker, interview 등
  chaeyong-ops 모드 실행 시 사용. (career-ops 기반 포크)
arguments: mode
user_invocable: true
user-invocable: true
argument-hint: "[scan | gonggo | oferta | ofertas | pipeline | pdf | apply | jiwon | batch | tracker | triage | cover | email | latex | latex-tex | add | expand | deep | contacto | training | project | interview-prep | interview | interview/plan | interview/practice | interview/debrief | interview-redflag | patterns | offer-prep | titles | upskill | followup | reply-watch | outcome | update | agent-inbox | discover]"
license: MIT
---

# 채용옵스 (Chaeyong Ops) — Router

한국 채용 시장용 구직 자동화. [career-ops](https://github.com/career-ops-hq/career-ops) 기반 포크이며, CLI별 스킬 경로만 다릅니다.

## Project Root Resolution

`SKILL.md` 위치에서 상위로 올라가 `AGENTS.md`와 `modes/`가 있는 디렉터리를 `PROJECT_ROOT`로 사용합니다. Resolve every path in this router (`modes/`, `config/`, `data/`, scripts, templates, and output paths) against `PROJECT_ROOT`, never against the process's current working directory.

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

- CLIs with slash-command registration can expose this router as `/chaeyong-ops`.
- Cursor: `.cursor/skills/chaeyong-ops/` — ask for a mode by name, or paste a JD/URL.
- Interactive Codex sessions use `codex` in the repo root. Slash commands are not guaranteed in Codex, so ask Codex to run the same mode by name if `/chaeyong-ops` is unavailable.
- Headless Codex workers use `codex exec "prompt"`.
- 슬래시 명령: `/chaeyong-ops` (또는 `/chaeyong-ops scan`)
- Codex: `codex exec "Run chaeyong-ops scan mode"`

## Mode Routing

| Input | Mode |
|-------|------|
| (empty) | discovery menu |
| JD text or URL | **auto-pipeline** |
| `gonggo` / `oferta` | `oferta` |
| `ofertas` | `ofertas` |
| `contacto` | `contacto` |
| `deep` | `deep` |
| `interview-prep` | `interview-prep` |
| `interview` | `interview` |
| `interview/plan` | `interview/plan` |
| `interview/practice` | `interview/practice` |
| `interview/debrief` | `interview/debrief` |
| `pdf` | `pdf` |
| `text` | `text` |
| `latex` | `latex` |
| `latex-tex` | `latex-tex` |
| `email` | `email` |
| `add` | `add` |
| `expand` | `expand` |
| `training` | `training` |
| `project` | `project` |
| `tracker` | `tracker` |
| `agent-inbox` | `agent-inbox` |
| `pipeline` | `pipeline` |
| `jiwon` / `apply` | `apply` |
| `scan` | `scan` |
| `discover` | `discover` |
| `batch` | `batch` |
| `patterns` | `patterns` |
| `offer-prep` | `offer-prep` |
| `titles` | `titles` |
| `upskill` | `upskill` |
| `followup` | `followup` |
| `reply-watch` | `reply-watch` |
| `outcome` | `outcome` |
| `interview-redflag` | `interview-redflag` |
| `update` | `update` |
| `cover` | `cover` |
| `triage` | `triage` |

**Auto-pipeline:** `$mode`가 알려진 sub-command가 아니고 JD/URL이면 `auto-pipeline` 실행.

---

## Output Language Directive

Before executing any mode, read `config/profile.yml` if it exists and resolve:

- `language.output` → ISO language code for human-facing output. Default: `ko`.
- `language.modes_dir` → optional market-mode directory.

> Write all human-facing output in `{language.output}` (default `ko`) regardless of the language of these instructions or the job description. Market terms from `modes/ko` may stay (정규직, 포괄임금제) but explain when needed.

---

## Discovery Menu

If your CLI supports `/chaeyong-ops`, show this menu. In Codex, surface the same options in plain text and map the requested mode the same way.

```
채용옵스 (Chaeyong Ops) — Command Center

  /chaeyong-ops {JD or URL}  → 자동 평가 + report + PDF + tracker
  /chaeyong-ops scan         → portals.yml 스캔 (원티드·잡코리아·사람인 등)
  /chaeyong-ops gonggo       → 채용 공고 A–G+H 평가만
  /chaeyong-ops triage       → 1차 빠른 점수 (go/no-go, 파일 없음)
  /chaeyong-ops pipeline     → pipeline.md inbox 처리
  /chaeyong-ops pdf          → 맞춤 이력서 PDF (ko-standard)
  /chaeyong-ops latex        → Export CV as LaTeX/Overleaf .tex
  /chaeyong-ops latex-tex    → Tailor your own resume.tex in place
  /chaeyong-ops jiwon        → 지원서 작성 도우미
  /chaeyong-ops cover        → 자기소개서 / 커버레터
  /chaeyong-ops email        → 지원 메일 초안
  /chaeyong-ops batch        → 대량 평가 (batch-runner.sh)
  /chaeyong-ops tracker      → 지원 현황
  /chaeyong-ops deep         → 회사 심층 리서치
  /chaeyong-ops contacto     → LinkedIn 아웃리치
  /chaeyong-ops ofertas      → 여러 오퍼 비교
  /chaeyong-ops offer-prep   → Read a received offer/contract (clause walk + lawyer questions)
  /chaeyong-ops titles       → Suggest adjacent job titles from your CV to broaden the search

첫 설정: node setup.mjs --defaults  →  config/profile.yml 의 experience.years 수정  →  npm run scan:kr
개인 데이터(cv.md, profile.yml)는 공개 저장소에 커밋하지 마세요.
```

---

## Context Loading

If `modes/_custom.md` exists, read it after `modes/_profile.md` and before the selected mode file. It contains user house rules and procedural preferences. It may override workflow/style defaults, but it never adds factual claims about the candidate.

### Modes that require `_shared.md` + their mode file

Read `modes/_shared.md` + `modes/_profile.md` (if exists) + `modes/_custom.md` (if exists) + `modes/{mode}.md`

Applies to: `auto-pipeline`, `gonggo`, `oferta`, `ofertas`, `pdf`, `text`, `contacto`, `apply`, `pipeline`, `scan`, `batch`

### Standalone modes with profile and custom context

Read `modes/_profile.md` (if exists) + `modes/_custom.md` (if exists) + `modes/{mode}.md`

Applies to: `tracker`, `agent-inbox`, `deep`, `interview-prep`, `interview`, `interview/plan`, `interview/practice`, `interview/debrief`, `latex`, `latex-tex`, `training`, `project`, `patterns`, `titles`, `upskill`, `followup`, `reply-watch`, `outcome`, `cover`, `email`, `add`, `offer-prep`, `discover`

### Modes delegated to subagent

For `scan`, `apply` (with Playwright), and `pipeline` (3+ URLs): launch as a worker/subagent with the content of `_shared.md` + `_profile.md` (if exists) + `_custom.md` (if exists) + `modes/{mode}.md` injected into the worker prompt. If your CLI exposes an `Agent(...)` primitive, the call looks like this:

```python
Agent(
  subagent_type="general-purpose",
  prompt="[output language directive]\n\n[content of modes/_shared.md]\n\n[content of modes/_profile.md if exists]\n\n[content of modes/_custom.md if exists]\n\n[content of modes/{mode}.md]\n\n[invocation-specific data]",
  description="chaeyong-ops {mode}"
)
```

Execute the instructions from the loaded mode file.
