import { ICompressor, Message } from '../interfaces';

/**
 * TrimCompressor keeps the very first message (often a system prompt) and the last N-1 messages.
 */
export class TrimCompressor implements ICompressor {
  private readonly messagesToKeep: number;

  constructor(config: { messagesToKeep: number }) {
    if (config.messagesToKeep < 2) {
      throw new Error('messagesToKeep must be at least 2 to retain the first system message and one recent message');
    }
    this.messagesToKeep = config.messagesToKeep;
  }

  async compress(messages: Message[]): Promise<Message[]> {
    if (messages.length <= this.messagesToKeep) {
      return messages;
    }
    const systemMessage = messages[0];
    const recentMessages = messages.slice(-this.messagesToKeep + 1);
    return [systemMessage, ...recentMessages];
  }
}
