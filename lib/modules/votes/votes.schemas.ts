import { z } from "zod";

export const voteStatusSchema = z.enum(["draft", "published", "closed"]);
export const voteScopeTypeSchema = z.enum(["role", "department", "position"]);
export const voteQuestionTypeSchema = z.enum(["single", "multi"]);

export const voteScopeInputSchema = z.object({
  scopeType: voteScopeTypeSchema,
  refId: z.string().uuid(),
});

export const voteOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(200),
  sort: z.number().int().min(0).max(10000),
});

export const voteQuestionSchema = z.object({
  id: z.string().uuid(),
  questionType: voteQuestionTypeSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  required: z.boolean(),
  sort: z.number().int().min(0).max(10000),
  maxChoices: z.number().int().min(1).max(200),
  options: z.array(voteOptionSchema).min(2).max(200),
});

export const createVoteDraftBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  descriptionMd: z.string().max(20000).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  anonymousResponses: z.boolean(),
  visibleAll: z.boolean(),
  scopes: z.array(voteScopeInputSchema).max(500),
});

export const updateVoteDraftBodySchema = createVoteDraftBodySchema.extend({
  questions: z.array(voteQuestionSchema).max(500),
});

const voteAnswerValueSchema = z.union([
  z.object({ optionId: z.string().uuid() }),
  z.object({ optionIds: z.array(z.string().uuid()).max(200) }),
]);

export const submitVoteResponseBodySchema = z.object({
  items: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        value: voteAnswerValueSchema,
      }),
    )
    .max(2000),
});

export const extendVoteBodySchema = z.object({
  endAt: z.string().datetime(),
});

export const pinVoteBodySchema = z.object({
  pinned: z.boolean(),
});

export type VoteScopeInput = z.infer<typeof voteScopeInputSchema>;
export type VoteQuestionType = z.infer<typeof voteQuestionTypeSchema>;
export type VoteStatus = z.infer<typeof voteStatusSchema>;
export type SubmitVoteResponseBody = z.infer<typeof submitVoteResponseBodySchema>;
export type UpdateVoteDraftBody = z.infer<typeof updateVoteDraftBodySchema>;

