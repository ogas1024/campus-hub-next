export type SurveyQuestionType = "text" | "single" | "multi" | "rating";

export type SurveyQuestionOption = { id: string; label: string; sort: number };

export type SurveyQuestion = {
  id: string;
  title: string;
  questionType: SurveyQuestionType;
  required: boolean;
  sectionTitle: string;
  sectionSort: number;
  sort: number;
  options: SurveyQuestionOption[];
};

export type SurveyAnswerValue =
  | { text: string }
  | { optionId: string }
  | { optionIds: string[] }
  | { value: number };

export type SurveyResponseItem = {
  questionId: string;
  value: SurveyAnswerValue;
};

export type SurveyResponse = {
  submittedAt: Date;
  user?: { name: string; studentId: string };
  items: SurveyResponseItem[];
};

export type SurveyQuestionResultBase = {
  questionId: string;
  title: string;
  sectionTitle: string;
  required: boolean;
  answeredCount: number;
};

export type SurveyTextQuestionResult = SurveyQuestionResultBase & {
  questionType: "text";
  samples: string[];
};

export type SurveySingleChoiceQuestionResult = SurveyQuestionResultBase & {
  questionType: "single";
  options: Array<{ optionId: string; label: string; count: number; percent: number }>;
};

export type SurveyMultiChoiceQuestionResult = SurveyQuestionResultBase & {
  questionType: "multi";
  options: Array<{ optionId: string; label: string; count: number; percent: number }>;
};

export type SurveyRatingQuestionResult = SurveyQuestionResultBase & {
  questionType: "rating";
  avg: number | null;
  distribution: Array<{ value: number; count: number; percent: number }>;
};

export type SurveyQuestionResult =
  | SurveyTextQuestionResult
  | SurveySingleChoiceQuestionResult
  | SurveyMultiChoiceQuestionResult
  | SurveyRatingQuestionResult;

export type SurveyResults = {
  totalResponses: number;
  questions: SurveyQuestionResult[];
};

export function normalizeQuestions(questions: SurveyQuestion[]) {
  return [...questions].sort((a, b) => {
    if (a.sectionSort !== b.sectionSort) return a.sectionSort - b.sectionSort;
    return a.sort - b.sort;
  });
}

function safePercent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 10_000) / 100;
}

function pickText(value: SurveyAnswerValue) {
  return "text" in value ? value.text : null;
}

function pickSingle(value: SurveyAnswerValue) {
  return "optionId" in value ? value.optionId : null;
}

function pickMulti(value: SurveyAnswerValue) {
  return "optionIds" in value ? value.optionIds : null;
}

function pickRating(value: SurveyAnswerValue) {
  return "value" in value ? value.value : null;
}

export function buildSurveyResults(params: {
  questions: SurveyQuestion[];
  responses: SurveyResponse[];
  textSampleLimitPerQuestion?: number;
}): SurveyResults {
  const questions = normalizeQuestions(params.questions);
  const totalResponses = params.responses.length;
  const sampleLimit = Math.max(0, Math.min(200, Math.floor(params.textSampleLimitPerQuestion ?? 30)));

  const itemsByQuestionId = new Map<string, SurveyResponseItem[]>();
  for (const r of params.responses) {
    for (const item of r.items) {
      const list = itemsByQuestionId.get(item.questionId) ?? [];
      list.push(item);
      itemsByQuestionId.set(item.questionId, list);
    }
  }

  const results: SurveyQuestionResult[] = [];

  for (const q of questions) {
    const items = itemsByQuestionId.get(q.id) ?? [];

    if (q.questionType === "text") {
      const samples: string[] = [];
      for (const item of items) {
        const raw = pickText(item.value);
        if (!raw) continue;
        const text = raw.trim();
        if (!text) continue;
        samples.push(text);
        if (sampleLimit > 0 && samples.length >= sampleLimit) break;
      }

      results.push({
        questionId: q.id,
        questionType: "text",
        title: q.title,
        sectionTitle: q.sectionTitle,
        required: q.required,
        answeredCount: items.length,
        samples,
      });
      continue;
    }

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
        sectionTitle: q.sectionTitle,
        required: q.required,
        answeredCount: items.length,
        options,
      });
      continue;
    }

    if (q.questionType === "multi") {
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
        sectionTitle: q.sectionTitle,
        required: q.required,
        answeredCount: items.length,
        options,
      });
      continue;
    }

    const distributionMap = new Map<number, number>();
    let sum = 0;
    let count = 0;
    for (const item of items) {
      const v = pickRating(item.value);
      if (!v || !Number.isFinite(v)) continue;
      const value = Math.max(1, Math.min(5, Math.trunc(v)));
      distributionMap.set(value, (distributionMap.get(value) ?? 0) + 1);
      sum += value;
      count += 1;
    }

    const distribution = [1, 2, 3, 4, 5].map((value) => {
      const c = distributionMap.get(value) ?? 0;
      return { value, count: c, percent: safePercent(c, count) };
    });

    results.push({
      questionId: q.id,
      questionType: "rating",
      title: q.title,
      sectionTitle: q.sectionTitle,
      required: q.required,
      answeredCount: items.length,
      avg: count > 0 ? Math.round((sum / count) * 100) / 100 : null,
      distribution,
    });
  }

  return { totalResponses, questions: results };
}

function sanitizeForCsvFormula(value: string) {
  const text = value.replace(/\r\n/g, "\n");
  if (/^[=+\-@]/.test(text) || text.startsWith("\t")) return `'${text}`;
  return text;
}

function escapeCsvCell(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildSurveyCsv(params: {
  questions: SurveyQuestion[];
  responses: SurveyResponse[];
  includeIdentity: boolean;
}) {
  const questions = normalizeQuestions(params.questions);
  const header: string[] = [];

  if (params.includeIdentity) {
    header.push("学号", "姓名");
  }
  header.push("提交时间");
  for (const q of questions) {
    const title = q.sectionTitle ? `${q.sectionTitle} / ${q.title}` : q.title;
    header.push(title);
  }

  const lines: string[] = [];
  lines.push(header.map((h) => escapeCsvCell(sanitizeForCsvFormula(h))).join(","));

  const optionLabelMap = new Map<string, string>();
  for (const q of questions) {
    for (const opt of q.options) optionLabelMap.set(opt.id, opt.label);
  }

  for (const r of params.responses) {
    const row: string[] = [];

    if (params.includeIdentity) {
      row.push(r.user?.studentId ?? "", r.user?.name ?? "");
    }
    row.push(r.submittedAt.toISOString());

    const answerMap = new Map<string, SurveyAnswerValue>();
    for (const item of r.items) answerMap.set(item.questionId, item.value);

    for (const q of questions) {
      const v = answerMap.get(q.id);
      if (!v) {
        row.push("");
        continue;
      }

      if (q.questionType === "text" && "text" in v) {
        row.push(v.text);
        continue;
      }
      if (q.questionType === "single" && "optionId" in v) {
        row.push(optionLabelMap.get(v.optionId) ?? "");
        continue;
      }
      if (q.questionType === "multi" && "optionIds" in v) {
        const labels = v.optionIds.map((id) => optionLabelMap.get(id) ?? "").filter(Boolean);
        row.push(labels.join("; "));
        continue;
      }
      if (q.questionType === "rating" && "value" in v) {
        row.push(String(v.value));
        continue;
      }

      row.push("");
    }

    lines.push(row.map((c) => escapeCsvCell(sanitizeForCsvFormula(c))).join(","));
  }

  return lines.join("\n");
}
