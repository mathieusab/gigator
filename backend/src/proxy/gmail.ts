export type GmailThread = {
  id: string;
  snippet?: string;
};

export type GmailProxyConfig = {
  clientId: string;
  clientSecret: string;
};

export async function listThreadsForEmail(
  _config: GmailProxyConfig,
  _email: string,
): Promise<GmailThread[]> {
  // Phase 2 skeleton only. Implement real Gmail API calls in US5.
  return [];
}
