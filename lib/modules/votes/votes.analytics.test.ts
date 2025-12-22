import { describe, expect, it } from "vitest";

import { buildVoteResults, type VoteQuestion, type VoteResponse } from "./votes.analytics";

function q(id: string, sort: number, questionType: VoteQuestion["questionType"], options: VoteQuestion["options"], maxChoices = 1): VoteQuestion {
  return {
    id,
    title: id,
    questionType,
    required: false,
    sort,
    maxChoices,
    options,
  };
}

describe("votes.analytics", () => {
  it("buildVoteResults: should aggregate counts", () => {
    const questions: VoteQuestion[] = [
      q("q_single", 0, "single", [
        { id: "o1", label: "A", sort: 0 },
        { id: "o2", label: "B", sort: 1 },
      ]),
      q(
        "q_multi",
        1,
        "multi",
        [
          { id: "m1", label: "X", sort: 0 },
          { id: "m2", label: "Y", sort: 1 },
          { id: "m3", label: "Z", sort: 2 },
        ],
        2,
      ),
    ];

    const responses: VoteResponse[] = [
      {
        submittedAt: new Date("2025-01-01T00:00:00.000Z"),
        items: [
          { questionId: "q_single", value: { optionId: "o1" } },
          { questionId: "q_multi", value: { optionIds: ["m1", "m2"] } },
        ],
      },
      {
        submittedAt: new Date("2025-01-02T00:00:00.000Z"),
        items: [
          { questionId: "q_single", value: { optionId: "o2" } },
          { questionId: "q_multi", value: { optionIds: ["m1"] } },
        ],
      },
      {
        submittedAt: new Date("2025-01-03T00:00:00.000Z"),
        items: [
          { questionId: "q_single", value: { optionId: "o2" } },
          { questionId: "q_multi", value: { optionIds: ["m3"] } },
        ],
      },
    ];

    const results = buildVoteResults({ questions, responses });
    expect(results.totalResponses).toBe(3);

    const single = results.questions.find((x) => x.questionId === "q_single");
    expect(single && single.questionType).toBe("single");
    if (single && single.questionType === "single") {
      expect(single.options.find((o) => o.optionId === "o1")?.count).toBe(1);
      expect(single.options.find((o) => o.optionId === "o2")?.count).toBe(2);
    }

    const multi = results.questions.find((x) => x.questionId === "q_multi");
    expect(multi && multi.questionType).toBe("multi");
    if (multi && multi.questionType === "multi") {
      expect(multi.options.find((o) => o.optionId === "m1")?.count).toBe(2);
      expect(multi.options.find((o) => o.optionId === "m2")?.count).toBe(1);
      expect(multi.options.find((o) => o.optionId === "m3")?.count).toBe(1);
      expect(multi.maxChoices).toBe(2);
    }
  });
});

