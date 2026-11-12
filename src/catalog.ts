/**
 * 플레이어 채널(stn/ch/city) → 원본 스트림 출처 표.
 *
 * - fixed: 방송사가 공개한 고정 스트림 주소
 * - 그 외: 접속마다 기간 한정 토큰이 붙은 주소를 방송사 API에서 받아야 하는 채널
 *   (실제 호출은 resolvers.ts)
 *
 * 표에 없는 조합은 재생하지 않는다(404). 추측해서 다른 지역 주소로 대체하지 않는다.
 */

export type Source =
  | { kind: "fixed"; url: string }
  /** KBS 라이브 API의 channel_code (예: "24", 지역국은 "10_21") */
  | { kind: "kbs"; code: string }
  /** MBC 미니 aacplay channel 값 */
  | { kind: "mbcMini"; channel: "sfm" | "mfm" | "chm" }
  /** SBS play-api livestream 경로 (예: "powerpc/powerfm") */
  | { kind: "sbs"; path: string }
  /** 부산MBC: 날짜에 따라 바뀌는 스트림 이름 */
  | { kind: "busanMbc"; band: "AM" | "FM" }
  /** AFN(StreamTheWorld) 방송국 코드 */
  | { kind: "afn"; station: string; fallbackHost: string };

export interface CatalogEntry {
  stn: string;
  ch: string | null;
  city: string | null;
  name: string;
  source: Source;
}

const fixed = (url: string): Source => ({ kind: "fixed", url });

function entry(
  name: string,
  stn: string,
  ch: string | null,
  city: string | null,
  source: Source,
): CatalogEntry {
  return { stn, ch, city, name, source };
}

// ---------------------------------------------------------------- KBS
// channel_code = [지역국 코드 + "_"] + 채널 코드. 지역국은 1라디오·2라디오·1FM만 있다.
const KBS_CHANNELS: Array<[ch: string, code: string, label: string]> = [
  ["1radio", "21", "1라디오"],
  ["2radio", "22", "2라디오"],
  ["3radio", "23", "3라디오"],
  ["1fm", "24", "1FM"],
  ["2fm", "25", "2FM"],
  ["hanminjok", "26", "한민족방송"],
];
// 지역국마다 실제로 송출하는 라디오 채널만 둔다(없는 조합은 API가 빈 주소를 준다).
// 2026-11-12 국내 회선에서 check:streams로 전 조합을 확인한 결과다.
const KBS_CITIES: Array<[city: string, code: string, label: string, channels: string[]]> = [
  ["busan", "10", "부산", ["1radio", "2radio", "1fm"]],
  ["ulsan", "11", "울산", ["1radio"]],
  ["changwon", "20", "창원", ["1radio", "2radio", "1fm"]],
  ["jinju", "21", "진주", ["1radio"]],
  ["daegu", "30", "대구", ["1radio", "2radio", "1fm"]],
  ["andong", "31", "안동", ["1radio"]],
  ["pohang", "32", "포항", ["1radio"]],
  ["gwangju", "40", "광주", ["1radio", "2radio", "1fm"]],
  ["mokpo", "41", "목포", ["1radio", "1fm"]],
  ["suncheon", "43", "순천", ["1radio"]],
  ["jeonju", "50", "전주", ["1radio", "2radio", "1fm"]],
  ["daejeon", "60", "대전", ["1radio", "2radio", "1fm"]],
  ["cheongju", "70", "청주", ["1radio", "2radio", "1fm"]],
  ["chungju", "71", "충주", ["1radio", "1fm"]],
  ["chuncheon", "80", "춘천", ["1radio", "2radio", "1fm"]],
  ["gangneung", "81", "강릉", ["1radio", "1fm"]],
  ["wonju", "82", "원주", ["1radio", "1fm"]],
  ["jeju", "90", "제주", ["1radio", "2radio", "1fm"]],
];

const kbs: CatalogEntry[] = [
  ...KBS_CHANNELS.map(([ch, code, label]) =>
    entry(`KBS ${label}`, "kbs", ch, null, { kind: "kbs", code }),
  ),
  ...KBS_CITIES.flatMap(([city, cityCode, cityLabel, channels]) =>
    KBS_CHANNELS.filter(([ch]) => channels.includes(ch)).map(([ch, code, label]) =>
      entry(`KBS${cityLabel} ${label}`, "kbs", ch, city, {
        kind: "kbs",
        code: `${cityCode}_${code}`,
      }),
    ),
  ),
];

// ---------------------------------------------------------------- MBC
const mbc: CatalogEntry[] = [
  entry("MBC 표준FM", "mbc", "sfm", null, { kind: "mbcMini", channel: "sfm" }),
  entry("MBC FM4U", "mbc", "fm4u", null, { kind: "mbcMini", channel: "mfm" }),
  entry("MBC mini 올댓뮤직", "mbc", "chm", null, { kind: "mbcMini", channel: "chm" }),
  entry("부산MBC 표준FM", "mbc", "sfm", "busan", { kind: "busanMbc", band: "AM" }),
  entry("부산MBC FM4U", "mbc", "fm4u", "busan", { kind: "busanMbc", band: "FM" }),
  entry("울산MBC 표준FM", "mbc", "sfm", "ulsan", fixed("https://5ddfd163bd00d.streamlock.net/STDFM/STDFM/playlist.m3u8")),
  entry("울산MBC FM4U", "mbc", "fm4u", "ulsan", fixed("https://5ddfd163bd00d.streamlock.net/FM4U/FM4U/playlist.m3u8")),
  entry("MBC경남 표준FM", "mbc", "sfm", "changwon", fixed("https://wowza.mbcgn.kr/MBCFM/TV2.stream/playlist.m3u8")),
  entry("MBC경남 FM4U", "mbc", "fm4u", "changwon", fixed("https://wowza.mbcgn.kr/MBCFM4U/TV3.stream/playlist.m3u8")),
  entry("대구MBC 표준FM", "mbc", "sfm", "daegu", fixed("https://5ee1ec6f32118.streamlock.net/amradio/am/playlist.m3u8")),
  entry("대구MBC FM4U", "mbc", "fm4u", "daegu", fixed("https://5ee1ec6f32118.streamlock.net/fmradio/fm/playlist.m3u8")),
  entry("안동MBC 표준FM", "mbc", "sfm", "andong", fixed("https://live.andongmbc.co.kr/live/amlive/playlist.m3u8")),
  entry("안동MBC FM4U", "mbc", "fm4u", "andong", fixed("https://live.andongmbc.co.kr/live/fmlive/playlist.m3u8")),
  entry("포항MBC 표준FM", "mbc", "sfm", "pohang", fixed("http://stream.yubinet.com:1935/live/_definst_/Radio_Am/playlist.m3u8")),
  entry("포항MBC FM4U", "mbc", "fm4u", "pohang", fixed("http://stream.yubinet.com:1935/live/_definst_/Radio_Fm/playlist.m3u8")),
  entry("광주MBC 표준FM", "mbc", "sfm", "gwangju", fixed("https://media.kjmbc.co.kr/hls/amlive/GWANGJU-MBC-AM/playlist.m3u8")),
  entry("광주MBC FM4U", "mbc", "fm4u", "gwangju", fixed("https://media.kjmbc.co.kr/hls/fmlive/GWANGJU-MBC-FM/playlist.m3u8")),
  entry("목포MBC 표준FM", "mbc", "sfm", "mokpo", fixed("https://vod.mpmbc.co.kr/live/encoder-am/playlist.m3u8")),
  entry("목포MBC FM4U", "mbc", "fm4u", "mokpo", fixed("https://vod.mpmbc.co.kr/live/encoder-fm/playlist.m3u8")),
  entry("여수MBC 표준FM", "mbc", "sfm", "yeosu", fixed("https://5c3639aa99149.streamlock.net/%ED%91%9C%EC%A4%80FM/%ED%91%9C%EC%A4%80FM/playlist.m3u8")),
  entry("여수MBC FM4U", "mbc", "fm4u", "yeosu", fixed("https://5c3639aa99149.streamlock.net/FM4U/FM4U/playlist.m3u8")),
  entry("전주MBC 표준FM", "mbc", "sfm", "jeonju", fixed("https://live.jmbc.co.kr/live/am_live.m3u8")),
  entry("전주MBC FM4U", "mbc", "fm4u", "jeonju", fixed("https://live.jmbc.co.kr/live/fm_live.m3u8")),
  entry("대전MBC 표준FM", "mbc", "sfm", "daejeon", fixed("https://ns1.tjmbc.co.kr/live_am/live_am.stream/playlist.m3u8")),
  entry("대전MBC FM4U", "mbc", "fm4u", "daejeon", fixed("https://ns1.tjmbc.co.kr/live_fm/live_fm.stream/playlist.m3u8")),
  entry("MBC충북 표준FM", "mbc", "sfm", "cheongju", fixed("https://mbccbp.coreit.co.kr/radio_stfm/myStream.sdp/playlist.m3u8")),
  entry("MBC충북 FM4U", "mbc", "fm4u", "cheongju", fixed("https://mbccbp.coreit.co.kr/radio_fm/myStream.sdp/playlist.m3u8")),
  entry("춘천MBC 표준FM", "mbc", "sfm", "chuncheon", fixed("https://stream.chmbc.co.kr/radio1/fm1_aac/playlist.m3u8")),
  entry("춘천MBC FM4U", "mbc", "fm4u", "chuncheon", fixed("https://stream.chmbc.co.kr/live_radio2/fm1/playlist.m3u8")),
  entry("원주MBC 표준FM", "mbc", "sfm", "wonju", fixed("http://live.wjmbc.co.kr:1935/fm2/fm2/playlist.m3u8")),
  entry("원주MBC FM4U", "mbc", "fm4u", "wonju", fixed("http://live.wjmbc.co.kr:1935/fm989/fm989/playlist.m3u8")),
  entry("MBC강원영동 표준FM", "mbc", "sfm", "gangneung", fixed("http://123.254.72.24:1935/amlive/livestream/playlist.m3u8")),
  entry("MBC강원영동 FM4U", "mbc", "fm4u", "gangneung", fixed("http://123.254.72.24:1935/fmlive/livestream/playlist.m3u8")),
  entry("제주MBC 표준FM", "mbc", "sfm", "jeju", fixed("https://onairfm.jejumbc.com/hls/onairfmjejumbc/index.m3u8")),
  entry("제주MBC FM4U", "mbc", "fm4u", "jeju", fixed("https://onairsfm.jejumbc.com/hls/onairsfmjejumbc/1_2/index.m3u8")),
];

// ---------------------------------------------------------------- SBS·지역 민방
const sbs: CatalogEntry[] = [
  entry("SBS 러브FM", "sbs", "lovefm", null, { kind: "sbs", path: "lovepc/lovefm" }),
  entry("SBS 파워FM", "sbs", "powerfm", null, { kind: "sbs", path: "powerpc/powerfm" }),
  entry("SBS 고릴라디오M", "sbs", "dmb", null, { kind: "sbs", path: "sbsdmbpc/sbsdmb" }),
  entry("KNN 러브FM", "sbs", "lovefm", "busan", fixed("https://stream1.knn.co.kr/hls/b3y26uu6471k8tes9w7h_lfm/index.m3u8")),
  entry("KNN 파워FM", "sbs", "powerfm", "busan", fixed("https://stream1.knn.co.kr/hls/lb9ezl87d37uu0vy65bb_pfm/index.m3u8")),
  entry("UBC 그린FM", "sbs", "powerfm", "ulsan", fixed("https://stream.ubc.co.kr/hls/ubcfmstream/index.m3u8")),
  entry("TBC 드림FM", "sbs", "powerfm", "daegu", fixed("http://203.251.91.122:1935/on-air-Backup/fm/playlist.m3u8")),
  entry("KBC 마이FM", "sbs", "powerfm", "gwangju", fixed("https://vod.ikbc.co.kr/KBCFM/kbcra_aac/playlist.m3u8")),
  entry("JTV 매직FM", "sbs", "powerfm", "jeonju", fixed("http://61.85.197.53:1935/jtv_radio/myStream/playlist.m3u8")),
  entry("TJB 파워FM", "sbs", "powerfm", "daejeon", fixed("https://vod.tjb.co.kr/radiolive/_definst_/radio_64k/playlist.m3u8")),
  entry("CJB 조이FM", "sbs", "powerfm", "cheongju", fixed("https://wowza1.cjb.co.kr/live/cjbradio/playlist.m3u8")),
  entry("G1 프레쉬FM", "sbs", "powerfm", "chuncheon", fixed("http://61.82.49.4:1935/fm/_definst_/myStream/playlist.m3u8")),
  entry("JIBS 뉴파워FM", "sbs", "powerfm", "jeju", fixed("http://123.140.197.22/stream/2/play.m3u8")),
];

// ---------------------------------------------------------------- EBS
const ebs: CatalogEntry[] = [
  entry("EBS FM", "ebs", "fm", null, fixed("https://ebsonair.ebs.co.kr/fmradiofamilypc/familypc1m/playlist.m3u8")),
  entry("EBS 반디 외국어 전문", "ebs", "bandi", null, fixed("https://ebsonair.ebs.co.kr/cloud1/iradio/playlist.m3u8")),
];

// ---------------------------------------------------------------- CBS
const cbsStation = (path: string) =>
  fixed(`https://m-aac.cbs.co.kr/${path}/_definst_/${path.replace(/^mweb_/, "")}.stream/playlist.m3u8`);

const cbs: CatalogEntry[] = [
  entry("CBS 표준FM", "cbs", "sfm", null, fixed("https://m-aac.cbs.co.kr/mweb_cbs981/_definst_/cbs981.stream/playlist.m3u8")),
  entry("CBS 음악FM", "cbs", "mfm", null, fixed("https://m-aac.cbs.co.kr/mweb_cbs939/_definst_/cbs939.stream/playlist.m3u8")),
  entry("CBS JOY4U", "cbs", "joy4u", null, fixed("https://m-aac.cbs.co.kr/mweb_cbscmc/_definst_/cbscmc.stream/playlist.m3u8")),
  entry("부산CBS 표준FM", "cbs", "sfm", "busan", cbsStation("busan939")),
  entry("부산CBS 음악FM", "cbs", "mfm", "busan", cbsStation("busan981")),
  entry("울산CBS 표준FM", "cbs", "sfm", "ulsan", cbsStation("ulsan")),
  entry("경남CBS 표준FM", "cbs", "sfm", "gyeongnam", cbsStation("gyeongnam")),
  entry("대구CBS 표준FM", "cbs", "sfm", "daegu", cbsStation("daegu")),
  entry("대구CBS 음악FM", "cbs", "mfm", "daegu", cbsStation("daegu939")),
  entry("포항CBS 표준FM", "cbs", "sfm", "pohang", cbsStation("pohang")),
  entry("광주CBS 표준FM", "cbs", "sfm", "gwangju", cbsStation("gwangju")),
  entry("광주CBS 음악FM", "cbs", "mfm", "gwangju", cbsStation("gwangju939")),
  entry("전남CBS 표준FM", "cbs", "sfm", "jeonnam", cbsStation("jeonnam")),
  entry("전북CBS 표준FM", "cbs", "sfm", "jeonbuk", cbsStation("jeonbuk")),
  entry("대전CBS 표준FM", "cbs", "sfm", "daejeon", cbsStation("daejeon")),
  entry("충북CBS 표준FM", "cbs", "sfm", "cheongju", cbsStation("cheongju")),
  entry("춘천CBS 표준FM", "cbs", "sfm", "chuncheon", cbsStation("chuncheon")),
  entry("강원영동CBS 표준FM", "cbs", "sfm", "youngdong", cbsStation("youngdong")),
  entry("제주CBS 표준FM", "cbs", "sfm", "jeju", cbsStation("jeju")),
];

// ---------------------------------------------------------------- TBN (ch 없음, city로 지역 구분)
const TBN_REGIONS: Array<[city: string | null, path: string, label: string]> = [
  [null, "gyeongin", "경인"],
  ["busan", "busan", "부산"],
  ["ulsan", "ulsan", "울산"],
  ["gyeongnam", "gyeongnam", "경남"],
  ["daegu", "daegu", "대구"],
  ["gyeongbuk", "kyungbuk", "경북"],
  ["gwangju", "gwangju", "광주"],
  ["jeonbuk", "jeonbuk", "전북"],
  ["daejeon", "daejeon", "대전"],
  ["chungnam", "chungnam", "충남"],
  ["chungbuk", "chungbuk", "충북"],
  ["gangwon", "gangwon", "강원"],
  ["jeju", "jeju", "제주"],
];
const tbn: CatalogEntry[] = TBN_REGIONS.map(([city, path, label]) =>
  entry(`TBN ${label}교통방송`, "tbn", null, city, fixed(`https://www.tbn.it.kr/${path}/myStream/playlist.m3u8`)),
);

// ---------------------------------------------------------------- 종교방송
const febcLive2 = (name: string) => fixed(`http://mlive2.febc.net:1935/live/${name}/playlist.m3u8`);
const febcLive3 = (name: string) => fixed(`https://mlive3.febc.net/live5/${name}/playlist.m3u8`);
const febc: CatalogEntry[] = [
  entry("FEBC 서울극동방송", "febc", null, null, febcLive2("seoulfm")),
  entry("FEBC 부산극동방송", "febc", null, "busan", febcLive2("bsfebc")),
  entry("FEBC 울산극동방송", "febc", null, "ulsan", febcLive2("uslive")),
  entry("FEBC 창원극동방송", "febc", null, "changwon", febcLive2("cwlive")),
  entry("FEBC 대구극동방송", "febc", null, "daegu", febcLive3("daegulive")),
  entry("FEBC 포항극동방송", "febc", null, "pohang", febcLive2("phlive")),
  entry("FEBC 광주극동방송", "febc", null, "gwangju", febcLive2("gjlive")),
  entry("FEBC 목포극동방송", "febc", null, "mokpo", febcLive3("mplive")),
  entry("FEBC 전남동부극동방송", "febc", null, "jeonnam", febcLive2("jndblive")),
  entry("FEBC 전북극동방송", "febc", null, "jeonbuk", febcLive2("jblive")),
  entry("FEBC 대전극동방송", "febc", null, "daejeon", febcLive2("djlive")),
  entry("FEBC 강원극동방송", "febc", null, "gangwon", febcLive3("ydlive")),
  entry("FEBC 제주극동방송", "febc", null, "jeju", febcLive2("jejufm")),
];

// 지역 BBS는 smilecdn(Wowza)으로 옮겨졌다. 1935 포트는 http만 받고 https로 접속하면
// ERR_SSL_PROTOCOL_ERROR가 나므로, https 플레이어 페이지에서 막히지 않도록 기본 포트(443)의
// https 주소를 쓴다(부산영어방송과 같은 방식, 2026-11-12 세 채널 모두 200 확인).
// 대구 공식 온에어 주소의 wowzatoken은 서버가 검사하지 않아 뺐다.
const smilecdn = (path: string) => fixed(`https://live.cdn.smilecdn.com/${path}/playlist.m3u8`);

const bbs: CatalogEntry[] = [
  entry("BBS 서울불교방송", "bbs", null, null, fixed("https://bbslive.clouducs.com/bbsradio-mlive/radio.stream/playlist.m3u8")),
  entry("BBS 부산불교방송", "bbs", null, "busan", smilecdn("bbsfm_live/live.sdp")),
  entry("BBS 대구불교방송", "bbs", null, "daegu", smilecdn("dgbbs_live/live")),
  entry("BBS 광주불교방송", "bbs", null, "gwangju", smilecdn("kjbbs1_live/live")),
  entry("BBS 제주불교방송", "bbs", null, "jeju", fixed("http://kdbmobile.clouducs.com:1935/jeju/jeju.stream_aac/playlist.m3u8")),
];

const cpbc: CatalogEntry[] = [
  entry("CPBC 가톨릭평화방송", "cpbc", null, null, fixed("http://onair1.cpbc.co.kr:1935/live/_definst_/Instreamer.stream_aac/playlist.m3u8")),
  entry("CPBC 부산가톨릭평화방송", "cpbc", null, "busan", fixed("http://pbcradio.dynamicsmart.com:1935/radio/bscpbc-radio/index.m3u8")),
  entry("CPBC 대구가톨릭평화방송", "cpbc", null, "daegu", fixed("http://live.dgcpbc.co.kr/dgcpbclive/livestream/playlist.m3u8")),
  entry("CPBC 광주가톨릭평화방송", "cpbc", null, "gwangju", fixed("http://pbcradio.dynamicsmart.com:1935/radio/kjpbc2/index.m3u8")),
];

const wbs: CatalogEntry[] = [
  entry("WBS 서울원음방송", "wbs", null, null, fixed("https://wbsradio.kr/wbs-seoul")),
  entry("WBS 부산원음방송", "wbs", null, "busan", fixed("https://wbsradio2.kr/wbs-b")),
  entry("WBS 대구원음방송", "wbs", null, "daegu", fixed("https://wbsradio2.kr/wbs-d")),
  entry("WBS 광주원음방송", "wbs", null, "gwangju", fixed("https://wbsradio2.kr/wbs-g")),
  entry("WBS 전북원음방송", "wbs", null, "jeonbuk", fixed("https://wbsradio2.kr/wbs-j")),
];

// ---------------------------------------------------------------- 그 외
const others: CatalogEntry[] = [
  entry("YTN 라디오", "ytn", null, null, fixed("https://radiolive.ytn.co.kr/radio/_definst_/20211118_fmlive/playlist.m3u8")),
  entry("iFM 경인방송", "ifm", null, null, fixed("https://stream.ifm.kr/live/aod1/playlist.m3u8")),
  entry("OBS 라디오", "obs", null, null, fixed("https://vod3.obs.co.kr:444/live/obsstream1/radio.stream/playlist.m3u8")),
  entry("TBS FM", "tbs", "fm", null, fixed("https://cdnfm.tbs.seoul.kr/tbs/_definst_/tbs_fm_web_360.smil/playlist.m3u8")),
  entry("TBS eFM", "tbs", "efm", null, fixed("https://cdnefm.tbs.seoul.kr/tbs/_definst_/tbs_efm_web_360.smil/playlist.m3u8")),
  entry("국방FM", "kookbang", null, null, fixed("https://mediaworks.dema.mil.kr/live_edge/audio.sdp/playlist.m3u8")),
  entry("국악방송", "kugak", null, null, fixed("https://mgugaklive.nowcdn.co.kr/gugakradio/gugakradio.stream/playlist.m3u8")),
  entry("광주국악방송", "kugak", null, "gwangju", fixed("https://mgugaklive.nowcdn.co.kr/gugakgwangju/Glive.stream/playlist.m3u8")),
  entry("대전국악방송", "kugak", null, "daejeon", fixed("https://mgugaklive.nowcdn.co.kr/gugakdaejeon/Daejeonradio.stream/playlist.m3u8")),
  entry("부산영어방송", "befm", null, null, fixed("https://live.cdn.smilecdn.com/befm905_live/live/playlist.m3u8")),
  entry("글로벌광주방송", "ggn", null, null, fixed("http://media.ggn.or.kr:8080/live")),
  entry("Arirang Radio", "arirang", null, null, fixed("https://amdlive-ch03-ctnd-com.akamaized.net/arirang_3ch/smil:arirang_3ch.smil/playlist.m3u8")),
  entry("AFN FM Humphreys", "afn", null, "humphreys", { kind: "afn", station: "AFNP_OSN", fallbackHost: "14613.live.streamtheworld.com" }),
  entry("AFN FM Daegu", "afn", null, "daegu", { kind: "afn", station: "AFNP_DGU", fallbackHost: "14943.live.streamtheworld.com" }),
  entry("AFN FM Kunsan", "afn", null, "kunsan", { kind: "afn", station: "AFNP_KSN", fallbackHost: "21633.live.streamtheworld.com" }),
];

export const CATALOG: readonly CatalogEntry[] = [
  ...kbs,
  ...mbc,
  ...sbs,
  ...ebs,
  ...cbs,
  ...tbn,
  ...febc,
  ...bbs,
  ...cpbc,
  ...wbs,
  ...others,
];

function key(stn: string, ch: string | null, city: string | null): string {
  return `${stn}\u0000${ch ?? ""}\u0000${city ?? ""}`;
}

const INDEX = new Map(CATALOG.map((item) => [key(item.stn, item.ch, item.city), item]));

/** stn/ch/city가 정확히 일치하는 채널만 돌려준다. 빈 문자열은 없음(null)과 같다. */
export function findChannel(
  stn: string | null | undefined,
  ch: string | null | undefined,
  city: string | null | undefined,
): CatalogEntry | undefined {
  if (!stn) {
    return undefined;
  }
  return INDEX.get(key(stn, ch || null, city || null));
}
