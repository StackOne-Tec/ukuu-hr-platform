/* Minimal Hikvision ISAPI client for the Attendance Import flow.
   Mirrors UkuuHr's HikvisionIsapiClient (see hikvision_fetch.py in the C#
   reference repo):

     GET  /ISAPI/System/deviceInfo                      -> device info (XML)
     POST /ISAPI/AccessControl/AcsEvent?format=json     -> punches (JSON)

   Real terminals sit on the LAN, ship with self-signed certs, and typically
   require DIGEST authentication (Basic is often disabled). So requests run
   through node http/https with TLS verification disabled, a short connect
   timeout, and a Basic -> Digest fallback handshake when the device responds
   with a 401 Digest challenge (mirrors hikvision_fetch.py). */

import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";

export type IsapiCreds = { username: string; password?: string };

const CONNECT_TIMEOUT_MS = 2000;
const READ_TIMEOUT_MS = 8000;

type RawResponse = { status: number; text: string; headers: http.IncomingHttpHeaders };

const md5 = (s: string) => crypto.createHash("md5").update(s, "utf8").digest("hex");

/* RFC 7616 digest challenge-response (qop="auth" when offered). */
function digestHeader(opts: {
  challenge: string;
  username: string;
  password: string;
  method: string;
  uri: string;
}): string {
  const part = (name: string) => {
    const m = opts.challenge.match(new RegExp(`${name}\\s*=\\s*"?([^",]+)"?`, "i"));
    return m ? m[1].replace(/^"|"$/g, "") : "";
  };
  const realm = part("realm") || "ISAPI";
  const nonce = part("nonce");
  const opaque = part("opaque");
  const qop = /qop\s*=\s*"?auth/.test(opts.challenge) ? "auth" : "";
  const nc = "00000001";
  const cnonce = crypto.randomBytes(8).toString("hex");
  const ha1 = md5(`${opts.username}:${realm}:${opts.password}`);
  const ha2 = md5(`${opts.method}:${opts.uri}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);
  const quote = (v: string) => `"${v}"`;
  const parts = [
    `username=${quote(opts.username)}`,
    `realm=${quote(realm)}`,
    `nonce=${quote(nonce)}`,
    `uri=${quote(opts.uri)}`,
    `response=${quote(response)}`,
  ];
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce=${quote(cnonce)}`);
  if (opaque) parts.push(`opaque=${quote(opaque)}`);
  return `Digest ${parts.join(", ")}`;
}

function send(opts: {
  host: string;
  port: number;
  method: string;
  path: string;
  body?: string;
  contentType?: string;
  authorization?: string;
  timeoutMs?: number;
}): Promise<RawResponse> {
  const { host, port, method, path } = opts;
  const mod = port === 443 ? https : http;
  const headers: Record<string, string> = { Accept: "application/xml, application/json" };
  if (opts.contentType) headers["Content-Type"] = opts.contentType;
  if (opts.authorization) headers.Authorization = opts.authorization;
  const body = opts.body ?? "";

  return new Promise<RawResponse>((resolve, reject) => {
    const req = mod.request(
      {
        host,
        port,
        method,
        path,
        headers: body ? { ...headers, "Content-Length": Buffer.byteLength(body) } : headers,
        rejectUnauthorized: false, // Hikvision devices ship with self-signed certs
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8"), headers: res.headers })
        );
      }
    );
    req.setTimeout(opts.timeoutMs ?? READ_TIMEOUT_MS, () => req.destroy(new Error("timed out")));
    req.on("error", (err) => reject(new Error(`Cannot connect to ${host}:${port} — ${(err as Error).message}`)));
    if (body) req.write(body);
    req.end();
  });
}

export async function isapiRequest(opts: {
  host: string;
  port: number;
  method: string;
  path: string;
  body?: string;
  contentType?: string;
  auth?: IsapiCreds;
  timeoutMs?: number;
}): Promise<RawResponse> {
  const { host, port, method, path, auth } = opts;

  // Round 1: anonymous request. Real Hikvision firmware answers this with a
  // 401 + WWW-Authenticate challenge (Digest, or Basic on some firmware) — and
  // we verified 192.168.1.137 behaves exactly that way. Going anonymous first
  // avoids the failure mode where a wrong-Basic attempt gets a bare 401 with no
  // challenge, which would make the digest retry impossible even with the
  // correct password.
  const first = await send({ ...opts });
  if (first.status !== 401 || !auth?.username) return first;

  // Round 2: answer the challenge the device actually issued.
  const challenge = String(first.headers["www-authenticate"] ?? "");
  if (/digest/i.test(challenge)) {
    const digest = digestHeader({
      challenge,
      username: auth.username,
      password: auth.password ?? "",
      method,
      uri: path.split("?")[0],
    });
    const second = await send({ ...opts, authorization: digest });
    if (second.status !== 401) return second;
    return second; // digest rejected — let the caller surface the real status
  }
  if (/basic/i.test(challenge)) {
    const basic = "Basic " + Buffer.from(`${auth.username}:${auth.password ?? ""}`).toString("base64");
    return send({ ...opts, authorization: basic });
  }
  return first; // caller turns 401 into a readable "authentication failed" error
}

/* GET /ISAPI/System/deviceInfo — proves the live connection and returns the
   terminal's identity. XML is parsed leniently (namespaces + casing vary). */
export async function probeDevice(host: string, port: number, auth?: IsapiCreds) {
  const res = await isapiRequest({ host, port, method: "GET", path: "/ISAPI/System/deviceInfo", auth });
  if (res.status === 401) {
    throw new Error("Authentication failed (HTTP 401) — check the device username and password");
  }
  if (res.status >= 400) {
    throw new Error(`Device returned HTTP ${res.status} on the ISAPI probe`);
  }
  const grab = (tag: string) => {
    const m = res.text.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, "i"));
    return m ? m[1].trim() : "";
  };
  return {
    status: res.status,
    deviceName: grab("deviceName") || `${host}`,
    model: grab("model"),
    serialNo: grab("serialNumber") || grab("serialNo"),
  };
}

export type DeviceEventKind = "check-in" | "check-out" | "verify" | "system";

export type DeviceEvent = {
  employeeNo: string; // "" when the event carries no person id
  time: Date;
  major: number;
  minor: number;
  kind: DeviceEventKind;
  label: string; // human-readable type, e.g. "Check In", "Verify 1.1028", "System 5.9"
  raw: string;
};

export type DeviceUser = { employeeNo: string; name: string; userType: string };

/* Readable type name for a Hikvision AcsEvent major.minor pair. Common codes:
   1.75 / 1.76 (or 5.75 / 5.76 on access controllers) = check-in / check-out;
   majors 2/3 are device/system; 5.* is access-controller activity. Anything
   else is shown as its raw code so no event is ever silently dropped. */
export function eventLabel(major: number, minor: number): string {
  const code = `${major}.${minor}`;
  if (minor === 75) return "Check In";
  if (minor === 76) return "Check Out";
  const known: Record<string, string> = {
    "1.1": "Access", "1.2": "Access Denied", "1.5": "Access", "1.25": "Access", "1.26": "Access Denied",
    "5.9": "Heartbeat", "5.21": "Online", "5.22": "Offline", "5.38": "Config Change",
    "2.39": "Time Sync", "2.1024": "Device Event", "1.1028": "Verify",
  };
  return known[code] ?? `Event ${code}`;
}

/* POST /ISAPI/AccessControl/AcsEvent?format=json — pulls EVERY event the
   device holds in the requested window (full history by default) and classifies
   each one; nothing is dropped. Firmware varies: classic terminals report
   punches as (1,75)/(1,76), access controllers (DS-K1T3xx, verified live on
   192.168.1.137) as (5,75)/(5,76) with the person id in employeeNoString. */
export async function fetchDeviceEvents(opts: {
  host: string;
  port: number;
  auth?: IsapiCreds;
  start: Date;
  end: Date;
  maxResults?: number;
  cap?: number; // safety cap on total events pulled (default 10000)
}): Promise<{ events: DeviceEvent[]; fetched: number; truncated: boolean }> {
  const maxResults = opts.maxResults ?? 100;
  const cap = opts.cap ?? 10000;
  const hikTime = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  const events: DeviceEvent[] = [];
  let position = 0;
  const searchID = `ukuu-${Date.now()}`;
  let truncated = false;

  for (let page = 0; page < 500; page++) {
    const body = JSON.stringify({
      AcsEventCond: {
        searchID,
        searchResultPosition: position,
        maxResults,
        major: 0, // 0 = no device-side filter — we classify every event client-side
        minor: 0,
        startTime: hikTime(opts.start),
        endTime: hikTime(opts.end),
      },
    });
    const res = await isapiRequest({
      host: opts.host,
      port: opts.port,
      method: "POST",
      path: "/ISAPI/AccessControl/AcsEvent?format=json",
      body,
      contentType: "application/json",
      auth: opts.auth,
    });
    if (res.status === 401) {
      throw new Error("Authentication failed (HTTP 401) — check the device username and password");
    }
    if (res.status >= 400) {
      throw new Error(`Device returned HTTP ${res.status} while pulling events`);
    }
    let doc: unknown;
    try {
      doc = JSON.parse(res.text);
    } catch {
      break; // not a JSON response — device doesn't support the JSON search
    }
    const root = (doc as Record<string, unknown>)["AcsEvent"] ?? doc;
    const rootObj = root as Record<string, unknown>;
    const list = (rootObj["InfoList"] as unknown[]) ?? (rootObj["EventList"] as unknown[]) ?? [];

    for (const item of list) {
      const it = item as Record<string, unknown>;
      const employeeNo = String(it.employeeNoString ?? it.employeeNo ?? it.EmployeeNo ?? "").trim();
      const timeStr = String(it.time ?? it.eventTime ?? "");
      const major = Number(it.major ?? it.Major ?? 0);
      const minor = Number(it.minor ?? it.Minor ?? 0);
      if (!timeStr) continue; // no timestamp = nothing to record
      const t = new Date(timeStr.replace(" ", "T"));
      if (Number.isNaN(t.getTime())) continue;
      const hasPerson = employeeNo.length > 0;
      const kind: DeviceEventKind =
        hasPerson && minor === 75 ? "check-in"
        : hasPerson && minor === 76 ? "check-out"
        : hasPerson ? "verify"
        : "system";
      events.push({
        employeeNo,
        time: t,
        major,
        minor,
        kind,
        label: kind === "check-in" ? "Check In" : kind === "check-out" ? "Check Out" : eventLabel(major, minor),
        raw: JSON.stringify(it).slice(0, 500),
      });
    }

    position += list.length;
    if (events.length >= cap) {
      truncated = true;
      break;
    }
    if (list.length === 0) break;
    const total = Number((root as Record<string, unknown>)["totalMatches"] ?? 0);
    if (total > 0 && position >= total) break; // some pages omit totalMatches — only stop when it says we're done
  }

  return { events, fetched: events.length, truncated };
}

/* POST /ISAPI/AccessControl/UserInfo/Search?format=json — the people enrolled
   on the device (employeeNo, name, validity, door rights…). Tolerant parse so
   older firmware that returns a different container still yields something. */
export async function fetchDeviceUsers(opts: {
  host: string;
  port: number;
  auth?: IsapiCreds;
  maxResults?: number;
}): Promise<DeviceUser[]> {
  const maxResults = opts.maxResults ?? 200;
  const body = JSON.stringify({
    UserInfoSearchCond: { searchID: `ukuu-u-${Date.now()}`, searchResultPosition: 0, maxResults },
  });
  const res = await isapiRequest({
    host: opts.host,
    port: opts.port,
    method: "POST",
    path: "/ISAPI/AccessControl/UserInfo/Search?format=json",
    body,
    contentType: "application/json",
    auth: opts.auth,
  });
  if (res.status === 401) {
    throw new Error("Authentication failed (HTTP 401) — check the device username and password");
  }
  if (res.status >= 400) {
    return []; // firmware without UserInfo/Search — personnel simply unavailable
  }
  try {
    const doc = JSON.parse(res.text);
    const root = (doc as Record<string, unknown>)["UserInfoSearch"] ?? doc;
    const list =
      ((root as Record<string, unknown>)["UserInfo"] as unknown[]) ??
      ((root as Record<string, unknown>)["UserInfoList"] as unknown[]) ??
      [];
    return list
      .map((u) => {
        const it = u as Record<string, unknown>;
        return {
          employeeNo: String(it.employeeNo ?? "").trim(),
          name: String(it.name ?? "").trim(),
          userType: String(it.userType ?? "normal"),
        };
      })
      .filter((u) => u.employeeNo || u.name);
  } catch {
    return [];
  }
}
