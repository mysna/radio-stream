import { describe, expect, it } from "vitest";

import { CATALOG, findChannel } from "../src/catalog";
import playerChannels from "./fixtures/player-channels.json";

describe("catalog", () => {
  it("has one entry per stn/ch/city", () => {
    const keys = CATALOG.map(({ stn, ch, city }) => `${stn}|${ch}|${city}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses http(s) stream urls for fixed sources", () => {
    for (const item of CATALOG) {
      if (item.source.kind === "fixed") {
        expect(item.source.url, item.name).toMatch(/^https?:\/\/\S+$/);
      }
    }
  });

  // mysna/radio의 src/channels.js(커뮤니티 라디오·보이는 라디오 제외) 스냅샷.
  it("covers every channel the player lists", () => {
    const missing = playerChannels.filter((item) => !findChannel(item.stn, item.ch, item.city));
    expect(missing).toEqual([]);
  });

  it("matches exactly and does not fall back to another region", () => {
    expect(findChannel("kbs", "1radio", "busan")?.name).toBe("KBS부산 1라디오");
    expect(findChannel("kbs", "3radio", "busan")).toBeUndefined();
    expect(findChannel("cbs", "sfm", "nowhere")).toBeUndefined();
    expect(findChannel("tbn", "", "")?.name).toBe("TBN 경인교통방송");
    expect(findChannel(undefined, "sfm", null)).toBeUndefined();
  });
});
