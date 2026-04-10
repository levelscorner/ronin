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
            maxTokens: 12000,
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

## Output Contract

You MUST end your response with exactly ONE fenced JSON block. This is the structured evaluation result that the extension parses. Do NOT skip any field. Every field is required.

\`\`\`json
{
  "archetype": "<one of: ai_platform, agentic, technical_pm, solutions_architect, forward_deployed, transformation>",
  "dimensions": {
    "matchCv": { "score": <number 1 to 5>, "rationale": "<why this score>", "evidence": ["<quote from CV or JD>"] },
    "northStar": { "score": <number 1 to 5>, "rationale": "<why>", "evidence": [] },
    "comp": { "score": <number 1 to 5>, "rationale": "<why>", "evidence": [] },
    "cultural": { "score": <number 1 to 5>, "rationale": "<why>", "evidence": [] },
    "redFlags": { "score": <number 1 to 5>, "rationale": "<why>", "evidence": [] }
  },
  "globalScore": <number like 3.8>,
  "verdict": "<one of: strong, good, borderline, weak>",
  "tldr": "<one sentence summary of fit>",
  "gaps": [{ "requirement": "<what's missing>", "severity": "<blocker or significant or minor>", "mitigation": "<how to address>" }],
  "dealBreakers": ["<any dealbreakers, or empty array>"],
  "keywords": ["<15 to 20 ATS keywords extracted from the JD>"],
  "reportMarkdown": "<your full analysis above as markdown>"
}
\`\`\`

CRITICAL RULES:
1. The JSON block MUST be the very last thing in your response.
2. Every field shown above is REQUIRED. Do not omit any.
3. All 5 dimensions (matchCv, northStar, comp, cultural, redFlags) must be present.
4. Scores are numbers (not strings), between 1 and 5.
5. globalScore is a decimal like 3.8 (not a string).
6. Keep reportMarkdown concise (under 2000 chars) to avoid truncation.
7. No text after the closing \`\`\` fence.
`;

  return `${header}\n\n## Job Description\n\n${job.descriptionMarkdown}\n${jsonContract}`;
}
