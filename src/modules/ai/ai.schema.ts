import { z } from "zod/v4";

export const recommendDoctorSchema = z.object({
  symptoms: z.string().min(10).max(1000),
});

export type RecommendDoctorInput = z.infer<typeof recommendDoctorSchema>;
