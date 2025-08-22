// Core interfaces for slimcontext

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

// BaseMessage allows optional alias 'human' used by some frameworks
export interface BaseMessage {
  role: 'system' | 'user' | 'human' | 'assistant';
  content: string;
}

export interface ModelResponse {
  content: string;
}

export interface IChatModel {
  invoke(messages: BaseMessage[]): Promise<ModelResponse>;
}

export interface ICompressor {
  compress(messages: Message[]): Promise<Message[]>;
}
