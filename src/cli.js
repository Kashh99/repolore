#!/usr/bin/env node
import 'dotenv/config';
import { program } from 'commander';
import { fetchRepo } from './github.js';
import { getCached, deleteCache, listCached } from './cache.js';
import { summarizeIssues } from './summarize.js';
import { displaySummaries, displayRaw, displayHistory, displayQueryResults } from './display.js';

program
  .name('opsmem')
  .description('Fetch, cache, and summarize GitHub repo incidents')
  .version('1.0.0');

program
  .command('analyze <github-repo-url>')
  .description('Fetch and summarize repo incidents')
  .option('--no-ai', 'Skip Ollama summarization and display raw issue/PR data')
  .option('--refresh', 'Delete cached data and re-fetch from GitHub')
  .action(async (repoUrl, opts) => {
    try {
      const { owner, repo } = parseRepoUrl(repoUrl);
      const repoKey = `${owner}/${repo}`;

      if (opts.refresh) {
        deleteCache(repoKey);
        console.log(`Cache cleared for ${repoKey}`);
      }

      const existing = getCached(repoKey);
      const data = existing
        ? (console.log(`Using cached data for ${repoKey} (use --refresh to re-fetch)`), existing)
        : (console.log(`Fetching ${repoKey} from GitHub...`), await fetchRepo(owner, repo));

      if (opts.ai === false) {
        displayRaw(repoKey, data.issues, data.prs);
      } else {
        console.log(`Summarizing with Ollama (mistral)...`);
        const summaries = await summarizeIssues(data.issues, data.prs);
        displaySummaries(repoKey, summaries);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('query <keyword>')
  .description('Search cached memory for a keyword')
  .action((keyword) => {
    try {
      const results = searchCache(keyword);
      if (results.length === 0) {
        console.log(`No cached results found for "${keyword}"`);
      } else {
        displayQueryResults(keyword, results);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('List all analyzed repos')
  .action(() => {
    try {
      const repos = listCached();
      displayHistory(repos);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

function parseRepoUrl(url) {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: ${url}\nExpected format: https://github.com/owner/repo`);
  }
  return { owner: match[1], repo: match[2] };
}

function searchCache(keyword) {
  const repos = listCached();
  const lower = keyword.toLowerCase();
  const results = [];

  for (const repo of repos) {
    const data = getCached(repo.key);
    if (!data) continue;

    const matchingIssues = (data.issues || []).filter(issue =>
      issue.title?.toLowerCase().includes(lower) ||
      issue.body?.toLowerCase().includes(lower)
    );
    const matchingPRs = (data.prs || []).filter(pr =>
      pr.title?.toLowerCase().includes(lower) ||
      pr.body?.toLowerCase().includes(lower)
    );

    if (matchingIssues.length > 0 || matchingPRs.length > 0) {
      results.push({ repo: repo.key, issues: matchingIssues, prs: matchingPRs });
    }
  }

  return results;
}

program.parse();
