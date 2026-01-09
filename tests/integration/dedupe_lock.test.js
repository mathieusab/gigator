// tests/integration/dedupe_lock.test.js
// Integration test for dedupe / lock behavior (POST /api/compose + send)
// Run with: node tests/integration/dedupe_lock.test.js
// Assumes backend running at http://localhost:3000
// Environment:
//   BASE - optional (defaults to http://localhost:3000)
//
// Flow:
// 1) Create draft A with recipient+subject X
// 2) Send draft A (expect success 200/201)
// 3) Create draft B with same recipient+subject X
// 4) Attempt to send draft B (expect 409 + lock object in response body)
//
// This test is best-effort: the backend must implement the dedupe/lock behavior
// (return 409 and include a lock object { locked_by, reason, evidence }) for it to pass.

(async () => {
  try {
    const BASE = process.env.BASE || 'http://localhost:3000';

    async function postCompose(payload) {
      const res = await fetch(`${BASE}/api/compose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch(e) { throw new Error(`Invalid JSON from /api/compose: ${text}`); }
      return { status: res.status, body };
    }

    async function sendDraft(draftId, force = false) {
      const url = `${BASE}/api/compose/${encodeURIComponent(draftId)}/send${force ? '?force=true' : ''}`;
      const res = await fetch(url, { method: 'POST' });
      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch(e) { throw new Error(`Invalid JSON from send endpoint: ${text}`); }
      return { status: res.status, body };
    }

    // Shared values for the duplicate scenario
    const to = ['user@example.com'];
    const subject = `Integration Dedupe Test ${Date.now()}`;
    const bodyText = 'Test message body';

    console.log('Creating draft A...');
    const r1 = await postCompose({
      opportunity_id: null,
      to,
      subject,
      body: bodyText,
      request_ai: false
    });
    if (![200,201,202].includes(r1.status)) {
      throw new Error(`Failed to create draft A: status ${r1.status} body=${JSON.stringify(r1.body)}`);
    }
    const draftAId = r1.body?.draft_id || r1.body?.id;
    if (!draftAId) {
      throw new Error(`No draft_id returned when creating draft A: ${JSON.stringify(r1.body)}`);
    }
    console.log(`Draft A created: ${draftAId}`);

    console.log('Sending draft A (initial send)...');
    const s1 = await sendDraft(draftAId, false);
    if (![200,201].includes(s1.status)) {
      throw new Error(`Initial send of draft A failed: status ${s1.status} body=${JSON.stringify(s1.body)}`);
    }
    console.log('Draft A sent successfully.');

    // Create draft B with same to+subject to simulate duplicate attempt
    console.log('Creating draft B with same to+subject...');
    const r2 = await postCompose({
      opportunity_id: null,
      to,
      subject,
      body: bodyText + ' (second)',
      request_ai: false
    });
    if (![200,201,202].includes(r2.status)) {
      throw new Error(`Failed to create draft B: status ${r2.status} body=${JSON.stringify(r2.body)}`);
    }
    const draftBId = r2.body?.draft_id || r2.body?.id;
    if (!draftBId) {
      throw new Error(`No draft_id returned when creating draft B: ${JSON.stringify(r2.body)}`);
    }
    console.log(`Draft B created: ${draftBId}`);

    // Attempt to send draft B, expecting dedupe lock (409) and lock object
    console.log('Attempting to send draft B (expecting dedupe lock / 409)...');
    const s2 = await sendDraft(draftBId, false);
    if (s2.status !== 409) {
      throw new Error(`Expected 409 for duplicate send attempt, got ${s2.status}. body=${JSON.stringify(s2.body)}`);
    }

    const lock = s2.body?.lock || s2.body;
    if (!lock || typeof lock !== 'object') {
      throw new Error(`Expected lock object in 409 response body, got: ${JSON.stringify(s2.body)}`);
    }
    const hasLockedBy = typeof lock.locked_by === 'string' && lock.locked_by.length > 0;
    const hasReason = typeof lock.reason === 'string' && lock.reason.length > 0;
    const hasEvidence = lock.evidence !== undefined;

    if (!hasLockedBy || !hasReason || !hasEvidence) {
      throw new Error(`Lock object missing expected fields. lock=${JSON.stringify(lock)}`);
    }

    console.log('PASS: dedupe / lock integration test passed');
    process.exit(0);
  } catch (err) {
    console.error('FAIL: dedupe / lock integration test failed');
    console.error(err);
    process.exit(1);
  }
})();