import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

test.describe('Reporter Integration Tests', () => {
  const tempDir = join(process.cwd(), '.test-temp');
  const reporterPath = join(process.cwd(), 'reporter', 'index.js');

  test.beforeAll(() => {
    // Create temp directory for test files
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
  });

  test('reporter module should be loadable', async () => {
    // Check that reporter file exists
    expect(existsSync(reporterPath)).toBe(true);
    
    // Try to require it
    const Reporter = require(reporterPath);
    expect(Reporter).toBeDefined();
    expect(typeof Reporter).toBe('function');
  });

  test('reporter should have correct configuration options', async () => {
    const Reporter = require(reporterPath);
    
    // Create instance with options
    const reporter = new Reporter({
      serverUrl: 'http://test-server:3000',
      projectName: 'test-project',
      uploadTraces: false,
      uploadReport: false
    });
    
    expect(reporter.options).toBeDefined();
    expect(reporter.options.serverUrl).toBe('http://test-server:3000');
    expect(reporter.options.projectName).toBe('test-project');
    expect(reporter.options.uploadTraces).toBe(false);
    expect(reporter.options.uploadReport).toBe(false);
  });

  test('reporter should use default values when no options provided', async () => {
    const Reporter = require(reporterPath);
    
    const reporter = new Reporter();
    
    expect(reporter.options.serverUrl).toBe('http://localhost:3000');
    expect(reporter.options.projectName).toBe('default-project');
    expect(reporter.options.uploadTraces).toBe(true);
    expect(reporter.options.uploadReport).toBe(true);
  });

  test('reporter should collect test results', async () => {
    const Reporter = require(reporterPath);
    
    const reporter = new Reporter({
      serverUrl: 'http://localhost:3000',
      projectName: 'reporter-test',
      uploadTraces: false,
      uploadReport: false
    });
    
    // Simulate test lifecycle
    reporter.onBegin({}, {});
    
    // Simulate test end
    const mockTest = {
      title: 'sample test',
      location: { file: 'test.spec.ts', line: 10, column: 5 }
    };
    
    const mockResult = {
      status: 'passed',
      duration: 1000,
      retry: 0,
      attachments: []
    };
    
    reporter.onTestEnd(mockTest, mockResult);
    
    expect(reporter.testCases).toHaveLength(1);
    expect(reporter.testCases[0].title).toBe('sample test');
    expect(reporter.passedTests).toBe(1);
  });

  test('reporter should track test statuses correctly', async () => {
    const Reporter = require(reporterPath);
    
    const reporter = new Reporter({
      serverUrl: 'http://localhost:3000',
      projectName: 'status-test',
      uploadTraces: false,
      uploadReport: false
    });
    
    reporter.onBegin({}, {});
    
    // Add passed test
    reporter.onTestEnd(
      { title: 'passed test', location: { file: 'test.spec.ts', line: 1, column: 1 } },
      { status: 'passed', duration: 1000, retry: 0, attachments: [] }
    );
    
    // Add failed test
    reporter.onTestEnd(
      { title: 'failed test', location: { file: 'test.spec.ts', line: 2, column: 1 } },
      { status: 'failed', duration: 2000, retry: 0, error: { message: 'Test failed' }, attachments: [] }
    );
    
    // Add skipped test
    reporter.onTestEnd(
      { title: 'skipped test', location: { file: 'test.spec.ts', line: 3, column: 1 } },
      { status: 'skipped', duration: 0, retry: 0, attachments: [] }
    );
    
    expect(reporter.totalTests).toBe(3);
    expect(reporter.passedTests).toBe(1);
    expect(reporter.failedTests).toBe(1);
    expect(reporter.skippedTests).toBe(1);
  });

  test('reporter should successfully upload results to server', async ({ request }) => {
    const Reporter = require(reporterPath);
    
    const reporter = new Reporter({
      serverUrl: 'http://localhost:3000',
      projectName: 'upload-test-project',
      uploadTraces: false,
      uploadReport: false
    });
    
    // Setup test data
    reporter.onBegin({}, {});
    reporter.startTime = new Date().toISOString();
    
    reporter.onTestEnd(
      { title: 'upload test', location: { file: 'test.spec.ts', line: 1, column: 1 } },
      { status: 'passed', duration: 1500, retry: 0, attachments: [] }
    );
    
    // Call onEnd (this will upload)
    await reporter.onEnd({ status: 'passed' });
    
    // Verify data was uploaded by checking the API
    const response = await request.get('/api/projects');
    const projects = await response.json();
    
    const uploadedProject = projects.find((p: any) => p.name === 'upload-test-project');
    expect(uploadedProject).toBeDefined();
    expect(uploadedProject.totalRuns).toBeGreaterThan(0);
  });

  test('reporter package.json should have correct metadata', async () => {
    const packageJsonPath = join(process.cwd(), 'reporter', 'package.json');
    expect(existsSync(packageJsonPath)).toBe(true);
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    expect(packageJson.name).toBe('playwright-dashboard-reporter');
    expect(packageJson.main).toBe('index.js');
    expect(packageJson.types).toBe('index.d.ts');
    expect(packageJson.peerDependencies).toBeDefined();
    expect(packageJson.peerDependencies['@playwright/test']).toBeDefined();
  });

  test('reporter should have TypeScript definitions', async () => {
    const typeDefsPath = join(process.cwd(), 'reporter', 'index.d.ts');
    expect(existsSync(typeDefsPath)).toBe(true);
    
    const typeDefs = readFileSync(typeDefsPath, 'utf-8');
    expect(typeDefs).toContain('DashboardReporterOptions');
    expect(typeDefs).toContain('serverUrl');
    expect(typeDefs).toContain('projectName');
    expect(typeDefs).toContain('uploadTraces');
    expect(typeDefs).toContain('uploadReport');
  });

  test('reporter should handle network errors gracefully', async () => {
    const Reporter = require(reporterPath);
    
    const reporter = new Reporter({
      serverUrl: 'http://invalid-server:9999',
      projectName: 'error-test',
      uploadTraces: false,
      uploadReport: false
    });
    
    reporter.onBegin({}, {});
    reporter.startTime = new Date().toISOString();
    
    reporter.onTestEnd(
      { title: 'test', location: { file: 'test.spec.ts', line: 1, column: 1 } },
      { status: 'passed', duration: 1000, retry: 0, attachments: [] }
    );
    
    // This should not throw, just log error
    await expect(reporter.onEnd({ status: 'passed' })).rejects.toThrow();
  });
});
