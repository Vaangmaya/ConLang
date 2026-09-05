// zod schemas and (de)serialization for the Project save format (DESIGN.md §3, §4.8).
// Anything crossing a JSON boundary (project save/load, imports) is validated here.

import { z } from 'zod';

const placeSchema = z.enum([
  'bilabial',
  'labiodental',
  'dental',
  'alveolar',
  'postalveolar',
  'retroflex',
  'palatal',
  'velar',
  'uvular',
  'glottal',
]);

const mannerSchema = z.enum([
  'stop',
  'fricative',
  'affricate',
  'nasal',
  'trill',
  'tap',
  'lateral',
  'approximant',
]);

const heightSchema = z.enum(['high', 'mid-high', 'mid', 'mid-low', 'low']);
const backnessSchema = z.enum(['front', 'central', 'back']);

const consonantFeaturesSchema = z.object({
  kind: z.literal('consonant'),
  place: placeSchema,
  manner: mannerSchema,
  voiced: z.boolean(),
});

const vowelFeaturesSchema = z.object({
  kind: z.literal('vowel'),
  height: heightSchema,
  backness: backnessSchema,
  rounded: z.boolean(),
  long: z.boolean(),
});

const featureBundleSchema = z.discriminatedUnion('kind', [
  consonantFeaturesSchema,
  vowelFeaturesSchema,
]);

const phonemeSchema = z.object({
  id: z.string(),
  ipa: z.string(),
  features: featureBundleSchema,
  weight: z.number().positive(),
  romanization: z.string(),
});

const inventorySchema = z.object({
  phonemes: z.array(phonemeSchema),
});

const phonemeClassSchema = z.object({
  symbol: z.string(),
  members: z.array(z.string()),
});

// TemplateNode is recursive; validated structurally rather than re-derived from the AST types.
const templateNodeSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.object({ type: z.literal('ClassRef'), symbol: z.string() }),
    z.object({ type: z.literal('Optional'), prob: z.number(), body: templateNodeSchema }),
    z.object({ type: z.literal('Seq'), elements: z.array(templateNodeSchema) }),
  ]),
);

const syllableTemplateSchema = z.object({
  raw: z.string(),
  ast: templateNodeSchema,
  weight: z.number().positive(),
});

const constraintSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('BannedSequence'),
    sequence: z.array(z.string()),
    scope: z.enum([
      'anywhere',
      'wordInitial',
      'wordFinal',
      'withinSyllable',
      'acrossSyllableBoundary',
    ]),
  }),
  z.object({
    type: z.literal('Sonority'),
    scale: z.record(z.string(), z.number()),
    allowPlateaus: z.boolean(),
  }),
  z.object({
    type: z.literal('VowelHarmony'),
    sets: z.array(z.array(z.string())),
    neutral: z.array(z.string()),
  }),
  z.object({
    type: z.literal('RequiredOnset'),
    scope: z.enum(['everySyllable', 'wordInitial']),
  }),
]);

const grammarSchema = z.object({
  classes: z.array(phonemeClassSchema),
  templates: z.array(syllableTemplateSchema),
  syllableCount: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
    weights: z.array(z.number()),
  }),
  constraints: z.array(constraintSchema),
});

const generatedWordSchema = z.object({
  phonemeIds: z.array(z.string()),
  syllableBreaks: z.array(z.number().int()),
  seed: z.number(),
});

const featureSpecSchema = z.object({
  sign: z.enum(['+', '-']),
  name: z.string(),
});

const atomSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ipaLiteral'), value: z.string() }),
  z.object({ type: z.literal('classRef'), symbol: z.string() }),
  z.object({ type: z.literal('featureSet'), features: z.array(featureSpecSchema) }),
  z.object({ type: z.literal('boundary') }),
]);

const seqOrEpsilonSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('seq'), atoms: z.array(atomSchema) }),
  z.object({ type: z.literal('epsilon') }),
]);

const soundChangeAstSchema = z.object({
  target: seqOrEpsilonSchema,
  replacement: seqOrEpsilonSchema,
  before: z.array(atomSchema).optional(),
  after: z.array(atomSchema).optional(),
});

const soundChangeRuleSchema = z.object({
  id: z.string(),
  raw: z.string(),
  enabled: z.boolean(),
  ast: soundChangeAstSchema.optional(),
});

export const projectSchema = z.object({
  formatVersion: z.literal(1),
  name: z.string(),
  inventory: inventorySchema,
  grammar: grammarSchema,
  lexicon: z.array(generatedWordSchema),
  rules: z.array(soundChangeRuleSchema),
});

export type Project = z.infer<typeof projectSchema>;

export interface ProjectValidationError {
  path: string;
  message: string;
}

export function parseProject(
  json: unknown,
): { ok: true; project: Project } | { ok: false; errors: ProjectValidationError[] } {
  const result = projectSchema.safeParse(json);
  if (result.success) {
    return { ok: true, project: result.data };
  }
  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}
