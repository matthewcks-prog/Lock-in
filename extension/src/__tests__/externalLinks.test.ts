import { describe, expect, it } from 'vitest';
import { EXTERNAL_LINKS } from '../config/externalLinks';

describe('EXTERNAL_LINKS', () => {
  it('matches the approved compliance URLs exactly', () => {
    expect(EXTERNAL_LINKS).toEqual({
      MONASH_ACADEMIC_INTEGRITY: 'https://www.monash.edu/students/study-success/academic-integrity',
      USING_GENAI_AT_MONASH:
        'https://www.monash.edu/students/news/articles/using-generative-ai-at-monash',
      TEACHHQ_AI_STATEMENTS:
        'https://www.monash.edu/learning-teaching/teachhq/Teaching-practices/artificial-intelligence/AI-statements',
      TEACHHQ_AI_AND_ASSESSMENT:
        'https://www.monash.edu/learning-teaching/teachhq/Teaching-practices/artificial-intelligence/ai-and-assessment',
      MONASH_AI_POLICIES_AND_GUIDELINES:
        'https://www.monash.edu/ai/tools-training-and-resources/ai-policies-and-guidelines',
      MONASH_IT_ACCEPTABLE_USE_PROCEDURE_PDF:
        'https://publicpolicydms.monash.edu/Monash/documents/1909280',
      MONASH_DATA_PROTECTION_AND_PRIVACY_PROCEDURE:
        'https://www.monash.edu/privacy-monash/data-protection-and-privacy-procedure-and-collection-statements',
      TEQSA_GENAI_INTEGRITY_HUB:
        'https://www.teqsa.gov.au/guides-resources/higher-education-good-practice-hub/gen-ai-knowledge-hub/gen-ai-academic-integrity-and-assessment-reform',
      CHROME_WEB_STORE_PROGRAM_POLICIES:
        'https://developer.chrome.com/docs/webstore/program-policies/policies',
    });
  });
});
