import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createSessionCookieValue } from "./cookie.js";
import { SESSION_COOKIE_NAME } from "./constants.js";

const TEST_PASSWORD = "director-test-password";
const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789ab";
const SENTINEL = "sentinal-password-9f3a";
const NOW = 1_700_000_000;

async function createTestApp(options?: { enableProbe?: boolean; nowSeconds?: number }) {
  return buildApp({
    password: TEST_PASSWORD,
    sessionSecret: TEST_SECRET,
    nowSeconds: options?.nowSeconds ?? NOW,
    enableProbe: options?.enableProbe ?? true,
    enableLogger: false,
  });
}

function sessionCookieFromResponse(setCookie: string | string[] | undefined): string | undefined {
  if (setCookie === undefined) {
    return undefined;
  }
  const lines = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const line of lines) {
    if (line.startsWith(`${SESSION_COOKIE_NAME}=`) && !line.includes("Max-Age=0")) {
      const value = line.slice(SESSION_COOKIE_NAME.length + 1).split(";")[0];
      return value;
    }
  }
  return undefined;
}

describe("session API inject (I1–I12)", () => {
  afterEach(() => {
    // no shared server
  });

  it("I1 wrong password returns 401 without signed session cookie or sentinel leak", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/session/login",
      payload: { password: SENTINEL },
    });
    expect(response.statusCode).toBe(401);
    const body = response.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("unauthorized");
    const setCookie = response.headers["set-cookie"];
    const signed = sessionCookieFromResponse(setCookie);
    expect(signed).toBeUndefined();
    expect(response.body).not.toContain(SENTINEL);
    expect(JSON.stringify(setCookie ?? "")).not.toContain(SENTINEL);
    await app.close();
  });

  it("I2 successful login sets HttpOnly SameSite=Lax cookie without Secure", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/session/login",
      payload: { password: TEST_PASSWORD },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ authenticated: true });
    const setCookie = response.headers["set-cookie"];
    const line = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(line).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(line).toContain("HttpOnly");
    expect(line).toContain("SameSite=Lax");
    expect(line).not.toContain("Secure");
    expect(line).not.toContain(TEST_PASSWORD);
    await app.close();
  });

  it("I3 GET /api/session without cookie", async () => {
    const app = await createTestApp();
    const response = await app.inject({ method: "GET", url: "/api/session" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ authenticated: false });
    await app.close();
  });

  it("I4 GET /api/session with valid cookie", async () => {
    const app = await createTestApp();
    const login = await app.inject({
      method: "POST",
      url: "/api/session/login",
      payload: { password: TEST_PASSWORD },
    });
    const cookieValue = sessionCookieFromResponse(login.headers["set-cookie"]);
    expect(cookieValue).toBeDefined();
    const response = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ authenticated: true });
    await app.close();
  });

  it("I5 GET /api/session with tampered or expired cookie", async () => {
    const app = await createTestApp({ nowSeconds: NOW + 604_801 });
    const expired = createSessionCookieValue(TEST_SECRET, NOW);
    const tampered = `${expired}x`;
    const expiredRes = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${expired}` },
    });
    expect(expiredRes.json()).toEqual({ authenticated: false });
    const tamperedRes = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${tampered}` },
    });
    expect(tamperedRes.json()).toEqual({ authenticated: false });
    await app.close();
  });

  it("I6 probe rejects missing, bad, and expired cookies", async () => {
    const app = await createTestApp();
    const noCookie = await app.inject({ method: "GET", url: "/api/session-probe" });
    expect(noCookie.statusCode).toBe(401);
    expect(noCookie.json().error.code).toBe("unauthorized");
    expect(noCookie.body).not.toContain(SENTINEL);

    const bad = await app.inject({
      method: "GET",
      url: "/api/session-probe",
      headers: { cookie: `${SESSION_COOKIE_NAME}=not.valid` },
    });
    expect(bad.statusCode).toBe(401);

    const expiredApp = await createTestApp({ nowSeconds: NOW + 604_801 });
    const expiredValue = createSessionCookieValue(TEST_SECRET, NOW);
    const expired = await expiredApp.inject({
      method: "GET",
      url: "/api/session-probe",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${expiredValue}` },
    });
    expect(expired.statusCode).toBe(401);
    await app.close();
    await expiredApp.close();
  });

  it("I7 probe allows valid session cookie", async () => {
    const app = await createTestApp();
    const login = await app.inject({
      method: "POST",
      url: "/api/session/login",
      payload: { password: TEST_PASSWORD },
    });
    const cookieValue = sessionCookieFromResponse(login.headers["set-cookie"]);
    const probe = await app.inject({
      method: "GET",
      url: "/api/session-probe",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    });
    expect(probe.statusCode).toBe(200);
    await app.close();
  });

  it("I8 logout clears browser cookie but copied cookie remains valid until exp", async () => {
    const app = await createTestApp();
    const login = await app.inject({
      method: "POST",
      url: "/api/session/login",
      payload: { password: TEST_PASSWORD },
    });
    const cookieValue = sessionCookieFromResponse(login.headers["set-cookie"]);
    expect(cookieValue).toBeDefined();

    const logout = await app.inject({
      method: "POST",
      url: "/api/session/logout",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toEqual({ authenticated: false });
    const clearLine = Array.isArray(logout.headers["set-cookie"])
      ? logout.headers["set-cookie"][0]
      : logout.headers["set-cookie"];
    expect(clearLine).toContain("Max-Age=0");

    const probeWithCopy = await app.inject({
      method: "GET",
      url: "/api/session-probe",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    });
    expect(probeWithCopy.statusCode).toBe(200);

    const probeWithout = await app.inject({
      method: "GET",
      url: "/api/session-probe",
    });
    expect(probeWithout.statusCode).toBe(401);
    await app.close();
  });

  it("I9 logout without cookie still clears Set-Cookie", async () => {
    const app = await createTestApp();
    const logout = await app.inject({ method: "POST", url: "/api/session/logout" });
    expect(logout.statusCode).toBe(200);
    const clearLine = Array.isArray(logout.headers["set-cookie"])
      ? logout.headers["set-cookie"][0]
      : logout.headers["set-cookie"];
    expect(clearLine).toContain("Max-Age=0");
    await app.close();
  });

  it("I10 login with empty body object returns validation_error", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/session/login",
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
    expect(response.body).not.toContain(SENTINEL);
    expect(sessionCookieFromResponse(response.headers["set-cookie"])).toBeUndefined();
    await app.close();
  });

  it("I11 production app without probe route returns 404 even with valid session", async () => {
    const app = await createTestApp({ enableProbe: false });
    const cookieValue = createSessionCookieValue(TEST_SECRET, NOW);
    const response = await app.inject({
      method: "GET",
      url: "/api/session-probe",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("I12 fake cookie before login stays invalid after failed login", async () => {
    const app = await createTestApp();
    const fake = "aaaa.bbbb";
    const login = await app.inject({
      method: "POST",
      url: "/api/session/login",
      payload: { password: "wrong-password-value" },
      headers: { cookie: `${SESSION_COOKIE_NAME}=${fake}` },
    });
    expect(login.statusCode).toBe(401);
    const probe = await app.inject({
      method: "GET",
      url: "/api/session-probe",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${fake}` },
    });
    expect(probe.statusCode).toBe(401);
    await app.close();
  });

  it("rejects cross-origin POST login when Origin is not loopback", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/session/login",
      payload: { password: TEST_PASSWORD },
      headers: { origin: "https://evil.example" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toBe("Origin không được phép.");
    expect(sessionCookieFromResponse(response.headers["set-cookie"])).toBeUndefined();
    await app.close();
  });

  it("allows login without Origin header (inject / curl)", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/session/login",
      payload: { password: TEST_PASSWORD },
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("probe with oversized cookie returns 401 not 500", async () => {
    const app = await createTestApp();
    const huge = "a".repeat(5000);
    const response = await app.inject({
      method: "GET",
      url: "/api/session-probe",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${huge}` },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
