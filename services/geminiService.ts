
import { GoogleGenAI } from "@google/genai";
import { GeneratePayload, GroundingSource, ChatPayload, ChatMessage } from '../types';

const MODEL_ID = 'gemini-3-pro-preview';

export const generateGeminiResponse = async (
  apiKey: string,
  payload: GeneratePayload
): Promise<{ text: string; sources: GroundingSource[] }> => {
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });

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

  if (payload.useThinking) {
    config.thinkingConfig = { thinkingBudget: 8192 }; 
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
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
    
    const sources: GroundingSource[] = [];
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

export const generateChatResponse = async (
  apiKey: string,
  payload: ChatPayload
): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });

  // We include the module context, the main output, and the chat history
  const contents = [
    {
      role: 'user',
      parts: [{ text: `BACKGROUND CONTEXT:\n${payload.history}\n\nCURRENT MODULE OUTPUT:\n${payload.currentOutput}` }]
    },
    // Replay chat history
    ...payload.chatHistory.map(msg => ({
      role: msg.role,
      parts: [
        { text: msg.text },
        ...(msg.attachments?.map(att => ({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data
          }
        })) || [])
      ]
    })),
    // Newest message
    {
      role: 'user',
      parts: [
        { text: payload.prompt },
        ...(payload.newAttachments?.map(att => ({
          inlineData: {
             mimeType: att.mimeType,
             data: att.data
          }
        })) || [])
      ]
    }
  ];

  const config: any = {
    systemInstruction: payload.systemInstruction + "\n\nYou are now in a follow-up chat mode. Answer the user's specific questions about the generated analysis. Be helpful, concise, and reference the analysis.",
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: contents as any,
      config: config
    });

    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw new Error(`Gemini Chat Error: ${(error as Error).message}`);
  }
};
