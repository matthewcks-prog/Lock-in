// backend/config/prompts.js

/**
 * AI System Prompts
 *
 * Centralized prompt configuration for AI features.
 * Keeping prompts here enables:
 * - A/B testing without code changes
 * - Versioning and experimentation
 * - Separation from business logic
 */

const CHAT_WITH_NOTES_SYSTEM_PROMPT = `You are a study assistant that answers questions using the student's own notes.

If information is not in the notes provided, say so honestly.

Be clear and concise, and reference which note you are using when relevant.`;

const STUDY_GUIDE_DEPTH_CONFIG = {
  brief: {
    tldrRange: '5 bullets',
    objectiveRange: '4 objectives',
    takeawayRange: '4-6 items total across High/Medium/Low',
    conceptRange: '4-6 concept links',
    definitionRange: '6-10 terms',
    processRange: 'Only include core steps explicitly stated',
    exampleRange: 'Up to 2 examples',
    confusionRange: 'Up to 4 confusions',
    style: 'Keep it compact and revision-first.',
  },
  standard: {
    tldrRange: '6-8 bullets',
    objectiveRange: '5-7 objectives',
    takeawayRange: '6-10 items total across High/Medium/Low',
    conceptRange: '6-10 concept links',
    definitionRange: '10-16 terms',
    processRange: 'Include all named or implied methods and step lists',
    exampleRange: 'Include all examples that are worked in lecture',
    confusionRange: 'Capture all repeated corrections/confusions',
    style: 'Balanced detail with strong scannability.',
  },
  detailed: {
    tldrRange: '8-10 bullets',
    objectiveRange: '6-8 objectives',
    takeawayRange: '10-14 items total across High/Medium/Low',
    conceptRange: '10-16 concept links',
    definitionRange: '16-24 terms',
    processRange: 'Include every process/method/step sequence found',
    exampleRange: 'Include every worked example in transcript',
    confusionRange: 'Capture every confusion, repetition, or warning',
    style: 'Maximum useful detail while remaining structured.',
  },
};

function resolveStudyGuideDepth(depth) {
  if (depth === 'brief' || depth === 'detailed') {
    return depth;
  }
  return 'standard';
}

function toDisplayValue(value, fallback = 'Not provided') {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildExamFocusAreasLine(examFocusAreas) {
  if (!Array.isArray(examFocusAreas) || examFocusAreas.length === 0) {
    return '- Exam focus areas: Not provided';
  }
  const cleaned = examFocusAreas
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
  if (cleaned.length === 0) {
    return '- Exam focus areas: Not provided';
  }
  return `- Exam focus areas: ${cleaned.join('; ')}`;
}

function buildDepthInstruction(depth) {
  const resolvedDepth = resolveStudyGuideDepth(depth);
  const config = STUDY_GUIDE_DEPTH_CONFIG[resolvedDepth];
  return [
    `Preferred depth: ${resolvedDepth}`,
    `- TL;DR: ${config.tldrRange}`,
    `- Learning Objectives: ${config.objectiveRange}`,
    `- High-Yield Takeaways: ${config.takeawayRange}`,
    `- Concept Map connections: ${config.conceptRange}`,
    `- Definitions table size: ${config.definitionRange}`,
    `- Processes/Methods: ${config.processRange}`,
    `- Examples: ${config.exampleRange}`,
    `- Common Confusions: ${config.confusionRange}`,
    `- Style: ${config.style}`,
  ].join('\n');
}

function buildStudyGuideSystemPrompt() {
  return `You are an expert Study Guide Generator for university students.

Grounding requirements:
- Use only information that appears in the provided transcript source.
- Do not add outside facts, examples, definitions, corrections, or assumptions.
- If a requested detail is missing or unclear, write exactly "Not stated in transcript" and place it under "Open Questions / Missing Info".
- Every factual claim must include evidence in this format: (evidence: "short quote" @ mm:ss-mm:ss).
- Always cite using the timestamp range from the transcript line (e.g. @ 01:23-01:45), never line numbers.
- Keep quotes short.

Output quality rules:
- Use clean Markdown with clear headings and bullet lists.
- Keep language simple and exam-ready.
- Do not include preambles or mention these instructions.
- Maintain section order exactly as requested.`;
}

function buildStudyGuideOutputInstructions({ includeJson }) {
  const lines = [
    'OUTPUT (in this exact section order):',
    '1) TL;DR (5-10 bullets, depth-adjusted)',
    '2) Learning Objectives (inferred from transcript, phrased as "I can...")',
    '3) High-Yield Key Takeaways (prioritized High / Medium / Low + why)',
    '4) Core Concepts & How They Connect (concept map in text using arrows/indentation)',
    '5) Definitions (table: Term | Transcript definition (paraphrase) | Evidence)',
    '6) Processes / Methods / Steps (if any, include when to use + pitfalls only if mentioned)',
    '7) Examples Worked in the Lecture (only examples in transcript)',
    '8) Common Confusions & Clarifications (and how to avoid mistakes using transcript ideas)',
    '9) Open Questions / Missing Info (only items not fully explained in transcript)',
    '',
    'If any section has no evidence-backed items, write "Not stated in transcript" in that section.',
  ];

  if (includeJson === true) {
    lines.push(
      '',
      'After the Markdown, append a JSON block labeled "STUDY_GUIDE_JSON" with keys:',
      'tldr, high_yield, definitions, recall_questions, flashcards, open_questions.',
      'Each item must include evidence with quote and start/end timestamps (e.g. @ 01:23-01:45).',
    );
  }

  return lines.join('\n');
}

function buildStudyGuidePrompt({
  depth,
  transcriptBody,
  courseName,
  lectureTitle,
  weekTopic,
  goal,
  examFocusAreas,
  includeJson = true,
}) {
  const depthInstructions = buildDepthInstruction(depth);
  const contextBlock = [
    'INPUT CONTEXT',
    `- Course/Unit: ${toDisplayValue(courseName)}`,
    `- Lecture title: ${toDisplayValue(lectureTitle)}`,
    `- Week/topic: ${toDisplayValue(weekTopic)}`,
    `- Student goal: ${toDisplayValue(goal, 'weekly review')}`,
    buildExamFocusAreasLine(examFocusAreas),
    '',
    depthInstructions,
  ].join('\n');

  const user = [
    contextBlock,
    '',
    'TRANSCRIPT SOURCE',
    'Each transcript line uses this format:',
    'L#### | mm:ss-mm:ss | speaker(optional) | text',
    '',
    transcriptBody,
    '',
    buildStudyGuideOutputInstructions({ includeJson }),
  ].join('\n');

  return {
    system: buildStudyGuideSystemPrompt(),
    user,
  };
}

function buildStudyGuideChunkDigestPrompt({
  depth,
  chunkIndex,
  chunkCount,
  chunkBody,
  lectureTitle,
}) {
  const resolvedDepth = resolveStudyGuideDepth(depth);
  const title = toDisplayValue(lectureTitle, 'Untitled lecture');
  const system = `You extract grounded study evidence from transcript chunks.
Return concise Markdown only.
Use only the provided transcript chunk.
Every bullet must include evidence in format: (evidence: "short quote" @ mm:ss-mm:ss). Always use the timestamp from the transcript line, never the line number.`;

  const user = [
    `Lecture: ${title}`,
    `Depth mode: ${resolvedDepth}`,
    `Chunk: ${chunkIndex + 1}/${chunkCount}`,
    '',
    'TASK',
    'Summarize only this chunk into these sections:',
    '1) Chunk Facts (8-14 bullets)',
    '2) Definitions (table: Term | Definition from chunk | Evidence)',
    '3) Methods/Steps (if any)',
    '4) Worked Examples (if any)',
    '5) Confusions/Warnings (if any)',
    '6) Open Questions from this chunk',
    '',
    'If something is missing, write "Not stated in transcript".',
    '',
    'TRANSCRIPT CHUNK',
    chunkBody,
  ].join('\n');

  return { system, user };
}

module.exports = {
  CHAT_WITH_NOTES_SYSTEM_PROMPT,
  resolveStudyGuideDepth,
  buildStudyGuidePrompt,
  buildStudyGuideChunkDigestPrompt,
};
