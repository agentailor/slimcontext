import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { MessageContentComplex } from '@langchain/core/messages';
import { Runnable, type RunnableConfig } from '@langchain/core/runnables';
import { describe, it, expect, vi } from 'vitest';

import {
  baseToSlim,
  compressLangChainHistory,
  extractContent,
  roleFromMessageType,
  slimToLangChain,
} from '../src/adapters/langchain';
import type { SlimContextMessage } from '../src/interfaces';

// Mock BaseChatModel for testing
const createMockChatModel = (responseText: string): BaseChatModel => {
  class MockRunnable extends Runnable<BaseMessage[], AIMessage> {
    lc_namespace = ['langchain', 'test', 'mock'];

    invoke(
      _input: BaseMessage[],
      _options?: Partial<RunnableConfig> | undefined,
    ): Promise<AIMessage> {
      return Promise.resolve(new AIMessage(responseText));
    }
  }
  const model = new MockRunnable();
  return model as unknown as BaseChatModel;
};

describe('LangChain Adapter', () => {
  describe('extractContent', () => {
    it('should extract string content', () => {
      expect(extractContent('  hello world  ')).toBe('hello world');
    });

    it('should extract content from a complex array', () => {
      const content: MessageContentComplex[] = [
        { type: 'text', text: 'Hello' },
        { type: 'image_url', image_url: 'some_url' }, // Should be ignored
      ];
      expect(extractContent([' world', ...content])).toBe('world\nHello');
    });

    it('should return an empty string for unsupported types', () => {
      expect(extractContent(123)).toBe('');
      expect(extractContent(null)).toBe('');
      expect(extractContent({})).toBe('');
    });
  });

  describe('roleFromMessageType', () => {
    it('should map message types to roles correctly', () => {
      expect(roleFromMessageType('ai')).toBe('assistant');
      expect(roleFromMessageType('human')).toBe('user');
      expect(roleFromMessageType('system')).toBe('system');
      expect(roleFromMessageType('tool')).toBe('tool');
      expect(roleFromMessageType('generic')).toBe('user');
    });
  });

  describe('Message Conversion', () => {
    it('should convert BaseMessage to SlimContextMessage', () => {
      const humanMessage = new HumanMessage('Hello');
      const slimMessage = baseToSlim(humanMessage);
      expect(slimMessage).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should convert SlimContextMessage back to BaseMessage', () => {
      const slimMessage: SlimContextMessage = { role: 'assistant', content: 'Hi there' };
      const baseMessage = slimToLangChain(slimMessage);
      expect(baseMessage).toBeInstanceOf(AIMessage);
      expect(baseMessage.content).toBe('Hi there');
    });
  });

  describe('compressLangChainHistory', () => {
    const history: BaseMessage[] = [
      new SystemMessage('You are a helpful assistant.'),
      new HumanMessage('Message 1'),
      new AIMessage('Message 2'),
      new HumanMessage('Message 3'),
      new AIMessage('Message 4'),
    ];

    it('should compress history with the trim strategy', async () => {
      const compressed = await compressLangChainHistory(history, {
        strategy: 'trim',
        maxModelTokens: 400,
        thresholdPercent: 0.5,
        minRecentMessages: 2,
        estimateTokens: () => 150, // each message ~150 tokens
      });
      // System (150) + last two messages (300) = 450 > threshold 200, but
      // our TrimCompressor preserves last two regardless; will drop earlier non-systems.
      expect(compressed.length).toBe(3);
      expect(compressed[0]).toBeInstanceOf(SystemMessage);
      expect(compressed[1]).toBeInstanceOf(HumanMessage);
      expect(compressed[1].content).toBe('Message 3');
      expect(compressed[2]).toBeInstanceOf(AIMessage);
      expect(compressed[2].content).toBe('Message 4');
    });

    it('should compress history with the summarize strategy', async () => {
      const mockModel = createMockChatModel('This is a summary of messages 1 and 2.');
      const invokeSpy = vi.spyOn(mockModel, 'invoke');

      const compressed = await compressLangChainHistory(history, {
        strategy: 'summarize',
        llm: mockModel,
        maxModelTokens: 300,
        thresholdPercent: 0.5,
        estimateTokens: () => 100,
        minRecentMessages: 2,
      });

      expect(invokeSpy).toHaveBeenCalled();
      // Should be: system + summary + last 2 messages
      expect(compressed).toHaveLength(4);
      expect(compressed[0]).toBeInstanceOf(SystemMessage);
      expect(compressed[1]).toBeInstanceOf(SystemMessage); // Summary is an System Message
      expect(compressed[1].content).toContain('This is a summary of messages 1 and 2.');
      expect(compressed[2].content).toBe('Message 3');
      expect(compressed[3].content).toBe('Message 4');
    });

    it('should work with a pre-created compressor', async () => {
      const customCompressor = {
        compress: async (messages: SlimContextMessage[]) => {
          return Promise.resolve([
            { role: 'assistant', content: 'Custom summary' },
            ...messages.slice(-1),
          ] as SlimContextMessage[]);
        },
      };

      const compressed = await compressLangChainHistory(history, {
        compressor: customCompressor,
      });

      expect(compressed).toHaveLength(2);
      expect(compressed[0].content).toBe('Custom summary');
      expect(compressed[1].content).toBe('Message 4');
    });
  });
});
