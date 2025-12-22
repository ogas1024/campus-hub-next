export type VoteQuestionType = "single" | "multi";

export type VoteQuestionOption = { id: string; label: string; sort: number };

export type VoteQuestion = {
  id: string;
  questionType: VoteQuestionType;
  title: string;
  required: boolean;
  sort: number;
  maxChoices: number;
  options: VoteQuestionOption[];
};

export type VoteAnswerValue = { optionId: string } | { optionIds: string[] };

export type VoteResponseItem = {
  questionId: string;
  value: VoteAnswerValue;
};

export type VoteResponse = {
  submittedAt: Date;
  items: VoteResponseItem[];
};

export type VoteQuestionResultBase = {
  questionId: string;
  title: string;
  required: boolean;
  questionType: VoteQuestionType;
  answeredCount: number;
};

export type VoteSingleChoiceQuestionResult = VoteQuestionResultBase & {
  questionType: "single";
  options: Array<{ optionId: string; label: string; count: number; percent: number }>;
};

export type VoteMultiChoiceQuestionResult = VoteQuestionResultBase & {
  questionType: "multi";
  maxChoices: number;
  options: Array<{ optionId: string; label: string; count: number; percent: number }>;
};

export type VoteQuestionResult = VoteSingleChoiceQuestionResult | VoteMultiChoiceQuestionResult;

export type VoteResults = {
  totalResponses: number;
  questions: VoteQuestionResult[];
};

function safePercent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 10_000) / 100;
}

function normalizeQuestions(questions: VoteQuestion[]) {
  return [...questions].sort((a, b) => a.sort - b.sort);
}

function pickSingle(value: VoteAnswerValue) {
  return "optionId" in value ? value.optionId : null;
}

function pickMulti(value: VoteAnswerValue) {
  return "optionIds" in value ? value.optionIds : null;
}

export function buildVoteResults(params: {
  questions: VoteQuestion[];
  responses: VoteResponse[];
}): VoteResults {
  const questions = normalizeQuestions(params.questions);
  const totalResponses = params.responses.length;

  const itemsByQuestionId = new Map<string, VoteResponseItem[]>();
  for (const r of params.responses) {
    for (const item of r.items) {
      const list = itemsByQuestionId.get(item.questionId) ?? [];
      list.push(item);
      itemsByQuestionId.set(item.questionId, list);
    }
  }

  const results: VoteQuestionResult[] = [];

  for (const q of questions) {
    const items = itemsByQuestionId.get(q.id) ?? [];

    if (q.questionType === "single") {
      const counts = new Map<string, number>();
      for (const item of items) {
        const id = pickSingle(item.value);
        if (!id) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }

      const options = q.options
        .slice()
        .sort((a, b) => a.sort - b.sort)
        .map((opt) => {
          const count = counts.get(opt.id) ?? 0;
          return { optionId: opt.id, label: opt.label, count, percent: safePercent(count, items.length) };
        });

      results.push({
        questionId: q.id,
        questionType: "single",
        title: q.title,
        required: q.required,
        answeredCount: items.length,
        options,
      });
      continue;
    }

    const counts = new Map<string, number>();
    for (const item of items) {
      const ids = pickMulti(item.value);
      if (!ids) continue;
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const options = q.options
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((opt) => {
        const count = counts.get(opt.id) ?? 0;
        return { optionId: opt.id, label: opt.label, count, percent: safePercent(count, items.length) };
      });

    results.push({
      questionId: q.id,
      questionType: "multi",
      title: q.title,
      required: q.required,
      answeredCount: items.length,
      maxChoices: q.maxChoices,
      options,
    });
  }

  return { totalResponses, questions: results };
}

