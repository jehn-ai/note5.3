
import { GoogleGenAI, Type } from "@google/genai";
import { SummaryMode, Flashcard, QuizQuestion } from "../types";
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
}
