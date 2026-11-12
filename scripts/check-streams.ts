// 모든 채널의 실제 스트림 주소를 구해 응답하는지 확인한다.
// 사용법: npm run check:streams [-- --json]
// 해외 IP에서는 국내 전용 서버가 응답하지 않을 수 있으니, 결과는 실행 위치를 감안해 읽는다.
import { CATALOG } from "../src/catalog.ts";
import { resolveSource } from "../src/resolvers.ts";

interface Result {
  name: string;
  stn: string;
  ch: string | null;
  city: string | null;
  status: string;
  url: string | null;
}

async function probe(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    // 라이브 스트림은 끝나지 않으므로 상태 코드만 보고 연결을 닫는다.
    await response.body?.cancel();
    return String(response.status);
  } catch (error) {
    return error instanceof Error ? error.name : "error";
  }
}

async function check(item: (typeof CATALOG)[number]): Promise<Result> {
  const base = { name: item.name, stn: item.stn, ch: item.ch, city: item.city };
  try {
    const { url } = await resolveSource(item.source, (input, init) => fetch(input, init));
    return { ...base, url, status: await probe(url) };
  } catch (error) {
    return { ...base, url: null, status: `resolve:${error instanceof Error ? error.message : "error"}` };
  }
}

const results: Result[] = [];
const queue = [...CATALOG];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      results.push(await check(item));
    }
  }),
);
results.sort((a, b) => CATALOG.findIndex((x) => x.name === a.name) - CATALOG.findIndex((x) => x.name === b.name));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const result of results) {
    console.log(`${result.status.padEnd(12)} ${result.name}`);
  }
}
const failed = results.filter((result) => !result.status.startsWith("2"));
console.log(`\n${results.length - failed.length}/${results.length} ok`);
