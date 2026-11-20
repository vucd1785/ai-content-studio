import {
  type Brief,
  type BriefWriteBody,
  briefWriteBodySchema,
  DEFAULT_FORMAT,
  type FormatPack,
  getFormatPack,
} from "@studio/contracts";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { vi } from "@/i18n/vi";
import { ApiError } from "@/lib/api";
import { useSaveBrief } from "./use-projects";

const TEXT_FIELDS = ["topic", "audience", "goal", "tone", "visualStyle"] as const;
type TextField = (typeof TEXT_FIELDS)[number];
type FieldName = TextField | "durationSec" | "notes";
type FormValues = Record<TextField | "notes" | "durationSec", string>;

/** Mọi brief dùng một gói chung "Hoạt hình" (ADR-013 bổ sung (2)): không có ô chọn thể loại. */
const PACK = getFormatPack(DEFAULT_FORMAT.id, DEFAULT_FORMAT.version) as FormatPack;
type FieldErrors = Partial<Record<FieldName, string>>;

/** Giới hạn của `briefWriteBodySchema` (contracts `api/project.ts`). */
const TEXT_MAX = 2000;
const NOTES_MAX = 8000;

function initialValues(brief: Brief | null): FormValues {
  return {
    topic: brief?.topic ?? "",
    audience: brief?.audience ?? "",
    goal: brief?.goal ?? "",
    tone: brief?.tone ?? "",
    visualStyle: brief?.visualStyle ?? "",
    notes: brief?.notes ?? "",
    durationSec: brief === null ? "60" : String(brief.durationSec),
  };
}

/**
 * Validate bằng đúng schema hợp đồng (`briefWriteBodySchema`). Sai thì không gửi request.
 * `durationSec` rỗng hoặc ngoài khoảng của gói `story` v3 (30–180 giây) → lỗi tiếng Việt.
 */
export function validateBrief(
  values: FormValues,
): { ok: true; body: BriefWriteBody } | { ok: false; errors: FieldErrors } {
  const duration = values.durationSec.trim() === "" ? Number.NaN : Number(values.durationSec);
  const candidate = {
    topic: values.topic.trim(),
    audience: values.audience.trim(),
    goal: values.goal.trim(),
    tone: values.tone.trim(),
    visualStyle: values.visualStyle.trim(),
    durationSec: duration,
    language: "vi" as const,
    ...(values.notes.trim() === "" ? {} : { notes: values.notes.trim() }),
  };
  const parsed = briefWriteBodySchema.safeParse(candidate);
  if (parsed.success) {
    return { ok: true, body: parsed.data };
  }
  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as FieldName | undefined;
    if (field === undefined || errors[field] !== undefined) continue;
    if (field === "durationSec") {
      errors.durationSec = vi.brief.durationRangeFor(PACK.durationSec.min, PACK.durationSec.max);
    } else {
      errors[field] = issue.code === "too_big" ? vi.brief.tooLong : vi.brief.required;
    }
  }
  return { ok: false, errors };
}

export function BriefForm({ projectId, brief }: { projectId: string; brief: Brief | null }) {
  const [values, setValues] = useState<FormValues>(() => initialValues(brief));
  const [errors, setErrors] = useState<FieldErrors>({});
  const save = useSaveBrief(projectId);

  const setField = (field: keyof FormValues, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateBrief(values);
    if (!result.ok) {
      setErrors(result.errors);
      save.reset();
      return;
    }
    setErrors({});
    save.mutate(result.body);
  };

  const serverError = save.isError
    ? save.error instanceof ApiError && save.error.code === "validation_error"
      ? vi.brief.serverValidation
      : vi.brief.serverError
    : null;

  const fieldId = (field: FieldName) => `brief-${projectId}-${field}`;
  const errorFor = (field: FieldName) =>
    errors[field] === undefined ? null : (
      <p id={`${fieldId(field)}-error`} className="text-destructive text-xs">
        {errors[field]}
      </p>
    );
  const ariaFor = (field: FieldName) => ({
    id: fieldId(field),
    "aria-invalid": errors[field] !== undefined,
    ...(errors[field] !== undefined ? { "aria-describedby": `${fieldId(field)}-error` } : {}),
  });

  /** Ô văn bản nhiều dòng tự giãn theo nội dung, có gợi ý và bộ đếm ký tự. */
  const textField = (field: TextField | "notes", rows: number) => {
    const max = field === "notes" ? NOTES_MAX : TEXT_MAX;
    const length = values[field].length;
    return (
      <div key={field} className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={fieldId(field)}>{vi.brief[field]}</Label>
          <span
            className={`text-xs tabular-nums ${length > max ? "text-destructive" : "text-muted-foreground"}`}
          >
            {length.toLocaleString("vi-VN")}/{max.toLocaleString("vi-VN")}
          </span>
        </div>
        <Textarea
          {...ariaFor(field)}
          rows={rows}
          className="resize-y leading-relaxed"
          placeholder={vi.brief.placeholders[field]}
          value={values[field]}
          onChange={(event) => setField(field, event.target.value)}
        />
        {errorFor(field)}
      </div>
    );
  };

  return (
    <form
      className="bg-card @container flex flex-col gap-5 rounded-2xl border p-5"
      onSubmit={onSubmit}
      noValidate
      aria-label={vi.brief.heading}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{vi.brief.heading}</h2>
        <p className="text-muted-foreground text-sm">{vi.brief.intro}</p>
      </div>
      <fieldset className="flex flex-col gap-4">
        <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          {vi.brief.sectionContent}
        </legend>
        {textField("topic", 2)}
        {textField("goal", 3)}
      </fieldset>
      <fieldset className="grid gap-4 @lg:grid-cols-2">
        <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          {vi.brief.sectionStyle}
        </legend>
        {textField("audience", 2)}
        {textField("tone", 2)}
        {textField("visualStyle", 3)}
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId("durationSec")}>{vi.brief.durationSec}</Label>
          <Input
            {...ariaFor("durationSec")}
            type="number"
            inputMode="numeric"
            min={PACK.durationSec.min}
            max={PACK.durationSec.max}
            step={1}
            value={values.durationSec}
            onChange={(event) => setField("durationSec", event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            {vi.brief.durationHint(PACK.durationSec.min, PACK.durationSec.max)}
          </p>
          {errorFor("durationSec")}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-4">
        <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
          {vi.brief.sectionNotes}
        </legend>
        {textField("notes", 10)}
      </fieldset>
      {serverError !== null ? (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      ) : null}
      {save.isSuccess ? (
        <p role="status" className="text-sm">
          {vi.brief.saved}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending} className="min-w-32">
          {save.isPending ? vi.brief.saving : vi.brief.save}
        </Button>
      </div>
    </form>
  );
}
