# ulsan-energy-poc

울산 에너지 자급자족 플랫폼 **POC(껍데기)** — [energy-v2-frontend](https://github.com/routinecrew/energy-v2-frontend) 프론트를 그대로 가져와 백엔드·DB·인증 없이 동작하도록 만든 정적 사이트.

## 특징

- **백엔드 없음**: `src/api/client.ts` 가 네트워크 대신 `src/mocks/poc` 목업 라우터로 응답. 원본 `api/{domain}`·`hooks` 는 수정 없이 사용.
- **로그인 없음**: 로그인 화면의 역할 버튼(전기사용자 / 발전사업자 / 관리자)으로 바로 진입. 이메일을 입력하면 `admin@…`, `operator@…`, 그 외 → 전기사용자로 매핑.
- **정적 export**: `next build` → `./out`. Cloudflare Workers(정적 에셋)로 배포.
- **지도**: 통합관제 지도는 Mapbox GL(`src/components/ui/MapboxMapView.tsx`). 자체 mapbox 구현으로 교체 시 이 컴포넌트만 바꾸면 됨.

## 실행

```bash
npm install
npm run preview    # 운영 빌드 후 http://localhost:3030 — 화면 확인은 이걸로 (빠름)
npm run dev        # 개발 서버 — 페이지마다 첫 진입 시 컴파일하므로 느림(수 초). 코드 수정 중일 때만 사용
npm run build      # ./out 생성
npm run deploy     # build + wrangler deploy (Cloudflare 로그인 필요)
```

> Windows PowerShell 에서는 `&&` 대신 `;` 로 명령을 이어야 합니다. 예: `cd ulsan-energy-poc; npm run preview`

## 역할별 진입 경로

| 역할 | 계정(표시용) | 랜딩 |
| --- | --- | --- |
| 관리자 | admin@test.com | `/monitoring` (통합관제 지도) |
| 전기사용자 | consumer@test.com | `/consumer` (수용가 대시보드) |
| 발전사업자 | operator@test.com | `/dashboard` (발전 대시보드) |

## 디자인 기준

- 색·아이콘·상태 규칙은 `src/lib/design.ts` 한 곳에서 정의한다 (근거: DT WEB 기본 디자인 가이드). 화면은 `src/components/ui/Design.tsx` 의 `SourceBadge` / `SourceIcon` / `StatusBadge` / `MetricIcon` 만 쓴다.
- 가이드 페이지: `/guide` (메뉴에 없음, URL 로만 접근). 배포 후 `https://ulsanenergypoc.pairwork.net/guide`.
- 규칙 요약: 발전원은 지도 마커와 같은 SVG + 고유색(태양광 주황·ORC 다홍·연료전지 파랑), 상태는 정상 초록·이상감지 빨강 두 가지, 지표는 라벨이 같으면 아이콘도 같다, 퍼센트·이모지는 쓰지 않는다.

## 목업 데이터 추가

`src/mocks/poc/fixtures.ts` 에 `registerMock(/^\/엔드포인트$/, () => 데이터)` 를 추가한다. 등록되지 않은 엔드포인트는 빈 목록/빈 페이지 응답을 돌려준다.

## 배포 (Cloudflare)

`wrangler.jsonc` 의 `routes` 에 `ulsanenergypoc.pairwork.net` 커스텀 도메인이 설정되어 있다. `pairwork.net` 존이 같은 Cloudflare 계정에 있으면 `npm run deploy` 만으로 연결된다.
