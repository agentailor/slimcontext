import { SlimContextCompressor, SlimContextMessage } from '../interfaces';

export interface TrimConfig {
  messagesToKeep: number;
}

/**
 * TrimCompressor keeps the very first message (often a system prompt) and the last N-1 messages.
 */
export class TrimCompressor implements SlimContextCompressor {
  private readonly messagesToKeep: number;

  constructor(config: TrimConfig) {
    if (config.messagesToKeep < 2) {
      throw new Error(
        'messagesToKeep must be at least 2 to retain the first system message and one recent message',
      );
    }
    this.messagesToKeep = config.messagesToKeep;
  }

  async compress(messages: SlimContextMessage[]): Promise<SlimContextMessage[]> {
    if (messages.length <= this.messagesToKeep) {
      return messages;
    }
    const systemMessage = messages[0];
    const recentMessages = messages.slice(-this.messagesToKeep + 1);
    return [systemMessage, ...recentMessages];
  }
}
