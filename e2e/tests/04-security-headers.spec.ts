/**
 * Security headers test — valida que middleware aplica os headers
 * obrigatórios em rotas críticas.
 *
 * Cobre: CSP (report-only nos apps user-facing, enforce no admin),
 * HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
 */
import { test, expect } from "@playwright/test";

const WEB_URLS = [
  "http://localhost:3000/login",
  "http://localhost:3000/app", // redirect, mas headers vêm
];
const PATIENT_URLS = ["http://localhost:3002/login"];
const ADMIN_URLS = ["http://localhost:3003/login"];

const REQUIRED_HEADERS = [
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

test.describe("Security headers — web", () => {
  for (const url of WEB_URLS) {
    test(`${url} tem headers obrigatórios`, async ({ request }) => {
      const resp = await request.get(url, { maxRedirects: 0 });
      // Aceita 2xx ou 3xx (redirects)
      expect(resp.status()).toBeLessThan(500);
      const headers = resp.headers();
      for (const h of REQUIRED_HEADERS) {
        expect(headers[h], `header ${h} missing in ${url}`).toBeTruthy();
      }
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["strict-transport-security"]).toContain("max-age");
      // CSP report-only nos apps user-facing (não enforce ainda)
      expect(
        headers["content-security-policy-report-only"] ??
          headers["content-security-policy"],
      ).toBeTruthy();
    });
  }
});

test.describe("Security headers — patient", () => {
  for (const url of PATIENT_URLS) {
    test(`${url} tem headers obrigatórios`, async ({ request }) => {
      const resp = await request.get(url, { maxRedirects: 0 });
      expect(resp.status()).toBeLessThan(500);
      const headers = resp.headers();
      for (const h of REQUIRED_HEADERS) {
        expect(headers[h], `header ${h} missing in ${url}`).toBeTruthy();
      }
      expect(headers["x-frame-options"]).toBe("DENY");
    });
  }
});

test.describe("Security headers — admin (CSP enforce)", () => {
  for (const url of ADMIN_URLS) {
    test(`${url} tem CSP enforce + X-Robots-Tag noindex`, async ({
      request,
    }) => {
      const resp = await request.get(url, { maxRedirects: 0 });
      expect(resp.status()).toBeLessThan(500);
      const headers = resp.headers();
      for (const h of REQUIRED_HEADERS) {
        expect(headers[h], `header ${h} missing in ${url}`).toBeTruthy();
      }
      // Admin: CSP é enforce (não report-only)
      expect(headers["content-security-policy"]).toBeTruthy();
      expect(headers["content-security-policy-report-only"]).toBeFalsy();
      // Admin: nunca indexar
      expect(headers["x-robots-tag"]).toContain("noindex");
      // Admin: referrer policy mais strict
      expect(headers["referrer-policy"]).toBe("no-referrer");
    });
  }
});
