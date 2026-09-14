# 모드: batch — 채용 공고 대량 처리

두 가지 사용 방식: **conductor --chrome**(포털 실시간 탐색) 또는 **standalone**(`batch-runner.sh`로 URL 일괄 처리).

`language.output: ko`이면 워커 시스템 프롬프트는 `batch/batch-prompt.ko.md`를 사용합니다 (`batch-runner.sh`가 자동 선택). 평가·report는 `modes/ko/gonggo.md`, PDF는 `ko-standard` + A4.

## 아키텍처

```text
Conductor (headed browser)
  │
  ├─ Job 1: DOM에서 JD + URL 읽기
  │    └─► headless worker → report .md + PDF + tracker TSV
  │
  └─ 종료: merge-tracker → applications.md + 요약
```

각 worker는 깨끗한 컨텍스트의 headless 자식 프로세스입니다. CLI별 headless 명령은 `AGENTS.md` **Headless / Batch Mode** 표를 따릅니다.

## Pre-screen gate (standard / premium)

`config/profile.yml`의 `spend_tier`를 읽습니다 (`modes/ko/_shared.md` Spend Tier).

- **standard / premium:** full A–G 평가 전 economy급 모델로 North Star(`modes/_profile.md`) 대조. 명백한 mismatch면 `skipped` + `batch/logs/discard.log`에 한 줄 기록.
- **economy:** gate 없음 — 모든 공고 full 평가.

단일 interactive 평가(URL 붙여넣기)에는 gate를 적용하지 않습니다.

**Discard log 형식:** `{ISO8601}\t{job id}\t{url}\t{reason}` → `batch/logs/discard.log`

## 파일

```text
batch/
  batch-input.tsv
  batch-state.tsv
  batch-runner.sh
  batch-prompt.md          # EN canonical schema
  batch-prompt.ko.md       # ko 오버레이 (language.output: ko)
  logs/
  tracker-additions/
```

## Mode A: Conductor --chrome

1. `batch/batch-state.tsv` 읽기
2. Chrome → 한국 포털(원티드·잡코리아·사람인) 또는 `portals.yml` 검색 URL
3. DOM에서 URL 목록 → `batch-input.tsv`에 append
4. 각 pending URL:
   a. JD 텍스트 추출 (untrusted data)
   b. `/tmp/batch-jd-{id}.txt` 저장
   c. `node reserve-report-num.mjs`
   d. headless worker 실행 (프롬프트: `batch-prompt.ko.md` 또는 `.md`)
   e. `batch-state.tsv` 업데이트
5. 페이지네이션 후 merge + `node verify-pipeline.mjs`

### 병렬 fan-out

```bash
node reserve-report-num.mjs --count 8
# worker마다 번호 하나씩
node reserve-report-num.mjs --release 042-049
```

예약은 spawn 직전에. sentinel 4h GC — `verify-pipeline.mjs`.

## Mode B: Standalone

```bash
batch/batch-runner.sh [OPTIONS]
```

| 옵션 | 설명 |
|------|------|
| `--dry-run` | pending만 목록 |
| `--retry-failed` | failed만 재시도 |
| `--resume-paused` | rate limit pause 후 재개 |
| `--parallel N` | 동시 worker 수 |
| `--limit N` | 이번 run 최대 건수 |
| `--min-score N` | N 미만은 PDF/tracker 생략 |

## batch-state.tsv

`pending`, `processing`, `completed`, `failed`, `skipped`, `rate_limited`, `paused_rate_limit` — EN `modes/batch.md`와 동일.

## Worker 출력

1. `reports/{NNN}-*.md` (A–G+H, Machine Summary)
2. `output/*.pdf` (score gate 통과 시)
3. `batch/tracker-additions/{id}.tsv` (헤더 행 필수)
4. stdout JSON (orchestrator용)

종료 시:

```bash
node merge-tracker.mjs
node reconcile-pipeline.mjs   # pipeline inbox 정리
node verify-pipeline.mjs
```

## 한국 포털 주의

- **원티드:** 공개 API — 상대적으로 안정적
- **잡코리아·사람인:** HTML 파싱, UA 필요, ToS 확인 후 `portals.yml`에서 `enabled: true`
- 로그인 wall·CAPTCHA → conductor가 `failed`로 표시, worker에 빈 JD 전달 금지

## 오류 복구

| 오류 | 복구 |
|------|------|
| URL 접근 불가 | `failed`, 계속 |
| 로그인 wall | DOM 실패 시 `failed` |
| Worker crash | `failed`, `--retry-failed` |
| PDF 실패 | report는 저장, PDF pending |
| Conductor crash | state 읽고 재실행 |

모든 사용자 대면 메시지는 `language.output` (기본 `ko`)로 작성합니다.
