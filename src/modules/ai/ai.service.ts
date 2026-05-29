import { desc } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { groqClient, GROQ_MODEL } from "../../config/groq";
import { db } from "../../config/db";
import { doctorsRepository } from "../doctors/doctors.repository";
import type { DoctorWithUser } from "../doctors/doctors.repository";
import { aiRecommendationLogs } from "./ai.schema";
import type { AiRecommendationLog } from "./ai.schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AIRecommendation {
  specialization: string;
  reason: string;
}

interface ParsedAIResponse {
  recommendations: AIRecommendation[];
}

export interface RecommendationResult {
  recommendations: Array<AIRecommendation & { doctors: DoctorWithUser[] }>;
}

// ---------------------------------------------------------------------------
// Prompt builder — injects the live specialization list from the DB
// ---------------------------------------------------------------------------
function buildRecommendationPrompt(symptoms: string, specializations: string[]): string {
  const specializationList = specializations.map((s) => `"${s}"`).join(", ");

  return `You are a medical triage assistant helping patients find the right doctor specialization.

Patient describes: "${symptoms}"

Available specializations: ${specializationList}

Respond ONLY with a JSON object (no markdown, no explanation) in this exact format:
{
  "recommendations": [
    {
      "specialization": "Cardiology",
      "reason": "Brief reason why this specialization fits the symptoms"
    }
  ]
}

Rules:
- Return 1 to 3 specializations maximum
- You MUST pick ONLY from the available specializations list above — exact match required
- Keep reasons under 20 words
- If symptoms are unclear, recommend the closest specialization from the list
- If no specialization closely fits, pick the closest one from the list
- Never provide diagnosis or medical advice
- Respond only with the JSON object, nothing else
`;
}

// ---------------------------------------------------------------------------
// Response parser — falls back to first available specialization
// ---------------------------------------------------------------------------
function parseAIResponse(text: string): ParsedAIResponse {
  const fallbackSpecialization = "General Practitioner";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as ParsedAIResponse;
  } catch {
    return {
      recommendations: [
        {
          specialization: fallbackSpecialization,
          reason: "Unable to parse symptoms — general practitioner recommended",
        },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
export const aiService = {
  async getRecommendations(symptoms: string, userId: string): Promise<RecommendationResult> {
    // 1. Fetch live specialization list from DB first
    const specializations = await doctorsRepository.getDistinctSpecializations();

    // 2. Build prompt with the specialization list injected
    const prompt = buildRecommendationPrompt(symptoms, specializations);

    // 3. Call Groq API (fall back gracefully if the API errors)
    let text: string;
    try {
      const completion = await groqClient.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: GROQ_MODEL,
        response_format: { type: "json_object" },
      });
      text = completion.choices[0].message.content ?? "";
    } catch (err) {
      console.error("[AI] Groq API error:", (err as Error).message);
      text = "";
    }

    // 4. Parse structured JSON from response
    const parsed = parseAIResponse(text);

    // 5. For each recommended specialization, fetch matching doctors (up to 3)
    const enriched = await Promise.all(
      parsed.recommendations.map(async (rec) => {
        const { items } = await doctorsRepository.findAll({
          specialization: rec.specialization,
          page: 1,
          limit: 3,
        });
        return { ...rec, doctors: items };
      }),
    );

    // 6. Log the completed recommendation (fire-and-forget — don't block the response)
    db.insert(aiRecommendationLogs)
      .values({
        userId,
        symptoms,
        recommendations: JSON.stringify(enriched),
      })
      .catch((err: unknown) => {
        console.error("[AI] Failed to log recommendation:", err);
      });

    return { recommendations: enriched };
  },

  async getHistory(userId: string): Promise<AiRecommendationLog[]> {
    return db
      .select()
      .from(aiRecommendationLogs)
      .where(eq(aiRecommendationLogs.userId, userId))
      .orderBy(desc(aiRecommendationLogs.createdAt))
      .limit(10);
  },
};
