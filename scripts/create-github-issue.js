// ABOUTME: Script to create GitHub issues from todo.md or command line arguments
// ABOUTME: Integrates with GitHub API to automate issue creation from agent pipeline

const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');

class GitHubIssueCreator {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    // Get repo info from package.json or environment
    this.owner = process.env.GITHUB_OWNER || 'your-username';
    this.repo = process.env.GITHUB_REPO || 'vibe-clauding';
  }

  async createIssue(title, body, labels = [], assignees = []) {
    try {
      const response = await this.octokit.rest.issues.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body,
        labels,
        assignees,
      });

      console.log(`✅ Created issue #${response.data.number}: ${title}`);
      console.log(`   URL: ${response.data.html_url}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to create issue: ${error.message}`);
      throw error;
    }
  }

  parseTodoMd() {
    const todoPath = path.join(process.cwd(), 'todo.md');

    if (!fs.existsSync(todoPath)) {
      console.log('📝 No todo.md file found');
      return [];
    }

    const content = fs.readFileSync(todoPath, 'utf8');
    const lines = content.split('\n');
    const todos = [];

    for (const line of lines) {
      // Match various todo formats: - [ ], * [ ], 1. [ ], etc.
      const todoMatch = line.match(/^[\s]*[-*]?\s*\d*\.?\s*\[\s*\]\s*(.+)$/);
      if (todoMatch) {
        todos.push({
          title: todoMatch[1].trim(),
          body: `Auto-generated from todo.md\n\n**Original line:** ${line.trim()}`,
          labels: ['todo', 'auto-generated'],
        });
      }
    }

    return todos;
  }

  async createIssuesFromTodos() {
    const todos = this.parseTodoMd();

    if (todos.length === 0) {
      console.log('📝 No unchecked todos found to convert to issues');
      return [];
    }

    console.log(`📋 Found ${todos.length} todos to convert to issues`);
    const createdIssues = [];

    for (const todo of todos) {
      try {
        const issue = await this.createIssue(
          todo.title,
          todo.body,
          todo.labels
        );
        createdIssues.push(issue);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Failed to create issue for: ${todo.title}`);
      }
    }

    return createdIssues;
  }

  async createCustomIssue(title, body, labels = []) {
    const defaultLabels = ['manual'];
    const allLabels = [...new Set([...defaultLabels, ...labels])];

    return await this.createIssue(title, body, allLabels);
  }
}

// CLI functionality
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    console.error(
      '   Export it in your shell: export GITHUB_TOKEN=your_token_here'
    );
    process.exit(1);
  }

  const creator = new GitHubIssueCreator();

  try {
    switch (command) {
      case 'from-todos':
        await creator.createIssuesFromTodos();
        break;

      case 'create': {
        if (args.length < 3) {
          console.error(
            '❌ Usage: node create-github-issue.js create "Issue Title" "Issue Body"'
          );
          process.exit(1);
        }
        const title = args[1];
        const body = args[2];
        const labels = args.slice(3);
        await creator.createCustomIssue(title, body, labels);
        break;
      }

      default:
        console.log('GitHub Issue Creator');
        console.log('');
        console.log('Usage:');
        console.log(
          '  node create-github-issue.js from-todos                    # Create issues from todo.md'
        );
        console.log(
          '  node create-github-issue.js create "Title" "Body" [labels] # Create custom issue'
        );
        console.log('');
        console.log('Environment variables:');
        console.log(
          '  GITHUB_TOKEN  - GitHub personal access token (required)'
        );
        console.log(
          '  GITHUB_OWNER  - GitHub username/organization (optional)'
        );
        console.log('  GITHUB_REPO   - Repository name (optional)');
        break;
    }
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { GitHubIssueCreator };
