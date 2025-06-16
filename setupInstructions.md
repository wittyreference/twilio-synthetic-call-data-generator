Setup Git
================
1. **Install Git**: If you haven't already, download and install Git from [git-scm.com](https://git-scm.com/).
2. **Configure Git**: Open your terminal or command prompt and set your username and email:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email " 

   Create a directory for your project:
   ```bash
   mkdir my-project
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/username/my-project.git
   git branch -M main
   git push -u origin main
   ```