"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubApp = void 0;
const core = __importStar(require("@actions/core"));
const auth_app_1 = require("@octokit/auth-app");
const rest_1 = require("@octokit/rest");
function isValidInstallationAccount(account) {
    return account && typeof account === 'object' && typeof account.login === 'string';
}
class GitHubApp {
    octokit;
    auth;
    defaultPermissions = {
        checks: 'write',
        statuses: 'write'
    };
    constructor(config) {
        const { appId, privateKey, baseUrl } = config;
        this.auth = (0, auth_app_1.createAppAuth)({
            appId,
            privateKey,
            baseUrl
        });
        this.octokit = new rest_1.Octokit({
            baseUrl,
            auth: async () => {
                const { token } = await this.auth({ type: 'app' });
                return token;
            }
        });
    }
    async getRepositoryInstallation(owner, repo) {
        try {
            const response = await this.octokit.apps.getRepoInstallation({
                owner,
                repo
            });
            if (!isValidInstallationAccount(response.data.account)) {
                throw new Error('Invalid installation account data');
            }
            const installation = {
                id: response.data.id,
                account: {
                    login: response.data.account.login
                }
            };
            return installation;
        }
        catch (error) {
            core.debug(`Error getting repository installation: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
        }
    }
    async getInstallationToken(installationId) {
        try {
            const response = await this.auth({
                type: 'installation',
                installationId,
                permissions: this.defaultPermissions
            });
            return {
                token: response.token,
                tokenId: response.token.split('_')[1] || Date.now().toString(),
                expiresAt: response.expiresAt,
                permissions: this.defaultPermissions
            };
        }
        catch (error) {
            throw new Error(`Failed to get installation token: ${error}`);
        }
    }
    async validatePermissions(token) {
        try {
            const testOctokit = new rest_1.Octokit({ auth: token });
            const { headers } = await testOctokit.rest.apps.listInstallations();
            const scopes = (headers['x-oauth-scopes'] || '').split(',').map(s => s.trim());
            return scopes.includes('checks') && scopes.includes('statuses');
        }
        catch (error) {
            core.warning(`Permission validation failed: ${error}`);
            return false;
        }
    }
    async revokeToken(tokenId) {
        try {
            await this.octokit.apps.revokeInstallationAccessToken();
            core.info('Token revoked successfully');
        }
        catch (error) {
            core.warning(`Failed to revoke token: ${error}`);
        }
    }
    async run() {
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
        }
        catch (error) {
            if (error instanceof Error) {
                core.setFailed(error.message);
                core.debug(error.stack || 'No stack trace available');
            }
            else {
                core.setFailed('An unexpected error occurred');
            }
        }
    }
}
exports.GitHubApp = GitHubApp;
