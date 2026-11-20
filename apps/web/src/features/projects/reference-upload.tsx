import { type ReferenceResponse, referenceJsonBodySchema } from "@studio/contracts";
import { type FormEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vi } from "@/i18n/vi";
import { ApiError } from "@/lib/api";
import { useAddReferenceUrl, useUploadReference } from "./use-projects";

/** Cùng trần với server (P2-03): 10 × 1024 × 1024 byte. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// ADR-030: ảnh PNG, JPEG, WebP được đưa vào video như hình minh họa thật.
const ALLOWED_EXTENSIONS = ["md", "txt", "pdf", "png", "jpg", "jpeg", "webp"];

/** Kiểm trước khi gửi: đuôi md/txt/pdf hoặc ảnh png/jpg/webp, ≤ 10 MiB. Server vẫn sniff nội dung. */
export function validateUploadFile(file: File | undefined): string | null {
  if (file === undefined) return vi.references.noFile;
  const dot = file.name.lastIndexOf(".");
  const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) return vi.references.badType;
  if (file.size > MAX_UPLOAD_BYTES) return vi.references.tooLarge;
  return null;
}

function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "payload_too_large") return vi.references.tooLarge;
    if (error.code === "validation_error") return vi.references.serverValidation;
  }
  return vi.references.serverError;
}

export function ReferenceUpload({
  projectId,
  references,
}: {
  projectId: string;
  references: ReferenceResponse[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const upload = useUploadReference(projectId);
  const inputId = `reference-file-${projectId}`;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    const problem = validateUploadFile(file);
    if (problem !== null || file === undefined) {
      setLocalError(problem);
      upload.reset();
      return;
    }
    setLocalError(null);
    upload.mutate(file, {
      onSuccess: () => {
        if (inputRef.current !== null) inputRef.current.value = "";
      },
    });
  };

  const errorText = localError ?? (upload.isError ? uploadErrorMessage(upload.error) : null);

  return (
    <section
      className="bg-card flex flex-col gap-3 rounded-2xl border p-5"
      aria-label={vi.references.heading}
    >
      <h2 className="text-lg font-semibold">{vi.references.heading}</h2>
      {references.length === 0 ? (
        <p className="text-muted-foreground text-sm">{vi.references.empty}</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {references.map((reference) => (
            <li key={reference.id}>{reference.title ?? reference.id}</li>
          ))}
        </ul>
      )}
      <form className="flex flex-col gap-2" onSubmit={onSubmit} noValidate>
        <Label htmlFor={inputId} className="leading-snug">
          {vi.references.fileLabel}
        </Label>
        <Input
          id={inputId}
          ref={inputRef}
          type="file"
          accept=".md,.txt,.pdf,.png,.jpg,.jpeg,.webp"
        />
        <p className="text-muted-foreground text-xs">{vi.references.imageHint}</p>
        {errorText !== null ? (
          <p role="alert" className="text-destructive text-sm">
            {errorText}
          </p>
        ) : null}
        {upload.isSuccess ? (
          <p role="status" className="text-sm">
            {vi.references.uploaded}
          </p>
        ) : null}
        <Button type="submit" variant="secondary" disabled={upload.isPending}>
          {upload.isPending ? vi.references.uploading : vi.references.upload}
        </Button>
      </form>
      <UrlReferenceForm projectId={projectId} />
    </section>
  );
}

function UrlReferenceForm({ projectId }: { projectId: string }) {
  const [url, setUrl] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const add = useAddReferenceUrl(projectId);
  const inputId = `reference-url-${projectId}`;
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = referenceJsonBodySchema.safeParse({ url: url.trim() });
    if (!parsed.success) {
      setLocalError(vi.references.badUrl);
      add.reset();
      return;
    }
    setLocalError(null);
    add.mutate(parsed.data.url, { onSuccess: () => setUrl("") });
  };
  const errorText = localError ?? (add.isError ? vi.references.urlServerError : null);
  return (
    <form className="flex flex-col gap-2 border-t pt-3" onSubmit={onSubmit} noValidate>
      <Label htmlFor={inputId} className="leading-snug">
        {vi.references.urlLabel}
      </Label>
      <Input
        id={inputId}
        type="url"
        inputMode="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        aria-invalid={errorText !== null}
      />
      {errorText !== null ? (
        <p role="alert" className="text-destructive text-sm">
          {errorText}
        </p>
      ) : null}
      {add.isSuccess ? (
        <p role="status" className="text-sm">
          {vi.references.urlAdded}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={add.isPending}>
        {add.isPending ? vi.references.addingUrl : vi.references.addUrl}
      </Button>
    </form>
  );
}
