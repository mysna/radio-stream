import { describe, expect, it } from "vitest";

import app from "../src/index";
import type { Fetcher } from "../src/resolvers";

function env(body: string | number = "https://sbs.example/love.m3u8?token=t") {
  const calls: string[] = [];
  const UPSTREAM_FETCH: Fetcher = async (input) => {
    calls.push(input);
    return typeof body === "number" ? new Response("err", { status: body }) : new Response(body);
  };
  return { bindings: { UPSTREAM_FETCH }, calls };
}

const request = (path: string, bindings: object) => app.request(`https://radio-stream.example${path}`, {}, bindings);

describe("GET /stream", () => {
  it("redirects a fixed channel to its stream without caching the redirect", async () => {
    const { bindings, calls } = env();
    const response = await request("/stream?stn=cbs&ch=mfm", bindings);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://m-aac.cbs.co.kr/mweb_cbs939/_definst_/cbs939.stream/playlist.m3u8",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(calls).toEqual([]);
  });

  it("accepts the player's trailing-slash form", async () => {
    const { bindings } = env();
    const response = await request("/stream/?stn=tbn&city=busan", bindings);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://www.tbn.it.kr/busan/myStream/playlist.m3u8");
  });

  it("resolves tokenized channels and reuses the cached url", async () => {
    const { bindings, calls } = env("https://sbs.example/love.m3u8?token=cached");
    const first = await request("/stream?stn=sbs&ch=lovefm", bindings);
    const second = await request("/stream?stn=sbs&ch=lovefm", bindings);
    expect(first.headers.get("Location")).toBe("https://sbs.example/love.m3u8?token=cached");
    expect(second.headers.get("Location")).toBe("https://sbs.example/love.m3u8?token=cached");
    expect(calls).toHaveLength(1);
  });

  it("does not play channels it does not know", async () => {
    const { bindings } = env();
    const response = await request("/stream?stn=community&ch=mapofm", bindings);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "channel_not_found" } });
  });

  it("requires stn", async () => {
    const { bindings } = env();
    expect((await request("/stream?ch=sfm", bindings)).status).toBe(400);
  });

  it("reports upstream failures as 502", async () => {
    const { bindings } = env(503);
    const response = await request("/stream?stn=mbc&ch=chm", bindings);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "upstream_failed" } });
  });
});

describe("other routes", () => {
  it("returns the url as json", async () => {
    const { bindings } = env();
    const response = await request("/url?stn=kugak&city=daejeon", bindings);
    await expect(response.json()).resolves.toEqual({
      name: "대전국악방송",
      url: "https://mgugaklive.nowcdn.co.kr/gugakdaejeon/Daejeonradio.stream/playlist.m3u8",
    });
  });

  it("lists supported channels without urls", async () => {
    const { bindings } = env();
    const body = (await (await request("/channels", bindings)).json()) as { channels: Array<Record<string, unknown>> };
    expect(body.channels.length).toBeGreaterThan(150);
    expect(body.channels[0]).not.toHaveProperty("url");
  });

  it("answers health checks", async () => {
    const { bindings } = env();
    await expect((await request("/health", bindings)).json()).resolves.toEqual({ service: "radio-stream" });
  });
});
