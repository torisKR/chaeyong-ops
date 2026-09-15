# NOTICE — 채용옵스 (Chaeyong Ops)

## 기반 프로젝트

이 프로젝트는 [career-ops](https://github.com/career-ops-hq/career-ops) (MIT License)를 기반으로 한국 채용 시장에 맞게 수정한 포크입니다.

- **원본 저작권:** Copyright (c) 2026 Santiago Fernández de Valderrama
- **원본 라이선스:** [MIT License](https://github.com/career-ops-hq/career-ops/blob/main/LICENSE)
- **원본 상표 정책:** [TRADEMARK.md](https://github.com/career-ops-hq/career-ops/blob/main/TRADEMARK.md) — `career-ops` 이름·로고·공식 제품 표현은 원저작자 상표이며, 이 포크는 **채용옵스(Chaeyong Ops)** 라는 별도 이름으로 배포합니다.

## 수정 사항 (한국형 포크)

- 한국어 README 및 기본 설정 (`language.output: ko`, `modes/ko`)
- 잡코리아·사람인·원티드·리멤버 job board provider
- 한국 채용 시장 평가 기준 강화 (`modes/ko/`) — 기본 타깃 예시: 풀스택/백엔드
- 한국어 이력서 템플릿 (`templates/cv-template.ko-standard.html`)
- 영어 필수 공고 필터 예시 (`templates/portals-kr.example.yml`)
- 프로필 연차 필터 (`experience.years` → 스캔 제목 밴드 + 평가 SKIP)
- 한국 지원 워크플로 (`docs/APPLY-KR.md`, `docs/GETTING-STARTED-KR.md`)
- 원커맨드 설정 (`setup.mjs` — `npm run setup`)
- 채용옵스 브랜드 에셋 (`assets/` — README 히어로 `icon.png` · `banner.png`)

## 라이선스

원본 MIT 라이선스 전문은 `LICENSE` 파일에 포함되어 있습니다. 수정·재배포·상업적 이용이 가능하며, 원저작권 표시와 MIT 조항을 유지해야 합니다.

**보증 없음:** THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

## 개인정보

공개 저장소에 API 키, 이력서, 연락처, 지원 기록을 포함하지 마세요. 개인용 데이터는 비공개 저장소 또는 로컬에서만 관리하세요.

## 한국 채용 사이트 이용약관

잡코리아·사람인·원티드·리멤버 provider는 공개 목록 페이지/API를 읽기 전용으로 조회합니다. MIT 라이선스가 사이트 이용약관을 대체하지 않습니다. 배포·운영 전 각 사이트의 robots.txt와 이용약관에서 자동 수집 허용 범위를 확인하세요. Cloudflare/WAF 챌린지는 우회하지 않습니다.
