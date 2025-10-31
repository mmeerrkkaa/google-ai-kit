export interface Part {
  text?: string;
  inlineData?: Blob;
  fileData?: FileData;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
}

export interface Blob {
  mimeType: string;
  data: string;
}

export interface FileData {
  mimeType: string;
  fileUri: string;
}

export interface Content {
  parts: Part[];
  role?: 'user' | 'model' | 'function' | 'system';
}

export interface SafetySetting {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
}

export enum HarmCategory {
  HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED",
  HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH",
  HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT",
  HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT",
}

export enum HarmBlockThreshold {
  HARM_BLOCK_THRESHOLD_UNSPECIFIED = "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
  BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE",
  BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE",
  BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH",
  BLOCK_NONE = "BLOCK_NONE",
}

export interface Schema {
  type: SchemaType;
  format?: string;
  description?: string;
  nullable?: boolean;
  enum?: string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
}

export enum SchemaType {
  STRING = "STRING",
  NUMBER = "NUMBER",
  INTEGER = "INTEGER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  OBJECT = "OBJECT",
}

export interface GenerationConfig {
  stopSequences?: string[];
  candidateCount?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  responseMimeType?: "text/plain" | "application/json";
  responseSchema?: Schema;
  thinkingConfig?: ThinkingConfig;
  // maxToolCalls (или maxCalls) теперь в FunctionCallingConfig
}

export interface ThinkingConfig {
  /**
   * Включить или выключить thinking mode
   * @default false
   */
  mode?: 'enabled' | 'disabled';

  /**
   * Максимальное количество токенов для reasoning
   */
  maxThinkingTokens?: number;
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: Schema;
  /**
   * Optional function to execute this tool.
   * If provided, the client will call this function when the model requests this tool.
   * The function should accept the arguments object parsed by the model and return a Promise with the result.
   * This field will NOT be sent to the Google API.
   */
  execute?: (args: any) => Promise<any>;
}

export interface GoogleSearchRetrieval {
  disableAttribution?: boolean;
}

export interface Tool {
  /**
   * A list of function declarations.
   * Each declaration can now include an `execute` method for client-side execution.
   */
  functionDeclarations?: FunctionDeclaration[];
  googleSearchRetrieval?: GoogleSearchRetrieval;
}

export enum FunctionCallingMode {
  MODE_UNSPECIFIED = "MODE_UNSPECIFIED",
  AUTO = "AUTO",
  ANY = "ANY",
  NONE = "NONE"
}

export interface FunctionCallingConfig {
  mode?: FunctionCallingMode;
  allowedFunctionNames?: string[];
  /**
   * Maximum number of sequential function calls allowed for this tool configuration
   * during a single `generateContent` or `chat` call.
   * If the model continues to request function calls beyond this limit,
   * the generation will stop.
   * This overrides the client's `defaultMaxToolCalls`.
   * Default is based on client's `defaultMaxToolCalls` (typically 5).
   * Set to 0 or 1 if you want at most one model response that could be a function call,
   * handling further execution manually.
   * If set to 0, no automatic tool call loop will be performed by the client for functions.
   */
  maxCalls?: number;
}

export interface ToolConfig {
  functionCallingConfig?: FunctionCallingConfig;
}


export interface FunctionCall {
  name: string;
  args: object;
}

export interface FunctionResponse {
  name: string;
  response: object;
}

export interface SystemInstruction {
  role: 'system';
  parts: Part[];
}

export interface SafetyRating {
  category: HarmCategory;
  probability: HarmProbability;
  blocked?: boolean;
}

export enum HarmProbability {
  HARM_PROBABILITY_UNSPECIFIED = "HARM_PROBABILITY_UNSPECIFIED",
  NEGLIGIBLE = "NEGLIGIBLE",
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export interface Candidate {
  content: Content;
  finishReason?: FinishReason;
  safetyRatings?: SafetyRating[];
  citationMetadata?: CitationMetadata;
  tokenCount?: number;
}

export enum FinishReason {
  FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED",
  STOP = "STOP",
  MAX_TOKENS = "MAX_TOKENS",
  SAFETY = "SAFETY",
  RECITATION = "RECITATION",
  OTHER = "OTHER",
  MAX_TOOL_CALLS_REACHED = "MAX_TOOL_CALLS_REACHED"
}

export interface CitationMetadata {
  citationSources: CitationSource[];
}

export interface CitationSource {
  startIndex?: number;
  endIndex?: number;
  uri?: string;
  license?: string;
}

export interface PromptFeedback {
  blockReason?: BlockReason;
  safetyRatings?: SafetyRating[];
  blockReasonMessage?: string;
}

export enum BlockReason {
  BLOCK_REASON_UNSPECIFIED = "BLOCK_REASON_UNSPECIFIED",
  SAFETY = "SAFETY",
  OTHER = "OTHER",
}

export interface FileMetadata {
  name: string;
  displayName?: string;
  mimeType: string;
  sizeBytes: string;
  createTime: string;
  updateTime: string;
  expirationTime?: string;
  sha256Hash: string;
  uri: string;
}

export interface ContentEmbedding {
  values: number[];
}