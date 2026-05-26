import express from "express";
import cors from "cors";
import helmet from "helmet";
import { db } from "./config/db";
import { sql } from "drizzle-orm";
import { env } from "./config/env";
import { errorMiddleware } from "./shared/middleware/error.middleware";
import authRouter from "./modules/auth/auth.router";

const app = express();
const PORT = env.PORT;

// Global Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/db', async (req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: 'db connected' });
  } catch (err) {
    res.status(500).json({ status: 'db error', error: String(err) });
  }
});

app.use("/api/auth", authRouter);
 
// Error handler — must be last
app.use(errorMiddleware);
 
app.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});


export default app;
