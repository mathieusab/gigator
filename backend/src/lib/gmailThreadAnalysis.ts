import type { GmailThreadFull } from '../proxy/gmail.js';

export type GmailThreadSuggestion =
  | {
      kind: 'create_concert';
      confidence: number;
      rationale?: string;
      extracted: {
        title?: string;
        venue_name?: string;
        city?: string;
        date_start?: string;
        notes?: string;
      };
    }
  | {
      kind: 'reject';
      confidence: number;
      rationale?: string;
    };

function safeString(v: unknown) {
  return String(v ?? '').trim();
}

function extractEmailAddress(headerValue: string | undefined) {
  const raw = safeString(headerValue);
  if (!raw) return '';
  const m = raw.match(/<([^>]+)>/);
  if (m?.[1]) return m[1].trim();
  if (raw.includes('@')) return raw.split(/[\s,;]/)[0].trim();
  return '';
}

function normalizeSubject(subject: string) {
  return subject
    .replace(/^\s*(re|fw|fwd)\s*:\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function pickBestText(thread: GmailThreadFull): string {
  const messages = thread.messages ?? [];
  const parts: string[] = [];
  for (const m of messages) {
    const from = safeString(m.headers?.from);
    const date = safeString(m.headers?.date) || safeString(m.internalDate);
    const subject = safeString(m.headers?.subject);
    const body = safeString(m.bodyText) || safeString(m.snippet);
    if (!from && !body) continue;
    parts.push(`From: ${from}`);
    if (date) parts.push(`Date: ${date}`);
    if (subject) parts.push(`Subject: ${subject}`);
    if (body) parts.push(body);
    parts.push('---');
  }
  return parts.join('\n').trim();
}

function findFrenchDateIso(text: string): string | undefined {
  // dd/mm/yyyy or dd-mm-yyyy
  const m = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return undefined;
  if (year < 100) year = 2000 + year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  // Use 20:00 UTC to be "evening" by default.
  const iso = new Date(Date.UTC(year, month - 1, day, 20, 0, 0)).toISOString();
  return iso;
}

function looksLikeRejection(textLower: string) {
  const patterns = [
    'malheureusement',
    'ne pouvons pas donner suite',
    'ne pouvons pas',
    'pas possible',
    'refus',
    'décliné',
    'decline',
    'unfortunately',
    'we cannot',
    'not able to',
  ];
  return patterns.some((p) => textLower.includes(p));
}

export function analyzeThreadHeuristic(thread: GmailThreadFull): GmailThreadSuggestion {
  const subjectRaw = safeString(thread.messages?.[0]?.headers?.subject) || safeString(thread.snippet);
  const subject = normalizeSubject(subjectRaw);

  const text = pickBestText(thread);
  const textLower = text.toLowerCase();

  const lastMsg = (thread.messages ?? [])[Math.max(0, (thread.messages ?? []).length - 1)];
  const counterpartEmail = extractEmailAddress(lastMsg?.headers?.from) || extractEmailAddress(lastMsg?.headers?.to);

  if (looksLikeRejection(textLower)) {
    return {
      kind: 'reject',
      confidence: 0.75,
      rationale: 'Le dernier échange ressemble à un refus (mots-clés détectés).',
    };
  }

  const date_start = findFrenchDateIso(text);

  const notesLines: string[] = [];
  notesLines.push('Suggestion IA (heuristique)');
  if (counterpartEmail) notesLines.push(`Contact: ${counterpartEmail}`);
  if (subject) notesLines.push(`Objet: ${subject}`);
  if (date_start) notesLines.push(`Date détectée: ${date_start}`);
  notesLines.push('---');
  // Keep a short excerpt to avoid huge payloads.
  const excerpt = text
    .split(/\n+/)
    .slice(0, 30)
    .join('\n')
    .trim();
  if (excerpt) notesLines.push(excerpt);

  return {
    kind: 'create_concert',
    confidence: date_start ? 0.65 : 0.5,
    rationale: date_start
      ? 'Une date potentielle a été détectée; opportunité probable.'
      : 'Pas de refus détecté; opportunité possible.',
    extracted: {
      title: subject || undefined,
      date_start: date_start || undefined,
      notes: notesLines.join('\n').trim(),
    },
  };
}
