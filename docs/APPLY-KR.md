# 한국 지원 워크플로 (채용옵스)

이 포크를 **실제로 지원에 쓰는** 순서입니다. 무차별 대량 지원 도구가 아닙니다. 점수가 낮은 공고는 건너뛰고, **제출 버튼은 항상 사람이 누릅니다.**

> 시스템은 절대 지원서를 제출하지 않습니다 — the system never submits an application.

## 0. 개인 데이터

처음 클론했다면 [GETTING-STARTED-KR.md](GETTING-STARTED-KR.md) 의 5분 경로를 먼저 보세요. 이 문서는 **실제로 지원에 쓰는** 순서입니다.

```bash
node setup.mjs --defaults
```

`cv.md`, `config/profile.yml`, `portals.yml`, `data/*` 는 **gitignored** 입니다. 예제만 커밋되어 있습니다.

- 공개 저장소에 실명 전화번호·개인 이메일을 넣지 마세요.
- 예제 연락처 (`you.example@example.com`, `010-0000-0000`) 는 placeholder 입니다.

## 1. 프로필

```bash
node setup.mjs --defaults
# 또는
cp config/profile.example.yml config/profile.yml
```

이 포크의 `config/profile.example.yml` 은 **한국 백엔드/풀스택** 기본값입니다.

| 항목 | 예제 기본 |
|------|-----------|
| 역할 | 풀스택 개발자, 백엔드 개발자 (NestJS / Node.js / TypeScript) |
| 위치 | 서울 |
| 연봉 | 세전 4,000만원+ (`compensation.target_range`) |
| 언어 | `language.output: ko`, `language.modes_dir: modes/ko` |
| PDF | `cv.template: ko-standard`, `auto_pdf_score_threshold: 4.0` |

이름·이메일·전화·연봉 범위·**`experience.years`** 를 **본인 값**으로 바꿉니다. 예제 이름 `김예시` 를 그대로 두지 마세요. 경력 연차가 스캔 제목 필터와 `gonggo` SKIP을 결정합니다.

확인:

```bash
node doctor.mjs --json
```

`onboardingNeeded: false` 가 될 때까지 `cv.md` / `profile.yml` / `modes/_profile.md` / `portals.yml` 을 채웁니다.

## 2. 이력서

```bash
cp cv.example.md cv.md
```

구조만 가져오고, 회사명·날짜·성과는 **본인이 확인한 사실만** 남깁니다. 없는 숫자를 만들지 마세요. PDF는 `cv.md` 가 소스 오브 트루스입니다.

```bash
cp modes/_profile.template.md modes/_profile.md
```

아키타입(백엔드 / 풀스택 / 프론트)을 본인 이야기로 고칩니다.

## 3. 포털 스캔

```bash
node setup.mjs --defaults
# 또는
cp templates/portals-kr.example.yml portals.yml
node scan.mjs
```

| 보드 | 기본 `enabled` | 비고 |
|------|----------------|------|
| **원티드** (백엔드, 풀스택, NestJS, Node.js, TypeScript) | `true` | 공개 JSON `GET /api/v4/jobs` |
| 사람인 | `false` | 이용약관·robots.txt 확인 후 `true` |
| 잡코리아 | `false` | 이용약관·robots.txt 확인 후 `true` |
| 리멤버 | `false` | HTML stub. Cloudflare 우회 없음 |

원티드만 빠르게:

```bash
node scan.mjs --company "Wanted — 백엔드"
```

신규 공고는 `data/pipeline.md` 에 쌓입니다.

### 원티드 HTTP 403 (CloudFront)

클라우드/데이터센터 IP에서는 공개 API가 **403** 을 주는 경우가 있습니다. provider는 브라우저형 User-Agent로 재시도하지만, **챌린지를 풀거나 우회하지 않습니다.**

그때는:

1. 집/주거용 네트워크에서 `node scan.mjs` 를 다시 실행하거나
2. 원티드에서 공고 URL을 복사해 `gonggo` / auto-pipeline 에 붙여넣습니다.

MIT 라이선스 ≠ 원티드·사람인·잡코리아·리멤버 이용약관. `enabled: true` 전에 각 사이트 약관을 확인하세요.

### 필터

스캔과 평가가 **둘 다** 게이트입니다. **경력 연차 + 프로젝트 시니어티는 `config/profile.yml` → `experience.years`를 따릅니다.** 고정 주니어 밴드가 아닙니다.

```yaml
# config/profile.yml
experience:
  years: 1.7          # 본인 총 경력(년). 소수 가능. 또는 months: 19
  # skip_tolerance_years: 0.5
  # senior_min_years: 5
```

| 단계 | 무엇을 거르나 |
|------|----------------|
| 스캔 title negatives | `experience.years`로 고름 (`experience-band.mjs`). `years < 3` → `3~5년`/`3년 이상`/`시니어`/`Lead`/`팀장` 등. `years ≥ 5` → 연차 제목 negative 없음. `portals.yml`에 하드코딩할 필요 없음 |
| `content_filter.negative` | 본문: 영어 회화 필수, 원어민 등 |
| `gonggo` 경력 핏 | JD **필수** 최소 연차 > `years + tolerance` 이거나, 시니어 리드/아키텍트 소유권이 필수인데 `years < senior_min_years`이면 저점수 / **SKIP** |

개인 출시 프로젝트는 스킬 핏을 보강할 수 있지만 **연차로 치지 않습니다.** `years`를 바꾸면 필터가 따라갑니다.

`portals.yml` 이 없으면:

```text
Error: portals.yml not found. Run: node setup.mjs --defaults
Korean boards: cp templates/portals-kr.example.yml portals.yml
```

## 4. 평가 (`gonggo`) — 4.0/5 미만은 지원하지 않음

스캔 결과 URL 또는 공고 텍스트를 붙여넣습니다.

```text
/chaeyong-ops gonggo
# 또는 URL을 그대로 붙여넣으면 auto-pipeline
```

| 점수 | 행동 |
|------|------|
| **≥ 4.0/5** | PDF + `jiwon` 초안 후, 포털에서 **직접** 제출 |
| 3.0–3.9 | 특별한 이유가 있을 때만. 기본은 건너뜀 |
| **&lt; 4.0** | 지원 비권장. 트래커는 `SKIP` / `Discarded` |

품질 > 수량. 잘 맞는 5곳이 대충 50곳보다 낫습니다.

## 5. 맞춤 이력서 PDF

4.0 이상만 자동 PDF (`auto_pdf_score_threshold: 4.0`). 나머지는:

```text
/chaeyong-ops pdf {company-slug}
```

출력은 `output/` (gitignored). 제출 전에 숫자·회사명이 `cv.md` 와 같은지 읽으세요.

## 6. 지원서 초안 (`jiwon`) → 포털에서 직접 제출

```text
/chaeyong-ops jiwon
```

폼 답변·자기소개서를 **복사**합니다. Chrome 지원 페이지에서 **당신이 Submit/지원하기를 누릅니다.** 에이전트는 제출하지 않습니다.

트래커 반영 (제출한 뒤에만):

```bash
node set-status.mjs <report번호> Applied --note "원티드에서 직접 제출"
```

## 한 줄 요약

```text
profile.yml + cv.md
  → node setup.mjs --defaults
  → node scan.mjs
  → gonggo 점수 ≥ 4.0 만
  → pdf / jiwon 초안
  → 원티드·사람인·잡코리아 사이트에서 직접 제출
```
