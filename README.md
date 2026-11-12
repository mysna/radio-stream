# radio-stream

한국 라디오 방송사의 **원본 스트림 주소**를 돌려주는 Cloudflare Worker입니다.
[mysna/radio](https://github.com/mysna/radio) 플레이어가 오디오 `src`로 사용합니다.

## API

| 경로 | 설명 |
|---|---|
| `GET /stream?stn=&ch=&city=` | 원본 스트림 주소로 302 리다이렉트 (`/stream/`도 허용) |
| `GET /url?stn=&ch=&city=` | `{"name": ..., "url": ...}` |
| `GET /channels` | 지원 채널 목록(주소 제외) |
| `GET /health` | 상태 확인 |

- `stn`(방송사), `ch`(채널), `city`(지역) 조합이 [`src/catalog.ts`](src/catalog.ts)와
  **정확히 일치하는 채널만** 지원합니다. 없는 조합은 `404 channel_not_found`이며 다른
  지역 주소로 대체하지 않습니다.
- 방송사 API가 주소를 주지 않으면 `502 upstream_failed`입니다.

```bash
curl -I 'https://radio-stream.mysna.workers.dev/stream?stn=kbs&ch=1radio&city=busan'
curl 'https://radio-stream.mysna.workers.dev/url?stn=tbn&city=busan'
```

## 출처 유형

- **고정 주소**: 방송사가 공개한 스트림 주소를 그대로 돌려줍니다.
- **토큰 주소**: KBS(본사·지역국), MBC(서울), SBS(서울)는 접속마다 기간 한정 토큰이
  붙은 주소를 방송사 API에서 받습니다. 10분간 엣지 캐시에 보관해 API 호출을 줄입니다.
- **부산MBC**: 날짜(KST)에 따라 바뀌는 스트림 이름을 계산합니다.
- **AFN**: StreamTheWorld가 알려주는 서버를 사용합니다.

방송사 API에는 `radio-stream/0.1 (+https://github.com/mysna/radio-stream)` User-Agent로
요청합니다.

## 개발

```bash
npm ci
npm run typecheck
npm test
npm run check:streams   # 실제 방송사 서버에 접속해 전 채널 점검(국내 IP에서 실행 권장)
```

`main`에 push하면 테스트 후 `wrangler deploy`로 배포됩니다. 저장소 시크릿
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`가 필요합니다.

## 권리

스트림과 방송 콘텐츠의 권리는 각 방송사에 있습니다. 이 Worker는 공개된 스트림 주소를
안내할 뿐 콘텐츠를 중계·저장하지 않습니다.
