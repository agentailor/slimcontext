# LangChain one-call history compression

This example shows how to use `compressLangChainHistory` to compress a LangChain message history in a single call.

```ts
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { langchain } from 'slimcontext';

// 1) Create your LangChain chat model (any BaseChatModel works)
const llm = new ChatOpenAI({ model: 'gpt-5-mini', temperature: 0 });

// 2) Build your existing LangChain-compatible history
const history = [
  new SystemMessage(
    "You are a helpful AI assistant. The user's name is Bob and he wants to plan a trip to Paris.",
  ),
  new HumanMessage('Hi, can you help me plan a trip?'),
  new AIMessage('Of course, Bob! Where are you thinking of going?'),
  new HumanMessage('I want to go to Paris.'),
  new AIMessage('Great choice! Paris is a beautiful city. What do you want to do there?'),
  new HumanMessage('I want to visit the Eiffel Tower and the Louvre.'),
  new AIMessage('Those are two must-see attractions! Do you have a preferred time to visit?'),
  new HumanMessage('I was thinking sometime in June.'),
  new AIMessage('June is a great time to visit Paris! The weather is usually pleasant.'),
  new HumanMessage('What about flights?'),
  new AIMessage('I found some great flight options for you.'),
  new HumanMessage('Can you show me the details?'),
  new AIMessage(
    'Here are the details for the flights I found:\n\n- Flight 1: Departing June 1st, 10:00 AM\n- Flight 2: Departing June 2nd, 2:00 PM\n- Flight 3: Departing June 3rd, 5:00 PM',
  ),
  new HumanMessage(
    "I like the second flight option. I will check it out later, let's talk about hotels.",
  ),
  new AIMessage(
    'The best hotel options in Paris are:\n\n- Hôtel de Ville\n- Le Meurice\n- Hôtel Plaza Athénée',
  ),
  // ...imagine more messages here about restaurants, activities, booking details...
  // This is our latest message
  new HumanMessage('Okay, can you summarize the whole plan for me in a bulleted list?'),
];

console.log('Original size:', history.length);

// 3) Compress with either summarize (default) or trim strategy
const compact = await langchain.compressLangChainHistory(history, {
  strategy: 'summarize', // Use AI summarization strategy
  llm, // pass your BaseChatModel for generating summaries
  maxModelTokens: 200, // Your model's context window size
  thresholdPercent: 0.8, // Trigger compression when 80% of tokens are used
  minRecentMessages: 4, // Always keep the last 4 messages untouched
});

// Alternatively, use trimming without an LLM:
const trimmed = await langchain.compressLangChainHistory(history, {
  strategy: 'trim', // Simple trimming strategy (no AI needed)
  maxModelTokens: 200, // Your model's context window size
  thresholdPercent: 0.8, // Trigger compression when 80% of tokens are used
  minRecentMessages: 4, // Always keep the last 4 messages untouched
});

console.log('Summarized size:', compact.length);
console.log('Trimmed size:', trimmed.length);
console.log('Compressed messages:', compact);
```

After running this, you'll have something like this as output (for the summarization):

```ts
[
  new SystemMessage(
    "You are a helpful AI assistant. The user's name is Bob and he wants to plan a trip to Paris.",
  ),
  new SystemMessage(
    'User (Bob) wants help planning a trip to Paris in June to visit the Eiffel Tower and the Louvre.\nAssistant confirmed June is a good time and reported finding flight options.\nUser asked the assistant to show the flight details.',
  ),
  new AIMessage(
    'Here are the details for the flights I found:\n\n- Flight 1: Departing June 1st, 10:00 AM\n- Flight 2: Departing June 2nd, 2:00 PM\n- Flight 3: Departing June 3rd, 5:00 PM',
  ),
  new HumanMessage(
    "I like the second flight option. I will check it out later, let's talk about hotels.",
  ),
  new AIMessage(
    'The best hotel options in Paris are:\n\n- Hôtel de Ville\n- Le Meurice\n- Hôtel Plaza Athénée',
  ),
  new HumanMessage('Okay, can you summarize the whole plan for me in a bulleted list?'),
];
```

Notes

- `@langchain/core` is an optional peer dependency. Install it only if you use the adapter.
- Summarize strategy summarizes older content when total tokens exceed `thresholdPercent * maxModelTokens`.
