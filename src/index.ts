import express from "express";
import cors from "cors";
import helmet from "helmet";
import { db } from "./config/db";
import { sql } from "drizzle-orm";
import { env } from "./config/env";
import { errorMiddleware } from "./shared/middleware/error.middleware";
import authRouter from "./modules/auth/auth.router";
import usersRouter from "./modules/users/users.controller";
import patientsRouter from "./modules/patients/patients.controller";
import doctorsRouter from "./modules/doctors/doctors.controller";
import appointmentsRouter from "./modules/appointments/appointments.controller";

const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/health/db", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "db connected" });
  } catch (err) {
    res.status(500).json({ status: "db error", error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/doctors", doctorsRouter);
app.use("/api/appointments", appointmentsRouter);

// ---------------------------------------------------------------------------
// Error handler — must be last
// ---------------------------------------------------------------------------
app.use(errorMiddleware);

app.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});

export default app;