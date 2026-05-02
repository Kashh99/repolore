import ollama from 'ollama';
import Anthropic from '@anthropic-ai/sdk';
import pLimit from 'p-limit';

const OLLAMA_MODEL = 'mistral';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const CONCURRENCY = 10;

function getBackend() {
  if (process.env.ANTHROPIC_API_KEY) {
    return { name: 'claude', client: new Anthropic() };
  }
  return { name: 'ollama', client: null };
}

export async function summarizeIssues(issues, prs) {
  const backend = getBackend();
  console.log(`  Using ${backend.name === 'claude' ? `Claude (${CLAUDE_MODEL})` : `Ollama (${OLLAMA_MODEL})`}`);

  const total = issues.length + prs.length;
  let completed = 0;
  const limit = pLimit(CONCURRENCY);

  const printProgress = () => {
    completed++;
    process.stdout.write(`\r  Summarizing ${completed}/${total}...`);
  };

  const allItems = [
    ...issues.map(item => ({ type: 'issue', item })),
    ...prs.map(item => ({ type: 'pr', item })),
  ];

  const summaries = await Promise.all(
    allItems.map(({ type, item }) =>
      limit(async () => {
        const summary = await summarizeItem(type, item, backend);
        printProgress();
        return { type, ...summary };
      })
    )
  );

  process.stdout.write('\n');
  return summaries;
}

async function withRetry(fn) {
  const delays = [2000, 4000, 8000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.status === 429 || err?.message?.includes('429');
      if (is429 && attempt < delays.length) {
        await new Promise(r => setTimeout(r, delays[attempt]));
        continue;
      }
      throw err;
    }
  }
}

async function summarizeItem(type, item, backend) {
  const commentsText = (item.comments || [])
    .map(c => `  [${c.author}]: ${c.body}`)
    .join('\n');

  const prompt = `You are an ops engineer analyzing a GitHub ${type}.

${type.toUpperCase()} #${item.number}: ${item.title}
State: ${item.state}${item.merged ? ' (merged)' : ''}
Author: ${item.author}
Labels: ${(item.labels || []).join(', ') || 'none'}
Created: ${item.createdAt}
${item.closedAt ? `Closed: ${item.closedAt}` : ''}
${item.mergedAt ? `Merged: ${item.mergedAt}` : ''}

Description:
${item.body || '(no description)'}

${commentsText ? `Comments:\n${commentsText}` : ''}

Respond with EXACTLY this JSON format (no markdown, no extra text):
{
  "summary": "<one-line summary of what this is about>",
  "status": "<resolved|open|recurring>",
  "contributors": ["<username>", ...],
  "linkedFix": "<PR number or commit SHA if a fix was mentioned, else null>"
}`;

  try {
    let text;
    if (backend.name === 'claude') {
      const response = await withRetry(() => backend.client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }));
      text = response.content[0].text.trim();
    } else {
      const response = await ollama.chat({
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: prompt }],
      });
      text = response.message.content.trim();
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      number: item.number,
      title: item.title,
      state: item.state,
      summary: parsed.summary || '(no summary)',
      status: parsed.status || 'open',
      contributors: parsed.contributors || [item.author].filter(Boolean),
      linkedFix: parsed.linkedFix || null,
    };
  } catch (err) {
    return {
      number: item.number,
      title: item.title,
      state: item.state,
      summary: '(summarization unavailable)',
      status: item.state === 'closed' ? 'resolved' : 'open',
      contributors: [item.author].filter(Boolean),
      linkedFix: null,
    };
  }
}
