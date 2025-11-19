
import { GoogleGenAI } from "@google/genai";
import { GeneratePayload, GroundingSource } from '../types';

export const generateGeminiResponse = async (
  apiKey: string,
  payload: GeneratePayload
): Promise<{ text: string; sources: GroundingSource[] }> => {
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });

  // Using Gemini 3 Pro for maximum reasoning capability as requested
  const modelId = 'gemini-3-pro-preview'; 

  const tools: any[] = [];
  if (payload.useGrounding) {
    tools.push({ googleSearch: {} });
  }

  const config: any = {
    systemInstruction: payload.systemInstruction,
    temperature: 0.7,
  };

  if (tools.length > 0) {
    config.tools = tools;
  }

  // Enable Thinking for complex reasoning if requested
  if (payload.useThinking) {
    config.thinkingConfig = { thinkingBudget: 8192 }; // High budget for deep analysis
  }

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        {
          role: 'user',
          parts: [
            { text: `CONTEXT AND HISTORY:\n${payload.history}\n\n` },
            { text: `YOUR CURRENT TASK:\n${payload.prompt}` }
          ]
        }
      ],
      config: config
    });

    const text = response.text || "No response generated.";
    
    // Extract grounding (search) metadata
    const sources: GroundingSource[] = [];
    
    // Check for grounding chunks in candidates
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            uri: chunk.web.uri,
            title: chunk.web.title
          });
        }
      });
    }

    return { text, sources };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(`Gemini API Error: ${(error as Error).message}`);
  }
};
