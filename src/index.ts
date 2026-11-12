import { Hono, type Context } from "hono";

import { CATALOG, findChannel, type CatalogEntry } from "./catalog";
import { resolveSource, type Fetcher } from "./resolvers";

export interface Env {
  /** 테스트용: 방송사 API 호출을 대신한다. 배포 환경에서는 전역 fetch를 쓴다. */
  UPSTREAM_FETCH?: Fetcher;
}

// 플레이어가 "/stream/?stn=..."처럼 끝에 슬래시를 붙여 호출하므로 둘 다 받는다.
const app = new Hono<{ Bindings: Env }>({ strict: false });

app.use("*", async (context, next) => {
  await next();
  // 읽기 전용 공개 API다. 플레이어(GitHub Pages)와 로컬 개발 모두에서 호출한다.
  context.header("Access-Control-Allow-Origin", "*");
});

function cacheKey(item: CatalogEntry): Request {
  const params = new URLSearchParams({ stn: item.stn, ch: item.ch ?? "", city: item.city ?? "" });
  return new Request(`https://radio-stream.cache/resolved?${params}`);
}

/**
 * 채널의 재생 주소를 구한다. 토큰 주소는 Cache API에 잠시 보관해 방송사 API 호출을
 * 줄인다(같은 데이터센터로 들어온 요청끼리만 공유된다).
 */
async function streamUrlFor(item: CatalogEntry, env: Env): Promise<string> {
  if (item.source.kind === "fixed") {
    return item.source.url;
  }

  // WebWorker lib의 CacheStorage 타입에는 Cloudflare 기본 캐시(default)가 없다.
  const cache = (caches as unknown as { default: Cache }).default;
  const key = cacheKey(item);
  const cached = await cache.match(key);
  if (cached) {
    return cached.text();
  }

  const fetcher: Fetcher = env.UPSTREAM_FETCH ?? ((input, init) => fetch(input, init));
  const resolved = await resolveSource(item.source, fetcher);
  if (resolved.ttlSeconds > 0) {
    await cache.put(
      key,
      new Response(resolved.url, { headers: { "Cache-Control": `max-age=${resolved.ttlSeconds}` } }),
    );
  }
  return resolved.url;
}

function errorJson(context: Context, status: 400 | 404 | 502, code: string, message: string) {
  return context.json({ error: { code, message } }, status, { "Cache-Control": "no-store" });
}

async function lookup(context: Context<{ Bindings: Env }>): Promise<Response | { url: string; item: CatalogEntry }> {
  const stn = context.req.query("stn");
  if (!stn) {
    return errorJson(context, 400, "missing_station", "stn is required.");
  }
  const item = findChannel(stn, context.req.query("ch"), context.req.query("city"));
  if (!item) {
    return errorJson(context, 404, "channel_not_found", "The requested channel is not supported.");
  }
  try {
    return { url: await streamUrlFor(item, context.env ?? {}), item };
  } catch {
    return errorJson(context, 502, "upstream_failed", "The broadcaster did not return a stream URL.");
  }
}

app.get("/health", (context) => context.json({ service: "radio-stream" }));

/** 오디오 요소의 src로 바로 쓰는 경로: 원본 스트림 주소로 리다이렉트한다. */
app.get("/stream", async (context) => {
  const result = await lookup(context);
  if (result instanceof Response) {
    return result;
  }
  // 토큰 주소가 브라우저에 남지 않도록 리다이렉트 자체는 캐시하지 않는다.
  return new Response(null, { status: 302, headers: { Location: result.url, "Cache-Control": "no-store" } });
});

/** 주소만 필요한 경우: {"url": ...} */
app.get("/url", async (context) => {
  const result = await lookup(context);
  if (result instanceof Response) {
    return result;
  }
  return context.json({ name: result.item.name, url: result.url }, 200, { "Cache-Control": "no-store" });
});

/** 지원 채널 목록(주소 없이). */
app.get("/channels", (context) =>
  context.json(
    {
      channels: CATALOG.map(({ stn, ch, city, name, source }) => ({ stn, ch, city, name, kind: source.kind })),
    },
    200,
    { "Cache-Control": "public, max-age=3600" },
  ),
);

app.notFound((context) => errorJson(context, 404, "not_found", "Unknown path."));

export default app;
