import { createHash } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type HostResolver,
  hostAllowlistFor,
  htmlToText,
  isPublicAddress,
  safeFetch,
} from "./safe-fetch.js";

/** Resolver giả: không đụng DNS thật. */
function fakeResolver(map: Record<string, string[]>): HostResolver {
  return async (hostname) => {
    const addresses = map[hostname];
    if (addresses === undefined) {
      throw new Error("ENOTFOUND");
    }
    return addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  };
}

describe("isPublicAddress (P3-03)", () => {
  it("chặn private, loopback, link-local, metadata, CGNAT, mapped, ULA, multicast", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.100.100.200",
      "0.0.0.0",
      "255.255.255.255",
      "224.0.0.1",
      "::1",
      "::",
      "::ffff:127.0.0.1",
      "::ffff:a9fe:a9fe",
      "0:0:0:0:0:ffff:7f00:1",
      "fd00:ec2::254",
      "fe80::1",
      "64:ff9b::7f00:1",
      "not-an-ip",
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it("cho phép địa chỉ công khai", () => {
    for (const address of ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"]) {
      expect(isPublicAddress(address), address).toBe(true);
    }
  });
});

describe("safeFetch: từ chối trước khi mở socket (P3-03)", () => {
  it("URL metadata bị từ chối dù host nằm trong allowlist", async () => {
    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "http://[fd00:ec2::254]/latest/meta-data/",
      "http://100.100.100.200/latest/meta-data/",
    ]) {
      const result = await safeFetch(url, { allowedHosts: hostAllowlistFor([url]) });
      expect(result.log, url).toMatchObject({ error: "address_blocked", status: null, contentHash: null });
      expect(result.text).toBeUndefined();
    }
  });

  it("host công khai trỏ DNS về metadata hoặc loopback bị chặn", async () => {
    const resolver = fakeResolver({
      "metadata.example.com": ["169.254.169.254"],
      "mixed.example.com": ["93.184.216.34", "10.0.0.5"],
      "local.example.com": ["::1"],
    });
    for (const host of ["metadata.example.com", "mixed.example.com", "local.example.com"]) {
      const result = await safeFetch(`https://${host}/`, {
        allowedHosts: new Set([host]),
        resolver,
      });
      expect(result.log.error, host).toBe("address_blocked");
    }
  });

  it("giao thức khác http/https, URL có credential, URL hỏng bị từ chối", async () => {
    const allowedHosts = new Set(["example.com", ""]);
    expect((await safeFetch("file:///etc/passwd", { allowedHosts })).log.error).toBe("protocol_not_allowed");
    expect((await safeFetch("ftp://example.com/a", { allowedHosts })).log.error).toBe("protocol_not_allowed");
    expect((await safeFetch("gopher://example.com/", { allowedHosts })).log.error).toBe("protocol_not_allowed");
    expect((await safeFetch("https://user:pw@example.com/", { allowedHosts })).log.error).toBe("invalid_url");
    expect((await safeFetch("not a url", { allowedHosts })).log.error).toBe("invalid_url");
  });

  it("host ngoài allowlist và DNS lỗi", async () => {
    expect(
      (await safeFetch("https://other.example.com/", { allowedHosts: new Set(["example.com"]) })).log.error,
    ).toBe("host_not_allowed");
    expect(
      (
        await safeFetch("https://missing.example.com/", {
          allowedHosts: new Set(["missing.example.com"]),
          resolver: fakeResolver({}),
        })
      ).log.error,
    ).toBe("dns_failed");
  });
});

describe("safeFetch: server giả trên 127.0.0.1 (P3-03)", () => {
  let server: Server;
  let port = 0;
  const handlers = new Map<string, (res: ServerResponse) => void>();
  const SITE = "site.test";
  const OTHER = "other.test";
  const PRIVATE = "private.test";
  const resolver = fakeResolver({
    [SITE]: ["127.0.0.1"],
    [OTHER]: ["127.0.0.1"],
    [PRIVATE]: ["10.0.0.7"],
  });
  // Chỉ mở đúng loopback của server giả; mọi dải chặn khác giữ nguyên.
  const isAddressAllowed = (address: string) => address === "127.0.0.1" || isPublicAddress(address);
  const base = () => `http://${SITE}:${port}`;
  const options = (extra: Partial<Parameters<typeof safeFetch>[1]> = {}) => ({
    allowedHosts: new Set([SITE, PRIVATE]),
    resolver,
    isAddressAllowed,
    ...extra,
  });

  beforeAll(async () => {
    server = createServer((req, res) => {
      const handler = handlers.get(req.url ?? "");
      if (handler === undefined) {
        res.writeHead(404).end();
        return;
      }
      handler(res);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;

    const html =
      "<html><head><title>Redis &amp; cache</title><script>alert(1)</script></head>" +
      "<body><h1>Redis</h1><p>Lưu dữ liệu trong RAM.</p><style>p{}</style></body></html>";
    handlers.set("/ok", (res) => res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html));
    handlers.set("/plain", (res) => res.writeHead(200, { "content-type": "text/plain" }).end("  văn bản  "));
    for (let i = 1; i <= 4; i++) {
      handlers.set(`/r${i}`, (res) => res.writeHead(302, { location: i === 4 ? "/ok" : `/r${i + 1}` }).end());
    }
    handlers.set("/to-other", (res) => res.writeHead(301, { location: `http://${OTHER}:${port}/ok` }).end());
    handlers.set("/to-private", (res) => res.writeHead(307, { location: `http://${PRIVATE}:${port}/ok` }).end());
    handlers.set("/to-metadata", (res) =>
      res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }).end(),
    );
    handlers.set("/to-file", (res) => res.writeHead(302, { location: "file:///etc/passwd" }).end());
    handlers.set("/big-declared", (res) =>
      res.writeHead(200, { "content-type": "text/plain", "content-length": String(2 * 1024 * 1024) }).end(),
    );
    handlers.set("/big-chunked", (res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      const chunk = "x".repeat(64 * 1024);
      for (let i = 0; i < 20; i++) {
        res.write(chunk);
      }
      res.end();
    });
    handlers.set("/hang", () => {
      // Không trả lời.
    });
    handlers.set("/missing", (res) => res.writeHead(404, { "content-type": "text/html" }).end("không có"));
    handlers.set("/binary", (res) => res.writeHead(200, { "content-type": "application/octet-stream" }).end("x"));
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("thành công: trích văn bản HTML, hash nội dung, finalUrl", async () => {
    const result = await safeFetch(`${base()}/ok`, options());
    expect(result.log.error).toBeUndefined();
    expect(result.log.status).toBe(200);
    expect(result.log.finalUrl).toBe(`${base()}/ok`);
    expect(result.title).toBe("Redis & cache");
    expect(result.text).toContain("Lưu dữ liệu trong RAM.");
    expect(result.text).not.toContain("alert");
    expect(result.log.contentHash).toMatch(/^[a-f0-9]{64}$/);

    const plain = await safeFetch(`${base()}/plain`, options());
    expect(plain.text).toBe("văn bản");
    expect(plain.log.contentHash).toBe(createHash("sha256").update("  văn bản  ").digest("hex"));
  });

  it("3 redirect cùng host thì được, 4 thì từ chối", async () => {
    const three = await safeFetch(`${base()}/r2`, options());
    expect(three.log.error).toBeUndefined();
    expect(three.log.finalUrl).toBe(`${base()}/ok`);
    const four = await safeFetch(`${base()}/r1`, options());
    expect(four.log.error).toBe("too_many_redirects");
  });

  it("redirect ra host ngoài allowlist, về IP private, về metadata, về file: bị từ chối", async () => {
    expect((await safeFetch(`${base()}/to-other`, options())).log).toMatchObject({
      error: "host_not_allowed",
      finalUrl: `http://${OTHER}:${port}/ok`,
    });
    expect((await safeFetch(`${base()}/to-private`, options())).log.error).toBe("address_blocked");
    expect(
      (
        await safeFetch(`${base()}/to-metadata`, options({ allowedHosts: new Set([SITE, "169.254.169.254"]) }))
      ).log.error,
    ).toBe("address_blocked");
    expect((await safeFetch(`${base()}/to-file`, options())).log.error).toBe("protocol_not_allowed");
  });

  it("vượt 1 MB theo content-length hoặc khi đang đọc bị dừng", async () => {
    expect((await safeFetch(`${base()}/big-declared`, options())).log.error).toBe("too_large");
    expect((await safeFetch(`${base()}/big-chunked`, options())).log.error).toBe("too_large");
  });

  it("hết thời gian thì ghi timeout", async () => {
    const result = await safeFetch(`${base()}/hang`, options({ timeoutMs: 150 }));
    expect(result.log).toMatchObject({ error: "timeout", contentHash: null });
  });

  it("HTTP lỗi và content-type lạ không có hash", async () => {
    expect((await safeFetch(`${base()}/missing`, options())).log).toMatchObject({
      error: "http_error",
      status: 404,
      contentHash: null,
    });
    expect((await safeFetch(`${base()}/binary`, options())).log.error).toBe("unsupported_content_type");
  });
});

describe("htmlToText", () => {
  it("bỏ thẻ, comment, script và giải mã entity cơ bản", () => {
    expect(htmlToText("<p>a&lt;b</p><!-- x --><script>y</script><p>c&#39;d</p>")).toEqual({ text: "a<b\nc'd" });
  });
});
