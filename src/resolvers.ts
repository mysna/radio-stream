import type { Source } from "./catalog";

/** 테스트에서 방송사 API 호출을 대신할 수 있게 fetch를 주입받는다. */
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 8_000;
// 요청 출처를 숨기지 않도록 서비스 이름과 저장소 주소를 User-Agent로 밝힌다.
const REQUEST_HEADERS = { "User-Agent": "radio-stream/0.1 (+https://github.com/mysna/radio-stream)" };
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

async function getText(fetcher: Fetcher, url: string): Promise<string> {
  const response = await fetcher(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`upstream ${response.status}`);
  }
  return (await response.text()).trim();
}

/** 응답 본문이 그대로 스트림 주소인 API용: http(s) 주소가 아니면 실패로 본다. */
function requireUrl(value: string): string {
  if (!/^https?:\/\/\S+$/.test(value)) {
    throw new Error("upstream returned no stream url");
  }
  return value;
}

// 부산MBC 스트림 이름은 KST 날짜(YYMMDD)의 각 숫자를 정해진 문자로 바꾼 값을 붙인다.
const BUSAN_MBC_DIGITS = "qhsagbjcpd"; // 0~9

export function busanMbcDateCode(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const yymmdd =
    String(kst.getUTCFullYear()).slice(2) +
    String(kst.getUTCMonth() + 1).padStart(2, "0") +
    String(kst.getUTCDate()).padStart(2, "0");
  return Array.from(yymmdd, (digit) => BUSAN_MBC_DIGITS[Number(digit)]).join("");
}

export interface Resolved {
  url: string;
  /** 같은 주소를 캐시해도 되는 시간(초). 0이면 캐시하지 않는다. */
  ttlSeconds: number;
}

/** 출처 정의를 실제 재생 주소로 바꾼다. 실패하면 예외를 던진다. */
export async function resolveSource(source: Source, fetcher: Fetcher, now = new Date()): Promise<Resolved> {
  switch (source.kind) {
    case "fixed":
      return { url: source.url, ttlSeconds: 0 };

    case "kbs": {
      const body = await getText(
        fetcher,
        `https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/${source.code}`,
      );
      const json = JSON.parse(body) as { channel_item?: Array<{ service_url?: string }> };
      // 토큰은 수 시간 유효하지만 만료 직전 주소를 건네지 않도록 짧게 캐시한다.
      return { url: requireUrl(json.channel_item?.[0]?.service_url ?? ""), ttlSeconds: 600 };
    }

    case "mbcMini":
      return {
        url: requireUrl(
          await getText(fetcher, `https://sminiplay.imbc.com/aacplay.ashx?agent=webapp&channel=${source.channel}`),
        ),
        ttlSeconds: 600,
      };

    case "sbs":
      return {
        url: requireUrl(
          await getText(
            fetcher,
            `https://apis.sbs.co.kr/play-api/1.0/livestream/${source.path}?protocol=hls&ssl=Y`,
          ),
        ),
        ttlSeconds: 600,
      };

    case "busanMbc":
      return {
        url: `https://brook.bsmbc.com/live/BusanMBC_${source.band}_onairstream.${busanMbcDateCode(now)}/playlist.m3u8`,
        ttlSeconds: 0,
      };

    case "afn": {
      // StreamTheWorld가 알려주는 서버 중 하나를 쓰고, 조회에 실패하면 알려진 서버로 대체한다.
      let host = source.fallbackHost;
      try {
        const xml = await getText(
          fetcher,
          `https://playerservices.streamtheworld.com/api/livestream?station=${source.station}&transports=http%2Chls&version=1.10`,
        );
        host = [...xml.matchAll(/<ip>([^<]+)<\/ip>/g)].map((match) => match[1]).at(-1) ?? host;
      } catch {
        // 대체 서버 사용
      }
      return { url: `https://${host}/${source.station}AAC.aac`, ttlSeconds: 600 };
    }
  }
}
