# OpenAI summarization example (copy-paste)

This project is BYOM (bring your own model). To use OpenAI for summarization without adding deps to this repo, copy the snippet below into your app and install `openai` there.

```ts
import {
  SummarizeCompressor,
  type SlimContextChatModel,
  type SlimContextMessage,
  type SlimContextModelResponse,
} from 'slimcontext';
import OpenAI from 'openai';

const client = new OpenAI();

class OpenAIModel implements SlimContextChatModel {
  async invoke(msgs: SlimContextMessage[]): Promise<SlimContextModelResponse> {
    const response = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: msgs.map((m) => ({
        role: m.role === 'human' ? 'user' : (m.role as 'system' | 'user' | 'assistant'),
        content: m.content,
      })),
    });
    return { content: response.choices?.[0]?.message?.content ?? '' };
  }
}

async function main() {
  const history: SlimContextMessage[] = [
    {
      role: 'system',
      content:
        "You are a helpful AI assistant. The user's name is Bob and he wants to plan a trip to Paris.",
    },
    { role: 'user', content: 'Hi, can you help me plan a trip?' },
    { role: 'assistant', content: 'Of course, Bob! Where are you thinking of going?' },
    { role: 'user', content: 'I want to go to Paris.' },
    {
      role: 'assistant',
      content: 'Great choice! Paris is a beautiful city. What do you want to do there?',
    },
    { role: 'user', content: 'I want to visit the Eiffel Tower and the Louvre.' },
    {
      role: 'assistant',
      content: 'Those are two must-see attractions! Do you have a preferred time to visit?',
    },
    { role: 'user', content: 'I was thinking sometime in June.' },
    {
      role: 'assistant',
      content: 'June is a great time to visit Paris! The weather is usually pleasant.',
    },
    { role: 'user', content: 'What about flights?' },
    { role: 'assistant', content: 'I found some great flight options for you.' },
    { role: 'user', content: 'Can you show me the details?' },
    {
      role: 'assistant',
      content:
        'Here are the details for the flights I found:\n\n- Flight 1: Departing June 1st, 10:00 AM\n- Flight 2: Departing June 2nd, 2:00 PM\n- Flight 3: Departing June 3rd, 5:00 PM',
    },
    {
      role: 'user',
      content:
        "I like the second flight option. I will check it out later, let's talk about hotels.",
    },
    {
      role: 'assistant',
      content:
        'The best hotel options in Paris are:\n\n- Hôtel de Ville\n- Le Meurice\n- Hôtel Plaza Athénée',
    },
    // ...imagine 50 more messages here about flights, hotels, restaurants...
    // This is our latest message
    { role: 'user', content: 'Okay, can you summarize the whole plan for me in a bulleted list?' },
  ];
  console.log('Original messages length:', history.length);
  const summarize = new SummarizeCompressor({
    model: new OpenAIModel(), // Your BYOM implementation for generating summaries
    maxModelTokens: 200, // Your model's context window size
    thresholdPercent: 0.8, // Trigger compression when 80% of tokens are used
    minRecentMessages: 4, // Always keep the last 4 messages untouched
  });
  const compressed = await summarize.compress(history);
  console.log('Compressed messages length:', compressed.length);

  console.log('Compressed messages:', compressed);
}
main();
```

After running this, you'll have something like this as output:

```JSON
[
  {
    "role": "system",
    "content": "You are a helpful AI assistant. The user's name is Bob and he wants to plan a trip to Paris."
  },
  {
    "role": "system",
    "content": "User (Bob) wants help planning a trip to Paris in June to visit the Eiffel Tower and the Louvre.\nAssistant confirmed June is a good time and reported finding flight options.\nUser asked the assistant to show the flight details."
  },
  {
    "role": "assistant",
    "content": "Here are the details for the flights I found:\n- Flight 1: Departing June 1st, 10:00 AM\n- Flight 2: Departing June 2nd, 2:00 PM\n- Flight 3: Departing June 3rd, 5:00 PM"
  },
  {
    "role": "user",
    "content": "I like the second flight option. I will check it out later, let's talk about hotels."
  },
  {
    "role": "assistant",
    "content": "Some top hotel options in Paris include:\n- Le Meurice\n- Hôtel Plaza Athénée\n- Hôtel de Crillon"
  },
  {
    "role": "user",
    "content": "Okay, can you summarize the whole plan for me in a bulleted list?"
  }
]
```

Notes:

- Set `OPENAI_API_KEY` in your environment.
- Pick any chat model available in your account (e.g., `gpt-4o`, `gpt-5.1-mini`, etc.).
- You can swap OpenAI for any provider by implementing `SlimContextChatModel`.
