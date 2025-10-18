import {
  Content,
  GenerationConfig,
  SafetySetting,
  Tool,
  SystemInstruction,
  ToolConfig
} from './common';

export interface GenerateContentRequest {
  prompt?: string;
  contents?: Content[];
  model?: string;
  safetySettings?: SafetySetting[];
  generationConfig?: GenerationConfig;
  tools?: Tool[];
  systemInstruction?: SystemInstruction;
  toolConfig?: ToolConfig;
  user?: string;
}

export interface CountTokensRequest {
  contents: Content[];
}

export interface EmbedContentRequest {
  content: Content;
  taskType?: "TASK_TYPE_UNSPECIFIED" | "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" | "SEMANTIC_SIMILARITY" | "CLASSIFICATION" | "CLUSTERING";
  title?: string;
}

export interface UploadFileRequest {
  file: {
    displayName?: string;
    mimeType: string;
    uri?: string;
  };
}