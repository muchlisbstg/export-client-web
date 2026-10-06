import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = mkdtempSync(path.join(os.tmpdir(), "export-client-api-"));
const dbPath = path.join(tempDir, "test.sqlite");
const portProbe = createServer();
portProbe.listen(0, "127.0.0.1");
await once(portProbe, "listening");
const address = portProbe.address();
assert(address && typeof address === "object");
const port = address.port;
portProbe.close();
await once(portProbe, "close");

let output = "";
const server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  cwd: root,
  env: {
    ...process.env,
    API_PORT: String(port),
    DB_PATH: dbPath,
    NODE_ENV: "test",
    WEB_ORIGINS: "http://localhost:5173",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`API exited early:\n${output}`);
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) { ready = true; break; }
    } catch {
      // Wait for the local API process to bind its port.
    }
    await delay(100);
  }
  assert(ready, `API did not become ready:\n${output}`);

  const productsResponse = await fetch(`${base}/api/v1/products`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()).data;
  assert.equal(products.length, 3);

  const invalidResponse = await fetch(`${base}/api/v1/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ customerName: "X" }),
  });
  assert.equal(invalidResponse.status, 400);

  const requestBody = {
    customerName: "Sample Client",
    customerEmail: "client@example.com",
    destinationCountry: "Japan",
    productId: products[0].id,
    quantity: 1000,
  };
  const createdResponse = await fetch(`${base}/api/v1/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.match(created.trackingCode, /^[A-F0-9]{24}$/);

  const trackedResponse = await fetch(`${base}/api/v1/inquiries/${created.trackingCode}`);
  assert.equal(trackedResponse.status, 200);
  const tracked = (await trackedResponse.json()).data;
  assert.equal(tracked.status, "received");
  assert.equal(tracked.productName, products[0].name);
  assert.equal("customerName" in tracked, false);
  assert.equal("customerEmail" in tracked, false);

  const invalidCodeResponse = await fetch(`${base}/api/v1/inquiries/not-a-code`);
  assert.equal(invalidCodeResponse.status, 400);
  const missingRequestResponse = await fetch(`${base}/api/v1/inquiries/${"F".repeat(24)}`);
  assert.equal(missingRequestResponse.status, 404);

  console.log("API smoke tests passed: health, catalog, validation, RFQ creation, cross-client tracking, and PII omission.");
} finally {
  if (server.exitCode === null) {
    const exited = once(server, "exit").catch(() => undefined);
    server.kill("SIGTERM");
    await Promise.race([exited, delay(3000)]);
    if (server.exitCode === null) server.kill("SIGKILL");
  }
  rmSync(tempDir, { recursive: true, force: true });
}
