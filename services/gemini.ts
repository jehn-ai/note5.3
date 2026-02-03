
import { GoogleGenAI, Type } from "@google/genai";
import { SummaryMode, Flashcard, QuizQuestion, ProveItQuestion, ProveItGrade } from "../types";
// @ts-ignore
import * as pdfjsLib from "pdfjs-dist";

// Set worker source for PDF.js
try {
  if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
  }
} catch (e) {
  console.warn("Failed to set PDF worker", e);
}

type NormalizedMode = "tldr" | "bullet" | "detailed";

function normalizeMode(mode: SummaryMode): NormalizedMode {
  const raw = String(mode ?? "").toLowerCase();
  const cleaned = raw.replace(/[^a-z]/g, "");
  if (cleaned.includes("tldr")) return "tldr";
  if (cleaned.includes("bullet")) return "bullet";
  if (cleaned.includes("detailed")) return "detailed";
  return "bullet";
}

function getSummaryControls(mode: SummaryMode) {
  const normalized = normalizeMode(mode);
  const commonRules = `
STRICT OUTPUT FORMAT RULES (must follow)
1. Output must be plain text only.
2. Do not use Markdown symbols or Markdown styling anywhere. Avoid: #, ##, ###, *, -, >, \`, _, **.
3. Do not use bullet points. Use numbering and lettered subpoints only.
4. Headings must be in ALL CAPS (no # symbols).
5. Use colons after labels (e.g., Definition:).
6. Use short, readable paragraphs.
7. No LaTeX, no equations, no math notation. Describe math concepts in plain text if necessary.
8. Do not wrap text in code blocks.
`.trim();

  if (normalized === "tldr") {
    return {
      thinkingBudget: 1024,
      maxOutputTokens: 2048,
      prompt: `Act as a senior academic tutor. Produce a TLDR summary.\n${commonRules}\n\nTLDR CONSTRAINTS:\n1. Length 120-180 words.\n2. Structure: 1 Paragraph, 5 Takeaways, 1 Conclusion.\n\nOUTPUT FORMAT:\nACADEMIC SUMMARY: [TOPIC]\n\nParagraph:\n[content]\n\nTakeaways:\n1.\n2.\n3.\n4.\n5.\n\nCONCLUSION:\n[content]`.trim(),
    };
  }

  if (normalized === "bullet") {
    return {
      thinkingBudget: 2048,
      maxOutputTokens: 4096,
      prompt: `Act as a senior academic tutor. Produce a concise BULLET MODE summary.\n${commonRules}\n\nBULLET MODE CONSTRAINTS:\n1. Prioritize clarity.\n2. Include key definitions, distinctions, examples.\n\nOUTPUT FORMAT:\nACADEMIC SUMMARY: [TOPIC]\n\n1. CORE IDEA:\n2. KEY DEFINITIONS:\n   a)\n   b)\n3. KEY DISTINCTIONS:\n   a)\n   b)\n4. IMPORTANT NUANCES:\n   a)\n5. APPLIED EXAMPLES:\n   1)\n\nCONCLUSION:\n[content]`.trim(),
    };
  }

  return {
    thinkingBudget: 4096,
    maxOutputTokens: 8192,
    prompt: `Act as a senior academic tutor. Produce a DETAILED academic summary.\n${commonRules}\n\nDETAILED MODE CONSTRAINTS:\n1. Preserve original meaning.\n2. Capture all MAJOR sections.\n3. Do not invent missing info.\n\nTEMPLATE:\nACADEMIC SUMMARY: [TOPIC]\n\n1. [SECTION TITLE]\nDefinition:\nUnderlying logic:\nKey elements:\n\n[Continue for major sections]\n\nCOMPARATIVE ANALYSIS\nKey differences:\na)\nb)\n\nAPPLIED EXAMPLES\n\nSTRATEGIC SYNTHESIS\nConclusion:`.trim(),
  };
}

export class GeminiService {
  private static get ai() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * client-side PDF extraction to avoid huge XHR payloads
   */
  private static async extractPdfText(base64: string): Promise<string> {
    try {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
      let fullText = '';
      
      // Limit to first 40 pages to ensure speed and stay within context safely
      const maxPages = Math.min(doc.numPages, 40);
      
      for (let i = 1; i <= maxPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map((item: any) => item.str);
        fullText += `--- Page ${i} ---\n` + strings.join(' ') + '\n\n';
      }
      return fullText;
    } catch (e) {
      console.warn("PDF extraction failed, falling back to raw image analysis", e);
      return "";
    }
  }

  static async generateSummary(
    fileBase64: string,
    mimeType: string,
    mode: SummaryMode
  ): Promise<string> {
    // 1. Try text extraction for PDFs
    let textContext = "";
    if (mimeType === "application/pdf") {
      textContext = await this.extractPdfText(fileBase64);
    }

    const { prompt, thinkingBudget, maxOutputTokens } = getSummaryControls(mode);
    const model = "gemini-3-flash-preview"; // Use Flash for speed and stability with text

    try {
      const parts = textContext 
        ? [{ text: `${prompt}\n\nDOCUMENT CONTENT:\n${textContext}` }]
        : [{ text: prompt }, { inlineData: { data: fileBase64, mimeType } }];

      const response = await this.ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          temperature: 0.2,
          maxOutputTokens,
          thinkingConfig: { thinkingBudget },
        },
      });

      return response.text || "No summary generated.";
    } catch (error) {
      console.error("Gemini summary error:", error);
      throw new Error("Failed to generate summary. The file might be too large or complex.");
    }
  }

  static async generateFlashcards(summaryText: string): Promise<Flashcard[]> {
    const model = "gemini-3-flash-preview";
    const prompt = `
Return valid JSON only. No extra text.
Task: Generate exactly 10 high-impact flashcards based ONLY on the summary provided.
Rules:
1) Each flashcard must support ACTIVE RECALL.
2) Populate 'source' field with the specific Section Title/Header.
3) Keep answers 1-3 sentences.

Schema: Array of { "question": string, "answer": string, "source": string }

SUMMARY:
${summaryText}
`.trim();

    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: [{ text: prompt }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING },
                source: { type: Type.STRING },
              },
              required: ["question", "answer"],
            },
          },
        },
      });
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Gemini flashcards error:", error);
      return [];
    }
  }

  static async generateFlashcardsFromDocument(
    fileBase64: string, 
    mimeType: string, 
    config: { targetCards: number; difficulty: string }
  ): Promise<Flashcard[]> {
    // 1. Try text extraction for PDFs to avoid XHR size limits
    let textContext = "";
    if (mimeType === "application/pdf") {
      textContext = await this.extractPdfText(fileBase64);
    }

    // Use Flash if we have text (faster), Pro if we rely on visual/multimodal
    const model = textContext ? "gemini-3-flash-preview" : "gemini-3-pro-preview";
    
    const prompt = `
      Analyze this document content and generate exactly ${config.targetCards} flashcards.
      Difficulty Level: ${config.difficulty}.
      
      Rules:
      1. Extract key concepts directly from the content.
      2. 'source' field MUST be "Page X" or Section Header.
      3. Questions must be challenging.
      
      Output JSON format: Array of { "question": string, "answer": string, "source": string }.
    `;
  
    try {
      const parts = textContext 
        ? [{ text: `${prompt}\n\nDOCUMENT TEXT:\n${textContext}` }]
        : [{ text: prompt }, { inlineData: { data: fileBase64, mimeType } }];

      const response = await this.ai.models.generateContent({
        model,
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  source: { type: Type.STRING },
                },
                required: ["question", "answer", "source"],
              },
            },
        }
      });
      
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Direct Flashcard Gen Error", error);
      // Fallback to simpler summary generation if direct analysis fails
      try {
        const fallbackSummary = await this.generateSummary(fileBase64, mimeType, 'TLDR' as any);
        return await this.generateFlashcards(fallbackSummary);
      } catch (innerErr) {
        return [];
      }
    }
  }

  static async generateQuiz(summaryText: string): Promise<QuizQuestion[]> {
    const model = "gemini-3-flash-preview";
    const prompt = `
Return valid JSON only.
Task: Create 5 multiple-choice questions based on the summary.
Schema: Array of { question, options (4 strings), correctAnswer (string), explanation }
SUMMARY:
${summaryText}
`.trim();

    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: [{ text: prompt }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "correctAnswer", "explanation"]
            }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Gemini quiz error:", error);
      return [];
    }
  }

  // Retry helper for handling transient errors
  private static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable (503, 429, or network errors)
        const isRetryable = 
          error?.message?.includes('503') ||
          error?.message?.includes('429') ||
          error?.message?.includes('RESOURCE_EXHAUSTED') ||
          error?.message?.includes('UNAVAILABLE') ||
          error?.message?.includes('overloaded');
        
        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[Retry ${attempt + 1}/${maxRetries}] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  // Prove It Feature Methods
  static async generateProveItQuestions(cards: { id: string; front: string; back: string }[]): Promise<ProveItQuestion[]> {
    const model = "gemini-3-flash-preview";
    const prompt = buildProveItPrompt(3);

    const payload = {
      flashcards: cards.map(c => ({ id: c.id, front: c.front, back: c.back }))
    };

    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: [{ text: prompt + "\n\nFLASHCARDS_JSON:\n" + JSON.stringify(payload) }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING },
                question: { type: Type.STRING },
                answerKey: { type: Type.STRING },
                sourceCardIds: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["id", "type", "question", "answerKey", "sourceCardIds"]
            }
          }
        }
      });

      const raw = response.text || "[]";
      const parsed = JSON.parse(raw);

      // Basic cleanup
      return Array.isArray(parsed)
        ? parsed
            .map((q: any): ProveItQuestion => ({
              id: String(q.id || "").trim(),
              type: q.type === "scenario" ? "scenario" : "short",
              question: String(q.question || "").trim(),
              answerKey: String(q.answerKey || "").trim(),
              sourceCardIds: Array.isArray(q.sourceCardIds) ? q.sourceCardIds.map(String) : []
            }))
            .filter(q => q.id && q.question && q.answerKey && q.sourceCardIds.length)
            .slice(0, 3)
        : [];
    } catch (error) {
      console.error("Prove It question generation error:", error);
      return [];
    }
  }

  static async gradeProveIt(questions: ProveItQuestion[], studentAnswers: Record<string, string>): Promise<ProveItGrade> {
    const model = "gemini-3-flash-preview";
    const prompt = GRADE_PROVEIT_PROMPT;

    const payload = { questions, studentAnswers };

    try {
      return await this.retryWithBackoff(async () => {
        const response = await this.ai.models.generateContent({
          model,
          contents: [{ text: prompt + "\n\nPAYLOAD_JSON:\n" + JSON.stringify(payload) }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                totalScore: { type: Type.NUMBER },
                maxScore: { type: Type.NUMBER },
                results: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      correct: { type: Type.BOOLEAN },
                      score: { type: Type.NUMBER },
                      feedback: { type: Type.STRING },
                      firstMissingIdea: { type: Type.STRING },
                      followUpQuestion: { type: Type.STRING }
                    },
                    required: ["id", "correct", "score", "feedback", "firstMissingIdea"]
                  }
                }
              },
              required: ["totalScore", "maxScore", "results"]
            }
          }
        });

        const raw = response.text || "{}";
        const parsed = JSON.parse(raw);

        return {
          totalScore: Number(parsed.totalScore ?? 0),
          maxScore: Number(parsed.maxScore ?? questions.length),
          results: Array.isArray(parsed.results) ? parsed.results : []
        };
      });
    } catch (error) {
      console.error("Prove It grading error:", error);
      throw error; // Re-throw to let UI handle it
    }
  }
}

// Helper functions for Prove It
function buildProveItPrompt(target: number): string {
  return `
You are a strict study coach.

Create a "Prove It" mini review of EXACTLY ${target} questions from the provided flashcards.

Rules:
- Use ONLY the flashcards provided as the knowledge source.
- Q1 and Q2 must be short-answer (1–2 sentences expected).
- Q3 must be a scenario/application question.
- Provide an answerKey for each question using only the flashcard backs.
- Each question must include sourceCardIds referencing the flashcards used.
- Output ONLY valid JSON (no markdown, no commentary).

JSON schema:
[
  {
    "id": "q1",
    "type": "short",
    "question": "string",
    "answerKey": "string",
    "sourceCardIds": ["string"]
  }
]
`.trim();
}

const GRADE_PROVEIT_PROMPT = `
You are an examiner. Grade the student's answers using ONLY the answer keys provided.

Rules:
- Be strict but fair.
- Accept paraphrases if meaning is preserved.
- For each question return: correct (boolean), score (0..1), feedback (1–2 sentences),
  firstMissingIdea (short phrase).
- If incorrect, generate exactly ONE followUpQuestion targeting firstMissingIdea.
- If correct, followUpQuestion must be null.
- Output ONLY valid JSON.

JSON schema:
{
  "totalScore": number,
  "maxScore": number,
  "results": [
    {
      "id": "q1",
      "correct": boolean,
      "score": number,
      "feedback": string,
      "firstMissingIdea": string,
      "followUpQuestion": string | null
    }
  ]
}
`.trim();
