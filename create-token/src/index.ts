import * as core from '@actions/core';
import { GitHubApp } from './github-app';
import { validateInputs } from './validators';

async function run(): Promise<void> {
  try {
    const { privateKey, appId } = validateInputs();
    
    const app = new GitHubApp({
      appId,
      privateKey,
      baseUrl: core.getInput('base_url') || 'https://api.github.com'
    });

    await app.run();

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
      core.debug(error.stack || 'No stack trace available');
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();