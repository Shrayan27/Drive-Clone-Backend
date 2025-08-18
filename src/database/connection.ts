import { Pool, PoolConfig } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "drive_clone",
  user: process.env.DB_USER || "username",
  password: process.env.DB_PASSWORD || "password",
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
};

// Create a new pool instance
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Test the connection
pool.on("connect", () => {
  console.log("Connected to PostgreSQL database");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Received SIGINT, closing database pool...");
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, closing database pool...");
  await pool.end();
  process.exit(0);
});

export default pool;
