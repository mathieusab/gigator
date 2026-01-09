// tests/integration/gmail_start.test.js
// Simple integration check for POST /api/sync/gmail/start
// Run with: node tests/integration/gmail_start.test.js
// This script assumes the backend is running on http://localhost:3000

(async () => {
  try {
    const url = 'http://localhost:3000/api/sync/gmail/start';
    const res = await fetch(url, { method: 'POST' });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      throw new Error(`response is not valid JSON: ${text}`);
    }

    if (res.status !== 200) {
      throw new Error(`/api/sync/gmail/start responded with status ${res.status} and body ${JSON.stringify(body)}`);
    }

    const oauthUrl = body?.oauth_url;
    if (!oauthUrl || typeof oauthUrl !== 'string') {
      throw new Error('oauth_url missing or not a string in response body');
    }

    const expectedPrefix = 'https://accounts.google.com/o/oauth2/v2/auth?';
    if (!oauthUrl.startsWith(expectedPrefix)) {
      throw new Error(`oauth_url does not start with expected prefix. got: ${oauthUrl}`);
    }

    if (!oauthUrl.includes('state=')) {
      throw new Error(`oauth_url missing state param. got: ${oauthUrl}`);
    }

    console.log('PASS: /api/sync/gmail/start integration test passed');
    process.exit(0);
  } catch (err) {
    console.error('FAIL: /api/sync/gmail/start integration test failed');
    console.error(err);
    process.exit(1);
  }
})();