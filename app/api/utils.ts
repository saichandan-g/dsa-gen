import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";

export type AIProvider = 'mistral' | 'gemini';

export interface ProviderConfig {
  apiKey: string;
  provider: AIProvider;
  model: string;
}

export async function callAIProvider(
  config: ProviderConfig,
  prompt: string,
  systemPrompt?: string
): Promise<string | null> {
  if (config.provider === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const model = genAI.getGenerativeModel({ model: config.model });

      const chat = model.startChat({
        history: systemPrompt ? [{ role: "user", parts: [{ text: systemPrompt }] }, { role: "model", parts: [{ text: "Okay, I understand." }] }] : [],
        generationConfig: {
          maxOutputTokens: 2000,
        },
      });

      const result = await chat.sendMessage(prompt);
      const response = result.response;
      const text = response.text();
      
      if (!text) {
        throw new Error('Empty response from Gemini API');
      }
      
      return text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Gemini API error: ${errorMessage}`);
    }
  } else if (config.provider === 'mistral') {
    try {
      const client = new Mistral({ apiKey: config.apiKey });
      const chatResponse = await client.chat.complete({
        model: config.model,
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ] as any,
      });
      
      if (!chatResponse.choices || chatResponse.choices.length === 0) {
        throw new Error('No choices in Mistral response');
      }
      
      const choice = chatResponse.choices[0];
      const content = choice?.message?.content;
      
      if (!content) {
        throw new Error('Empty content in Mistral response');
      }
      
      // Handle both string and array content types
      const textContent = typeof content === 'string' ? content : 
        Array.isArray(content) ? content.map((c: any) => typeof c === 'string' ? c : (c.text || '')).join('') : 
        '';
      
      if (!textContent) {
        throw new Error('No text content in Mistral response');
      }
      
      return textContent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Mistral API error: ${errorMessage}`);
    }
  }
  
  throw new Error(`Unsupported provider: ${config.provider}`);
}

export function getProviderFromModel(modelSelection: string): AIProvider | null {
  const lower = modelSelection.toLowerCase();

  if (lower.includes('mistral')) {
    return 'mistral';
  } else if (lower.includes('gemini') || lower.includes('google')) {
    return 'gemini';
  }

  return null;
}

export function getModelFromSelection(modelSelection: string): string {
  const lower = modelSelection.toLowerCase();

  if (lower.includes('mistral-small')) return 'mistral-small-latest';
  if (lower.includes('mistral-medium')) return 'mistral-medium-latest';
  if (lower.includes('mistral-large')) return 'mistral-large-latest';
  if (lower.includes('mistral')) return 'mistral-small-latest';

  if (lower.includes('gemini')) return 'gemini-2.5-flash';
  if (lower.includes('google')) return 'gemini-2.5-flash';

  return modelSelection;
}
