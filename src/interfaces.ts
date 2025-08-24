// Core interfaces for slimcontext

// Single message shape used across the library and adapters.
// Includes 'human' (alias some frameworks use) and 'tool' for compatibility.
export interface SlimContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'human';
  content: string;
}

export interface SlimContextModelResponse {
  content: string;
}

export interface SlimContextChatModel {
  invoke(messages: SlimContextMessage[]): Promise<SlimContextModelResponse>;
}

export interface SlimContextCompressor {
  compress(messages: SlimContextMessage[]): Promise<SlimContextMessage[]>;
}
