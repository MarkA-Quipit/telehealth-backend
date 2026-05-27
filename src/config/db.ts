import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { env } from "./env";
import * as schema from "../modules/index";

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });

// The transaction object passed to db.transaction() is PgTransaction<...>, which
// is narrower than NeonHttpDatabase (it lacks $withAuth and batch).
// Extracting it from the callback signature avoids hardcoding the type parameters.
export type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0];