import { z } from "zod";

export const surveyStatusSchema = z.enum(["draft", "published", "closed"]);
export const surveyScopeTypeSchema = z.enum(["role", "department", "position"]);
export const surveyQuestionTypeSchema = z.enum(["text", "single", "multi", "rating"]);

export const surveyScopeInputSchema = z.object({
  scopeType: surveyScopeTypeSchema,
  refId: z.string().uuid(),
});

export const surveyOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(200),
  sort: z.number().int().min(0).max(10000),
});

export const surveyQuestionSchema = z.object({
  id: z.string().uuid(),
  sectionId: z.string().uuid(),
  questionType: surveyQuestionTypeSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  required: z.boolean(),
  sort: z.number().int().min(0).max(10000),
  options: z.array(surveyOptionSchema).max(200).optional(),
});

export const surveySectionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().max(200),
  sort: z.number().int().min(0).max(10000),
  questions: z.array(surveyQuestionSchema).max(500),
});

export const createSurveyDraftBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  descriptionMd: z.string().max(20000).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  anonymousResponses: z.boolean(),
  visibleAll: z.boolean(),
  scopes: z.array(surveyScopeInputSchema).max(500),
});

export const updateSurveyDraftBodySchema = createSurveyDraftBodySchema.extend({
  sections: z.array(surveySectionSchema).max(100),
});

const surveyAnswerValueSchema = z.union([
  z.object({ text: z.string().max(5000) }),
  z.object({ optionId: z.string().uuid() }),
  z.object({ optionIds: z.array(z.string().uuid()).max(200) }),
  z.object({ value: z.number().int().min(1).max(5) }),
]);

export const submitSurveyResponseBodySchema = z.object({
  items: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        value: surveyAnswerValueSchema,
      }),
    )
    .max(2000),
});

export type SurveyScopeInput = z.infer<typeof surveyScopeInputSchema>;
export type SurveyQuestionType = z.infer<typeof surveyQuestionTypeSchema>;
export type SurveyStatus = z.infer<typeof surveyStatusSchema>;
export type SubmitSurveyResponseBody = z.infer<typeof submitSurveyResponseBodySchema>;
export type UpdateSurveyDraftBody = z.infer<typeof updateSurveyDraftBodySchema>;
