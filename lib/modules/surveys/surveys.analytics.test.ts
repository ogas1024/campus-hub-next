import { describe, expect, it } from "vitest";

import { buildSurveyCsv, buildSurveyResults, type SurveyQuestion, type SurveyResponse } from "./surveys.analytics";

function q(id: string, sectionTitle: string, sectionSort: number, sort: number, questionType: SurveyQuestion["questionType"], options: SurveyQuestion["options"] = []): SurveyQuestion {
  return {
    id,
    title: id,
    questionType,
    required: false,
    sectionTitle,
    sectionSort,
    sort,
    options,
  };
}

describe("surveys.analytics", () => {
  it("buildSurveyResults: should aggregate counts and rating avg", () => {
    const questions: SurveyQuestion[] = [
      q("q_text", "S1", 0, 0, "text"),
      q("q_single", "S1", 0, 1, "single", [
        { id: "o1", label: "A", sort: 0 },
        { id: "o2", label: "B", sort: 1 },
      ]),
      q("q_multi", "S1", 0, 2, "multi", [
        { id: "m1", label: "X", sort: 0 },
        { id: "m2", label: "Y", sort: 1 },
      ]),
      q("q_rating", "S1", 0, 3, "rating"),
    ];

    const responses: SurveyResponse[] = [
      {
        submittedAt: new Date("2025-01-01T00:00:00.000Z"),
        items: [
          { questionId: "q_text", value: { text: "hello" } },
          { questionId: "q_single", value: { optionId: "o1" } },
          { questionId: "q_multi", value: { optionIds: ["m1", "m2"] } },
          { questionId: "q_rating", value: { value: 5 } },
        ],
      },
      {
        submittedAt: new Date("2025-01-02T00:00:00.000Z"),
        items: [
          { questionId: "q_text", value: { text: "world" } },
          { questionId: "q_single", value: { optionId: "o2" } },
          { questionId: "q_multi", value: { optionIds: ["m1"] } },
          { questionId: "q_rating", value: { value: 3 } },
        ],
      },
    ];

    const results = buildSurveyResults({ questions, responses, textSampleLimitPerQuestion: 10 });
    expect(results.totalResponses).toBe(2);

    const single = results.questions.find((x) => x.questionId === "q_single");
    expect(single && single.questionType).toBe("single");
    if (single && single.questionType === "single") {
      expect(single.options.find((o) => o.optionId === "o1")?.count).toBe(1);
      expect(single.options.find((o) => o.optionId === "o2")?.count).toBe(1);
    }

    const multi = results.questions.find((x) => x.questionId === "q_multi");
    expect(multi && multi.questionType).toBe("multi");
    if (multi && multi.questionType === "multi") {
      expect(multi.options.find((o) => o.optionId === "m1")?.count).toBe(2);
      expect(multi.options.find((o) => o.optionId === "m2")?.count).toBe(1);
    }

    const rating = results.questions.find((x) => x.questionId === "q_rating");
    expect(rating && rating.questionType).toBe("rating");
    if (rating && rating.questionType === "rating") {
      expect(rating.avg).toBe(4);
      expect(rating.distribution.find((d) => d.value === 5)?.count).toBe(1);
      expect(rating.distribution.find((d) => d.value === 3)?.count).toBe(1);
    }
  });

  it("buildSurveyCsv: should mitigate csv formula injection", () => {
    const questions: SurveyQuestion[] = [q("q_text", "S1", 0, 0, "text")];
    const responses: SurveyResponse[] = [
      {
        submittedAt: new Date("2025-01-01T00:00:00.000Z"),
        items: [{ questionId: "q_text", value: { text: "=SUM(1,1)" } }],
      },
    ];

    const csv = buildSurveyCsv({ questions, responses, includeIdentity: false });
    expect(csv).toContain("\"'=SUM(1,1)\"");
  });
});

