// ABOUTME: Unit tests for scripts/create-github-issue.js GitHubIssueCreator class
// ABOUTME: Tests GitHub API integration for automated issue creation from todos

// Mock dependencies BEFORE requiring them
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      issues: {
        create: jest.fn(),
      },
    },
  })),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

const { GitHubIssueCreator } = require('../../../scripts/create-github-issue');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');

describe('GitHubIssueCreator', () => {
  let creator;
  let mockOctokit;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_OWNER = 'test-owner';
    process.env.GITHUB_REPO = 'test-repo';

    // Get the mocked Octokit instance
    mockOctokit = {
      rest: {
        issues: {
          create: jest.fn(),
        },
      },
    };
    Octokit.mockImplementation(() => mockOctokit);

    creator = new GitHubIssueCreator();
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

  describe('createIssue', () => {
    it('should create GitHub issue with title and body', async () => {
      const mockResponse = {
        data: {
          number: 123,
          html_url: 'https://github.com/test-owner/test-repo/issues/123',
          title: 'Test Issue',
        },
      };
      mockOctokit.rest.issues.create.mockResolvedValue(mockResponse);

      const result = await creator.createIssue('Test Issue', 'Test body');

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test Issue',
        body: 'Test body',
        labels: [],
        assignees: [],
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should add labels correctly', async () => {
      const mockResponse = {
        data: {
          number: 123,
          html_url: 'https://github.com/test-owner/test-repo/issues/123',
        },
      };
      mockOctokit.rest.issues.create.mockResolvedValue(mockResponse);

      await creator.createIssue('Test', 'Body', ['bug', 'enhancement']);

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: ['bug', 'enhancement'],
        })
      );
    });

    it('should add assignees correctly', async () => {
      const mockResponse = {
        data: {
          number: 123,
          html_url: 'https://github.com/test-owner/test-repo/issues/123',
        },
      };
      mockOctokit.rest.issues.create.mockResolvedValue(mockResponse);

      await creator.createIssue('Test', 'Body', [], ['user1', 'user2']);

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          assignees: ['user1', 'user2'],
        })
      );
    });

    it('should return created issue data', async () => {
      const mockResponse = {
        data: {
          number: 456,
          html_url: 'https://github.com/test-owner/test-repo/issues/456',
          title: 'Created Issue',
        },
      };
      mockOctokit.rest.issues.create.mockResolvedValue(mockResponse);

      const result = await creator.createIssue('Created Issue', 'Body');

      expect(result).toEqual(mockResponse.data);
    });

    it('should handle 401 API errors', async () => {
      const error = new Error('Bad credentials');
      error.status = 401;
      mockOctokit.rest.issues.create.mockRejectedValue(error);

      await expect(creator.createIssue('Test', 'Body')).rejects.toThrow(
        'Bad credentials'
      );
    });

    it('should handle 403 API errors', async () => {
      const error = new Error('Forbidden');
      error.status = 403;
      mockOctokit.rest.issues.create.mockRejectedValue(error);

      await expect(creator.createIssue('Test', 'Body')).rejects.toThrow(
        'Forbidden'
      );
    });

    it('should handle 404 API errors', async () => {
      const error = new Error('Not Found');
      error.status = 404;
      mockOctokit.rest.issues.create.mockRejectedValue(error);

      await expect(creator.createIssue('Test', 'Body')).rejects.toThrow(
        'Not Found'
      );
    });

    it('should handle 500 API errors', async () => {
      const error = new Error('Internal Server Error');
      error.status = 500;
      mockOctokit.rest.issues.create.mockRejectedValue(error);

      await expect(creator.createIssue('Test', 'Body')).rejects.toThrow(
        'Internal Server Error'
      );
    });

    it('should log success message with issue number and URL', async () => {
      const mockResponse = {
        data: {
          number: 789,
          html_url: 'https://github.com/test-owner/test-repo/issues/789',
          title: 'Success Issue',
        },
      };
      mockOctokit.rest.issues.create.mockResolvedValue(mockResponse);

      await creator.createIssue('Success Issue', 'Body');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Created issue #789')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://github.com/test-owner/test-repo/issues/789'
        )
      );
    });
  });

  describe('parseTodoMd', () => {
    it('should return empty array when todo.md does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const result = creator.parseTodoMd();

      expect(result).toEqual([]);
    });

    it('should parse unchecked todos with - [ ] format', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] First todo\n- [ ] Second todo');

      const result = creator.parseTodoMd();

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('First todo');
      expect(result[1].title).toBe('Second todo');
    });

    it('should parse unchecked todos with * [ ] format', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('* [ ] Star todo');

      const result = creator.parseTodoMd();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Star todo');
    });

    it('should parse unchecked todos with numbered format', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(
        '1. [ ] Numbered todo\n2. [ ] Another numbered'
      );

      const result = creator.parseTodoMd();

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Numbered todo');
    });

    it('should ignore checked todos - [x]', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [x] Completed\n- [ ] Not completed');

      const result = creator.parseTodoMd();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Not completed');
    });

    it('should handle indented todos', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('  - [ ] Indented todo');

      const result = creator.parseTodoMd();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Indented todo');
    });

    it('should extract todo title correctly', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Todo with special chars !@#$%');

      const result = creator.parseTodoMd();

      expect(result[0].title).toBe('Todo with special chars !@#$%');
    });

    it('should handle empty todo.md file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('');

      const result = creator.parseTodoMd();

      expect(result).toEqual([]);
    });

    it('should include auto-generated labels', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Test todo');

      const result = creator.parseTodoMd();

      expect(result[0].labels).toContain('todo');
      expect(result[0].labels).toContain('auto-generated');
    });
  });

  describe('createIssuesFromTodos', () => {
    it('should create issues for all unchecked todos', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Todo 1\n- [ ] Todo 2');
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/test/issues/1' },
      });

      const result = await creator.createIssuesFromTodos();

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no todos found', async () => {
      fs.existsSync.mockReturnValue(false);

      const result = await creator.createIssuesFromTodos();

      expect(result).toEqual([]);
      expect(mockOctokit.rest.issues.create).not.toHaveBeenCalled();
    });

    it('should add todo and auto-generated labels', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Test todo');
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/test/issues/1' },
      });

      await creator.createIssuesFromTodos();

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: expect.arrayContaining(['todo', 'auto-generated']),
        })
      );
    });

    it('should delay between requests to avoid rate limiting', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Todo 1\n- [ ] Todo 2');
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/test/issues/1' },
      });

      const startTime = Date.now();
      await creator.createIssuesFromTodos();
      const endTime = Date.now();

      // Should have at least 1 second delay between two issues
      expect(endTime - startTime).toBeGreaterThanOrEqual(900);
    });

    it('should continue processing if one issue creation fails', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Todo 1\n- [ ] Todo 2');
      mockOctokit.rest.issues.create
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          data: {
            number: 2,
            html_url: 'https://github.com/test/test/issues/2',
          },
        });

      const result = await creator.createIssuesFromTodos();

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
    });

    it('should log progress and success messages', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('- [ ] Todo 1');
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: {
          number: 1,
          html_url: 'https://github.com/test/test/issues/1',
          title: 'Todo 1',
        },
      });

      await creator.createIssuesFromTodos();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Found 1 todos')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Created issue #1')
      );
    });
  });

  describe('createCustomIssue', () => {
    it('should create issue with custom title and body', async () => {
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/test/issues/1' },
      });

      await creator.createCustomIssue('Custom Title', 'Custom Body');

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Custom Title',
          body: 'Custom Body',
        })
      );
    });

    it('should add manual label by default', async () => {
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/test/issues/1' },
      });

      await creator.createCustomIssue('Title', 'Body');

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: expect.arrayContaining(['manual']),
        })
      );
    });

    it('should merge custom labels with default labels', async () => {
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/test/issues/1' },
      });

      await creator.createCustomIssue('Title', 'Body', ['bug', 'enhancement']);

      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: expect.arrayContaining(['manual', 'bug', 'enhancement']),
        })
      );
    });

    it('should deduplicate labels', async () => {
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/test/issues/1' },
      });

      await creator.createCustomIssue('Title', 'Body', ['manual', 'bug']);

      const call = mockOctokit.rest.issues.create.mock.calls[0][0];
      const labels = call.labels;

      // Should only have one 'manual' label
      expect(labels.filter(l => l === 'manual')).toHaveLength(1);
      expect(labels).toContain('bug');
    });
  });
});
