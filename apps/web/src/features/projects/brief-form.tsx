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
 * `durationSec` rỗng hoặc ngoài khoảng của gói `story` (30–90 giây) → lỗi tiếng Việt.
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

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={onSubmit}
      noValidate
      aria-label={vi.brief.heading}
    >
      <h3 className="text-sm font-semibold">{vi.brief.heading}</h3>
      {TEXT_FIELDS.map((field) => (
        <div key={field} className="flex flex-col gap-1">
          <Label htmlFor={fieldId(field)}>{vi.brief[field]}</Label>
          <Input
            {...ariaFor(field)}
            value={values[field]}
            onChange={(event) => setField(field, event.target.value)}
          />
          {errorFor(field)}
        </div>
      ))}
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
        {errorFor("durationSec")}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={fieldId("notes")}>{vi.brief.notes}</Label>
        <Textarea
          {...ariaFor("notes")}
          value={values.notes}
          onChange={(event) => setField("notes", event.target.value)}
        />
        {errorFor("notes")}
      </div>
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
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? vi.brief.saving : vi.brief.save}
      </Button>
    </form>
  );
}
