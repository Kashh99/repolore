import { Octokit } from '@octokit/rest';
import { saveCache } from './cache.js';

function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set. Add it to your .env file.');
  }
  return new Octokit({ auth: token });
}

export async function fetchRepo(owner, repo) {
  const octokit = getOctokit();
  const repoKey = `${owner}/${repo}`;

  console.log(`  Fetching issues...`);
  const issues = await fetchIssues(octokit, owner, repo);

  console.log(`  Fetching pull requests...`);
  const prs = await fetchPRs(octokit, owner, repo);

  const data = { repoKey, issues, prs, fetchedAt: new Date().toISOString() };
  saveCache(repoKey, data);
  console.log(`  Cached ${issues.length} issues and ${prs.length} PRs.`);

  return data;
}

async function fetchIssues(octokit, owner, repo) {
  const { data } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: 'all',
    per_page: 50,
    sort: 'updated',
    direction: 'desc',
  });

  const issuesOnly = data.filter(i => !i.pull_request);

  const withComments = await Promise.all(
    issuesOnly.map(async (issue) => {
      let comments = [];
      if (issue.comments > 0) {
        try {
          const { data: commentData } = await octokit.issues.listComments({
            owner,
            repo,
            issue_number: issue.number,
            per_page: 10,
          });
          comments = commentData.map(c => ({
            author: c.user?.login,
            body: c.body?.slice(0, 500),
          }));
        } catch {
          // ignore comment fetch failures
        }
      }
      return {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        author: issue.user?.login,
        body: issue.body?.slice(0, 1000),
        labels: issue.labels.map(l => l.name),
        createdAt: issue.created_at,
        closedAt: issue.closed_at,
        comments,
      };
    })
  );

  return withComments;
}

async function fetchPRs(octokit, owner, repo) {
  const { data } = await octokit.pulls.list({
    owner,
    repo,
    state: 'all',
    per_page: 30,
    sort: 'updated',
    direction: 'desc',
  });

  return data.map(pr => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    merged: pr.merged_at !== null,
    author: pr.user?.login,
    body: pr.body?.slice(0, 1000),
    labels: pr.labels.map(l => l.name),
    createdAt: pr.created_at,
    mergedAt: pr.merged_at,
    closedAt: pr.closed_at,
  }));
}
