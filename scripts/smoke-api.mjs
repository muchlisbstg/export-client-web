import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempDir = mkdtempSync(path.join(os.tmpdir(), "export-client-peer-api-"));
const secret = "test-sync-secret-32-chars-minimum-123456";
const processes = [];

async function allocatePort() {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  assert(address && typeof address === "object");
  const port = address.port;
  probe.close();
  await once(probe, "close");
  return port;
}

function startNode({ nodeId, port, dbPath, peers = "", sharedSecret = "", rfqLimit = 20, trackLimit = 20 }) {
  let output = "";
  const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    cwd: root,
    env: {
      ...process.env,
      API_HOST: "127.0.0.1",
      API_PORT: String(port),
      DB_PATH: dbPath,
      NODE_ENV: "test",
      WEB_ORIGINS: "http://localhost:5173",
      RFQ_LIMIT_PER_15M: String(rfqLimit),
      TRACK_LOOKUP_LIMIT_PER_15M: String(trackLimit),
      SYNC_NODE_ID: nodeId,
      SYNC_SHARED_SECRET: sharedSecret,
      SYNC_PEERS: peers,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  const node = { child, port, dbPath, base: `http://127.0.0.1:${port}`, getOutput: () => output };
  processes.push(node);
  return node;
}

async function waitForHealth(node) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (node.child.exitCode !== null) throw new Error(`API node exited early:\n${node.getOutput()}`);
    try {
      const response = await fetch(`${node.base}/health`);
      if (response.ok) return response.json();
    } catch {
      // Wait for the API process to bind its port.
    }
    await delay(100);
  }
  throw new Error(`API node did not become ready:\n${node.getOutput()}`);
}

async function waitForTracking(node, code) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const response = await fetch(`${node.base}/api/v1/inquiries/${code}`);
    if (response.ok) return response.json();
    if (response.status !== 404) throw new Error(`Unexpected tracking response ${response.status}`);
    await delay(100);
  }
  throw new Error(`Inquiry ${code} did not replicate to ${node.base}`);
}

const portA = await allocatePort();
const portB = await allocatePort();
const portC = await allocatePort();
const nodeA = startNode({
  nodeId: "web-a",
  port: portA,
  dbPath: path.join(tempDir, "web-a.sqlite"),
  peers: `web-b=http://127.0.0.1:${portB}`,
  sharedSecret: secret,
  rfqLimit: 3,
  trackLimit: 3,
});
const nodeB = startNode({
  nodeId: "web-b",
  port: portB,
  dbPath: path.join(tempDir, "web-b.sqlite"),
  peers: `web-a=http://127.0.0.1:${portA}`,
  sharedSecret: secret,
});
const nodeC = startNode({
  nodeId: "web-disabled",
  port: portC,
  dbPath: path.join(tempDir, "web-disabled.sqlite"),
});

try {
  const [healthA, healthB, healthC] = await Promise.all([waitForHealth(nodeA), waitForHealth(nodeB), waitForHealth(nodeC)]);
  assert.equal(healthA.status, "ok");
  assert.equal(healthA.nodeId, "web-a");
  assert.equal(healthA.syncEnabled, true);
  assert.equal(healthB.syncEnabled, true);
  assert.equal(healthC.syncEnabled, false);

  const productsResponse = await fetch(`${nodeA.base}/api/v1/products`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()).data;
  assert.equal(products.length, 3);

  const invalidResponse = await fetch(`${nodeA.base}/api/v1/inquiries`, {
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
  const missingProductResponse = await fetch(`${nodeA.base}/api/v1/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...requestBody, productId: "missing-product" }),
  });
  assert.equal(missingProductResponse.status, 404);

  const createdResponse = await fetch(`${nodeA.base}/api/v1/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.match(created.trackingCode, /^[A-F0-9]{24}$/);

  const rateLimitedRfq = await fetch(`${nodeA.base}/api/v1/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  assert.equal(rateLimitedRfq.status, 429);

  const trackedAtOrigin = await fetch(`${nodeA.base}/api/v1/inquiries/${created.trackingCode}`);
  assert.equal(trackedAtOrigin.status, 200);
  const tracked = (await trackedAtOrigin.json()).data;
  assert.equal(tracked.status, "received");
  assert.equal(tracked.productName, products[0].name);
  assert.equal("customerName" in tracked, false);
  assert.equal("customerEmail" in tracked, false);

  const remoteTracking = await waitForTracking(nodeB, created.trackingCode);
  assert.equal(remoteTracking.data.productName, products[0].name);

  const noAuth = await fetch(`${nodeB.base}/api/v1/sync/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(noAuth.status, 401);

  const sourceDb = new Database(nodeA.dbPath, { readonly: true });
  const record = sourceDb.prepare(`
    SELECT id, tracking_code AS trackingCode, customer_name AS customerName,
      customer_email AS customerEmail, destination_country AS destinationCountry,
      product_id AS productId, quantity, unit, status, created_at AS createdAt,
      origin_node_id AS originNodeId FROM inquiries WHERE tracking_code = ?
  `).get(created.trackingCode);
  sourceDb.close();
  assert(record);

  const wrongUnitResponse = await fetch(`${nodeB.base}/api/v1/sync/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify({ ...record, id: "22222222-2222-4222-8222-222222222222", trackingCode: "B".repeat(24), unit: "piece" }),
  });
  assert.equal(wrongUnitResponse.status, 404);

  const duplicateResponse = await fetch(`${nodeB.base}/api/v1/sync/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify(record),
  });
  assert.equal(duplicateResponse.status, 200);
  assert.equal((await duplicateResponse.json()).result, "duplicate");

  const conflictResponse = await fetch(`${nodeB.base}/api/v1/sync/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify({ ...record, customerName: "Conflicting Name" }),
  });
  assert.equal(conflictResponse.status, 409);
  assert.equal((await conflictResponse.json()).error, "sync_conflict");

  const targetDb = new Database(nodeB.dbPath, { readonly: true });
  const storedName = targetDb.prepare("SELECT customer_name FROM inquiries WHERE id = ?").get(record.id).customer_name;
  const conflictCount = targetDb.prepare("SELECT COUNT(*) AS count FROM sync_conflicts WHERE inquiry_id = ?").get(record.id).count;
  targetDb.close();
  assert.equal(storedName, "Sample Client", "conflict must never overwrite the original record");
  assert.equal(conflictCount, 1);

  const invalidCodeResponse = await fetch(`${nodeA.base}/api/v1/inquiries/not-a-code`);
  assert.equal(invalidCodeResponse.status, 400);
  const missingRequestResponse = await fetch(`${nodeA.base}/api/v1/inquiries/${"F".repeat(24)}`);
  assert.equal(missingRequestResponse.status, 404);
  const rateLimitedLookup = await fetch(`${nodeA.base}/api/v1/inquiries/${created.trackingCode}`);
  assert.equal(rateLimitedLookup.status, 429);

  const disabledSync = await fetch(`${nodeC.base}/api/v1/sync/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(disabledSync.status, 503);

  console.log("API smoke tests passed: local API, validation, rate limits, peer replication, idempotency, conflict quarantine, no overwrite, sync auth, and sync-off default.");
} finally {
  for (const node of processes) {
    if (node.child.exitCode === null) {
      const exited = once(node.child, "exit").catch(() => undefined);
      node.child.kill("SIGTERM");
      await Promise.race([exited, delay(3_000)]);
      if (node.child.exitCode === null) node.child.kill("SIGKILL");
    }
  }
  rmSync(tempDir, { recursive: true, force: true });
}
