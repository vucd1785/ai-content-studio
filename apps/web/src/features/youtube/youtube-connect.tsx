import {
  YOUTUBE_CLIENT_ID_REGEX,
  YOUTUBE_CLIENT_SECRET_REGEX,
  type YoutubeConfigUpdate,
  youtubeConnectionSchema,
  youtubeOauthStartSchema,
} from "@studio/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { vi } from "@/i18n/vi";
import { apiRequest } from "@/lib/api";
import { useYoutubeConnection, YOUTUBE_CONNECTION_KEY } from "./use-youtube";

const t = vi.youtube;
/** Đợi đăng nhập Google tối đa 10 phút (bằng hạn của `state`). */
const WAIT_MS = 10 * 60 * 1000;

/**
 * Kết nối kênh YouTube ở Bộ nhận diện kênh (ADR-031 mục 1). "Kết nối" mở trang đăng nhập Google ở tab mới; Google
 * chuyển về API, trang này đọc lại trạng thái cho tới khi thấy kênh. Không bao giờ thấy hay giữ token.
 */
export function YoutubeConnectCard() {
  const queryClient = useQueryClient();
  const [waitingSince, setWaitingSince] = useState<number | null>(null);
  const connection = useYoutubeConnection({ waiting: waitingSince !== null });
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const data = connection.data;

  useEffect(() => {
    if (waitingSince === null) {
      return;
    }
    if (
      data?.connected === true &&
      data.connectedAt !== null &&
      Date.parse(data.connectedAt) >= waitingSince - 5000
    ) {
      setWaitingSince(null);
      return;
    }
    const timer = setTimeout(() => setWaitingSince(null), WAIT_MS - (Date.now() - waitingSince));
    return () => clearTimeout(timer);
  }, [data, waitingSince]);

  const start = useMutation({
    mutationFn: () =>
      apiRequest("/api/youtube/oauth/start", { method: "POST", schema: youtubeOauthStartSchema }),
    onSuccess: ({ authUrl }) => {
      setWaitingSince(Date.now());
      window.open(authUrl, "_blank", "noopener,noreferrer");
    },
  });
  const disconnect = useMutation({
    mutationFn: () =>
      apiRequest("/api/youtube/connection", { method: "DELETE", schema: youtubeConnectionSchema }),
    onSuccess: (next) => {
      queryClient.setQueryData(YOUTUBE_CONNECTION_KEY, next);
      setConfirmDisconnect(false);
    },
  });

  return (
    <section
      aria-labelledby="youtube-connect-heading"
      className="bg-card flex flex-col gap-3 rounded-2xl border p-5"
      data-testid="youtube-connect"
    >
      <h2 id="youtube-connect-heading" className="text-lg font-semibold">
        {t.connectHeading}
      </h2>
      <p className="text-muted-foreground text-sm">{t.connectHint}</p>
      {data === undefined ? null : (
        <OauthConfigForm
          configured={data.configured}
          clientIdHint={data.clientIdHint}
          hasClientSecret={data.hasClientSecret}
        />
      )}
      {data === undefined || !data.configured ? null : (
        <>
          {data.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              {data.channelThumbnail === null ? null : (
                <img
                  src={data.channelThumbnail}
                  alt=""
                  className="size-10 rounded-full border"
                  referrerPolicy="no-referrer"
                />
              )}
              <p className="text-sm">
                {t.connectedTo}{" "}
                <span className="font-semibold" data-testid="youtube-channel">
                  {data.channelTitle}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm">{t.notConnected}</p>
          )}
          {data.lastError === null ? null : (
            <p role="alert" className="text-destructive text-sm">
              <span className="font-semibold">{t.needReconnect}:</span> {data.lastError}
            </p>
          )}
          {waitingSince === null ? null : (
            <p role="status" className="text-muted-foreground text-sm">
              {t.connecting} {t.popupHint}
            </p>
          )}
          {start.isError ? (
            <p role="alert" className="text-destructive text-sm">
              {t.connectError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            {data.connected ? (
              <Button variant="outline" onClick={() => setConfirmDisconnect(true)}>
                {t.disconnect}
              </Button>
            ) : null}
            <Button disabled={start.isPending} onClick={() => start.mutate()}>
              {data.connected ? t.reconnect : t.connect}
            </Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmDisconnect}
        title={t.disconnectTitle}
        confirmLabel={t.disconnect}
        cancelLabel={t.keep}
        pending={disconnect.isPending}
        onConfirm={() => disconnect.mutate()}
        onCancel={() => setConfirmDisconnect(false)}
      >
        <p className="text-sm">{t.disconnectBody}</p>
      </ConfirmDialog>
    </section>
  );
}

/**
 * Nhập Client ID và secret (ADR-031 bổ sung 2026-11-16): API ghi vào `.env` và tự tạo khóa mã hóa. Secret không bao
 * giờ hiện lại; bỏ trống khi đổi Client ID thì giữ secret cũ.
 */
function OauthConfigForm({
  configured,
  clientIdHint,
  hasClientSecret,
}: {
  configured: boolean;
  clientIdHint: string | null;
  hasClientSecret: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [touched, setTouched] = useState(false);
  const save = useMutation({
    mutationFn: (body: YoutubeConfigUpdate) =>
      apiRequest("/api/youtube/config", { method: "PUT", body, schema: youtubeConnectionSchema }),
    onSuccess: (next) => {
      queryClient.setQueryData(YOUTUBE_CONNECTION_KEY, next);
      setEditing(false);
      setSecret("");
      setTouched(false);
      toast(t.configSaved);
    },
  });

  const open = !configured || editing;
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">
          {t.configCurrent} <code data-testid="youtube-client-hint">{clientIdHint}</code>
        </span>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          {t.configChange}
        </Button>
      </div>
    );
  }

  const trimmedId = clientId.trim();
  const trimmedSecret = secret.trim();
  const idError = trimmedId !== "" && !YOUTUBE_CLIENT_ID_REGEX.test(trimmedId);
  const secretError =
    trimmedSecret !== "" && !YOUTUBE_CLIENT_SECRET_REGEX.test(trimmedSecret)
      ? t.clientSecretInvalid
      : touched && trimmedSecret === "" && !hasClientSecret
        ? t.clientSecretRequired
        : null;
  const canSave =
    YOUTUBE_CLIENT_ID_REGEX.test(trimmedId) &&
    (trimmedSecret === "" ? hasClientSecret : YOUTUBE_CLIENT_SECRET_REGEX.test(trimmedSecret));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (canSave) {
      save.mutate({ clientId: trimmedId, clientSecret: trimmedSecret });
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      aria-label={t.configHeading}
      className="bg-muted/40 flex flex-col gap-3 rounded-xl border p-4"
      data-testid="youtube-config-form"
    >
      <h3 className="text-base font-semibold">{t.configHeading}</h3>
      <p className="text-muted-foreground text-sm">
        {t.configHint}{" "}
        <a className="font-semibold underline" href="#/publish-guide">
          {t.setupLink}
        </a>
      </p>
      <div className="flex flex-col gap-1">
        <Label htmlFor="yt-client-id">{t.clientId}</Label>
        <Input
          id="yt-client-id"
          value={clientId}
          placeholder={t.clientIdPlaceholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setClientId(e.target.value)}
          aria-invalid={idError}
        />
        {idError ? (
          <p role="alert" className="text-destructive text-xs">
            {t.clientIdInvalid}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="yt-client-secret">{t.clientSecret}</Label>
        <Input
          id="yt-client-secret"
          type="password"
          value={secret}
          placeholder={hasClientSecret ? t.clientSecretKeep : t.clientSecretPlaceholder}
          autoComplete="new-password"
          spellCheck={false}
          onChange={(e) => setSecret(e.target.value)}
          aria-invalid={secretError !== null}
        />
        {secretError === null ? null : (
          <p role="alert" className="text-destructive text-xs">
            {secretError}
          </p>
        )}
      </div>
      {save.isError ? (
        <p role="alert" className="text-destructive text-sm">
          {save.error instanceof Error && save.error.message !== ""
            ? save.error.message
            : t.configError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {configured ? (
          <Button type="button" variant="outline" onClick={() => setEditing(false)}>
            {t.configCancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={!canSave || save.isPending}>
          {save.isPending ? t.configSaving : t.configSave}
        </Button>
      </div>
    </form>
  );
}
