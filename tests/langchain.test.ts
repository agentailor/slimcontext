import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
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

    it('should convert ToolMessage to SlimContextMessage and back', () => {
      const toolMessage = new ToolMessage('Function result: 42', 'call_123');
      const slimMessage = baseToSlim(toolMessage);
      expect(slimMessage.role).toBe('tool');
      expect(slimMessage.content).toBe('Function result: 42');
      expect(slimMessage.metadata?.tool_call_id).toBe('call_123');

      const backToBase = slimToLangChain(slimMessage);
      expect(backToBase).toBeInstanceOf(ToolMessage);
      expect(backToBase.content).toBe('Function result: 42');
      expect((backToBase as ToolMessage).tool_call_id).toBe('call_123');
    });

    it('should preserve tool message content through roundtrip conversion', () => {
      const originalContent =
        'Complex tool response with\nmultiple lines\nand special chars: {"result": "success"}';
      const toolMessage = new ToolMessage(originalContent, 'call_456');

      const slimMessage = baseToSlim(toolMessage);
      const backToLangChain = slimToLangChain(slimMessage);

      expect(slimMessage.role).toBe('tool');
      expect(slimMessage.content).toBe(originalContent);
      expect(backToLangChain).toBeInstanceOf(ToolMessage);
      expect(backToLangChain.content).toBe(originalContent);
      expect((backToLangChain as ToolMessage).tool_call_id).toBe('call_456');
    });

    it('should preserve all message metadata fields', () => {
      const complexMessage = new AIMessage({
        content: 'Complex response',
        id: 'msg_123',
        name: 'assistant_bot',
        additional_kwargs: { model: 'gpt-4', temperature: 0.7 },
        response_metadata: { tokens: 150, latency: 250 },
      });

      const slimMessage = baseToSlim(complexMessage);
      const backToLangChain = slimToLangChain(slimMessage);

      expect(slimMessage.role).toBe('assistant');
      expect(slimMessage.content).toBe('Complex response');
      expect(slimMessage.metadata?.id).toBe('msg_123');
      expect(slimMessage.metadata?.name).toBe('assistant_bot');
      expect(slimMessage.metadata?.additional_kwargs).toEqual({
        model: 'gpt-4',
        temperature: 0.7,
      });
      expect(slimMessage.metadata?.response_metadata).toEqual({
        tokens: 150,
        latency: 250,
      });

      expect(backToLangChain).toBeInstanceOf(AIMessage);
      expect(backToLangChain.content).toBe('Complex response');
      expect(backToLangChain.id).toBe('msg_123');
      expect(backToLangChain.name).toBe('assistant_bot');
      expect(backToLangChain.additional_kwargs).toEqual({
        model: 'gpt-4',
        temperature: 0.7,
      });
      expect(backToLangChain.response_metadata).toEqual({
        tokens: 150,
        latency: 250,
      });
    });

    it('should preserve tool message with all metadata', () => {
      const toolMessage = new ToolMessage({
        content: '{"result": 42, "status": "success"}',
        tool_call_id: 'call_xyz_789',
        name: 'calculator',
        id: 'tool_msg_001',
        status: 'success' as const,
        artifact: { raw_output: 42, computation_time: 0.05 },
        additional_kwargs: { model_version: 'v2.1' },
        response_metadata: { execution_time: 100 },
      });

      const slimMessage = baseToSlim(toolMessage);
      const backToLangChain = slimToLangChain(slimMessage);

      // Check SlimContext message preserves metadata
      expect(slimMessage.role).toBe('tool');
      expect(slimMessage.content).toBe('{"result": 42, "status": "success"}');
      expect(slimMessage.metadata?.tool_call_id).toBe('call_xyz_789');
      expect(slimMessage.metadata?.name).toBe('calculator');
      expect(slimMessage.metadata?.id).toBe('tool_msg_001');
      expect(slimMessage.metadata?.status).toBe('success');
      expect(slimMessage.metadata?.artifact).toEqual({
        raw_output: 42,
        computation_time: 0.05,
      });

      // Check LangChain message is fully restored
      expect(backToLangChain).toBeInstanceOf(ToolMessage);
      const restoredTool = backToLangChain as ToolMessage;
      expect(restoredTool.content).toBe('{"result": 42, "status": "success"}');
      expect(restoredTool.tool_call_id).toBe('call_xyz_789');
      expect(restoredTool.name).toBe('calculator');
      expect(restoredTool.id).toBe('tool_msg_001');
      expect(restoredTool.status).toBe('success');
      expect(restoredTool.artifact).toEqual({
        raw_output: 42,
        computation_time: 0.05,
      });
      expect(restoredTool.additional_kwargs).toEqual({ model_version: 'v2.1' });
      expect(restoredTool.response_metadata).toEqual({ execution_time: 100 });
    });

    it('should handle messages without metadata gracefully', () => {
      const simpleMessage = new HumanMessage('Simple question');
      const slimMessage = baseToSlim(simpleMessage);
      const backToLangChain = slimToLangChain(slimMessage);

      expect(slimMessage.role).toBe('user');
      expect(slimMessage.content).toBe('Simple question');
      expect(slimMessage.metadata).toBeUndefined();

      expect(backToLangChain).toBeInstanceOf(HumanMessage);
      expect(backToLangChain.content).toBe('Simple question');
    });

    it('should preserve complex content when extractContent returns empty', () => {
      // Create AI message with complex content (tool calls, function calls, no plain text)
      const complexContent = [
        {
          functionCall: {
            name: 'duckduckgo__search',
            args: { query: 'AI agents trends and future' },
          },
          thoughtSignature: 'CikB0e2Kbyvu3hrfNhjy...',
        },
      ];

      const aiMessage = new AIMessage({
        content: complexContent,
        id: 'run-3073efed-c743-4ef2-b305-a52435fba26f',
        additional_kwargs: {
          tool_calls: [
            {
              name: 'duckduckgo__search',
              args: { query: 'AI agents trends and future' },
              id: '696ecb8f-d532-4172-abfa-98b72023674a',
              type: 'tool_call',
            },
          ],
        },
      });

      const slimMessage = baseToSlim(aiMessage);
      const backToLangChain = slimToLangChain(slimMessage);

      // Content should be empty string from extractContent
      expect(slimMessage.content).toBe('');
      // But original content should be preserved in metadata
      expect(slimMessage.metadata?.original_content).toEqual(complexContent);
      expect(slimMessage.metadata?.id).toBe('run-3073efed-c743-4ef2-b305-a52435fba26f');

      // When restored, should get back the original complex content
      expect(backToLangChain).toBeInstanceOf(AIMessage);
      expect(backToLangChain.content).toEqual(complexContent);
      expect(backToLangChain.id).toBe('run-3073efed-c743-4ef2-b305-a52435fba26f');
    });

    it('should preserve AI message with tool call chunks and no text content', () => {
      const complexMessageData = {
        content: [
          {
            functionCall: {
              name: 'duckduckgo__search',
              args: { query: 'AI agents trends and future' },
            },
            thoughtSignature: 'CikB0e2Kbyvu3hrfNhjy...',
          },
        ],
        tool_call_chunks: [
          {
            name: 'duckduckgo__search',
            args: '{"query":"AI agents trends and future"}',
            index: 0,
            type: 'tool_call_chunk',
            id: '696ecb8f-d532-4172-abfa-98b72023674a',
          },
        ],
        additional_kwargs: {},
        tool_calls: [
          {
            name: 'duckduckgo__search',
            args: { query: 'AI agents trends and future' },
            id: '696ecb8f-d532-4172-abfa-98b72023674a',
            type: 'tool_call',
          },
        ],
        invalid_tool_calls: [],
        response_metadata: {},
        id: 'run-3073efed-c743-4ef2-b305-a52435fba26f',
      };

      const aiMessage = new AIMessage(complexMessageData);
      const slimMessage = baseToSlim(aiMessage);
      const backToLangChain = slimToLangChain(slimMessage);

      // Should preserve the original complex content structure
      expect(slimMessage.content).toBe('');
      expect(slimMessage.metadata?.original_content).toEqual(complexMessageData.content);

      // When restored, should be identical to original
      expect(backToLangChain).toBeInstanceOf(AIMessage);
      expect(backToLangChain.content).toEqual(complexMessageData.content);
      expect(backToLangChain.id).toBe(complexMessageData.id);

      // Check that additional_kwargs is preserved (empty objects are not preserved to avoid bloat)
      expect(slimMessage.metadata?.additional_kwargs).toBeUndefined();
    });

    it('should handle mixed content with both text and complex structures', () => {
      // Test with plain string content which should extract normally
      const simpleMessage = new AIMessage('I will search for information about AI agents.');
      const slimMessage = baseToSlim(simpleMessage);
      const backToLangChain = slimToLangChain(slimMessage);

      // Should extract the text content
      expect(slimMessage.content).toBe('I will search for information about AI agents.');
      // Should NOT preserve original content since extractContent succeeded
      expect(slimMessage.metadata?.original_content).toBeUndefined();

      // Should restore with extracted text content
      expect(backToLangChain.content).toBe('I will search for information about AI agents.');
    });

    it('should handle complex array content by preserving original when needed', () => {
      // Test with array containing objects that may not be extractable by LangChain processing
      const mixedContent = [
        { text: 'I will search for information about AI agents.' },
        {
          functionCall: {
            name: 'search_tool',
            args: { query: 'AI agents' },
          },
        },
      ];

      const aiMessage = new AIMessage({ content: mixedContent });
      const slimMessage = baseToSlim(aiMessage);
      const backToLangChain = slimToLangChain(slimMessage);

      // Behavior depends on how LangChain processes the content internally
      // If extractContent returns empty, original content should be preserved
      if (slimMessage.content === '') {
        expect(slimMessage.metadata?.original_content).toEqual(mixedContent);
        expect(backToLangChain.content).toEqual(mixedContent);
      } else {
        // If content was extracted successfully, original shouldn't be preserved
        expect(slimMessage.metadata?.original_content).toBeUndefined();
        expect(backToLangChain.content).toBe(slimMessage.content);
      }
    });
  });

  describe('compressLangChainHistory', () => {
    const history: BaseMessage[] = [
      new SystemMessage('You are a helpful assistant.'),
      new HumanMessage('Message 1'),
      new AIMessage('Message 2'),
      new HumanMessage('Message 3'),
      new AIMessage('Message 4'),
      new HumanMessage('Message 5'), // End with user message to allow compression
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
      expect(compressed[1]).toBeInstanceOf(AIMessage);
      expect(compressed[1].content).toBe('Message 4');
      expect(compressed[2]).toBeInstanceOf(HumanMessage);
      expect(compressed[2].content).toBe('Message 5');
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
      expect(compressed[2].content).toBe('Message 4');
      expect(compressed[3].content).toBe('Message 5');
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
      expect(compressed[1].content).toBe('Message 5');
    });

    it('should preserve tool messages during compression', async () => {
      const historyWithTools: BaseMessage[] = [
        new SystemMessage('You are a helpful assistant.'),
        new HumanMessage('What is 2 + 2?'),
        new AIMessage('Let me calculate that for you.'),
        new ToolMessage('{"result": 4}', 'calc_123'),
        new AIMessage('The answer is 4.'),
        new HumanMessage('What about 5 + 5?'),
      ];

      const compressed = await compressLangChainHistory(historyWithTools, {
        strategy: 'trim',
        maxModelTokens: 300,
        thresholdPercent: 0.5,
        minRecentMessages: 3,
        estimateTokens: () => 100, // Total: 600 tokens, threshold: 150 tokens
      });

      // Should preserve system + last 3 messages (including the tool message)
      expect(compressed).toHaveLength(4);
      expect(compressed[0]).toBeInstanceOf(SystemMessage);
      expect(compressed[1]).toBeInstanceOf(ToolMessage);
      expect(compressed[1].content).toBe('{"result": 4}');
      expect((compressed[1] as ToolMessage).tool_call_id).toBe('calc_123');
      expect(compressed[2]).toBeInstanceOf(AIMessage);
      expect(compressed[2].content).toBe('The answer is 4.');
      expect(compressed[3]).toBeInstanceOf(HumanMessage);
      expect(compressed[3].content).toBe('What about 5 + 5?');
    });

    it('should preserve rich metadata during compression workflow', async () => {
      const historyWithMetadata: BaseMessage[] = [
        new SystemMessage({
          content: 'You are a helpful assistant.',
          id: 'system_001',
          name: 'system',
        }),
        new HumanMessage({
          content: 'Calculate 10 + 15',
          id: 'user_001',
          name: 'user123',
          additional_kwargs: { session_id: 'abc123' },
        }),
        new AIMessage({
          content: 'I will calculate that using a tool.',
          id: 'ai_001',
          response_metadata: { model: 'gpt-4', tokens: 12 },
        }),
        new ToolMessage({
          content: '{"result": 25}',
          tool_call_id: 'calc_operation_456',
          id: 'tool_001',
          name: 'calculator',
          status: 'success' as const,
          artifact: { operation: 'addition', operands: [10, 15] },
        }),
        new AIMessage({
          content: 'The result is 25.',
          id: 'ai_002',
          response_metadata: { tokens: 8 },
        }),
        new HumanMessage({
          content: 'Thanks!',
          id: 'user_002',
          name: 'user123',
        }),
      ];

      const compressed = await compressLangChainHistory(historyWithMetadata, {
        strategy: 'trim',
        maxModelTokens: 200,
        thresholdPercent: 0.6,
        minRecentMessages: 2,
        estimateTokens: () => 50, // Total: 250, threshold: 120
      });

      // Should preserve system + last 2 messages
      expect(compressed).toHaveLength(3);

      // Check system message metadata preserved
      expect(compressed[0]).toBeInstanceOf(SystemMessage);
      expect(compressed[0].id).toBe('system_001');
      expect(compressed[0].name).toBe('system');

      // Check AI message metadata preserved (2nd to last)
      expect(compressed[1]).toBeInstanceOf(AIMessage);
      const aiMsg = compressed[1] as AIMessage;
      expect(aiMsg.content).toBe('The result is 25.');
      expect(aiMsg.id).toBe('ai_002');

      // Check last human message
      expect(compressed[2]).toBeInstanceOf(HumanMessage);
      const humanMsg = compressed[2] as HumanMessage;
      expect(humanMsg.content).toBe('Thanks!');
      expect(humanMsg.id).toBe('user_002');
    });

    it('should preserve complex content during compression', async () => {
      const complexContent = [
        {
          functionCall: {
            name: 'search_tool',
            args: { query: 'test search' },
          },
          thoughtSignature: 'abc123...',
        },
      ];

      const historyWithComplexContent: BaseMessage[] = [
        new SystemMessage('You are a helpful assistant.'),
        new HumanMessage('Search for something'),
        new AIMessage({
          content: complexContent,
          id: 'complex_ai_msg',
          additional_kwargs: {
            tool_calls: [
              {
                name: 'search_tool',
                args: { query: 'test search' },
                id: 'tool_call_123',
                type: 'tool_call',
              },
            ],
          },
        }),
        new HumanMessage('Thanks!'),
      ];

      const compressed = await compressLangChainHistory(historyWithComplexContent, {
        strategy: 'trim',
        maxModelTokens: 200,
        thresholdPercent: 0.5,
        minRecentMessages: 2,
        estimateTokens: () => 80, // Total: 320, threshold: 100
      });

      // Should preserve system + last 2 messages
      expect(compressed).toHaveLength(3);
      expect(compressed[0]).toBeInstanceOf(SystemMessage);

      // Complex AI message should be preserved with original content structure
      expect(compressed[1]).toBeInstanceOf(AIMessage);
      const aiMsg = compressed[1] as AIMessage;
      expect(aiMsg.content).toEqual(complexContent);
      expect(aiMsg.id).toBe('complex_ai_msg');
      expect(aiMsg.additional_kwargs).toEqual({
        tool_calls: [
          {
            name: 'search_tool',
            args: { query: 'test search' },
            id: 'tool_call_123',
            type: 'tool_call',
          },
        ],
      });

      expect(compressed[2]).toBeInstanceOf(HumanMessage);
      expect(compressed[2].content).toBe('Thanks!');
    });
  });
});
