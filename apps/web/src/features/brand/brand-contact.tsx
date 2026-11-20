import { brandContactSchema, CHANNEL_NAME_MAX, isChannelNameSet } from "@studio/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";

export const BRAND_CONTACT_KEY = ["brand-profile", "contact"] as const;
const t = vi.brand.contact;

/** Tên kênh và liên hệ bản quyền của kênh mặc định (ADR-018, ADR-021). */
export function useBrandContact() {
  return useQuery({
    queryKey: BRAND_CONTACT_KEY,
    queryFn: () => apiRequest("/api/brand-profile/contact", { schema: brandContactSchema }),
  });
}

/**
 * Tên kênh (ADR-021: thẻ cuối video và bộ đăng bài; bắt buộc trước lần xuất đầu) và liên hệ bản quyền
 * (ADR-018: ghi cuối mô tả mọi video). Hai trường sửa được của trang; phần còn lại vẫn chỉ đọc.
 */
export function BrandContactForm() {
  const queryClient = useQueryClient();
  const contact = useBrandContact();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [nameError, setNameError] = useState(false);
  useEffect(() => {
    if (contact.data !== undefined) {
      setName(isChannelNameSet(contact.data.displayName) ? contact.data.displayName : "");
      setValue(contact.data.copyrightContact ?? "");
    }
  }, [contact.data]);
  const save = useMutation({
    mutationFn: (body: { copyrightContact: string; displayName?: string }) =>
      apiRequest("/api/brand-profile/contact", {
        method: "PUT",
        body,
        schema: brandContactSchema,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(BRAND_CONTACT_KEY, data);
      toast(t.saved);
    },
  });
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!isChannelNameSet(trimmed)) {
      setNameError(true);
      return;
    }
    setNameError(false);
    save.mutate({ copyrightContact: value, displayName: trimmed });
  };
  const missingName = contact.data !== undefined && !isChannelNameSet(contact.data.displayName);
  return (
    <form
      onSubmit={onSubmit}
      aria-label={t.heading}
      className="bg-card flex flex-col gap-3 rounded-2xl border p-5"
    >
      <h2 className="text-lg font-semibold">{t.heading}</h2>
      <p className="text-muted-foreground text-sm">{t.hint}</p>
      {missingName ? (
        <p className="bg-warning-bg text-foreground rounded-xl px-3 py-2 text-sm font-semibold">
          {t.nameMissing}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor="brand-channel-name">{t.nameLabel}</Label>
        <Input
          id="brand-channel-name"
          value={name}
          maxLength={CHANNEL_NAME_MAX}
          placeholder={t.namePlaceholder}
          onChange={(event) => setName(event.target.value)}
          disabled={contact.isPending}
          aria-invalid={nameError}
        />
        {nameError ? (
          <p role="alert" className="text-destructive text-xs">
            {t.nameRequired}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="brand-copyright-contact">{t.label}</Label>
        <Input
          id="brand-copyright-contact"
          value={value}
          maxLength={300}
          placeholder={t.placeholder}
          onChange={(event) => setValue(event.target.value)}
          disabled={contact.isPending}
        />
      </div>
      {contact.isError || save.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {t.error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending || contact.isPending}>
          {save.isPending ? t.saving : t.save}
        </Button>
      </div>
    </form>
  );
}
