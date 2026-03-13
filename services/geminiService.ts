
import { GoogleGenAI } from "@google/genai";
import { GeneratePayload, GroundingSource, ChatPayload } from '../types';
import { MODELS, isGemini3Model } from '../constants';

/**
 * Builds the correct thinkingConfig for the given model.
 * - Gemini 2.5 series: uses `thinkingBudget` (token count)
 * - Gemini 3 series:   uses `thinkingLevel` (string enum)
 */
const buildThinkingConfig = (model: string, useThinking: boolean): object | undefined => {
  if (!useThinking) return undefined;
  if (isGemini3Model(model)) {
    return { thinkingLevel: 'high' };
  }
  // Gemini 2.5 Flash / Flash-Lite: thinkingBudget in tokens (0 = off, -1 = auto)
  return { thinkingBudget: 8192 };
};

export const generateGeminiResponse = async (
  apiKey: string,
  model: string,
  payload: GeneratePayload
): Promise<{ text: string; sources: GroundingSource[] }> => {
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });
  const activeModel = model || MODELS.FLASH;

  const tools: any[] = [];
  if (payload.useGrounding) {
    tools.push({ googleSearch: {} });
  }

  const config: any = {
    systemInstruction: payload.systemInstruction,
  };

  if (tools.length > 0) {
    config.tools = tools;
  }

  const thinkingConfig = buildThinkingConfig(activeModel, !!payload.useThinking);
  if (thinkingConfig) {
    config.thinkingConfig = thinkingConfig;
  }

  try {
    const response = await ai.models.generateContent({
      model: activeModel,
      contents: [
        {
          role: 'user',
          parts: [
            { text: `CONTEXT AND HISTORY:\n${payload.history}\n\n` },
            { text: `YOUR CURRENT TASK:\n${payload.prompt}` }
          ]
        }
      ],
      config,
    });

    const text = response.text || "No response generated.";

    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({ uri: chunk.web.uri, title: chunk.web.title });
        }
      });
    }

    return { text, sources };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(`Gemini API Error: ${(error as Error).message}`);
  }
};

export const generateChatResponse = async (
  apiKey: string,
  model: string,
  payload: ChatPayload
): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });
  const activeModel = model || MODELS.FLASH;

  const contents = [
    {
      role: 'user',
      parts: [{ text: `BACKGROUND CONTEXT:\n${payload.history}\n\nCURRENT MODULE OUTPUT:\n${payload.currentOutput}` }]
    },
    ...payload.chatHistory.map(msg => ({
      role: msg.role,
      parts: [
        { text: msg.text },
        ...(msg.attachments?.map(att => ({
          inlineData: { mimeType: att.mimeType, data: att.data }
        })) || [])
      ]
    })),
    {
      role: 'user',
      parts: [
        { text: payload.prompt },
        ...(payload.newAttachments?.map(att => ({
          inlineData: { mimeType: att.mimeType, data: att.data }
        })) || [])
      ]
    }
  ];

  const config: any = {
    systemInstruction:
      payload.systemInstruction +
      "\n\nYou are now in follow-up chat mode. Answer the user's specific questions about the generated analysis. Be helpful, concise, and reference the analysis. You have access to Google Search. If the user asks about something not covered in the analysis, or asks you to verify, look up, or find new information, USE Google Search to find real, current answers. Do not say you cannot search the web.",
  };

  if (payload.useGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  try {
    const response = await ai.models.generateContent({
      model: activeModel,
      contents: contents as any,
      config,
    });

    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw new Error(`Gemini Chat Error: ${(error as Error).message}`);
  }
};
