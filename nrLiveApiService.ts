import type Database from 'better-sqlite3';

export interface NrLiveApiConfig {
  url: string;
  apiKey: string;
}

export interface LiveCallEntry {
  stanox?: string;
  tiploc?: string;
  name?: string;
  ata?: number | null;
  sta?: number | null;
  atd?: number | null;
  std?: number | null;
  platform?: string;
  variation?: number;
  status?: string;
}

export interface RemoteScheduleStop {
  tiploc: string;
  arr: string | null;
  dep: string | null;
  pass: string | null;
  platform?: string;
  line?: string;
}

export interface RemoteScheduleItem {
  train_uid: string;
  stp_indicator: string;
  is_cancelled: boolean;
  origin_tiploc: string | null;
  dest_tiploc: string | null;
  origin_dep: string | null;
  dest_arr: string | null;
  locations: RemoteScheduleStop[];
}

export interface RemoteTrainRecord {
  headcode: string;
  activated: boolean;
  train_id: string | null;
  train_uid: string | null;
  is_cancelled: boolean;
  variation_status: string;
  timetable_variation: number;
  last_location: string | null;
  last_event: string | null;
  last_actual_ts: number | null;
  last_platform: string | null;
  live_calls: Record<string, LiveCallEntry>;
  schedules: RemoteScheduleItem[];
}

export interface NrLiveServiceResult {
  std: string;
  arrAtDest: string;
  date: string;
  etd: string;
  platform: string;
  operator: string;
  operatorCode: string;
  destination: string;
  destinationTiploc: string;
  headcode: string;
  isPassengerService: boolean;
  stpIndicator: string;
  trainUid: string;
  activated: boolean;
  lastLocation: string | null;
}

export interface NrLiveApiStatus {
  configured: boolean;
  apiUrlPreview: string;
  candidateHeadcodesCount: number;
  cachedDates: Array<{
    date: string;
    headcodeCount: number;
    scheduleCount: number;
    fetchedAt: string;
  }>;
  lastQueryAt: string | null;
  lastQueryDurationMs: number | null;
  lastError: string | null;
  supportsDeparturesEndpoint: boolean | null;
}

// Complete Elizabeth Line TIPLOC -> Display Name mapping (covers both main.py TIPLOCs and Darwin/CRS variants)
export const TIPLOC_TO_NAME: Record<string, string> = {
  // Operational Depots, Sidings & Turnbacks
  MDNHDRS: 'Maidenhead Turnback',
  OLDOENG: 'Old Oak Engine Sdg',
  ROYAOSD: 'Royal Oak Sidings',
  OLDOXRS: 'Old Oak Depot',
  OLDOXAR: 'Old Oak Common East',
  MDNHDCS: 'Maidenhead CS',
  GIDEPKS: 'Gidea Park CS',
  GIDEPKM: 'Gidea Park Mid Sidings',
  GIDECES: 'Gidea Pk C/E Spur',
  SHENFMS: 'Shenfield CS',
  ILFEMUD: 'Ilford E.M.U.D.',
  ILFDEMD: 'Ilford E.M.U.D.',
  WBRNPKS: 'Westbourne Park Sidings',
  WEALEMU: 'West Ealing EMUD',
  ABWDXRS: 'Abbey Wood Sidings',
  PLMSRS: 'Plumstead CS',
  PLMSXCR: 'Plumstead CS',
  // Elizabeth Line Stations
  ABWDXR: 'Abbey Wood',
  WOLWXR: 'Woolwich',
  CUSTMHS: 'Custom House',
  CANWHRF: 'Canary Wharf',
  WCHAPXR: 'Whitechapel',
  STFD: 'Stratford (London)',
  MRYLAND: 'Maryland',
  FRSTGT: 'Forest Gate',
  MANRPK: 'Manor Park',
  ILFORD: 'Ilford',
  SVNKNGS: 'Seven Kings',
  GODMAYS: 'Goodmayes',
  CHDWLHT: 'Chadwell Heath',
  ROMFORD: 'Romford',
  GIDEAPK: 'Gidea Park',
  HRLDWOD: 'Harold Wood',
  BRTWOOD: 'Brentwood',
  SHENFLD: 'Shenfield',
  LIVSTLL: 'Liverpool Street',
  LIVST: 'Liverpool Street GE',
  FRNDXR: 'Farringdon',
  TOTCTRD: 'Tottenham Court Road',
  BONDST: 'Bond Street',
  PADTLL: 'Paddington LL',
  PADTON: 'Paddington GW',
  ACTONML: 'Acton Main Line',
  EALINGB: 'Ealing Broadway',
  WEALING: 'West Ealing',
  HANWELL: 'Hanwell',
  STHALL: 'Southall',
  HAYESAH: 'Hayes & Harlington',
  HTRWAPT: 'Heathrow Central',
  HTRWTM4: 'Heathrow Terminal 4',
  HTRWTM5: 'Heathrow Terminal 5',
  WDRYTON: 'West Drayton',
  IVER: 'Iver',
  LANGLEY: 'Langley',
  SLOUGH: 'Slough',
  BNHAM: 'Burnham',
  TAPLOW: 'Taplow',
  MDNHEAD: 'Maidenhead',
  MAIDNHD: 'Maidenhead',
  TWYFORD: 'Twyford',
  RDNGSTN: 'Reading',
  READING: 'Reading',
};

// Supports both CRS codes and TIPLOC aliases cleanly
export const CODE_TO_TIPLOCS: Record<string, string[]> = {
  ABW: ['ABWDXR'],
  WWC: ['WOLWXR'],
  CUS: ['CUSTMHS'],
  CWX: ['CANWHRF'],
  ZLW: ['WCHAPXR'],
  SRA: ['STFD'],
  MYL: ['MRYLAND'],
  FOG: ['FRSTGT'],
  MNP: ['MANRPK'],
  IFD: ['ILFORD'],
  SVK: ['SVNKNGS'],
  GMY: ['GODMAYS'],
  CTH: ['CHDWLHT'],
  RMF: ['ROMFORD'],
  GDP: ['GIDEAPK'],
  HRO: ['HRLDWOD'],
  BRE: ['BRTWOOD'],
  SNF: ['SHENFLD'],
  LST: ['LIVSTLL', 'LIVST'],
  ZFD: ['FRNDXR'],
  TCR: ['TOTCTRD'],
  BDS: ['BONDST'],
  PAD: ['PADTLL', 'PADTON'],
  AML: ['ACTONML'],
  EAL: ['EALINGB'],
  WEA: ['WEALING'],
  HAN: ['HANWELL'],
  STL: ['STHALL'],
  HAY: ['HAYESAH'],
  HXX: ['HTRWAPT'],
  HAF: ['HTRWTM4'],
  HWV: ['HTRWTM5'],
  WDT: ['WDRYTON'],
  IVR: ['IVER'],
  LNY: ['LANGLEY'],
  SLO: ['SLOUGH'],
  BNM: ['BNHAM'],
  TAP: ['TAPLOW'],
  MAI: ['MDNHEAD', 'MAIDNHD'],
  TWY: ['TWYFORD'],
  RDG: ['RDNGSTN', 'READING'],
  ILFEMUD: ['ILFEMUD', 'ILFDEMD'],
  ILFDEMD: ['ILFEMUD', 'ILFDEMD'],
  XIF: ['ILFEMUD', 'ILFDEMD'],
  PLMSXCR: ['PLMSXCR', 'PLMSRS'],
  PLMSRS: ['PLMSXCR', 'PLMSRS'],
};

const STP_PRIORITY: Record<string, number> = {
  C: 1,
  O: 2,
  N: 3,
  P: 4,
};

function resolveTiplocAliases(code: string): Set<string> {
  const norm = String(code || '').trim().toUpperCase();
  if (!norm) return new Set();
  const mapped = CODE_TO_TIPLOCS[norm];
  const result = new Set<string>(mapped ? [...mapped, norm] : [norm]);
  return result;
}

export function formatTiplocName(tiploc?: string | null): string {
  const key = String(tiploc || '').trim().toUpperCase();
  if (!key) return 'Unknown';
  return TIPLOC_TO_NAME[key] || key;
}

function getLondonTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatEpochToLondonHHMM(epochSec: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(epochSec * 1000));
}

function addMinutesToHHMM(hhmm: string, deltaMinutes: number): string {
  const [hStr, mStr] = hhmm.split(':');
  const total = ((parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + deltaMinutes) % 1440 + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function normalizeLiveEndpoint(rawUrl: string): URL {
  const clean = rawUrl.trim().replace(/\/+$/, '');
  if (clean.toLowerCase().endsWith('/api/live')) {
    return new URL(clean);
  }
  return new URL(`${clean}/api/live`);
}

function normalizeDeparturesEndpoint(rawUrl: string): URL {
  const clean = rawUrl.trim().replace(/\/+$/, '').replace(/\/api\/live$/i, '');
  return new URL(`${clean}/api/departures`);
}

function maskUrlHost(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//${u.host}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return rawUrl;
  }
}

interface DateScheduleCacheEntry {
  fetchedAt: number;
  baseUrl: string;
  dateYmd: string;
  headcodeCount: number;
  trains: Map<string, RemoteTrainRecord>;
}

const SCHEDULE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const LIVE_FRESH_WINDOW_MS = 15 * 1000; // 15 seconds

export function createNrLiveApiService(
  db: Database.Database,
  getConfig: () => NrLiveApiConfig,
  validateUrl: (rawUrl: string) => URL | null,
  getCandidateHeadcodesFromCatalog: (dateYmd: string) => Promise<string[]>
) {
  const dateCache = new Map<string, DateScheduleCacheEntry>();
  const inFlightBuilds = new Map<string, Promise<DateScheduleCacheEntry>>();
  const departuresSupport = new Map<string, { supported: boolean; checkedAt: number }>();

  let lastQueryAt: string | null = null;
  let lastQueryDurationMs: number | null = null;
  let lastError: string | null = null;
  let lastCandidateCount = 0;

  function buildHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }
    return headers;
  }

  async function fetchLiveBatch(
    baseUrl: string,
    apiKey: string,
    headcodes: string[],
    dateYmd: string
  ): Promise<Record<string, RemoteTrainRecord>> {
    const targetUrl = normalizeLiveEndpoint(baseUrl);
    targetUrl.searchParams.set('headcodes', headcodes.join(','));
    if (dateYmd) {
      targetUrl.searchParams.set('date', dateYmd);
    }

    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: buildHeaders(apiKey),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Remote Live API returned HTTP ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ''}`);
    }

    const json = (await res.json()) as { trains?: Record<string, RemoteTrainRecord> };
    if (!json || typeof json.trains !== 'object') {
      throw new Error('Remote Live API returned an unexpected payload (expected { trains: {...} }).');
    }

    return json.trains;
  }

  function buildFallbackElizabethLineHeadcodes(): string[] {
    const prefixes: string[] = [];
    const letters = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'; // standard UK reporting letters (I omitted in headcodes, check A-Z for safety)
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      prefixes.push(`9${ch}`);
      prefixes.push(`5${ch}`);
    }
    for (const p of ['3A', '3B', '3C', '3D', '3F', '3G', '3H', '3K', '3N', '3P', '3R', '3T', '3U', '3W', '3Y', '2W', '2Y', '2R', '2P', '2G', '2N']) {
      prefixes.push(p);
    }
    void letters;
    const out: string[] = [];
    for (const p of prefixes) {
      for (let n = 0; n < 100; n++) {
        out.push(`${p}${String(n).padStart(2, '0')}`);
      }
    }
    return out;
  }

  function loadPersistedDiscoveredHeadcodes(): string[] {
    try {
      const row = db
        .prepare("SELECT value FROM app_settings WHERE key = 'nr_discovered_headcodes'")
        .get() as { value?: string } | undefined;
      if (!row?.value) return [];
      const parsed = JSON.parse(row.value);
      if (parsed && Array.isArray(parsed.headcodes) && Date.now() - (parsed.updatedAt || 0) < 24 * 60 * 60 * 1000) {
        return parsed.headcodes;
      }
    } catch {}
    return [];
  }

  function persistDiscoveredHeadcodes(headcodes: string[]) {
    if (headcodes.length === 0) return;
    try {
      db.prepare(`
        INSERT INTO app_settings (key, value) VALUES ('nr_discovered_headcodes', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(JSON.stringify({ updatedAt: Date.now(), headcodes }));
    } catch {}
  }

  async function collectAllCandidateHeadcodes(dateYmd: string): Promise<{ headcodes: string[]; isDiscoveryScan: boolean }> {
    const hcSet = new Set<string>();

    // 1. Pull headcodes from TDtools diagram catalog (in-memory, SQLite cache, or fresh fetch)
    try {
      const catalogHeadcodes = await getCandidateHeadcodesFromCatalog(dateYmd);
      for (const h of catalogHeadcodes) {
        const clean = String(h || '').trim().toUpperCase();
        if (/^[0-9A-Z]{4}$/.test(clean)) {
          hcSet.add(clean);
        }
      }
    } catch (e) {
      console.warn('[NR Live API] Failed loading catalog headcodes:', e);
    }

    // 2. Include any headcodes from persisted remote API discovery (24h cache)
    for (const h of loadPersistedDiscoveredHeadcodes()) {
      const clean = String(h || '').trim().toUpperCase();
      if (/^[0-9A-Z]{4}$/.test(clean)) {
        hcSet.add(clean);
      }
    }

    // 3. Also include any headcodes allocated in local DB on the requested date
    try {
      const rows = db.prepare('SELECT headcodes FROM allocations WHERE date = ?').all(dateYmd) as Array<{ headcodes: string }>;
      for (const r of rows) {
        try {
          const parsed = JSON.parse(r.headcodes || '[]');
          if (Array.isArray(parsed)) {
            for (const h of parsed) {
              const clean = String(h || '').trim().toUpperCase();
              if (/^[0-9A-Z]{4}$/.test(clean)) {
                hcSet.add(clean);
              }
            }
          }
        } catch {}
      }
    } catch {}

    // 4. Fallback: if catalog isn't populated yet, run a fast parallel scan across Elizabeth Line reporting prefixes
    let isDiscoveryScan = false;
    if (hcSet.size < 20) {
      isDiscoveryScan = true;
      for (const h of buildFallbackElizabethLineHeadcodes()) {
        hcSet.add(h);
      }
    }

    const list = Array.from(hcSet);
    lastCandidateCount = list.length;
    return { headcodes: list, isDiscoveryScan };
  }

  async function buildOrGetDateScheduleCache(
    baseUrl: string,
    apiKey: string,
    dateYmd: string,
    forceRefresh = false
  ): Promise<DateScheduleCacheEntry> {
    const cacheKey = `${baseUrl}::${dateYmd}`;
    const existing = dateCache.get(cacheKey);
    if (!forceRefresh && existing && Date.now() - existing.fetchedAt < SCHEDULE_CACHE_TTL_MS) {
      return existing;
    }

    const pending = inFlightBuilds.get(cacheKey);
    if (pending) {
      return pending;
    }

    const task = (async () => {
      const { headcodes, isDiscoveryScan } = await collectAllCandidateHeadcodes(dateYmd);

      const BATCH_SIZE = 150;
      const chunks: string[][] = [];
      for (let i = 0; i < headcodes.length; i += BATCH_SIZE) {
        chunks.push(headcodes.slice(i, i + BATCH_SIZE));
      }

      const mergedTrains = new Map<string, RemoteTrainRecord>();
      const CONCURRENCY = isDiscoveryScan ? 8 : 4;
      let chunkIdx = 0;

      const worker = async () => {
        while (chunkIdx < chunks.length) {
          const idx = chunkIdx++;
          const batch = chunks[idx];
          const batchTrains = await fetchLiveBatch(baseUrl, apiKey, batch, dateYmd);
          for (const [hc, rec] of Object.entries(batchTrains)) {
            if (rec && Array.isArray(rec.schedules) && rec.schedules.length > 0) {
              mergedTrains.set(hc.toUpperCase(), rec);
            }
          }
        }
      };

      const workers = Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, () => worker());
      await Promise.all(workers);

      const activeHeadcodes = Array.from(mergedTrains.keys());
      if (isDiscoveryScan && activeHeadcodes.length > 0) {
        persistDiscoveredHeadcodes(activeHeadcodes);
        lastCandidateCount = activeHeadcodes.length;
      }

      const entry: DateScheduleCacheEntry = {
        fetchedAt: Date.now(),
        baseUrl,
        dateYmd,
        headcodeCount: activeHeadcodes.length || headcodes.length,
        trains: mergedTrains,
      };
      dateCache.set(cacheKey, entry);
      return entry;
    })();

    inFlightBuilds.set(cacheKey, task);
    try {
      return await task;
    } finally {
      if (inFlightBuilds.get(cacheKey) === task) {
        inFlightBuilds.delete(cacheKey);
      }
    }
  }

  async function tryRemoteDeparturesEndpoint(
    baseUrl: string,
    apiKey: string,
    options: { origin: string; destination?: string; date: string; time?: string; limit?: number }
  ): Promise<NrLiveServiceResult[] | null> {
    const cleanBase = baseUrl.trim().replace(/\/+$/, '').replace(/\/api\/live$/i, '');
    const cachedSupport = departuresSupport.get(cleanBase);
    if (cachedSupport && !cachedSupport.supported && Date.now() - cachedSupport.checkedAt < 5 * 60 * 1000) {
      return null;
    }

    try {
      const url = normalizeDeparturesEndpoint(baseUrl);
      url.searchParams.set('origin', options.origin);
      if (options.destination) url.searchParams.set('destination', options.destination);
      url.searchParams.set('date', options.date);
      if (options.time) url.searchParams.set('time', options.time);
      if (options.limit) url.searchParams.set('limit', String(options.limit));

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: buildHeaders(apiKey),
        signal: AbortSignal.timeout(8000),
      });

      if (res.status === 404 || res.status === 405) {
        departuresSupport.set(cleanBase, { supported: false, checkedAt: Date.now() });
        return null;
      }

      if (!res.ok) {
        return null;
      }

      const json = (await res.json()) as any;
      if (json && Array.isArray(json.services)) {
        departuresSupport.set(cleanBase, { supported: true, checkedAt: Date.now() });
        return json.services as NrLiveServiceResult[];
      }
      return null;
    } catch {
      return null;
    }
  }

  async function searchServices(options: {
    origin: string;
    destination?: string;
    date: string;
    time?: string;
    limit?: number;
  }): Promise<NrLiveServiceResult[]> {
    const cfg = getConfig();
    if (!cfg.url) {
      throw new Error('Remote Live Train API URL is not configured.');
    }
    if (!validateUrl(cfg.url)) {
      throw new Error('Remote Live Train API URL is invalid or disallowed.');
    }

    const startedAt = Date.now();
    const originSet = resolveTiplocAliases(options.origin);
    const destSet = options.destination ? resolveTiplocAliases(options.destination) : null;
    const dateYmd = options.date || getLondonTodayYmd();
    const minTime = (options.time || '00:00').slice(0, 5);
    const limit = Math.min(options.limit || 10, 10);
    const todayYmd = getLondonTodayYmd();

    try {
      // If the user's remote API natively supports /api/departures, use it directly
      const directServices = await tryRemoteDeparturesEndpoint(cfg.url, cfg.apiKey, {
        origin: options.origin,
        destination: options.destination,
        date: dateYmd,
        time: minTime,
        limit,
      });
      if (directServices) {
        lastQueryAt = new Date().toISOString();
        lastQueryDurationMs = Date.now() - startedAt;
        lastError = null;
        return directServices.slice(0, limit);
      }

      // Otherwise query GET /api/live?headcodes=...&date=... (exact main.py FastAPI endpoint)
      const cacheEntry = await buildOrGetDateScheduleCache(cfg.url, cfg.apiKey, dateYmd);

      interface MatchedCandidate {
        headcode: string;
        sched: RemoteScheduleItem;
        originStop: RemoteScheduleStop;
        destStop: RemoteScheduleStop;
        std: string;
        arrAtDest: string;
      }

      const candidates: MatchedCandidate[] = [];

      for (const [hc, rec] of cacheEntry.trains.entries()) {
        const sortedScheds = [...(rec.schedules || [])].sort(
          (a, b) => (STP_PRIORITY[a.stp_indicator] || 9) - (STP_PRIORITY[b.stp_indicator] || 9)
        );
        for (const sched of sortedScheds) {
          const locs = sched.locations || [];
          if (locs.length < 2) continue;

          const origIdx = locs.findIndex((l) => originSet.has(String(l.tiploc || '').toUpperCase()));
          if (origIdx === -1 || origIdx === locs.length - 1) continue;

          let destIdx = locs.length - 1;
          if (destSet && destSet.size > 0) {
            const foundDestIdx = locs.findIndex((l, idx) => idx > origIdx && destSet.has(String(l.tiploc || '').toUpperCase()));
            if (foundDestIdx === -1) continue;
            destIdx = foundDestIdx;
          }

          const originStop = locs[origIdx];
          const destStop = locs[destIdx];
          const std = originStop.dep || originStop.pass || originStop.arr;
          if (!std || std < minTime) continue;

          candidates.push({
            headcode: hc,
            sched,
            originStop,
            destStop,
            std,
            arrAtDest: destStop.arr || destStop.pass || destStop.dep || '',
          });
          break; // Keep highest STP schedule per headcode in candidate list
        }
      }

      candidates.sort((a, b) => a.std.localeCompare(b.std) || a.headcode.localeCompare(b.headcode));
      const topCandidates = candidates.slice(0, limit);

      // Refresh live TRUST telemetry in 1 small request for just the matched headcodes if searching today
      const liveOverlayMap = new Map<string, RemoteTrainRecord>();
      for (const c of topCandidates) {
        const existingRec = cacheEntry.trains.get(c.headcode);
        if (existingRec) liveOverlayMap.set(c.headcode, existingRec);
      }

      const cacheAgeMs = Date.now() - cacheEntry.fetchedAt;
      if (topCandidates.length > 0 && dateYmd === todayYmd && cacheAgeMs > LIVE_FRESH_WINDOW_MS) {
        try {
          const freshHcs = Array.from(new Set(topCandidates.map((c) => c.headcode)));
          const freshData = await fetchLiveBatch(cfg.url, cfg.apiKey, freshHcs, dateYmd);
          for (const [hc, rec] of Object.entries(freshData)) {
            if (rec) {
              liveOverlayMap.set(hc.toUpperCase(), rec);
            }
          }
        } catch (refreshErr) {
          console.warn('[NR Live API] Live TRUST overlay refresh skipped:', refreshErr);
        }
      }

      const results: NrLiveServiceResult[] = topCandidates.map((c) => {
        const live = liveOverlayMap.get(c.headcode);
        const locs = c.sched.locations || [];
        const terminusTiploc = String(c.sched.dest_tiploc || locs[locs.length - 1]?.tiploc || c.destStop.tiploc || '').toUpperCase();
        const destination = formatTiplocName(terminusTiploc);

        const calls = live?.live_calls || {};
        let originCall: LiveCallEntry | undefined;
        for (const alias of originSet) {
          if (calls[alias]) {
            originCall = calls[alias];
            break;
          }
        }

        const platform =
          originCall?.platform ||
          (originCall && live?.last_platform ? live.last_platform : '') ||
          c.originStop.platform ||
          '-';

        let etd = 'Scheduled';
        if (c.sched.is_cancelled || live?.is_cancelled) {
          etd = 'Cancelled';
        } else if (live?.activated) {
          if (originCall?.atd) {
            const depHHMM = formatEpochToLondonHHMM(originCall.atd);
            etd = Number(originCall.variation) > 0 ? `Dep. ${depHHMM}` : 'On time';
          } else if (Number(live.timetable_variation) > 0) {
            etd = `Exp. ${addMinutesToHHMM(c.std, Number(live.timetable_variation))}`;
          } else {
            etd = 'On time';
          }
        } else if (dateYmd === todayYmd) {
          etd = 'Scheduled';
        }

        const hc = c.headcode;
        const isPassengerService = !(hc.startsWith('5') || hc.startsWith('3') || hc.startsWith('0'));

        return {
          std: c.std,
          arrAtDest: c.arrAtDest,
          date: dateYmd,
          etd,
          platform: platform || '-',
          operator: 'Elizabeth Line',
          operatorCode: 'XR',
          destination,
          destinationTiploc: terminusTiploc,
          headcode: hc,
          isPassengerService,
          stpIndicator: c.sched.stp_indicator || 'P',
          trainUid: c.sched.train_uid || live?.train_uid || '',
          activated: Boolean(live?.activated),
          lastLocation: live?.last_location || null,
        };
      });

      lastQueryAt = new Date().toISOString();
      lastQueryDurationMs = Date.now() - startedAt;
      lastError = null;
      return results;
    } catch (err: any) {
      lastQueryAt = new Date().toISOString();
      lastQueryDurationMs = Date.now() - startedAt;
      lastError = err?.message || 'Remote Live API query failed';
      throw err;
    }
  }

  async function getLiveByHeadcodes(headcodes: string[], dateYmd?: string) {
    const cfg = getConfig();
    if (!cfg.url || !validateUrl(cfg.url)) {
      throw new Error('Remote Live Train API URL is not configured or invalid.');
    }
    const targetDate = dateYmd || getLondonTodayYmd();
    const trains = await fetchLiveBatch(cfg.url, cfg.apiKey, headcodes, targetDate);
    return { trains };
  }

  async function testConnection(url: string, apiKey: string): Promise<{
    success: boolean;
    responseTimeMs: number;
    status?: number;
    trainsCount?: number;
    sampleServices?: string[];
    error?: string;
  }> {
    const startTime = Date.now();
    const cleanUrl = url.trim();
    if (!cleanUrl || !validateUrl(cleanUrl)) {
      return {
        success: false,
        responseTimeMs: 0,
        error: 'Invalid or disallowed API URL.',
      };
    }

    try {
      const todayYmd = getLondonTodayYmd();
      const { headcodes: discoveredOrCatalog, isDiscoveryScan } = await collectAllCandidateHeadcodes(todayYmd);
      const sampleQueryHcs = !isDiscoveryScan && discoveredOrCatalog.length > 0
        ? discoveredOrCatalog.slice(0, 8)
        : ['9W36', '9U38', '9T04', '9R44', '9C10', '9G10', '9N12', '5Y41'];

      const targetUrl = normalizeLiveEndpoint(cleanUrl);
      targetUrl.searchParams.set('headcodes', sampleQueryHcs.join(','));
      targetUrl.searchParams.set('date', todayYmd);

      const res = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: buildHeaders(apiKey),
        signal: AbortSignal.timeout(10000),
      });

      const responseTimeMs = Date.now() - startTime;
      const rawText = await res.text();
      let parsed: any = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      if (!res.ok) {
        const detail = parsed?.detail || parsed?.error || parsed?.message || rawText || `HTTP ${res.status}`;
        return {
          success: false,
          responseTimeMs,
          status: res.status,
          error:
            res.status === 401
              ? `Unauthorized (HTTP 401): Check your x-api-key. (${detail})`
              : `Remote API returned HTTP ${res.status}: ${String(detail).slice(0, 200)}`,
        };
      }

      if (!parsed || typeof parsed.trains !== 'object') {
        return {
          success: false,
          responseTimeMs,
          status: res.status,
          error: 'Endpoint responded, but did not return expected { "trains": { ... } } JSON format.',
        };
      }

      const entries = Object.values(parsed.trains) as RemoteTrainRecord[];
      const withData = entries.filter((t) => t && (t.activated || (t.schedules && t.schedules.length > 0)));
      const sampleServices = withData.slice(0, 5).map((t) => {
        const s = t.schedules?.[0];
        const orig = s?.origin_tiploc ? formatTiplocName(s.origin_tiploc) : '';
        const dest = s?.dest_tiploc ? formatTiplocName(s.dest_tiploc) : '';
        const route = orig && dest ? `${s.origin_dep || '--:--'} ${orig} -> ${dest}` : t.variation_status || 'Loaded';
        return `${t.headcode}: ${route}${t.activated ? ` [${t.variation_status}]` : ''}`;
      });

      return {
        success: true,
        responseTimeMs,
        status: res.status,
        trainsCount: withData.length,
        sampleServices,
      };
    } catch (e: any) {
      return {
        success: false,
        responseTimeMs: Date.now() - startTime,
        error: e?.message || 'Failed to reach Remote Live Train API.',
      };
    }
  }

  function clearCache() {
    dateCache.clear();
    departuresSupport.clear();
  }

  function getStatus(): NrLiveApiStatus {
    const cfg = getConfig();
    const cachedDates = Array.from(dateCache.values()).map((entry) => ({
      date: entry.dateYmd,
      headcodeCount: entry.headcodeCount,
      scheduleCount: entry.trains.size,
      fetchedAt: new Date(entry.fetchedAt).toISOString(),
    }));

    let cleanBase = cfg.url ? cfg.url.trim().replace(/\/+$/, '').replace(/\/api\/live$/i, '') : '';
    const depCheck = cleanBase ? departuresSupport.get(cleanBase) : undefined;

    return {
      configured: Boolean(cfg.url),
      apiUrlPreview: maskUrlHost(cfg.url),
      candidateHeadcodesCount: lastCandidateCount,
      cachedDates,
      lastQueryAt,
      lastQueryDurationMs,
      lastError,
      supportsDeparturesEndpoint: depCheck ? depCheck.supported : null,
    };
  }

  return {
    searchServices,
    getLiveByHeadcodes,
    testConnection,
    clearCache,
    getStatus,
  };
}
