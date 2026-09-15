# Development Guidelines

## Local Setup

### Spell Checker (CSpell)
To ensure code quality and prevent typos, we use CSpell. The configuration is located in `cspell.json`.
- **Run locally**: You can run the spell checker using the command:
  ```bash
  pnpm run spellcheck
  ```
- **Custom Vocabulary**: If you need to add new domain-specific words, add them to the `words` array in `cspell.json`.

## CI/CD and Cloud Analysis

### SonarCloud (SonarCloud)
We have integrated SonarCloud for automated code analysis to track code health, integrations, and operational metrics.
- The configuration is defined in `sonar-project.properties`.
- The analysis is automatically triggered in our CI/CD pipeline on new pull requests and commits to the `main` or `development` branch.
- **Viewing Reports**: Developers can view and interpret the cloud reports by visiting the SonarCloud dashboard. Look for the `quiz-game` project to see detailed metrics on code quality, security vulnerabilities, and test coverage. Address any issues flagged in your Pull Request before merging.
