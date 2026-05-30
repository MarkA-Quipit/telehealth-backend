import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { env } from "./env";
import * as schema from "../modules/index";

// Node.js <22 does not expose a global WebSocket; neon-serverless needs one.
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });

// The transaction object passed to db.transaction() is PgTransaction<...>, which
// is narrower than NeonHttpDatabase (it lacks $withAuth and batch).
// Extracting it from the callback signature avoids hardcoding the type parameters.
export type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0];