## Documentation & Team Onboarding
GitHub Copilot automatically reviews pull requests using custom instructions tailored to our project's tools, coding styles, and workflows, ensuring consistent and relevant feedback across backend and frontend codebases. To help you get the most out of our GitHub Copilot PR review automation, please follow the steps below.

## How to Edit `.github/copilot-instructions.md`
The file at `.github/copilot-instructions.md` defines how GitHub Copilot reviews pull requests in this repository.

- Use natural language to describe backend and frontend coding preferences.
- When adding new conventions, be specific (e.g., “use async route handlers in Quart”).
- After editing, commit directly to the default branch.

> Tip: After you push updates, open a test PR to confirm the new rules take effect.

## How to Verify Copilot is Using the Custom Instructions
- To verify Copilot is using these rules:
  1. Open a test PR with code changes.
  2. Wait for Copilot to comment.
  3. Check that the comment references this `.github/copilot-instructions.md` file.

If no comment appears, or the suggestions seem off-topic:
- Confirm the PR includes backend/frontend changes.
- Make sure `.github/copilot-instructions.md` exists and is correctly formatted.
- Check that Copilot PR Reviews are enabled (see below).

## How to Enable or Disable the Copilot PR Review Feature Locally
You don’t need a specific editor to use Copilot’s pull request review feature — it runs automatically on GitHub once the repository settings are enabled.

However, if you also want your editor’s Copilot suggestions to follow the same rules as `.github/copilot-instructions.md`, here’s how to enable that locally:

In VS Code: 
1. Go to `Settings`.
2. Navigate to `Github › Copilot › Chat › Code Generation: Use Instruction Files`
3. Enable: `Use Instruction Files`.

In Visual Studio: 
1. Open `Tools > Options`.
2. Go to `GitHub Copilot > PR Reviews`.
3. Check: "Enable custom instructions".

These settings affect local code completions, not the GitHub-hosted PR reviews.

You can disable Copilot PR reviews at any time by unchecking this option.