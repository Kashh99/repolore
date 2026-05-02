import chalk from 'chalk';
import Table from 'cli-table3';

const STATUS_COLOR = {
  resolved: chalk.green,
  open: chalk.yellow,
  recurring: chalk.red,
};

export function displaySummaries(repoKey, summaries) {
  console.log('');
  console.log(chalk.bold.cyan(`  Incident Memory: ${repoKey}`));
  console.log(chalk.dim(`  ${summaries.length} items analyzed\n`));

  displayPatterns(summaries);

  const issues = summaries.filter(s => s.type === 'issue');
  const prs = summaries.filter(s => s.type === 'pr');

  if (issues.length > 0) {
    console.log(chalk.bold.white('  Issues'));
    printSummaryTable(issues);
  }

  if (prs.length > 0) {
    console.log(chalk.bold.white('  Pull Requests'));
    printSummaryTable(prs);
  }
}

const STOP_WORDS = new Set([
  // common english
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','was','are','were','be','been','being','have','has','had','do','does',
  'did','will','would','could','should','may','might','not','no','this','that',
  'it','its','by','from','as','into','after','when','if','due','via','per',
  'while','during','regarding','works','working',
  // github / issue noise
  'issue','issues','error','bug','fix','add','update','support','request',
  'feature','pr','pull','change','changes','make','use','using','used',
  'added','fixed','created','implemented','resolved','replacement','improvement',
  'behavior','calling','caused','running',
  // tech noise
  'package','spinner','spinners','node','library','version','method','function',
  'docs','usage','file','option','modules','default','stream','clear','catch',
  // additional noise
  'user','requested','requests','options','type','summarization',
  'instead','unable','cannot','causes','causing','each','only',
  'built','replace','breaks','close','alternative','upgrade',
]);

function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

function clusterByKeyword(summaries) {
  const keywordToItems = new Map();

  for (const item of summaries) {
    const words = new Set(extractKeywords(item.summary));
    for (const word of words) {
      if (!keywordToItems.has(word)) keywordToItems.set(word, []);
      keywordToItems.get(word).push(item);
    }
  }

  // keep only keywords that cluster 2+ distinct items
  const clusters = [];
  const seenSets = new Set();

  for (const [keyword, items] of keywordToItems) {
    if (items.length < 2) continue;

    // deduplicate clusters with identical item sets
    const key = items.map(i => i.number).sort().join(',');
    if (seenSets.has(key)) continue;
    seenSets.add(key);

    clusters.push({ keyword, items });
  }

  // sort by cluster size descending
  clusters.sort((a, b) => b.items.length - a.items.length);
  return clusters;
}

function displayPatterns(summaries) {
  const clusters = clusterByKeyword(summaries);
  if (clusters.length === 0) return;

  console.log(chalk.bold.yellow('  Recurring Patterns'));

  const table = new Table({
    head: [chalk.bold('Keyword'), chalk.bold('Count'), chalk.bold('Related Items')],
    colWidths: [18, 8, 75],
    wordWrap: true,
    style: { head: [], border: ['dim'] },
  });

  for (const { keyword, items } of clusters) {
    const refs = items
      .map(i => `#${i.number} ${i.summary.slice(0, 40)}${i.summary.length > 40 ? '…' : ''}`)
      .join('\n');
    table.push([chalk.yellow(keyword), String(items.length), chalk.dim(refs)]);
  }

  console.log(table.toString());
  console.log('');
}

function printSummaryTable(items) {
  const table = new Table({
    head: [
      chalk.bold('#'),
      chalk.bold('Summary'),
      chalk.bold('Status'),
      chalk.bold('Contributors'),
      chalk.bold('Fix'),
    ],
    colWidths: [6, 55, 12, 22, 12],
    wordWrap: true,
    style: { head: [], border: ['dim'] },
  });

  for (const item of items) {
    const statusFn = STATUS_COLOR[item.status] || chalk.white;
    table.push([
      chalk.dim(`#${item.number}`),
      item.summary,
      statusFn(item.status),
      (item.contributors || []).join(', ') || '-',
      item.linkedFix ? chalk.blue(item.linkedFix) : chalk.dim('-'),
    ]);
  }

  console.log(table.toString());
  console.log('');
}

export function displayRaw(repoKey, issues, prs) {
  console.log('');
  console.log(chalk.bold.cyan(`  Incident Memory: ${repoKey}`));
  console.log(chalk.dim(`  ${issues.length} issues, ${prs.length} PRs (raw)\n`));

  if (issues.length > 0) {
    console.log(chalk.bold.white('  Issues'));
    const table = new Table({
      head: [chalk.bold('#'), chalk.bold('Title'), chalk.bold('State'), chalk.bold('Author'), chalk.bold('Labels')],
      colWidths: [6, 52, 10, 18, 20],
      wordWrap: true,
      style: { head: [], border: ['dim'] },
    });
    for (const issue of issues) {
      const stateColor = issue.state === 'closed' ? chalk.green : chalk.yellow;
      table.push([
        chalk.dim(`#${issue.number}`),
        issue.title,
        stateColor(issue.state),
        issue.author || '-',
        (issue.labels || []).join(', ') || '-',
      ]);
    }
    console.log(table.toString());
    console.log('');
  }

  if (prs.length > 0) {
    console.log(chalk.bold.white('  Pull Requests'));
    const table = new Table({
      head: [chalk.bold('#'), chalk.bold('Title'), chalk.bold('State'), chalk.bold('Author'), chalk.bold('Labels')],
      colWidths: [6, 52, 10, 18, 20],
      wordWrap: true,
      style: { head: [], border: ['dim'] },
    });
    for (const pr of prs) {
      const stateColor = pr.merged ? chalk.magenta : pr.state === 'closed' ? chalk.red : chalk.yellow;
      const stateLabel = pr.merged ? 'merged' : pr.state;
      table.push([
        chalk.dim(`#${pr.number}`),
        pr.title,
        stateColor(stateLabel),
        pr.author || '-',
        (pr.labels || []).join(', ') || '-',
      ]);
    }
    console.log(table.toString());
    console.log('');
  }
}

export function displayHistory(repos) {
  if (repos.length === 0) {
    console.log(chalk.yellow('\n  No repos analyzed yet. Run: opsmem analyze <github-url>\n'));
    return;
  }

  console.log('');
  console.log(chalk.bold.cyan('  Analyzed Repos'));

  const table = new Table({
    head: [chalk.bold('Repository'), chalk.bold('Cached At')],
    colWidths: [45, 30],
    style: { head: [], border: ['dim'] },
  });

  for (const repo of repos) {
    const date = new Date(repo.fetchedAt).toLocaleString();
    table.push([chalk.white(repo.key), chalk.dim(date)]);
  }

  console.log(table.toString());
  console.log('');
}

export function displayQueryResults(keyword, results) {
  console.log('');
  console.log(chalk.bold.cyan(`  Query results for: "${keyword}"`));

  for (const result of results) {
    console.log(chalk.bold.white(`\n  ${result.repo}`));

    if (result.issues.length > 0) {
      console.log(chalk.dim(`  Issues (${result.issues.length})`));
      const table = new Table({
        head: [chalk.bold('#'), chalk.bold('Title'), chalk.bold('State')],
        colWidths: [6, 65, 12],
        wordWrap: true,
        style: { head: [], border: ['dim'] },
      });
      for (const issue of result.issues) {
        const stateColor = issue.state === 'closed' ? chalk.green : chalk.yellow;
        table.push([chalk.dim(`#${issue.number}`), issue.title, stateColor(issue.state)]);
      }
      console.log(table.toString());
    }

    if (result.prs.length > 0) {
      console.log(chalk.dim(`  Pull Requests (${result.prs.length})`));
      const table = new Table({
        head: [chalk.bold('#'), chalk.bold('Title'), chalk.bold('State')],
        colWidths: [6, 65, 12],
        wordWrap: true,
        style: { head: [], border: ['dim'] },
      });
      for (const pr of result.prs) {
        const stateColor = pr.merged ? chalk.magenta : pr.state === 'closed' ? chalk.red : chalk.yellow;
        const stateLabel = pr.merged ? 'merged' : pr.state;
        table.push([chalk.dim(`#${pr.number}`), pr.title, stateColor(stateLabel)]);
      }
      console.log(table.toString());
    }
  }

  console.log('');
}
