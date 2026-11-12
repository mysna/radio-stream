import { describe, expect, it } from "vitest";

import { busanMbcDateCode, resolveSource, type Fetcher } from "../src/resolvers";

function fakeFetch(routes: Record<string, string | number>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const fetcher = async (input: string) => {
    calls.push(input);
    const match = Object.entries(routes).find(([prefix]) => input.startsWith(prefix));
    if (!match) {
      return new Response("not found", { status: 404 });
    }
    const [, body] = match;
    return typeof body === "number" ? new Response("error", { status: body }) : new Response(body);
  };
  return Object.assign(fetcher, { calls });
}

describe("resolveSource", () => {
  it("returns fixed urls without calling upstream", async () => {
    const fetcher = fakeFetch({});
    await expect(resolveSource({ kind: "fixed", url: "https://a.example/x.m3u8" }, fetcher)).resolves.toEqual({
      url: "https://a.example/x.m3u8",
      ttlSeconds: 0,
    });
    expect(fetcher.calls).toEqual([]);
  });

  it("reads the first service_url from the KBS live API", async () => {
    const fetcher = fakeFetch({
      "https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/10_21": JSON.stringify({
        channel_item: [{ service_url: "https://kbs.example/busan.m3u8?Policy=x" }],
      }),
    });
    await expect(resolveSource({ kind: "kbs", code: "10_21" }, fetcher)).resolves.toEqual({
      url: "https://kbs.example/busan.m3u8?Policy=x",
      ttlSeconds: 600,
    });
  });

  it("uses the plain-text body of the MBC and SBS APIs", async () => {
    const fetcher = fakeFetch({
      "https://sminiplay.imbc.com/aacplay.ashx?agent=webapp&channel=mfm": " https://mbc.example/fm4u.m3u8?t=1\n",
      "https://apis.sbs.co.kr/play-api/1.0/livestream/powerpc/powerfm": "https://sbs.example/power.m3u8?token=t",
    });
    expect((await resolveSource({ kind: "mbcMini", channel: "mfm" }, fetcher)).url).toBe(
      "https://mbc.example/fm4u.m3u8?t=1",
    );
    expect((await resolveSource({ kind: "sbs", path: "powerpc/powerfm" }, fetcher)).url).toBe(
      "https://sbs.example/power.m3u8?token=t",
    );
  });

  it("fails when upstream errors or returns something that is not a url", async () => {
    const fetcher = fakeFetch({
      "https://sminiplay.imbc.com/": 503,
      "https://apis.sbs.co.kr/": "<html>blocked</html>",
      "https://cfpwwwapi.kbs.co.kr/": JSON.stringify({ channel_item: [] }),
    });
    await expect(resolveSource({ kind: "mbcMini", channel: "sfm" }, fetcher)).rejects.toThrow();
    await expect(resolveSource({ kind: "sbs", path: "lovepc/lovefm" }, fetcher)).rejects.toThrow();
    await expect(resolveSource({ kind: "kbs", code: "21" }, fetcher)).rejects.toThrow();
  });

  it("builds the dated Busan MBC stream name in KST", async () => {
    // 2026-11-11 23:30 UTC = 2026-11-12 08:30 KST → "261112"
    const now = new Date("2026-11-11T23:30:00Z");
    expect(busanMbcDateCode(now)).toBe("sjhhhs");
    const resolved = await resolveSource({ kind: "busanMbc", band: "FM" }, fakeFetch({}), now);
    expect(resolved.url).toBe("https://brook.bsmbc.com/live/BusanMBC_FM_onairstream.sjhhhs/playlist.m3u8");
  });

  it("uses the last StreamTheWorld server and falls back when lookup fails", async () => {
    const ok = fakeFetch({
      "https://playerservices.streamtheworld.com/": "<ip>1.live.example</ip><ip>2.live.example</ip>",
    });
    expect((await resolveSource({ kind: "afn", station: "AFNP_DGU", fallbackHost: "f.example" }, ok)).url).toBe(
      "https://2.live.example/AFNP_DGUAAC.aac",
    );
    const down = fakeFetch({ "https://playerservices.streamtheworld.com/": 500 });
    expect((await resolveSource({ kind: "afn", station: "AFNP_DGU", fallbackHost: "f.example" }, down)).url).toBe(
      "https://f.example/AFNP_DGUAAC.aac",
    );
  });
});
