/** P1-07 isolation runner model selection only (not used by production adapter). */

export const ISOLATION_MODEL_DEFAULT = "gemini-3.6-flash";

export function resolveIsolationDiagnosticModel(
  env: NodeJS.ProcessEnv = process.env,
): { model: string; source: "default" | "env" } {
  const override = env.GEMINI_DIAGNOSTIC_MODEL?.trim();
  if (!override) {
    return { model: ISOLATION_MODEL_DEFAULT, source: "default" };
  }
  return { model: override, source: "env" };
}
