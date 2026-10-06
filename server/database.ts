import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type Product = {
  id: string;
  name: string;
  category: string;
  origin: string;
  unit: string;
};

export type InquiryRecord = {
  id: string;
  trackingCode: string;
  customerName: string;
  customerEmail: string;
  destinationCountry: string;
  productId: string;
  quantity: number;
  unit: string;
  status: "received";
  createdAt: string;
  originNodeId: string;
};

export function createDatabase(filePath = process.env.DB_PATH ?? path.resolve("data/export-client.sqlite")): Database.Database {
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });

  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      origin TEXT NOT NULL,
      unit TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      tracking_code TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      destination_country TEXT NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id),
      quantity REAL NOT NULL CHECK (quantity > 0),
      unit TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received' CHECK (status = 'received'),
      created_at TEXT NOT NULL,
      origin_node_id TEXT NOT NULL DEFAULT 'legacy'
    );

    CREATE TABLE IF NOT EXISTS sync_outbox (
      inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
      peer_node_id TEXT NOT NULL,
      peer_url TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at_ms INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      PRIMARY KEY (inquiry_id, peer_node_id)
    );

    CREATE TABLE IF NOT EXISTS sync_conflicts (
      conflict_id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id TEXT NOT NULL,
      peer_node_id TEXT NOT NULL,
      existing_hash TEXT NOT NULL,
      incoming_hash TEXT NOT NULL,
      reason TEXT NOT NULL,
      detected_at TEXT NOT NULL
    );
  `);

  // Migrate databases created before peer synchronization was introduced.
  const inquiryColumns = db.prepare("PRAGMA table_info(inquiries)").all() as Array<{ name: string }>;
  if (!inquiryColumns.some((column) => column.name === "origin_node_id")) {
    db.exec("ALTER TABLE inquiries ADD COLUMN origin_node_id TEXT NOT NULL DEFAULT 'legacy'");
  }

  const count = db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare(
      "INSERT INTO products (id, name, category, origin, unit) VALUES (?, ?, ?, ?, ?)"
    );
    const seed = db.transaction(() => {
      insert.run("green-coffee", "Kopi Arabika hijau", "Kopi", "Indonesia", "kg");
      insert.run("dried-spices", "Rempah kering pilihan", "Rempah", "Indonesia", "kg");
      insert.run("cocoa-beans", "Biji kakao fermentasi", "Kakao", "Indonesia", "kg");
    });
    seed();
  }

  return db;
}
