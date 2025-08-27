import { Content, SystemInstruction, GenerationConfig } from './common';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatRequest {
  prompt: string;
  systemInstruction?: string | SystemInstruction;
  history?: ChatMessage[];
  model?: string;
  generationConfig?: GenerationConfig;
  user?: string; 
}