/**
 * The run-level baseline: which earlier passing run a run is compared against
 * by the Changes tab, the stored regression signals, the CI gate, pull-request
 * feedback and the AI diagnosis. The selection itself is a database query
 * (`server/utils/branch-baseline.ts`); this module holds the shapes that
 * describe the outcome and the one sentence every surface uses to explain it.
 */

/**
 * How the baseline relates to the run it is compared against.
 *
 * `branch` — `same`: the run's own branch; `fallback`: the branch the run's
 * branch forked from (the pull request's target, else the project default);
 * `chosen`: the base branch a user picked; `any`: some other branch, because
 * none of the above had a passing run; `null`: the run has no branch, so the
 * branch was not a criterion.
 *
 * `environment` — `same`: the run's own environment label; `other`: another
 * label, because the run's environment has no passing run; `null`: the run has
 * no environment label, so the environment was not a criterion.
 */
export interface RunBaselineMatch {
  branch: 'same' | 'fallback' | 'chosen' | 'any' | null;
  environment: 'same' | 'other' | null;
}

/** The branch the automatic ladder falls back to, and where it came from. */
export interface RunBaselineFallback {
  branch: string;
  source: 'pull-request' | 'default';
}

export interface RunBaselineScope {
  branch: string | null;
  environment: string | null;
}

function environmentLabel(environment: string | null): string {
  return environment ? `the ${environment} environment` : 'a run with no environment label';
}

function fallbackLabel(fallback: RunBaselineFallback | null): string {
  if (!fallback) return 'the default branch';
  const source = fallback.source === 'pull-request' ? "the pull request's target branch" : 'the default branch';
  return `${source} ${fallback.branch}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * One sentence saying why this baseline was chosen — for the Changes tab, the
 * MCP insights and the AI context. Examples: "The last passing run on
 * feature/x in staging." / "No passing staging run exists on feature/x; the
 * last passing run on the default branch main in staging." / "No passing
 * staging run exists; the last passing run on feature/x, from the production
 * environment."
 */
export function describeRunBaseline(input: {
  run: RunBaselineScope;
  baseline: RunBaselineScope;
  match: RunBaselineMatch;
  fallback: RunBaselineFallback | null;
}): string {
  const { run, baseline, match, fallback } = input;
  const env = run.environment;
  const sameEnv = match.environment === 'same' && env ? ` in ${env}` : '';
  const otherEnv = match.environment === 'other' ? `, from ${environmentLabel(baseline.environment)}` : '';
  const envWord = match.environment === 'same' && env ? `${env} ` : '';

  let picked: string;
  switch (match.branch) {
    case 'same':
      picked = `the last passing run on ${run.branch}${sameEnv}${otherEnv}`;
      break;
    case 'fallback':
      picked = `the last passing run on ${fallbackLabel(fallback)}${sameEnv}${otherEnv}`;
      break;
    case 'chosen':
      picked = `the last passing run on ${baseline.branch}${sameEnv}, the base branch you chose${otherEnv}`;
      break;
    case 'any': {
      const where = match.environment === 'other' ? ` in ${baseline.environment ?? 'no environment'}` : '';
      picked = `the most recent passing run${sameEnv}, from ${baseline.branch ?? 'a run with no branch'}${where}`;
      break;
    }
    default:
      picked = envWord ? `the last passing ${envWord}run` : `the most recent passing run${otherEnv}`;
  }

  const reasons: string[] = [];
  if (match.branch === null && match.environment !== null) reasons.push('this run has no branch');
  if (match.environment === 'other' && env) {
    reasons.push(
      match.branch === 'chosen' ? `no passing ${env} run exists on ${baseline.branch}` : `no passing ${env} run exists`,
    );
  }
  if (match.branch === 'fallback') reasons.push(`no passing ${envWord}run exists on ${run.branch}`);
  if (match.branch === 'any' && run.branch) {
    reasons.push(`no passing ${envWord}run exists on ${run.branch} or ${fallback?.branch ?? 'the default branch'}`);
  }

  if (reasons.length === 0) return `${capitalize(picked)}.`;
  return `${capitalize(reasons.join(', and '))}; ${picked}.`;
}
