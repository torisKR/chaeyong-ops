# 지원 현황 보드 (로컬)

채용옵스는 지원 기록을 **이 컴퓨터의 마크다운 트래커**에 둡니다. 브라우저에서 보려면 localhost HTTP 보드를 켭니다. SaaS나 계정은 없습니다.

## TUI vs 웹 localhost

| | 명령 | 무엇 |
|---|---|---|
| **웹 보드 (권장)** | `npm run dashboard:web` | 브라우저 `http://127.0.0.1:3847` — 한국어 지원 현황 |
| 터미널 UI | `npm run serve:dashboard` | 기존 Go TUI (필터·리포트 뷰어·상태 변경) |

둘 다 같은 소스 `data/applications.md` (없으면 루트 `applications.md`)를 읽습니다. 웹 보드는 **읽기 전용**입니다. 상태 변경은 `tracker` 모드, `node set-status.mjs`, 또는 터미널 UI를 쓰세요.

실험용 Next.js 앱(`web/`, `cd web && npm run dev`)은 별도 alpha 이며 이 보드와 다릅니다. 채용옵스 지원 현황은 `npm run dashboard:web` 이 정답입니다.

## 5분 안에 열기

Go 1.24+ 가 필요합니다.

```bash
npm run dashboard:web
```

터미널에 `http://127.0.0.1:3847` 이 나오면 브라우저로 엽니다. `127.0.0.1` 에만 바인딩하므로 같은 와이파이의 다른 기기는 볼 수 없습니다.

같은 것:

```bash
cd dashboard && go run . --web --path ..
# 또는 빌드한 바이너리
npm run build:dashboard
./dashboard/career-dashboard --web --path .
```

포트/주소를 바꾸려면 루프백만 허용됩니다.

```bash
cd dashboard && go run . --web --addr 127.0.0.1:4000 --path ..
```

`0.0.0.0` 이나 LAN IP는 거절합니다. 지원 회사·점수·링크는 개인정보입니다.

## 화면에 나오는 것

- 헤더 숫자: **지원완료 / 서류통과 / 면접 / 합격 / 불합격 / 보류**
- 표: 회사, 포지션, 포털(원티드·사람인·잡코리아·리멤버), 점수, 상태, 지원일, 공고 링크
- 필터: 상태 타일, 포털, 검색

트래커 상태(영어 canonical) → 화면 라벨:

| 트래커 | 화면 | 헤더 버킷 |
|--------|------|-----------|
| Applied | 지원완료 | 지원완료 |
| Responded | 서류통과 | 서류통과 |
| Interview | 면접 | 면접 |
| Offer | 합격 | 합격 |
| Hired | 입사 | 합격 |
| Rejected | 불합격 | 불합격 |
| Evaluated / SKIP / Discarded | 평가완료 / 스킵 / 폐기 | 보류 |

포털은 `Via` 열, 공고 URL 호스트, 또는 notes의 `via=원티드` 태그로 추정합니다.

## 데이터가 사는 곳

| 파일 | 역할 |
|------|------|
| `data/applications.md` | 지원 현황 소스 오브 트루스 (gitignored) |
| `applications.md` | 레거시 위치 — `data/` 파일이 없을 때만 |
| `CAREER_OPS_TRACKER` | 경로를 직접 지정할 때 |

이 파일들은 **git에 올리지 마세요.** `.gitignore`가 `data/*`와 `applications.md`를 막습니다. 보드는 그 파일을 읽어 보여 주기만 합니다.

빈 화면이 뜨면:

1. 채용 공고 URL을 Cursor / Claude Code에 붙여넣기 (auto-pipeline)
2. `tracker` 모드로 행 확인
3. `jiwon` 초안 후 포털에서 **직접** 제출 — 시스템이 제출하지 않습니다

## 개인정보

- 서버는 루프백 전용입니다. 클라우드 호스팅을 하지 마세요.
- 지원 기록·이력서·이메일은 사용자 레이어입니다. 공개 저장소에 커밋하지 마세요.
- 테스트 픽스처(`dashboard/internal/webui/testdata/`)는 허구 회사명만 들어 있습니다.

## 왜 localhost 인가

지원 현황은 PII입니다. 로컬 파일 + 로컬 브라우저가 맞는 기본값입니다. 원격 대시보드는 계정·전송·유출 면이 생깁니다. 채용옵스는 gitignored 트래커를 소스 오브 트루스로 두고, 이 컴퓨터에서만 보여 줍니다.
