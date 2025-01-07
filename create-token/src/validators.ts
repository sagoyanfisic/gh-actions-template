import * as core from '@actions/core';

export function isRsaPrivateKey(key: string): boolean {
  const rsaPattern = /^-----BEGIN RSA PRIVATE KEY-----\n[\s\S]*\n-----END RSA PRIVATE KEY-----\n?$/;
  return rsaPattern.test(key.trim());
}

export function validateInputs(): { privateKey: string; appId: string } {
  const privateKey = core.getInput('private-key', { required: true });
  const appId = core.getInput('app-id', { required: true });

  if (!isRsaPrivateKey(privateKey)) {
    throw new Error('Invalid RSA private key format');
  }

  if (!appId || isNaN(Number(appId))) {
    throw new Error('App ID must be a valid number');
  }

  return { privateKey, appId };
}