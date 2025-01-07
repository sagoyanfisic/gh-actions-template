import * as core from '@actions/core';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import type { InstallationAccessTokenAuthentication } from '@octokit/auth-app';
import { 
  Installation,
  GithubPermissions, 
  TokenResponse, 
  GitHubAppConfig 
} from './types';


type InstallationAccountType = {
  login: string;
  [key: string]: any;
};

function isValidInstallationAccount(account: any): account is InstallationAccountType {
  return account && typeof account === 'object' && typeof account.login === 'string';
}

export class GitHubApp {
  private octokit: Octokit;
  private auth: any;
  private readonly defaultPermissions: GithubPermissions = {
    checks: 'write',
    statuses: 'write'
  };

  constructor(config: GitHubAppConfig) {
    const { appId, privateKey, baseUrl } = config;

    this.auth = createAppAuth({
      appId,
      privateKey,
      baseUrl
    });

    this.octokit = new Octokit({
      baseUrl,
      auth: async () => {
        const { token } = await this.auth({ type: 'app' });
        return token;
      }
    });
  }

  async getRepositoryInstallation(owner: string, repo: string): Promise<Installation | null> {
    try {
      const response = await this.octokit.apps.getRepoInstallation({
        owner,
        repo
      });

      if (!isValidInstallationAccount(response.data.account)) {
        throw new Error('Invalid installation account data');
      }
      
      const installation: Installation = {
        id: response.data.id,
        account: {
          login: response.data.account.login
        }
      };
      
      return installation;
    } catch (error) {
      core.debug(`Error getting repository installation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  async getInstallationToken(installationId: number): Promise<TokenResponse> {
    try {
      const response = await this.auth({
        type: 'installation',
        installationId,
        permissions: this.defaultPermissions
      }) as InstallationAccessTokenAuthentication;

      return {
        token: response.token,
        tokenId: response.token.split('_')[1] || Date.now().toString(),
        expiresAt: response.expiresAt,
        permissions: this.defaultPermissions
      };
    } catch (error) {
      throw new Error(`Failed to get installation token: ${error}`);
    }
  }

  async validatePermissions(token: string): Promise<boolean> {
    try {
      const testOctokit = new Octokit({ auth: token });
      const { headers } = await testOctokit.rest.apps.listInstallations();
      
      const scopes = (headers['x-oauth-scopes'] || '').split(',').map(s => s.trim());
      
      return scopes.includes('checks') && scopes.includes('statuses');
    } catch (error) {
      core.warning(`Permission validation failed: ${error}`);
      return false;
    }
  }

  async revokeToken(tokenId: string): Promise<void> {
    try {
      await this.octokit.apps.revokeInstallationAccessToken();
      core.info('Token revoked successfully');
    } catch (error) {
      core.warning(`Failed to revoke token: ${error}`);
    }
  }

  async run(): Promise<void> {
    try {
      const repository = process.env.GITHUB_REPOSITORY;
      if (!repository) {
        throw new Error('GITHUB_REPOSITORY not found');
      }

      const [owner, repo] = repository.split('/');
      if (!owner || !repo) {
        throw new Error(`Invalid repository format: ${repository}`);
      }
      
      const installation = await this.getRepositoryInstallation(owner, repo);
      if (!installation?.id) {
        throw new Error(`GitHub App not installed on repository: ${repository}`);
      }

      const tokenResponse = await this.getInstallationToken(installation.id);

      const hasValidPermissions = await this.validatePermissions(tokenResponse.token);
      if (!hasValidPermissions) {
        core.warning('Token may have limited permissions');
      }

      core.setSecret(tokenResponse.token);
      core.setOutput('token', tokenResponse.token);
      core.setOutput('token_id', tokenResponse.tokenId);
      core.setOutput('expires_at', tokenResponse.expiresAt);
      core.setOutput('permissions', JSON.stringify(tokenResponse.permissions));

      core.info('Successfully generated installation token');

    } catch (error) {
      if (error instanceof Error) {
        core.setFailed(error.message);
        core.debug(error.stack || 'No stack trace available');
      } else {
        core.setFailed('An unexpected error occurred');
      }
    }
  }
}