import { geminiModel } from "../../config/gemini";
import { doctorsRepository } from "../doctors/doctors.repository";
import type { DoctorWithUser } from "../doctors/doctors.repository";

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
// Prompt builder (exact template from docs)
// ---------------------------------------------------------------------------
function buildRecommendationPrompt(symptoms: string): string {
  return `You are a medical triage assistant helping patients find the right doctor specialization.

Patient describes: "${symptoms}"

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
- Specialization names must be standard medical specializations (e.g., "Cardiology", "Dermatology", "General Practice")
- Keep reasons under 20 words
- If symptoms are unclear, recommend "General Practice"
- Never provide diagnosis or medical advice
- Respond only with the JSON object, nothing else
`;
}

// ---------------------------------------------------------------------------
// Response parser — always falls back to General Practice on malformed JSON
// ---------------------------------------------------------------------------
function parseAIResponse(text: string): ParsedAIResponse {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as ParsedAIResponse;
  } catch {
    return {
      recommendations: [
        {
          specialization: "General Practice",
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
  async getRecommendations(symptoms: string): Promise<RecommendationResult> {
    // 1. Build prompt
    const prompt = buildRecommendationPrompt(symptoms);

    // 2. Call Gemini API (fall back to General Practice if the API errors)
    let text: string;
    try {
      const result = await geminiModel.generateContent(prompt);
      text = result.response.text();
    } catch {
      text = "";
    }

    // 3. Parse structured JSON from response
    const parsed = parseAIResponse(text);

    // 4. For each recommended specialization, fetch matching doctors (up to 3)
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

    return { recommendations: enriched };
  },
};
