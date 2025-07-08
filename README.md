ABOUTME: This file provides setup instructions for creating prompt files and configuring GitHub repositories.
ABOUTME: It also includes steps for installing and configuring Git, and outlines the agent-assisted pipeline template.

# Project Setup and Agent-Assisted Pipeline Template

This repository serves as a template for our end-to-end agent-assisted pipeline. Teams can use this template to:
- Brainstorm new software product ideas with a chat LLM.
- Convert ideas into detailed software specifications (`spec.md`).
- Generate prompt plans (`prompt_plan.md`) and to-do lists (`todo.md`) for execution.
- Seamlessly create GitHub issues, manage tasks, and execute work through coding agents.

## Table of Contents

- [Instructions](#instructions)
- [Agent-Assisted Pipeline Overview](#agent-assisted-pipeline-overview)
- [Setup Instructions](#setup-instructions)
  - [Git Setup](#git-setup)
  - [Node.js and npm Setup](#nodejs-and-npm-setup)
  - [Twilio-specific Setup](#twilio-specific-setup)
  - [Python and Package Management](#python-and-package-management)
  - [Environment Variables](#environment-variables)
- [Usage](#usage)
  - [Idea Generation and Specification](#idea-generation-and-specification)
  - [Generating Task Artifacts](#generating-task-artifacts)
  - [Running the Pipeline](#running-the-pipeline)
- [GitHub Integration](#github-integration)
  - [Automation with GitHub Actions](#automation-with-github-actions)
  - [Issue & Task Management](#issue--task-management)
- [Example Artifacts](#example-artifacts)
- [Contribution Guidelines](#contribution-guidelines)

## Instructions

1. **Enable VS Code Settings:**
   - Enable `chat.promptFiles`:
     - Open VS Code settings: File > Preferences > Settings.
     - Search for `chat.promptFiles` and check the box.
   - Enable `github.copilot.chat.codeGeneration.useInstructionFiles`:
     - Search for this setting and check the box.

2. **Directory Structure:**
   - Ensure your project root includes a `.github` directory with all required prompt files (e.g., `copilot-instructions.md`, prompts in `/.github/prompts/`).

## Agent-Assisted Pipeline Overview

This template supports an automated workflow that:
- Assists with brainstorming using chat LLMs.
- Extracts a detailed spec from ideas (saved as `spec.md`).
- Generates a prompt plan (`prompt_plan.md`) and a to-do list (`todo.md`).
- Integrates with GitHub to manage issues, commits, and pull requests automatically.

## Setup Instructions

### Git Setup
1. **Install Git:**  
   Download and install Git from [git-scm.com](https://git-scm.com/).
2. **Configure Git:**
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your_email@example.com"
   ```

### Node.js and npm Setup
**Install Node.js and npm for package management:**  
1. Install homebrew if not already installed:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   2. Install Node.js using homebrew:
     ```bash
     brew install node
     ```
   3. Verify installation:
     ```bash
     node -v
     npm -v
     ```

### Twilio-specific Setup
1. **Install Twilio CLI:**  
   ```bash
   npm install -g twilio-cli
   ```
2. Authenticate with your Twilio account:
   ```bash
   twilio login
   ```
3. Verify installation:
   ```bash
   twilio --version
   ```
4. Insall the serverless toolkit:
   ```bash
   twilio plugins:install @twilio-labs/plugin-serverless
   ```
5. Add the autocomplete env var to your zsh profile and source it:
   ```bash
   printf "eval $(twilio autocomplete:script zsh)" >> ~/.zshrc; source ~/.zshrc
   ```
   To test it out, type `twilio` in your terminal and press tab to see the available commands.

### Python and Package Management
- We use `uv` for Python package management.
- There is no need for a `requirements.txt`; packages are managed in `pyproject.toml`.
- To run a script, use:
  ```bash
  uv run <script.py>
  ```
- To add a package, use:
  ```bash
  uv add <package>
  ```

### Environment Variables
1. Create a `.env` file in the project root:
   ```bash
   touch .env
   echo "GITHUB_TOKEN=your_personal_access_token_here" >> .env
   ```
2. Load the environment variable in your terminal session:
   ```bash
   export GITHUB_TOKEN=$(grep GITHUB_TOKEN .env | cut -d '=' -f2)
   ```

## Usage

- **Idea Generation and Specification:**
  - Initiate brainstorming using `brainstorm.md` (located in `/.github/prompts/`).
  - Finalize and save the software spec as `spec.md`.

- **Generating Task Artifacts:**
  - Use `plan.md` to generate a detailed prompt plan (`prompt_plan.md`).
  - Maintain a task tracker in `todo.md`.

- **Running the Pipeline:**
  - Follow the prompts in `/.github/prompts/` for creating GitHub issues, running tests, and marking tasks complete.
  - Leverage GitHub Actions (see below) to automate testing and linting.

## GitHub Integration

- **Automation with GitHub Actions:**
  - Configure workflows (e.g., in `.github/workflows/ci.yml`) to run tests and linting on commits.
  - Automate syncing between prompt files and GitHub issues, ensuring tasks in `todo.md` are tracked.

- **Issue & Task Management:**
  - Use agent scripts to create issues, add items to the to-do list, and mark items as complete.
  - Follow our workflow prompts (see files in `/.github/prompts/`) to keep GitHub issues and to-do tasks scoped and updated.

## Example Artifacts

- `spec.md`: Detailed software specification.
- `prompt_plan.md`: Comprehensive prompt plan for executing tasks.
- `todo.md`: Task tracker for to-do items.
- Additional prompts for TDD, code reviews, and GitHub issue management are located in `/.github/prompts/`.

## Contribution Guidelines

- **TDD Practice:**
  - Write tests before implementation.
  - Ensure tests and linting pass before any commit.
- **Commit Requirements:**
  - Never use `--no-verify` during commits.
  - Make small, incremental changes and retain all relevant comments starting with "ABOUTME:".
- **Documentation:**
  - Maintain clear comments and contribution instructions within files.