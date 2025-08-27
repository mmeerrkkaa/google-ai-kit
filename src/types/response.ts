import {
  Candidate,
  PromptFeedback,
  FileMetadata,
  FinishReason,
  SafetyRating,
  CitationMetadata,
} from './common';
import type { Content } from './common';

import { ContentEmbedding } from './common';


export interface GenerateContentResponse {
candidates?: Candidate[];
promptFeedback?: PromptFeedback;
usageMetadata?: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};
}

export interface EnhancedGenerateContentResponse extends GenerateContentResponse {
text(): string | null;
json<T = any>(): T | null;
}

export interface CountTokensResponse {
totalTokens: number;
}

export interface EmbedContentResponse {
embedding: ContentEmbedding;
}

export interface UploadFileResponse {
file: FileMetadata;
}

export interface GetFileResponse {
file: FileMetadata;
}

export interface ListFilesResponse {
files: FileMetadata[];
nextPageToken?: string;
}

export interface StreamGenerateContentResponse {
  candidates?: StreamCandidate[];
  promptFeedback?: PromptFeedback;
}
export interface StreamCandidate {
  content: Content;
  finishReason?: FinishReason;
  safetyRatings?: SafetyRating[];
  citationMetadata?: CitationMetadata;
  index: number;
}