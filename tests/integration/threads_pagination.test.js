// tests/integration/threads_pagination.test.js
// Integration test for GET /api/threads pagination & ordering
// Run with: node tests/integration/threads_pagination.test.js
// Assumes backend running at http://localhost:3000 and POST /api/threads supports creating threads for tests.

(async () => {
  try {
    const BASE = process.env.BASE || 'http://localhost:3000';
    const postUrl = `${BASE}/api/threads`;
    const getUrl = (q) => `${BASE}/api/threads${q ? '?' + q : ''}`;

    // Helper to POST a thread
    async function createThread(gmailId, subject, lastMessageAt) {
      const payload = {
        gmail_thread_id: gmailId,
        subject,
        raw_payload: { last_message_at: lastMessageAt }
      };
      const res = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (![200,201].includes(res.status)) {
        const text = await res.text();
        throw new Error(`Failed to create thread ${gmailId}: ${res.status} ${text}`);
      }
      return res.json();
    }

    // Create 15 threads with distinct last_message_at timestamps
    const count = 15;
    const created = [];
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      // Stagger times: newest first (now - i minutes)
      const ts = new Date(now - i * 60 * 1000).toISOString();
      const gmailId = `test-thread-${Date.now()}-${i}`;
      const subject = `Test Thread ${i}`;
      const r = await createThread(gmailId, subject, ts);
      created.push({ gmailId, subject, last_message_at: ts, createdResponse: r });
    }

    // Fetch with limit=10
    const resGet = await fetch(getUrl('limit=10'), { method: 'GET' });
    if (resGet.status !== 200) {
      const text = await resGet.text();
      throw new Error(`/api/threads?limit=10 returned status ${resGet.status}: ${text}`);
    }
    const body = await resGet.json();
    if (!Array.isArray(body)) {
      throw new Error(`/api/threads response is not an array: ${JSON.stringify(body)}`);
    }
    if (body.length !== 10) {
      throw new Error(`Expected 10 threads, got ${body.length}`);
    }

    // Verify sorted by last_message_at desc
    for (let i = 0; i < body.length - 1; i++) {
      const a = body[i]?.last_message_at;
      const b = body[i + 1]?.last_message_at;
      if (!a || !b) {
        throw new Error(`Missing last_message_at in returned threads at index ${i} or ${i + 1}`);
      }
      const ta = Date.parse(a);
      const tb = Date.parse(b);
      if (isNaN(ta) || isNaN(tb)) {
        throw new Error(`Invalid date format in last_message_at: a=${a} b=${b}`);
      }
      if (ta < tb) {
        throw new Error(`Threads not sorted desc by last_message_at at index ${i}: ${a} < ${b}`);
      }
    }

    console.log('PASS: /api/threads pagination & ordering test passed');
    process.exit(0);
  } catch (err) {
    console.error('FAIL: /api/threads pagination & ordering test failed');
    console.error(err);
    process.exit(1);
  }
})();