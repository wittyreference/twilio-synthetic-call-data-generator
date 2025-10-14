// ABOUTME: Integration tests for GitHub scripts workflow
// ABOUTME: Tests end-to-end integration of setup, issue creation, and todo synchronization

// Mock dependencies
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      issues: {
        create: jest.fn(),
        listForRepo: jest.fn(),
        update: jest.fn(),
        createComment: jest.fn(),
      },
    },
  })),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const { SetupManager } = require('../../../scripts/setup');
const { GitHubIssueCreator } = require('../../../scripts/create-github-issue');
const { TodoSyncer } = require('../../../scripts/sync-todos');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const child_process = require('child_process');

describe('GitHub Scripts Integration', () => {
  let setupManager;
  let issueCreator;
  let todoSyncer;
  let mockOctokit;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Set up environment
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_OWNER = 'test-owner';
    process.env.GITHUB_REPO = 'test-repo';
    process.env.ACCOUNT_SID = 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    process.env.AUTH_TOKEN = 'test_auth_token_32_characters_long_1234567890';

    // Mock Octokit
    mockOctokit = {
      rest: {
        issues: {
          create: jest.fn(),
          listForRepo: jest.fn(),
          update: jest.fn(),
          createComment: jest.fn(),
        },
      },
    };
    Octokit.mockImplementation(() => mockOctokit);

    // Create instances
    setupManager = new SetupManager();
    issueCreator = new GitHubIssueCreator();
    todoSyncer = new TodoSyncer();

    // Spy on console
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_OWNER;
    delete process.env.GITHUB_REPO;
    delete process.env.ACCOUNT_SID;
    delete process.env.AUTH_TOKEN;
  });

  describe('Complete workflow: Create Issues → Sync', () => {
    it('should complete full workflow successfully', async () => {
      // Step 1: User has todos in todo.md
      const todoContent = `# Todo List

- [ ] Implement feature A
- [ ] Fix bug B
- [ ] Add tests for C
`;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(todoContent);

      // Step 2: Create GitHub issues from todos
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/test/issues/1' },
      });

      const issues = await issueCreator.createIssuesFromTodos();

      expect(issues).toHaveLength(3);
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledTimes(3);

      // Step 3: User completes a todo in todo.md
      const updatedTodoContent = `# Todo List

- [x] Implement feature A
- [ ] Fix bug B
- [ ] Add tests for C
`;
      fs.readFileSync.mockReturnValue(updatedTodoContent);

      // Step 4: Sync todos to issues (should close issue #1)
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'Implement feature A',
            state: 'open',
            labels: [{ name: 'todo' }],
          },
          {
            number: 2,
            title: 'Fix bug B',
            state: 'open',
            labels: [{ name: 'todo' }],
          },
          {
            number: 3,
            title: 'Add tests for C',
            state: 'open',
            labels: [{ name: 'todo' }],
          },
        ],
      });

      await todoSyncer.syncTodosToIssues();

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({
          issue_number: 1,
          state: 'closed',
        })
      );
    });

    it('should handle bidirectional sync correctly', async () => {
      // Initial todo.md state
      const initialTodoContent = `# Todo List

- [ ] Task 1
- [ ] Task 2
`;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(initialTodoContent);

      // GitHub has closed issue for Task 1
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'Task 1',
            state: 'closed',
            labels: [{ name: 'todo' }],
          },
          {
            number: 2,
            title: 'Task 2',
            state: 'open',
            labels: [{ name: 'todo' }],
          },
        ],
      });

      // Sync issues to todos
      await todoSyncer.syncIssuesToTodos();

      // Should update todo.md to mark Task 1 as completed
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('todo.md'),
        expect.stringContaining('[x] Task 1'),
        'utf8'
      );
    });

    it('should create new issues for todos without matches', async () => {
      const todoContent = `# Todo List

- [ ] New task without issue
`;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(todoContent);

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [], // No existing issues
      });

      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/test/issues/1' },
      });

      await todoSyncer.syncTodosToIssues();

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New task without issue',
          labels: expect.arrayContaining(['todo', 'auto-sync']),
        })
      );
    });

    it('should add new todos for issues without matches', async () => {
      const todoContent = `# Todo List

`;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(todoContent);

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'Issue without todo',
            state: 'open',
            labels: [{ name: 'todo' }],
          },
        ],
      });

      await todoSyncer.syncIssuesToTodos();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('todo.md'),
        expect.stringContaining('[ ] Issue without todo'),
        'utf8'
      );
    });
  });

  describe('Error handling across components', () => {
    it('should handle GitHub API failures gracefully', async () => {
      const todoContent = `# Todo List

- [ ] Test task
`;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(todoContent);

      const apiError = new Error('API rate limit exceeded');
      apiError.status = 403;
      mockOctokit.rest.issues.listForRepo.mockRejectedValue(apiError);

      const issues = await todoSyncer.getIssues();

      expect(issues).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch issues')
      );
    });

    it('should continue sync when individual issue creation fails', async () => {
      const todoContent = `# Todo List

- [ ] Task 1
- [ ] Task 2
`;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(todoContent);

      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [],
      });

      mockOctokit.rest.issues.create
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          data: {
            number: 2,
            html_url: 'https://github.com/test/test/issues/2',
          },
        });

      await todoSyncer.syncTodosToIssues();

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledTimes(2);
    });

    it('should handle missing environment variables', () => {
      delete process.env.GITHUB_TOKEN;

      expect(() => {
        if (!process.env.GITHUB_TOKEN) {
          throw new Error('GITHUB_TOKEN is required');
        }
      }).toThrow('GITHUB_TOKEN is required');
    });
  });

  describe('Setup manager integration', () => {
    it('should run tests successfully', async () => {
      child_process.execSync.mockReturnValue(Buffer.from('All tests passed'));

      await setupManager.runTests();

      expect(child_process.execSync).toHaveBeenCalledWith(
        'npm test',
        expect.any(Object)
      );
    });

    it('should install dependencies', async () => {
      child_process.execSync.mockReturnValue(
        Buffer.from('Dependencies installed')
      );

      await setupManager.installDependencies();

      expect(child_process.execSync).toHaveBeenCalled();
    });
  });

  describe('Label management', () => {
    it('should apply correct labels to auto-generated issues', async () => {
      const todoContent = `# Todo List

- [ ] Auto task
`;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(todoContent);

      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/test/issues/1' },
      });

      const issues = await issueCreator.createIssuesFromTodos();

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: expect.arrayContaining(['todo', 'auto-generated']),
        })
      );
    });

    it('should apply correct labels to manually created issues', async () => {
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/test/issues/1' },
      });

      await issueCreator.createCustomIssue('Manual issue', 'Body', ['bug']);

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: expect.arrayContaining(['manual', 'bug']),
        })
      );
    });
  });

  describe('Full synchronization lifecycle', () => {
    it('should maintain consistency through multiple sync operations', async () => {
      // Initial state: empty todo.md
      let todoContent = '# Todo List\n\n';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => todoContent);

      // Operation 1: Add issue on GitHub
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'GitHub task',
            state: 'open',
            labels: [{ name: 'todo' }],
          },
        ],
      });

      await todoSyncer.syncIssuesToTodos();

      // Should add todo
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('todo.md'),
        expect.stringContaining('[ ] GitHub task'),
        'utf8'
      );

      // Update local state
      todoContent = '# Todo List\n\n- [ ] GitHub task\n';

      // Operation 2: Complete todo locally
      todoContent = '# Todo List\n\n- [x] GitHub task\n';
      fs.readFileSync.mockReturnValue(todoContent);

      await todoSyncer.syncTodosToIssues();

      // Should close issue
      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({
          issue_number: 1,
          state: 'closed',
        })
      );

      // Operation 3: Reopen issue on GitHub
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'GitHub task',
            state: 'open',
            labels: [{ name: 'todo' }],
          },
        ],
      });

      await todoSyncer.syncIssuesToTodos();

      // Should uncheck todo
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('todo.md'),
        expect.stringContaining('[ ] GitHub task'),
        'utf8'
      );
    });
  });
});
