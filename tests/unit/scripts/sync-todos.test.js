// ABOUTME: Unit tests for scripts/sync-todos.js TodoSyncer class
// ABOUTME: Tests bidirectional sync between todo.md and GitHub issues

// Mock dependencies BEFORE requiring them
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      issues: {
        listForRepo: jest.fn(),
        create: jest.fn(),
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
}));

const { TodoSyncer } = require('../../../scripts/sync-todos');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');

describe('TodoSyncer', () => {
  let syncer;
  let mockOctokit;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_OWNER = 'test-owner';
    process.env.GITHUB_REPO = 'test-repo';

    mockOctokit = {
      rest: {
        issues: {
          listForRepo: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          createComment: jest.fn(),
        },
      },
    };
    Octokit.mockImplementation(() => mockOctokit);

    syncer = new TodoSyncer();
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
  });

  describe('getIssues', () => {
    it('should fetch open issues with todo label', async () => {
      const mockIssues = [{ number: 1, title: 'Test Issue', state: 'open' }];
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: mockIssues,
      });

      const result = await syncer.getIssues('open');

      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        state: 'open',
        labels: 'todo',
        per_page: 100,
      });
      expect(result).toEqual(mockIssues);
    });

    it('should fetch closed issues when state=closed', async () => {
      const mockIssues = [
        { number: 2, title: 'Closed Issue', state: 'closed' },
      ];
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: mockIssues,
      });

      await syncer.getIssues('closed');

      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'closed' })
      );
    });

    it('should fetch all issues when state=all', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });

      await syncer.getIssues('all');

      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'all' })
      );
    });

    it('should handle pagination with per_page 100', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });

      await syncer.getIssues();

      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 100 })
      );
    });

    it('should handle API errors gracefully', async () => {
      mockOctokit.rest.issues.listForRepo.mockRejectedValue(
        new Error('API Error')
      );

      const result = await syncer.getIssues();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      mockOctokit.rest.issues.listForRepo.mockRejectedValue(
        new Error('Network error')
      );

      const result = await syncer.getIssues();

      expect(result).toEqual([]);
    });
  });

  describe('parseTodoFile', () => {
    it('should create new todo.md if it does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});

      const result = syncer.parseTodoFile();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('todo.md'),
        '# Todo List\n\n',
        'utf8'
      );
      expect(result.todos).toEqual([]);
    });

    it('should parse completed todos - [x]', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [x] Completed todo');

      const result = syncer.parseTodoFile();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].completed).toBe(true);
      expect(result.todos[0].title).toBe('Completed todo');
    });

    it('should parse completed todos - [X]', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [X] Completed with capital X');

      const result = syncer.parseTodoFile();

      expect(result.todos[0].completed).toBe(true);
    });

    it('should parse incomplete todos - [ ]', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Incomplete todo');

      const result = syncer.parseTodoFile();

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].completed).toBe(false);
      expect(result.todos[0].title).toBe('Incomplete todo');
    });

    it('should handle numbered todos', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        '1. [x] Numbered completed\n2. [ ] Numbered incomplete'
      );

      const result = syncer.parseTodoFile();

      expect(result.todos).toHaveLength(2);
      expect(result.todos[0].completed).toBe(true);
      expect(result.todos[1].completed).toBe(false);
    });

    it('should track line numbers correctly', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('# Header\n- [ ] First\n\n- [x] Second');

      const result = syncer.parseTodoFile();

      expect(result.todos[0].lineNumber).toBe(1);
      expect(result.todos[1].lineNumber).toBe(3);
    });

    it('should preserve original line format', () => {
      fs.existsSync.mockReturnValue(true);
      const originalLine = '  - [ ] Indented todo';
      fs.readFileSync.mockReturnValue(originalLine);

      const result = syncer.parseTodoFile();

      expect(result.todos[0].originalLine).toBe(originalLine);
    });

    it('should handle empty file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('');

      const result = syncer.parseTodoFile();

      expect(result.todos).toEqual([]);
    });
  });

  describe('syncTodosToIssues', () => {
    it('should create issues for incomplete todos without matching issues', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] New todo');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, title: 'New todo' },
      });

      await syncer.syncTodosToIssues();

      expect(mockOctokit.rest.issues.create).toHaveBeenCalled();
    });

    it('should close issues when matching todo is completed', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [x] Completed todo');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [{ number: 1, title: 'Completed todo', state: 'open' }],
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: {} });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: {} });

      await syncer.syncTodosToIssues();

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({
          issue_number: 1,
          state: 'closed',
        })
      );
    });

    it('should reopen issues when matching todo is unchecked', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Reopened todo');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [{ number: 2, title: 'Reopened todo', state: 'closed' }],
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: {} });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: {} });

      await syncer.syncTodosToIssues();

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({
          issue_number: 2,
          state: 'open',
        })
      );
    });

    it('should match todos and issues by title case-insensitive', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [x] FiX BuG');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [{ number: 3, title: 'fix bug', state: 'open' }],
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: {} });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: {} });

      await syncer.syncTodosToIssues();

      expect(mockOctokit.rest.issues.update).toHaveBeenCalled();
    });

    it('should handle partial title matches', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [x] Fix authentication bug');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [{ number: 4, title: 'authentication', state: 'open' }],
      });
      mockOctokit.rest.issues.update.mockResolvedValue({ data: {} });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: {} });

      await syncer.syncTodosToIssues();

      expect(mockOctokit.rest.issues.update).toHaveBeenCalled();
    });

    it('should not create duplicate issues', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Existing issue');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [{ number: 5, title: 'Existing issue', state: 'open' }],
      });

      await syncer.syncTodosToIssues();

      expect(mockOctokit.rest.issues.create).not.toHaveBeenCalled();
    });
  });

  describe('syncIssuesToTodos', () => {
    it('should mark todos as completed when issues are closed', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Should be completed');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [{ number: 1, title: 'Should be completed', state: 'closed' }],
      });

      await syncer.syncIssuesToTodos();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[x]'),
        'utf8'
      );
    });

    it('should mark todos as incomplete when issues are reopened', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [x] Should be reopened');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [{ number: 2, title: 'Should be reopened', state: 'open' }],
      });

      await syncer.syncIssuesToTodos();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[ ]'),
        'utf8'
      );
    });

    it('should add new todos for open issues without matches', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('# Todos\n');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [{ number: 3, title: 'New issue from GitHub', state: 'open' }],
      });

      await syncer.syncIssuesToTodos();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('New issue from GitHub'),
        'utf8'
      );
    });

    it('should preserve todo.md structure', async () => {
      const originalContent =
        '# Header\n- [ ] Todo 1\n\n## Section\n- [ ] Todo 2';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(originalContent);
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });

      await syncer.syncIssuesToTodos();

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should only write file when changes detected', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Todo');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [{ number: 1, title: 'Todo', state: 'open' }],
      });

      await syncer.syncIssuesToTodos();

      // No changes, so no write
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should log all modifications', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Todo to complete');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [{ number: 1, title: 'Todo to complete', state: 'closed' }],
      });

      await syncer.syncIssuesToTodos();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Marked todo as completed')
      );
    });
  });

  describe('createIssueFromTodo', () => {
    it('should create issue with todo title', async () => {
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, title: 'Test Todo' },
      });

      await syncer.createIssueFromTodo({ title: 'Test Todo' });

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Todo',
        })
      );
    });

    it('should add todo and auto-sync labels', async () => {
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, title: 'Test' },
      });

      await syncer.createIssueFromTodo({ title: 'Test' });

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: expect.arrayContaining(['todo', 'auto-sync']),
        })
      );
    });

    it('should handle creation failures', async () => {
      mockOctokit.rest.issues.create.mockRejectedValue(new Error('Failed'));

      await syncer.createIssueFromTodo({ title: 'Test' });

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('closeIssue', () => {
    it('should update issue state to closed', async () => {
      mockOctokit.rest.issues.update.mockResolvedValue({ data: {} });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: {} });

      await syncer.closeIssue(123, 'Test reason');

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        state: 'closed',
        state_reason: 'completed',
      });
    });

    it('should set state_reason to completed', async () => {
      mockOctokit.rest.issues.update.mockResolvedValue({ data: {} });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: {} });

      await syncer.closeIssue(123, 'Reason');

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({ state_reason: 'completed' })
      );
    });

    it('should add auto-close comment', async () => {
      mockOctokit.rest.issues.update.mockResolvedValue({ data: {} });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: {} });

      await syncer.closeIssue(123, 'Test reason');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          issue_number: 123,
          body: expect.stringContaining('Auto-closed'),
        })
      );
    });

    it('should handle close failures', async () => {
      mockOctokit.rest.issues.update.mockRejectedValue(new Error('Failed'));

      await syncer.closeIssue(123, 'Reason');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('reopenIssue', () => {
    it('should update issue state to open', async () => {
      mockOctokit.rest.issues.update.mockResolvedValue({ data: {} });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: {} });

      await syncer.reopenIssue(456, 'Reopen reason');

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 456,
        state: 'open',
      });
    });

    it('should add auto-reopen comment', async () => {
      mockOctokit.rest.issues.update.mockResolvedValue({ data: {} });
      mockOctokit.rest.issues.createComment.mockResolvedValue({ data: {} });

      await syncer.reopenIssue(456, 'Reopen reason');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          issue_number: 456,
          body: expect.stringContaining('Auto-reopened'),
        })
      );
    });

    it('should handle reopen failures', async () => {
      mockOctokit.rest.issues.update.mockRejectedValue(new Error('Failed'));

      await syncer.reopenIssue(456, 'Reason');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('fullSync', () => {
    it('should call syncTodosToIssues first', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });

      const syncTodosSpy = jest.spyOn(syncer, 'syncTodosToIssues');
      const syncIssuesSpy = jest.spyOn(syncer, 'syncIssuesToTodos');

      await syncer.fullSync();

      expect(syncTodosSpy).toHaveBeenCalled();
      expect(syncIssuesSpy).toHaveBeenCalled();

      // Verify order: syncTodosToIssues called before syncIssuesToTodos
      const todosCallOrder = syncTodosSpy.mock.invocationCallOrder[0];
      const issuesCallOrder = syncIssuesSpy.mock.invocationCallOrder[0];
      expect(todosCallOrder).toBeLessThan(issuesCallOrder);
    });

    it('should call syncIssuesToTodos second', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });

      const syncIssuesSpy = jest.spyOn(syncer, 'syncIssuesToTodos');

      await syncer.fullSync();

      expect(syncIssuesSpy).toHaveBeenCalled();
    });

    it('should complete full bidirectional sync', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Test');
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({ data: [] });

      await syncer.fullSync();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sync completed')
      );
    });
  });
});
