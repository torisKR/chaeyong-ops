# 모드: scan — 한국 채용 포털 스캐너

`portals.yml`에 설정된 포털을 스캔하고, 제목·내용 필터를 통과한 신규 공고를 `data/pipeline.md`에 추가합니다.

> **기본 실행 (zero-token):** `node scan.mjs` — provider가 있는 보드는 API/HTML 파싱으로 자동 처리합니다. 한국 provider: `wanted`, `jobkorea`, `saramin`.
>
> **에이전트 워크플로:** Playwright/WebSearch는 `scan.mjs`가 처리하지 못하는 보드(로그인 wall, SPA만 있는 페이지)에만 사용합니다.

## 권장 실행

3개 이상 회사·보드를 스캔할 때는 worker/subagent로 실행해 메인 컨텍스트를 보호합니다. subagent는 **단일 패스**만 — 추가 subagent 금지 (`modes/_shared.md`).

```bash
node scan.mjs
node scan.mjs --summary   # 사람이 읽기 좋은 요약
```

## 설정

`templates/portals-kr.example.yml`을 `portals.yml`로 복사한 뒤 조정합니다.

```yaml
language:
  output: ko
  modes_dir: modes/ko

content_filter:
  negative:        # 영어 필수 공고 제외 (선택)
    - "영어 회화 필수"
    - "원어민"

title_filter:
  positive: ["백엔드", "frontend", "AI", "데이터", "DevOps"]
  negative: ["인턴", "영업", "마케팅"]

job_boards:
  - name: Wanted — 백엔드
    provider: wanted
    searchKeywords: "백엔드"
    max_pages: 5
    enabled: true

  - name: Saramin — 개발
    provider: saramin
    searchKeywords: "개발"
    max_pages: 3
    enabled: false   # 이용약관 확인 후 true

  - name: JobKorea — 개발
    provider: jobkorea
    searchKeywords: "개발"
    max_pages: 3
    enabled: false
```

⚠️ **이용약관:** MIT 라이선스 ≠ 잡코리아·사람인·원티드 자동 수집 허용. `enabled: true` 전 robots.txt·이용약관을 확인하세요.

## 한국 포털 provider

| Provider | 방식 | 설정 |
|----------|------|------|
| **wanted** | 공개 JSON API (`/api/v4/jobs`) | `provider: wanted` + `searchKeywords` |
| **saramin** | HTML 검색 파싱 | `provider: saramin` + `searchKeywords` |
| **jobkorea** | HTML 검색 파싱 | `provider: jobkorea` + `searchKeywords` |

글로벌 ATS(Greenhouse, Ashby, Lever)에 올라온 **한국 지사 공고**는 기존 `tracked_companies` + API로 스캔 가능합니다.

## Discovery 레벨 (요약)

| Level | 방법 | 한국 맥락 |
|-------|------|-----------|
| **0** | `node scan.mjs` (provider API/HTML) | wanted·saramin·jobkorea + Greenhouse 등 |
| **1** | Playwright `careers_url` | 로그인 wall·SPA 보드 |
| **2** | ATS public API | `tracked_companies[].api` |
| **3** | WebSearch `site:` | 신규 회사 발견용 — **결과는 stale할 수 있음**, liveness 확인 필수 |

**규칙:** Level 0에서 성공한 회사는 Level 1·2에서 **재스캔하지 않음** (`local_parser_ok`).

## Workflow

1. `portals.yml` 읽기
2. `data/scan-history.tsv` — 이미 본 URL
3. `data/applications.md` + `data/pipeline.md` — 중복 제거
4. **`node scan.mjs` 실행** (Level 0+2 통합)
5. Level 1 Playwright — `scan.mjs`가 못 한 `tracked_companies`만 **직렬** 처리 (병렬 Playwright 금지)
6. Level 3 WebSearch — `search_queries` (enabled만)
7. **title_filter** · **location_filter** · **content_filter** 적용
8. 신규 URL → `data/pipeline.md` **대기** 섹션:

```markdown
## 대기
- [ ] https://www.wanted.co.kr/wd/12345 | 회사명 | 백엔드 엔지니어
```

9. `scan-history.tsv`에 상태 기록 (`added`, `skipped_dup`, `skipped_title`, …)

## Liveness 확인 (Level 3·수동 추가 URL)

WebSearch·오래된 링크는 **반드시** live 확인 후 pipeline에 추가:

```bash
node check-liveness.mjs <url>
```

또는 Playwright snapshot. 마감 공고는 `skipped_expired`로 기록.

## 한국 포털 Playwright 팁

- **원티드:** `/wd/{id}` — Apply 버튼 + JD 본문 확인
- **잡코리아:** `GI_Read` 페이지 — "지원 마감"·404 확인
- **사람인:** `rec_idx` 상세 — 로그인 없이 JD 읽히는지 확인
- **LinkedIn KR:** 로그인 wall → pipeline에 `[!]` + 사용자에게 JD 붙여넣기 요청

## Private / 로컬 JD

비공개 URL이면 JD를 `jds/{company}-{role}.md`에 저장:

```markdown
- [ ] local:jds/wanted-backend-acme.md | Acme | 백엔드
```

## 스캔 후

```bash
node merge-tracker.mjs    # 평가 batch 후
/chaeyong-ops pipeline    # 대기 URL 처리 → auto-pipeline
```

요약 표:

| 추가됨 | 스킵(중복) | 스킵(제목) | 스킵(마감) | 에러 |
|--------|-----------|-----------|-----------|------|

## 출력 언어

스캔 요약·pipeline 메모는 `language.output` (기본 `ko`)로 작성합니다.
