export type PermissionLevel = 'read' | 'write' | 'admin';

export interface GithubPermissions {
  checks: PermissionLevel;
  statuses: PermissionLevel;
}

export interface TokenResponse {
  token: string;
  tokenId: string;
  expiresAt: string;
  permissions: GithubPermissions;
}

export interface Installation {
  id: number;
  account: {
    login: string;
  };
}

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  baseUrl?: string;
}