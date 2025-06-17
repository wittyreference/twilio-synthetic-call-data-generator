#### Create instructions and prompt files in VS Code

1. Enable chat.promptFiles setting in VS Code:
   - Open your settings (File > Preferences > Settings).
   - Search for `chat.promptFiles`.
   - Check the box to enable it.
2. Enable github.copilot.chat.codeGeneration.useInstructionFiles setting in VS Code:
   - In the same settings window, search for `github.copilot.chat.codeGeneration.useInstructionFiles`.
   - Check the box to enable it.
3. Create .github directory in your project root
    - Open your terminal or command prompt.
    - Navigate to your project directory.
    - Run the following command:
      ```bash
      mkdir -p .github 
      ```
4. Create instructions file:
    - In the `.github` directory, create a file named `copilot-instructions.md`.

Chat with gpt-4o to hone your idea
Use the best reasoning model you can find to generate the spec. These days it is o1-pro or o3
Use the reasoning model to generate the prompts. 
Save spec.md, and prompt_plan.md in the root of the project.

Install Git
================
1. **Install Git**: If you haven't already, download and install Git from [git-scm.com](https://git-scm.com/).
2. **Configure Git**: Open your terminal or command prompt and set your username and email:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "
   ``` 

Setup GitHub Repository
================
### 1. **Check Your GitHub Permissions**
   - Ensure that you are logged into GitHub with the correct account.
   - Verify that you have write access to the repository (`wittyreference/vibe-coding`). If it's not your repository, ask the owner to grant you write access.

### 2. **Authenticate with GitHub**
   - If you haven't authenticated with GitHub, you need to set up authentication. Use one of the following methods:

#### 3. **Generate a Personal Access Token**
     1. Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens).
     2. Click "Generate new token" and select the necessary scopes (e.g., `repo` for repository access).
     3. Copy the generated token and save as an environment variable in step 5.
   - Use the token instead of your password when prompted during `git push`.

   Example:
   ```bash
   git remote set-url origin https://<username>:<personal-access-token>@github.com/wittyreference/vibe-coding.git
   ```

#### 4. **Create a directory for your project:**
   ```bash
   mkdir my-project
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/username/my-project.git
   ```

#### 5. **Set Up Environment Variables**
   - If you are using a personal access token, set it as an environment variable, in your project directory, create a `.env` file

     ```bash
     touch .env
     ```
    - Add your token to the `.env` file:
      ```bash
      GITHUB_TOKEN=your_personal_access_token_here
    ```
    - Load the environment variable in your terminal session:
      ```bash
      export GITHUB_TOKEN=$(cat .env | grep GITHUB_TOKEN | cut -d '=' -f2)
      ```
#### 6. Use the token in your commands:
   - When you push changes, use the token for authentication:
     ```bash
     git push https://<username>:$GITHUB_TOKEN
        ```
#### 8. **Add .env to .gitignore**
   - Ensure that your `.env` file is not tracked by Git by adding it to your `.gitignore` file:
     ```bash
     echo ".env" >> .gitignore
     ```

#### 9. **Push Changes**
   - Now you can push your changes to the repository:
     ```bash
     git remote set-url origin https://<username>:<personal-access-token>@github.com/wittyreference/vibe-coding.git
    git push -u origin main
     ```