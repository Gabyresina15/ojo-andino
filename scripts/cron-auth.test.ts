import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../src/app/api/cron/alertas/route";

const URL_CRON = "http://localhost/api/cron/alertas";

test("con CRON_SECRET, rechaza pedidos sin el token de Vercel Cron", async () => {
  process.env.CRON_SECRET = "s3creto";
  assert.equal((await GET(new Request(URL_CRON))).status, 401);
  assert.equal((await GET(new Request(URL_CRON, { headers: { authorization: "Bearer otro" } }))).status, 401);
});

test("con CRON_SECRET, acepta el token correcto", async () => {
  process.env.CRON_SECRET = "s3creto";
  const r = await GET(new Request(URL_CRON, { headers: { authorization: "Bearer s3creto" } }));
  assert.equal(r.status, 200);
});
