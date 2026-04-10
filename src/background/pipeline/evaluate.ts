// Evaluate pipeline — the core flow.
//
// Takes a JobPosting, runs it through the "evaluate" mode on Anthropic,
// parses the structured EvaluationResult, and writes:
//   - a row to `applications` (upserted by fuzzy company+role match)
//   - a row to `reports` (versioned per application)
//
// Streams deltas to the side panel via the BackgroundEvent bus so the
// user sees tokens materialize live.

import type { BackgroundEvent } from '../../shared/messages';
import type {
  Application,
  EvaluationResult,
  JobPosting,
} from '../../shared/types';
import { AnthropicClient, withRetry } from '../llm/anthropic';
import { buildSystemPrompt } from '../llm/modes';
import { parseEvaluationResult } from '../llm/parse';
import { getSettings } from '../storage/settings';
import { getCustomization, getCv, getArticleDigest, getProfile } from '../storage/profile';
import { upsertApplication } from '../storage/applications';
import { createReport } from '../storage/reports';

export interface EvaluateResponse {
  ok: true;
  application: Application;
  evaluation: EvaluationResult;
}

export interface EvaluateError {
  ok: false;
  error: string;
  details?: string;
}

export async function evaluateJob(
  job: JobPosting,
  emit: (event: BackgroundEvent) => void,
): Promise<EvaluateResponse | EvaluateError> {
  const tempId = crypto.randomUUID();
  emit({ type: 'bg:evalStarted', jobUrl: job.url, tempId });

  try {
    const [settings, profile, customization, cv, articleDigest] = await Promise.all([
      getSettings(),
      getProfile(),
      getCustomization(),
      getCv(),
      getArticleDigest(),
    ]);

    if (!settings.anthropicApiKey) {
      throw new Error('No Anthropic API key configured. Open Settings to add one.');
    }

    // Canonical evaluation mode is still keyed 'oferta' in the bundle
    // (inherited from the source repo's filename). The port renames it
    // semantically but keeps the source filename so knowledge-base stays
    // in sync with upstream. See scripts/bundle-modes.mjs for the full map.
    const { system } = buildSystemPrompt({
      name: 'oferta',
      language: profile.modesDir,
      profile,
      customization,
      cvMarkdown: cv.markdown,
      articleDigestMarkdown: articleDigest.markdown,
    });

    const userMessage = buildUserMessage(job);

    const client = new AnthropicClient({ apiKey: settings.anthropicApiKey });

    const { text } = await withRetry(
      () =>
        client.streamText(
          {
            model: settings.selectedModel,
            system,
            messages: [{ role: 'user', content: userMessage }],
            maxTokens: 4096,
            temperature: 0.3,
          },
          (delta) => emit({ type: 'bg:evalDelta', tempId, delta }),
        ),
      { maxRetries: 3 },
    );

    const parsed = parseEvaluationResult(text);
    if (!parsed.ok) {
      emit({ type: 'bg:evalFailed', tempId, error: parsed.error });
      return { ok: false, error: parsed.error, details: parsed.raw };
    }

    const evaluation = parsed.value;
    const reportMarkdown = evaluation.reportMarkdown || text;

    // Build application first with a temp reportId, then create the report
    // and update the application with the real reportId.
    const application = await upsertApplication({
      company: job.company,
      role: job.role,
      url: job.url,
      score: evaluation.globalScore,
      status: 'evaluated',
      reportId: 'pending',
      archetype: evaluation.archetype,
      language: job.language,
      notes: evaluation.tldr,
    });

    const report = await createReport({
      applicationId: application.id,
      company: job.company,
      url: job.url,
      markdown: reportMarkdown,
      evaluation,
    });

    const finalApplication = await upsertApplication({
      company: application.company,
      role: application.role,
      url: application.url,
      score: application.score,
      status: application.status,
      reportId: report.id,
      archetype: application.archetype,
      language: application.language,
      notes: application.notes,
    });

    emit({
      type: 'bg:evalCompleted',
      tempId,
      application: finalApplication,
      evaluation,
    });

    return { ok: true, application: finalApplication, evaluation };
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    emit({ type: 'bg:evalFailed', tempId, error: message });
    return { ok: false, error: message };
  }
}

function buildUserMessage(job: JobPosting): string {
  const header = [
    `**Company:** ${job.company}`,
    `**Role:** ${job.role}`,
    job.location ? `**Location:** ${job.location}` : '',
    `**Remote:** ${job.remote}`,
    job.salary ? `**Salary:** ${job.salary}` : '',
    `**URL:** ${job.url}`,
  ]
    .filter(Boolean)
    .join('\n');

  const jsonContract = `
---

## Output Format

Respond with ONLY a single JSON object. No prose, no markdown, no explanation before or after. Your entire response must be valid JSON matching this exact schema:

{
  "archetype": "<one of: ai_platform, agentic, technical_pm, solutions_architect, forward_deployed, transformation>",
  "dimensions": {
    "matchCv": { "score": <1-5>, "rationale": "<2-3 sentences on CV fit>", "evidence": ["<specific skill or experience from CV that matches>"] },
    "northStar": { "score": <1-5>, "rationale": "<2-3 sentences on career alignment>", "evidence": [] },
    "comp": { "score": <1-5>, "rationale": "<2-3 sentences on compensation fit>", "evidence": [] },
    "cultural": { "score": <1-5>, "rationale": "<2-3 sentences on culture/team fit>", "evidence": [] },
    "redFlags": { "score": <1-5>, "rationale": "<2-3 sentences on concerns>", "evidence": [] }
  },
  "globalScore": <weighted average 1.0-5.0>,
  "verdict": "<strong|good|borderline|weak>",
  "tldr": "<one sentence: should the candidate apply or not, and why>",
  "gaps": [{ "requirement": "<missing skill or experience>", "severity": "<blocker|significant|minor>", "mitigation": "<how to address in application>" }],
  "dealBreakers": [],
  "keywords": ["<15-20 ATS-relevant keywords from the JD>"],
  "reportMarkdown": "<a concise 500-800 word markdown summary covering: role overview, fit assessment, key strengths, gaps, compensation analysis, and recommendation>"
}

RULES:
1. Output ONLY the JSON object. No \`\`\`json fences. No text before or after.
2. Every field is REQUIRED.
3. All scores are numbers, not strings.
4. reportMarkdown is a self-contained summary (the only narrative the user sees).
5. Keep reportMarkdown under 800 words to minimize cost.
`;

  return `${header}\n\n## Job Description\n\n${job.descriptionMarkdown}\n${jsonContract}`;
}
