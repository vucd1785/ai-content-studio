import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vi } from "@/i18n/vi";
import { ApiError } from "@/lib/api";
import { useLogin } from "./use-session";

/** Thông báo lỗi tiếng Việt theo mã lỗi API; không hiện message gốc từ server. */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "unauthorized") return vi.login.errorWrongPassword;
    if (error.code === "validation_error") return vi.login.errorMissingPassword;
    if (error.code === "network_error") return vi.login.errorNetwork;
  }
  return vi.login.errorGeneric;
}

export function LoginPage() {
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const login = useLogin();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password === "") {
      setLocalError(vi.login.errorMissingPassword);
      return;
    }
    setLocalError(null);
    login.mutate(password, { onSuccess: () => setPassword("") });
  };

  const errorText = localError ?? (login.isError ? loginErrorMessage(login.error) : null);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>{vi.login.title}</h1>
          </CardTitle>
          <CardDescription>{vi.login.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor="studio-password">{vi.login.passwordLabel}</Label>
              <Input
                id="studio-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={errorText !== null}
                aria-describedby={errorText !== null ? "studio-login-error" : undefined}
              />
            </div>
            {errorText !== null ? (
              <p id="studio-login-error" role="alert" className="text-destructive text-sm">
                {errorText}
              </p>
            ) : null}
            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? vi.login.submitting : vi.login.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
