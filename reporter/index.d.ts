import type { Reporter, TestCase, TestResult, FullConfig, Suite, FullResult } from '@playwright/test/reporter';

export interface DashboardReporterOptions {
  /**
   * URL of the Playwright Dashboard server
   * @default 'http://localhost:3000'
   */
  serverUrl?: string;

  /**
   * Name of the project to report results under
   * @default 'default-project'
   */
  projectName?: string;

  /**
   * Whether to upload HTML report
   * @default true
   */
  uploadReport?: boolean;

  /**
   * Whether to upload trace files
   * @default true
   */
  uploadTraces?: boolean;

  /**
   * Project description
   */
  projectDescription?: string;

  /**
   * Related issue reference (e.g., JIRA ticket)
   */
  relatedIssue?: string;

  /**
   * CI job information (e.g., Jenkins job URL)
   */
  ciInfo?: string;

  /**
   * Tags to categorize the test run
   */
  tags?: string[];

  /**
   * Additional custom metadata
   */
  customData?: Record<string, any>;

  /**
   * Whether to automatically collect SCM info (git commit, branch, author)
   * @default true
   */
  collectScmInfo?: boolean;

  /**
   * Whether to automatically collect CI environment info
   * @default true
   */
  collectCiInfo?: boolean;

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean;
}

/**
 * Playwright Dashboard Reporter
 *
 * A custom reporter that sends test results to a Playwright Dashboard server.
 *
 * @example
 * ```typescript
 * // playwright.config.ts
 * import { defineConfig } from '@playwright/test';
 *
 * export default defineConfig({
 *   reporter: [
 *     ['playwright-dashboard-reporter', {
 *       serverUrl: 'http://localhost:3000',
 *       projectName: 'my-project',
 *       uploadReport: true
 *     }]
 *   ]
 * });
 * ```
 */
declare class PlaywrightDashboardReporter implements Reporter {
  constructor(options?: DashboardReporterOptions);

  onBegin(config: FullConfig, suite: Suite): void;
  onTestEnd(test: TestCase, result: TestResult): void;
  onEnd(result: FullResult): Promise<void>;
}

export default PlaywrightDashboardReporter;
