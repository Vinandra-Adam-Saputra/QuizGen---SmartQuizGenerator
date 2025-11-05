import { GoogleGenAI, Type } from "@google/genai";
import type { Quiz, QuestionType } from "../types";

// Updated schema to support multiple passages
const quizSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    passage: { type: Type.STRING }, // Legacy single passage
    passages: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    }, // NEW: Support multiple passages
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
          passage_index: { type: Type.NUMBER }, // NEW: Link question to passage
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
  // DEBUG: Check if description is received
  console.log('📝 Description received in geminiService:', description);
  console.log('📝 Description length:', description?.length || 0);
  
  // Build stronger prompt with description emphasis
  let instructionBlock = "";
  
  if (description && description.trim()) {
    console.log('✅ Description is valid, adding to prompt');
    instructionBlock = `
TEACHER'S SPECIFIC INSTRUCTIONS (HIGHEST PRIORITY - MUST FOLLOW EXACTLY):
"${description}"

IMPORTANT: The teacher's instructions above are MANDATORY. You MUST follow them precisely, even if they contradict general guidelines. If the teacher asks for multiple passages, create multiple passages. If they ask for specific question formats, use those formats. If they ask to exclude certain topics, DO NOT include them.
`;
  } else {
    console.log('⚠️ No description provided or empty');
  }

  // Detect if topic needs passages
  const topicNeedsPassage = [
    'narrative', 'descriptive', 'recount', 'report', 'exposition', 
    'news item', 'reading comprehension', 'text'
  ].some(keyword => topic.toLowerCase().includes(keyword));

  // Build passage instruction
  let passageInstruction = '';
  if (topicNeedsPassage) {
    if (description && /multiple|several|[0-9]+\s*(passage|text)/i.test(description)) {
      // User explicitly wants multiple passages
      passageInstruction = `
PASSAGE STRUCTURE (CRITICAL):
- Create MULTIPLE separate passages as requested in teacher's instructions
- Use the "passages" array field (NOT single "passage" field)
- Each passage should be 100-200 words
- Link each question to its passage using "passage_index" (0-based)
- Clearly separate passages by topic/story
- Example structure:
  {
    "passages": ["First passage text...", "Second passage text..."],
    "questions": [
      {"passage_index": 0, "question_text": "About first passage..."},
      {"passage_index": 1, "question_text": "About second passage..."}
    ]
  }
`;
    } else {
      // Default single passage
      passageInstruction = `
PASSAGE STRUCTURE:
- Include ONE comprehensive reading passage (150-250 words)
- Use the "passage" field
- All questions should be based on this passage
`;
    }
  }

  // Detect if description requests images
  const requestsImages = description && /image|picture|visual|illustration|photo|diagram/i.test(description);

  const prompt = `Generate a ${questionCount}-question quiz in English for an Indonesian student in ${classLevel}.

QUIZ DETAILS:
- Topic: "${topic}"
- Title: "${quizTitle}"
- Question Type: "${questionType}" ${questionType === 'mixed' ? '(use variety of types)' : ''}
- Number of Questions: ${questionCount}

${instructionBlock}

${passageInstruction}

GENERAL REQUIREMENTS:
- All question text & answer options MUST be in English
- Provide bilingual explanations: English first, then Indonesian translation
  Example: "The answer is 'on' because it shows position on a surface. (Jawabannya 'on' karena menunjukkan posisi di atas permukaan.)"

IMAGE GENERATION:
${requestsImages ? `
- The teacher has requested images/visuals in their instructions
- For questions that would benefit from images, include 'image_description' field
- Describe the image clearly and simply for AI image generation
- Example: "image_description": "A tiger in the jungle" or "A red apple on a table"
- Create image descriptions that help students answer the question visually
` : `
- Include 'image_description' ONLY if the question naturally requires visual support
- Common visual topics: prepositions of place, animals, colors, shapes, objects
- Example: "image_description": "A cat under a table" for preposition questions
`}

- Question difficulty should match ${classLevel}
- Ensure questions test understanding, not just memorization

QUESTION TYPE GUIDELINES:
- multiple-choice: Provide 4 options, one correct answer
- fill-in-the-blank: Use "___" in question_text, provide single word/phrase answer
- essay: Open-ended question, provide model answer and rubric in explanation

OUTPUT FORMAT:
Return ONLY a valid JSON object matching the schema. No markdown, no extra text.

${description && description.trim() ? `\nREMINDER: Follow the teacher's specific instructions above EXACTLY as written. ${requestsImages ? 'The teacher wants images - make sure to include image_description fields where appropriate.' : ''}` : ''}`;

  // DEBUG: Log the full prompt
  console.log('🤖 Full prompt sent to Gemini AI:');
  console.log('='.repeat(80));
  console.log(prompt);
  console.log('='.repeat(80));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: quizSchema,
        temperature: 0.7, // Slightly lower for more consistent following of instructions
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
      return normalizeQuizData(parsed);
    }

    const quizData = JSON.parse(jsonText);
    if (!quizData || !quizData.title || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      throw new Error("Invalid quiz structure received from Gemini API.");
    }

    return normalizeQuizData(quizData);
  } catch (err) {
    console.error("Error generating quiz with Gemini API:", err);
    throw new Error("Failed to generate quiz. See console for details.");
  }
};

/* -------------------- Normalize Quiz Data --------------------
   Handle both single passage and multiple passages format
*/
function normalizeQuizData(quizData: any): Omit<Quiz, "id"> {
  // If AI used new "passages" array format, convert for compatibility
  if (quizData.passages && Array.isArray(quizData.passages) && quizData.passages.length > 0) {
    // Keep passages array for multi-passage support
    // But also set first passage as legacy "passage" field for backward compatibility
    quizData.passage = quizData.passages[0];
  }
  
  return quizData as Omit<Quiz, "id">;
}

/* -------------------- Generate Image for a Question --------------------
   UPDATED: Menggunakan Pollinations.ai API (gratis, no API key needed)
   Returns a URL to the generated image or empty string on failure.
*/
export const generateQuestionImage = async (description: string): Promise<string> => {
  if (!description) return "";

  try {
    // METHOD 1: Pollinations.ai (Text-to-Image, gratis, no API key)
    const cleanDescription = encodeURIComponent(
      description.replace(/[^\w\s,.-]/g, "").trim()
    );
    
    // Tambahkan style untuk educational illustrations
    const enhancedPrompt = `${cleanDescription}, simple flat illustration, educational style, clear and colorful, for children`;
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=800&height=600&nologo=true&seed=${Date.now()}`;
    
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
      
      // Set timeout 10 detik (lebih reasonable)
      setTimeout(() => {
        console.warn("⏱️ Image generation timeout, using placeholder");
        resolve(generatePlaceholderImage(description));
      }, 500000);
      
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