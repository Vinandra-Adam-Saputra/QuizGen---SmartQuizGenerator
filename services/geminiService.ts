import { GoogleGenAI, Type } from "@google/genai";
import type { Quiz, QuestionType } from "../types";

const quizSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    passage: { type: Type.STRING },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: ["multiple-choice", "fill-in-the-blank", "essay"],
          },
          question_text: { type: Type.STRING },
          image_description: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correct_answer: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ["type", "question_text", "correct_answer", "explanation"],
      },
    },
  },
  required: ["title", "questions"],
};

/* -------------------- Inisialisasi client Gemini -------------------- */
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("VITE_GEMINI_API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

/* -------------------- Generate Quiz (text) -------------------- */
export const generateQuiz = async (
  quizTitle: string,
  classLevel: string,
  topic: string,
  questionCount: number,
  questionType: QuestionType | "mixed",
  description?: string
): Promise<Omit<Quiz, "id">> => {
  const extraInstruction = description
    ? `\nTeacher additional instruction: "${description}". Make sure all questions follow this direction.`
    : "";

  const prompt = `Generate a ${questionCount}-question quiz in English for an Indonesian student in ${classLevel}.
Topic: "${topic}"
Title: "${quizTitle}"
Desired question type: "${questionType}" (if 'mixed' use variety).${extraInstruction}

CRITICAL:
- All question text & answer options MUST be in English.
- Provide bilingual explanations (English + Bahasa Indonesia).
- For visual questions (e.g. prepositions of place), include an 'image_description' describing the picture to use (simple, clear description for image generation).
- For passage-based topics include a 'passage' field.
Return only a valid JSON object that matches the schema (no extra text).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: quizSchema,
        temperature: 0.8,
      },
    });

    const jsonText = (response as any).text?.trim?.() ?? null;
    if (!jsonText) {
      // fallback: try candidates content
      const candText =
        (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      if (!candText) {
        console.error("No JSON text found in Gemini response:", response);
        throw new Error("No JSON text returned from Gemini.");
      }
      // use candidate text
      const parsed = JSON.parse(candText);
      if (!parsed || !parsed.title || !Array.isArray(parsed.questions)) {
        throw new Error("Invalid quiz structure received from Gemini (candidate path).");
      }
      return parsed as Omit<Quiz, "id">;
    }

    const quizData = JSON.parse(jsonText);
    if (!quizData || !quizData.title || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      throw new Error("Invalid quiz structure received from Gemini API.");
    }

    return quizData as Omit<Quiz, "id">;
  } catch (err) {
    console.error("Error generating quiz with Gemini API:", err);
    throw new Error("Failed to generate quiz. See console for details.");
  }
};

/* -------------------- Generate Image for a Question --------------------
   UPDATED: Menggunakan Pollinations.ai API (gratis, no API key needed)
   atau Unsplash API sebagai alternatif.
   Returns a URL to the generated image or empty string on failure.
*/
export const generateQuestionImage = async (description: string): Promise<string> => {
  if (!description) return "";

  try {
    // METHOD 1: Pollinations.ai (Text-to-Image, gratis, no API key)
    // https://image.pollinations.ai/prompt/{description}
    const cleanDescription = encodeURIComponent(
      description.replace(/[^\w\s,.-]/g, "").trim()
    );
    
    // Tambahkan style untuk educational illustrations
    const enhancedPrompt = `${cleanDescription}, simple flat illustration, educational style, clear and colorful, for children`;
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=800&height=600&nologo=true`;
    
    // Test if image loads
    const testImage = new Image();
    
    return new Promise((resolve) => {
      testImage.onload = () => {
        console.log("✅ Image generated successfully:", imageUrl);
        resolve(imageUrl);
      };
      
      testImage.onerror = () => {
        console.warn("⚠️ Failed to generate image, using placeholder");
        resolve(generatePlaceholderImage(description));
      };
      
      // Set timeout 50 detik
      setTimeout(() => {
        console.warn("⏱️ Image generation timeout, using placeholder");
        resolve(generatePlaceholderImage(description));
      }, 50000);
      
      testImage.src = imageUrl;
    });

  } catch (err) {
    console.error("Error generating image:", err);
    return generatePlaceholderImage(description);
  }
};

/* -------------------- Generate Placeholder Image --------------------
   Membuat SVG placeholder dengan deskripsi gambar
*/
const generatePlaceholderImage = (description: string): string => {
  // Create simple SVG with text
  const svg = `
    <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="600" fill="#f0f4f8"/>
      <rect x="50" y="50" width="700" height="500" fill="white" stroke="#cbd5e0" stroke-width="2" rx="8"/>
      
      <!-- Icon -->
      <circle cx="400" cy="250" r="60" fill="#e2e8f0"/>
      <path d="M 400 220 L 400 260 M 380 240 L 420 240" stroke="#64748b" stroke-width="8" stroke-linecap="round"/>
      
      <!-- Text -->
      <text x="400" y="350" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#475569" font-weight="600">
        Image Description:
      </text>
      <foreignObject x="100" y="370" width="600" height="150">
        <div xmlns="http://www.w3.org/1999/xhtml" style="
          font-family: Arial, sans-serif;
          font-size: 16px;
          color: #64748b;
          text-align: center;
          padding: 10px;
          line-height: 1.5;
        ">
          ${description.length > 150 ? description.substring(0, 150) + '...' : description}
        </div>
      </foreignObject>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/* -------------------- ALTERNATIVE: Unsplash API --------------------
   Jika ingin menggunakan foto real dari Unsplash (perlu API key gratis)
   Uncomment fungsi ini dan ganti di generateQuestionImage
*/
/*
export const generateQuestionImageUnsplash = async (description: string): Promise<string> => {
  if (!description) return "";
  
  const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  if (!UNSPLASH_ACCESS_KEY) {
    console.warn("Unsplash API key not set, using placeholder");
    return generatePlaceholderImage(description);
  }

  try {
    // Extract keywords from description
    const keywords = description
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(" ")
      .slice(0, 3)
      .join(",");

    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${keywords}&orientation=landscape`,
      {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      }
    );

    if (!response.ok) throw new Error("Unsplash API error");

    const data = await response.json();
    return data.urls?.regular || generatePlaceholderImage(description);
  } catch (err) {
    console.error("Error fetching from Unsplash:", err);
    return generatePlaceholderImage(description);
  }
};
*/