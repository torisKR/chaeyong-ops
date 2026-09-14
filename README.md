<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/wordmark-dark.svg"><img src="docs/wordmark-light.svg" alt="채용옵스 Chaeyong Ops" width="320" height="86"></picture></p>

# 채용옵스 (Chaeyong Ops)

**한국 채용 시장을 위한 AI 구직 파이프라인**

> [career-ops](https://github.com/career-ops-hq/career-ops) 기반 포크 · MIT License · 별도 제품명으로 배포

채용옵스는 AI 코딩 CLI(Cursor, Claude Code, Codex, OpenCode 등)에서 동작하는 오픈소스 구직 자동화 도구입니다. 채용 공고를 평가하고, 맞춤 이력서를 만들고, 지원 현황을 추적합니다.

**중요:** 무차별 지원 도구가 아닙니다. 필터입니다 — 수백 개의 공고 중 시간을 투자할 가치가 있는 소수를 찾아줍니다. 4.0/5 미만 공고에는 지원하지 않는 것을 권장합니다. **제출 전 반드시 직접 검토하세요.**

## 출처 및 라이선스

| 항목 | 내용 |
|------|------|
| 기반 프로젝트 | [career-ops](https://github.com/career-ops-hq/career-ops) (MIT) |
| 원저작권 | Copyright (c) 2026 Santiago Fernández de Valderrama |
| 이 포크 | [torisKR/chaeyong-ops](https://github.com/torisKR/chaeyong-ops) |
| 라이선스 | MIT — 수정·재배포·상업적 이용 가능 ([LICENSE](LICENSE), [NOTICE](NOTICE.md)) |
| 상표 | `career-ops` 이름·로고는 원저작자 상표입니다. 이 프로젝트는 **채용옵스**라는 별도 이름으로 배포합니다. |

### 포크 시 지켜야 할 조건

1. **원저작권 표시와 MIT 라이선스 문구 유지** (`LICENSE` 파일)
2. **수정 내용과 원본 저장소 링크 명시** ([NOTICE.md](NOTICE.md))
3. **보증 없음 조항 유지**
4. 다른 저장소 코드를 섞으면 해당 라이선스도 별도 확인
5. **API 키, 이력서, 연락처, 지원 기록은 공개 저장소에 포함하지 않기**

## 한국형 기능

```
채용옵스
├── 원본 MIT 라이선스 유지
├── 잡코리아 · 사람인 · 원티드 provider
├── 한국어 평가 프롬프트 (modes/ko/)
├── 한국어 이력서 템플릿 (cv-template.ko-standard.html)
├── 한국식 경력·기술스택 평가 기준
├── 영어 필수 공고 필터 (portals-kr.example.yml)
└── 별도 제품명·로고로 배포
```

| 기능 | 설명 |
|------|------|
| **한국 포털 스캔** | 원티드(JSON API), 사람인·잡코리아(HTML 파싱) |
| **한국어 평가** | 정규직/수습/포괄임금제/4대 보험 등 한국 채용 맥락 반영 |
| **영어 필수 필터** | `content_filter.negative`로 원어민·영어 회화 필수 공고 제외 |
| **맞춤 PDF** | 한글 타이포그래피 + 한국어 섹션 제목 |
| **지원 추적** | 평가 → PDF → 트래커 파이프라인 |

### ⚠️ 채용 사이트 이용약관

MIT 라이선스가 잡코리아·사람인·원티드의 이용약관을 대체하지 **않습니다**. provider를 활성화하기 전 각 사이트의 robots.txt와 이용약관에서 자동 수집 허용 범위를 확인하세요.

### ⚠️ 공개 저장소 주의

개인 프로필 데이터(이름, 연락처, 경력)가 추적 파일에 저장될 수 있습니다. **개인용은 공개 포크보다 비공개 저장소가 안전합니다.**

## 빠른 시작

### 1. 클론

```bash
git clone https://github.com/torisKR/chaeyong-ops.git
cd chaeyong-ops
npm install
```

### 2. 프로필 설정

```bash
cp config/profile.example.yml config/profile.yml
cp templates/portals-kr.example.yml portals.yml
```

`config/profile.yml`에서 이름, 이메일, 목표 역할, 연봉 범위를 입력합니다. 기본값:

```yaml
language:
  output: ko
  modes_dir: modes/ko
```

### 3. 이력서 작성

프로젝트 루트에 `cv.md`를 만듭니다. AI CLI에게 "이력서 작성 도와줘"라고 요청하면 onboarding을 안내합니다.

### 4. 사용 예시

AI CLI에서:

- 채용 URL 붙여넣기 → 자동 평가 + PDF + 트래커
- URL 붙여넣기 → **auto-pipeline** (평가 + PDF + tracker 자동)
- `scan` 모드 → `node scan.mjs` / 원티드·잡코리아·사람인 스캔
- `gonggo` 모드 → 한국어 채용 공고 A–G+H 평가
- `triage` 모드 → 1차 빠른 점수 (PASS만 full 평가)
- `pipeline` 모드 → `data/pipeline.md` 대기 URL 일괄 처리
- `pdf` 모드 → 한국어 ATS 이력서 (`cv-template.ko-standard.html`)
- `jiwon` 모드 → 지원서 폼 작성 도우미
- `cover` / `email` → 자기소개서·지원 메일 초안
- `batch` 모드 → `batch/batch-runner.sh` 대량 평가 (한국어 worker 프롬프트)
- `deep` / `contacto` / `ofertas` → 리서치·아웃리치·오퍼 비교

## 한국 포털 설정

`templates/portals-kr.example.yml`을 `portals.yml`로 복사한 뒤 키워드를 조정합니다.

```yaml
job_boards:
  - name: Wanted — 소프트웨어
    provider: wanted
    searchKeywords: "백엔드"
    max_pages: 5
    enabled: true

  - name: Saramin — 개발
    provider: saramin
    searchKeywords: "개발"
    enabled: false   # 이용약관 확인 후 true

  - name: JobKorea — 개발
    provider: jobkorea
    searchKeywords: "개발"
    enabled: false   # 이용약관 확인 후 true
```

스캔 실행:

```bash
node scan.mjs
```

## 영어 필수 공고 제외

`portals.yml`에 다음을 추가하면 영어 회화/원어민 필수 공고를 스캔 단계에서 걸러냅니다.

```yaml
content_filter:
  negative:
    - "영어 회화 필수"
    - "원어민"
    - "native english"
```

영어 필수 역할을 지원하려면 해당 키워드를 제거하세요.

## 한국어 모드

`modes/ko/`에 한국 채용 시장용 평가·지원 모드가 있습니다.

| 파일 | 역할 |
|------|------|
| `_shared.md` | 한국 채용 용어, 경력 평가 기준, 영어 필수 처리 |
| `gonggo.md` | 채용 공고 평가 |
| `jiwon.md` | 지원서 작성 |
| `pipeline.md` | URL inbox 처리 |

## 지원 CLI

Claude Code, Cursor, Codex, OpenCode, Antigravity CLI, Qwen, Kimi, GitHub Copilot 등 [에이전트 스킬 표준](https://agentskills.io) CLI에서 동작합니다.

## 기여

Issue와 PR을 환영합니다. 한국 포털 provider 개선, 평가 기준 보강, 문서 번역 등 모두 좋습니다.

## 관련 링크

- [원본 career-ops](https://github.com/career-ops-hq/career-ops)
- [career-ops MIT 라이선스](https://raw.githubusercontent.com/career-ops-hq/career-ops/main/LICENSE)
- [career-ops 상표 정책](https://raw.githubusercontent.com/career-ops-hq/career-ops/main/TRADEMARK.md)
