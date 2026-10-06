import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { createDatabase, type Product } from "./database";

const db = createDatabase();
const app = express();
const port = Number(process.env.API_PORT ?? 4000);
const allowedOrigins = (process.env.WEB_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS"));
    },
  })
);
app.use(express.json({ limit: "16kb" }));

const inquiryInput = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().trim().email().max(254),
  destinationCountry: z.string().trim().min(2).max(80),
  productId: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().positive().max(1_000_000),
});

app.get("/health", (_request, response) => {
  db.prepare("SELECT 1").get();
  response.json({ status: "ok" });
});

app.get("/api/v1/products", (_request, response) => {
  const products = db
    .prepare(
      "SELECT id, name, category, origin, unit FROM products WHERE active = 1 ORDER BY name"
    )
    .all() as Product[];
  response.setHeader("Cache-Control", "no-store");
  response.json({ data: products });
});

app.post("/api/v1/inquiries", (request, response) => {
  const parsed = inquiryInput.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      error: "invalid_request",
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const product = db
    .prepare("SELECT id FROM products WHERE id = ? AND active = 1")
    .get(parsed.data.productId);
  if (!product) return response.status(404).json({ error: "product_not_found" });

  const trackingCode = randomBytes(12).toString("hex").toUpperCase();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO inquiries
      (id, tracking_code, customer_name, customer_email, destination_country, product_id, quantity, unit, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)`
  ).run(
    randomUUID(),
    trackingCode,
    parsed.data.customerName,
    parsed.data.customerEmail,
    parsed.data.destinationCountry,
    parsed.data.productId,
    parsed.data.quantity,
    "kg",
    createdAt
  );

  response.setHeader("Cache-Control", "no-store");
  return response.status(201).json({ trackingCode, status: "received", createdAt });
});

app.get("/api/v1/inquiries/:trackingCode", (request, response) => {
  const trackingCode = String(request.params.trackingCode ?? "").trim().toUpperCase();
  if (!/^[A-F0-9]{24}$/.test(trackingCode)) {
    return response.status(400).json({ error: "invalid_tracking_code" });
  }

  const inquiry = db
    .prepare(
      `SELECT i.status, i.created_at AS createdAt, p.name AS productName
       FROM inquiries i JOIN products p ON p.id = i.product_id
       WHERE i.tracking_code = ?`
    )
    .get(trackingCode) as
    | { status: string; createdAt: string; productName: string }
    | undefined;

  response.setHeader("Cache-Control", "no-store");
  if (!inquiry) return response.status(404).json({ error: "inquiry_not_found" });
  return response.json({ data: inquiry });
});

if (process.env.NODE_ENV === "production") {
  const webBuild = path.resolve("dist");
  app.use(express.static(webBuild));
  app.get(/^(?!\/api\/).*/, (_request, response, next) => {
    response.sendFile(path.join(webBuild, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error("API request failed:", error);
  response.status(500).json({ error: "internal_server_error" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Shared export-client API listening on http://0.0.0.0:${port}`);
});
