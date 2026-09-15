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
npm run dev        # http://localhost:3030
npm run build      # ./out 생성
npm run deploy     # build + wrangler deploy (Cloudflare 로그인 필요)
```

## 역할별 진입 경로

| 역할 | 계정(표시용) | 랜딩 |
| --- | --- | --- |
| 관리자 | admin@test.com | `/monitoring` (통합관제 지도) |
| 전기사용자 | consumer@test.com | `/consumer` (수용가 대시보드) |
| 발전사업자 | operator@test.com | `/dashboard` (발전 대시보드) |

## 목업 데이터 추가

`src/mocks/poc/fixtures.ts` 에 `registerMock(/^\/엔드포인트$/, () => 데이터)` 를 추가한다. 등록되지 않은 엔드포인트는 빈 목록/빈 페이지 응답을 돌려준다.

## 배포 (Cloudflare)

`wrangler.jsonc` 의 `routes` 에 `ulsanenergypoc.pairwork.net` 커스텀 도메인이 설정되어 있다. `pairwork.net` 존이 같은 Cloudflare 계정에 있으면 `npm run deploy` 만으로 연결된다.
