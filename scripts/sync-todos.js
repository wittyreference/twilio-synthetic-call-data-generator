// ABOUTME: Script to synchronize todo.md with GitHub issues bidirectionally
// ABOUTME: Maintains consistency between local todos and GitHub issue tracking

const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');

class TodoSyncer {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    this.owner = process.env.GITHUB_OWNER || 'your-username';
    this.repo = process.env.GITHUB_REPO || 'vibe-clauding';
    this.todoPath = path.join(process.cwd(), 'todo.md');
  }

  async getIssues(state = 'open') {
    try {
      const response = await this.octokit.rest.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        state,
        labels: 'todo',
        per_page: 100,
      });

      return response.data;
    } catch (error) {
      console.error(`❌ Failed to fetch issues: ${error.message}`);
      return [];
    }
  }

  parseTodoFile() {
    if (!fs.existsSync(this.todoPath)) {
      console.log('📝 Creating new todo.md file');
      fs.writeFileSync(this.todoPath, '# Todo List\n\n', 'utf8');
      return { todos: [], lines: ['# Todo List', '', ''] };
    }

    const content = fs.readFileSync(this.todoPath, 'utf8');
    const lines = content.split('\n');
    const todos = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match completed todos: - [x] or - [X]
      const completedMatch = line.match(
        /^[\s]*[-*]?\s*\d*\.?\s*\[x|X\]\s*(.+)$/
      );
      if (completedMatch) {
        todos.push({
          title: completedMatch[1].trim(),
          completed: true,
          lineNumber: i,
          originalLine: line,
        });
        continue;
      }

      // Match incomplete todos: - [ ]
      const incompleteMatch = line.match(
        /^[\s]*[-*]?\s*\d*\.?\s*\[\s*\]\s*(.+)$/
      );
      if (incompleteMatch) {
        todos.push({
          title: incompleteMatch[1].trim(),
          completed: false,
          lineNumber: i,
          originalLine: line,
        });
      }
    }

    return { todos, lines };
  }

  async syncTodosToIssues() {
    const { todos } = this.parseTodoFile();
    const issues = await this.getIssues('all');

    console.log(
      `📋 Found ${todos.length} todos and ${issues.length} todo-labeled issues`
    );

    for (const todo of todos) {
      // Find matching issue by title
      const matchingIssue = issues.find(
        issue =>
          issue.title.toLowerCase().includes(todo.title.toLowerCase()) ||
          todo.title.toLowerCase().includes(issue.title.toLowerCase())
      );

      if (matchingIssue) {
        // Update issue state based on todo completion
        const shouldBeClosed = todo.completed && matchingIssue.state === 'open';
        const shouldBeOpened =
          !todo.completed && matchingIssue.state === 'closed';

        if (shouldBeClosed) {
          await this.closeIssue(matchingIssue.number, 'Completed in todo.md');
        } else if (shouldBeOpened) {
          await this.reopenIssue(matchingIssue.number, 'Reopened from todo.md');
        }
      } else if (!todo.completed) {
        // Create new issue for incomplete todos without matching issues
        await this.createIssueFromTodo(todo);
      }
    }
  }

  async syncIssuesToTodos() {
    const issues = await this.getIssues('all');
    const { todos, lines } = this.parseTodoFile();

    let hasChanges = false;
    const newLines = [...lines];

    for (const issue of issues) {
      // Find matching todo
      const matchingTodo = todos.find(
        todo =>
          todo.title.toLowerCase().includes(issue.title.toLowerCase()) ||
          issue.title.toLowerCase().includes(todo.title.toLowerCase())
      );

      if (matchingTodo) {
        // Update todo completion status based on issue state
        const shouldBeCompleted =
          issue.state === 'closed' && !matchingTodo.completed;
        const shouldBeIncomplete =
          issue.state === 'open' && matchingTodo.completed;

        if (shouldBeCompleted) {
          newLines[matchingTodo.lineNumber] = matchingTodo.originalLine.replace(
            /\[\s*\]/,
            '[x]'
          );
          hasChanges = true;
          console.log(`✅ Marked todo as completed: ${matchingTodo.title}`);
        } else if (shouldBeIncomplete) {
          newLines[matchingTodo.lineNumber] = matchingTodo.originalLine.replace(
            /\[x|X\]/,
            '[ ]'
          );
          hasChanges = true;
          console.log(`🔄 Marked todo as incomplete: ${matchingTodo.title}`);
        }
      } else if (issue.state === 'open') {
        // Add new todo for issues without matching todos
        const newTodoLine = `- [ ] ${issue.title}`;
        newLines.push(newTodoLine);
        hasChanges = true;
        console.log(`➕ Added new todo from issue: ${issue.title}`);
      }
    }

    if (hasChanges) {
      fs.writeFileSync(this.todoPath, newLines.join('\n'), 'utf8');
      console.log('💾 Updated todo.md with changes from GitHub issues');
    } else {
      console.log('✨ Todo.md is already in sync with GitHub issues');
    }
  }

  async createIssueFromTodo(todo) {
    try {
      const response = await this.octokit.rest.issues.create({
        owner: this.owner,
        repo: this.repo,
        title: todo.title,
        body: `Auto-synced from todo.md\n\n**Status:** In Progress`,
        labels: ['todo', 'auto-sync'],
      });

      console.log(`➕ Created issue #${response.data.number}: ${todo.title}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to create issue for todo: ${todo.title}`);
    }
  }

  async closeIssue(issueNumber, reason) {
    try {
      await this.octokit.rest.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        state: 'closed',
        state_reason: 'completed',
      });

      await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        body: `🤖 Auto-closed: ${reason}`,
      });

      console.log(`✅ Closed issue #${issueNumber}: ${reason}`);
    } catch (error) {
      console.error(
        `❌ Failed to close issue #${issueNumber}: ${error.message}`
      );
    }
  }

  async reopenIssue(issueNumber, reason) {
    try {
      await this.octokit.rest.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        state: 'open',
      });

      await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        body: `🤖 Auto-reopened: ${reason}`,
      });

      console.log(`🔄 Reopened issue #${issueNumber}: ${reason}`);
    } catch (error) {
      console.error(
        `❌ Failed to reopen issue #${issueNumber}: ${error.message}`
      );
    }
  }

  async fullSync() {
    console.log(
      '🔄 Starting bidirectional sync between todo.md and GitHub issues...'
    );

    // First sync todos to issues (create/update issues)
    await this.syncTodosToIssues();

    // Then sync issues back to todos (update todo status)
    await this.syncIssuesToTodos();

    console.log('✨ Sync completed!');
  }
}

// CLI functionality
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'sync';

  if (!process.env.GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  const syncer = new TodoSyncer();

  try {
    switch (command) {
      case 'sync':
        await syncer.fullSync();
        break;

      case 'todos-to-issues':
        await syncer.syncTodosToIssues();
        break;

      case 'issues-to-todos':
        await syncer.syncIssuesToTodos();
        break;

      default:
        console.log('Todo-GitHub Sync Tool');
        console.log('');
        console.log('Usage:');
        console.log('  node sync-todos.js [command]');
        console.log('');
        console.log('Commands:');
        console.log('  sync              # Full bidirectional sync (default)');
        console.log('  todos-to-issues   # Sync todos to GitHub issues');
        console.log('  issues-to-todos   # Sync GitHub issues to todos');
        break;
    }
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { TodoSyncer };
