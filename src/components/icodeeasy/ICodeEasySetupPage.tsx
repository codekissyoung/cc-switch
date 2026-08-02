import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Monitor,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { ClaudeIcon, CodexIcon, GeminiIcon } from "@/components/BrandIcons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { providersApi, settingsApi, universalProvidersApi } from "@/lib/api";
import type { AppId } from "@/lib/api";
import type { UniversalProvider } from "@/types";
import {
  createICodeEasyUniversalProvider,
  ICODEEASY_KEYS_URL,
  ICODEEASY_UNIVERSAL_PROVIDER_ID,
} from "@/config/universalProviderPresets";
import { extractErrorMessage } from "@/utils/errorUtils";
import { cn } from "@/lib/utils";
import type { CodexSuiteStatus } from "@/lib/api/settings";

type SetupAppId = Extract<AppId, "claude" | "codex" | "gemini">;

interface SetupApp {
  id: SetupAppId;
  providerId: string;
  labelKey: string;
  descriptionKey: string;
}

const SETUP_APPS: SetupApp[] = [
  {
    id: "claude",
    providerId: `universal-claude-${ICODEEASY_UNIVERSAL_PROVIDER_ID}`,
    labelKey: "icodeeasySetup.apps.claude.name",
    descriptionKey: "icodeeasySetup.apps.claude.description",
  },
  {
    id: "codex",
    providerId: `universal-codex-${ICODEEASY_UNIVERSAL_PROVIDER_ID}`,
    labelKey: "icodeeasySetup.apps.codex.name",
    descriptionKey: "icodeeasySetup.apps.codex.description",
  },
  {
    id: "gemini",
    providerId: `universal-gemini-${ICODEEASY_UNIVERSAL_PROVIDER_ID}`,
    labelKey: "icodeeasySetup.apps.gemini.name",
    descriptionKey: "icodeeasySetup.apps.gemini.description",
  },
];

function SetupAppIcon({ appId }: { appId: SetupAppId }) {
  if (appId === "claude") return <ClaudeIcon size={28} />;
  if (appId === "codex") return <CodexIcon size={28} />;
  return <GeminiIcon size={28} />;
}

export function ICodeEasySetupPage() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<UniversalProvider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [selectedApps, setSelectedApps] = useState<Set<SetupAppId>>(
    () => new Set(["codex"]),
  );
  const [configuredApps, setConfiguredApps] = useState<Set<SetupAppId>>(
    () => new Set(),
  );
  const [failedApps, setFailedApps] = useState<Set<SetupAppId>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [codexSuiteStatus, setCodexSuiteStatus] =
    useState<CodexSuiteStatus | null>(null);
  const [codexSuiteError, setCodexSuiteError] = useState<string | null>(null);
  const [monitorCodexInstall, setMonitorCodexInstall] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        let currentProvider = await universalProvidersApi.get(
          ICODEEASY_UNIVERSAL_PROVIDER_ID,
        );
        if (!currentProvider) {
          currentProvider = createICodeEasyUniversalProvider("");
          await universalProvidersApi.upsert(currentProvider);
        }

        const [currentProviderIds, suiteStatus] = await Promise.all([
          Promise.all(
            SETUP_APPS.map(async (app) => ({
              app,
              currentId: await providersApi.getCurrent(app.id),
            })),
          ),
          settingsApi.getCodexSuiteStatus().catch((error) => {
            console.warn("[ICodeEasySetup] Failed to probe Codex suite", error);
            return null;
          }),
        ]);

        if (!active) return;
        setProvider(currentProvider);
        setApiKey(currentProvider.apiKey);
        setCodexSuiteStatus(suiteStatus);
        setConfiguredApps(
          new Set(
            currentProviderIds
              .filter(({ app, currentId }) => currentId === app.providerId)
              .map(({ app }) => app.id),
          ),
        );
      } catch (error) {
        console.error("[ICodeEasySetup] Failed to load configuration", error);
        toast.error(
          t("icodeeasySetup.loadError", {
            error: extractErrorMessage(error),
          }),
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!monitorCodexInstall) return;

    let active = true;
    let attempts = 0;
    const refresh = async () => {
      attempts += 1;
      try {
        const status = await settingsApi.getCodexSuiteStatus();
        if (!active) return;
        setCodexSuiteStatus(status);
        if (status.desktopInstalled || attempts >= 100) {
          setMonitorCodexInstall(false);
        }
      } catch (error) {
        console.warn(
          "[ICodeEasySetup] Failed to refresh Codex suite status",
          error,
        );
        if (attempts >= 100 && active) setMonitorCodexInstall(false);
      }
    };

    const interval = window.setInterval(() => void refresh(), 3000);
    void refresh();
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [monitorCodexInstall]);

  const toggleApp = (appId: SetupAppId, checked: boolean) => {
    setSelectedApps((previous) => {
      const next = new Set(previous);
      if (checked) next.add(appId);
      else next.delete(appId);
      return next;
    });
  };

  const handleConfigure = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey || selectedApps.size === 0 || saving) return;

    setSaving(true);
    setFailedApps(new Set());
    setCodexSuiteError(null);
    try {
      const normalizedProvider = createICodeEasyUniversalProvider(
        trimmedKey,
        provider,
      );
      await universalProvidersApi.upsert(normalizedProvider);
      await universalProvidersApi.sync(ICODEEASY_UNIVERSAL_PROVIDER_ID);

      const nextConfigured = new Set(configuredApps);
      const nextFailed = new Set<SetupAppId>();
      for (const app of SETUP_APPS) {
        if (!selectedApps.has(app.id)) continue;
        try {
          await providersApi.switch(app.providerId, app.id);
          nextConfigured.add(app.id);
        } catch (error) {
          console.error(
            `[ICodeEasySetup] Failed to configure ${app.id}`,
            error,
          );
          nextFailed.add(app.id);
        }
      }

      setProvider(normalizedProvider);
      setApiKey(trimmedKey);
      setConfiguredApps(nextConfigured);
      setFailedApps(nextFailed);

      let suiteError: string | null = null;
      if (
        selectedApps.has("codex") &&
        !nextFailed.has("codex") &&
        codexSuiteStatus?.supported !== false
      ) {
        try {
          let status =
            codexSuiteStatus ?? (await settingsApi.getCodexSuiteStatus());
          if (!status.cliInstalled) {
            if (!status.npmAvailable) {
              suiteError = t("icodeeasySetup.codexSuite.nodeRequired");
            } else {
              await settingsApi.installNativeCodexCli();
              status = await settingsApi.getCodexSuiteStatus();
              setCodexSuiteStatus(status);
              if (!status.cliInstalled) {
                throw new Error(
                  t("icodeeasySetup.codexSuite.cliVerificationFailed"),
                );
              }
            }
          }

          const launch = await settingsApi.launchOrInstallCodexDesktop();
          if (!launch.desktopWasInstalled) setMonitorCodexInstall(true);
        } catch (error) {
          suiteError = extractErrorMessage(error);
          console.error(
            "[ICodeEasySetup] Failed to prepare ChatGPT Codex suite",
            error,
          );
        }
      }
      setCodexSuiteError(suiteError);

      if (nextFailed.size === 0 && !suiteError) {
        toast.success(t("icodeeasySetup.configureSuccess"));
      } else if (nextFailed.size === 0 && suiteError) {
        toast.warning(
          t("icodeeasySetup.codexSuite.partial", { error: suiteError }),
        );
      } else {
        toast.warning(
          t("icodeeasySetup.configurePartial", {
            count: nextFailed.size,
          }),
        );
      }
    } catch (error) {
      console.error("[ICodeEasySetup] Failed to save configuration", error);
      toast.error(
        t("icodeeasySetup.configureError", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  const openKeysPage = async () => {
    try {
      await settingsApi.openExternal(ICODEEASY_KEYS_URL);
    } catch (error) {
      toast.error(
        t("icodeeasySetup.openKeysError", {
          error: extractErrorMessage(error),
        }),
      );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoaderCircle className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-blue-500" />
            {t("icodeeasySetup.apiKeyTitle")}
          </CardTitle>
          <CardDescription>
            {t("icodeeasySetup.apiKeyDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={t("icodeeasySetup.apiKeyPlaceholder")}
                aria-label={t("icodeeasySetup.apiKeyLabel")}
                autoComplete="off"
                className="h-11 pr-11 font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-9 w-9 text-muted-foreground"
                onClick={() => setShowApiKey((visible) => !visible)}
                aria-label={t(
                  showApiKey
                    ? "icodeeasySetup.hideApiKey"
                    : "icodeeasySetup.showApiKey",
                )}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0"
              onClick={() => void openKeysPage()}
            >
              {t("icodeeasySetup.getApiKey")}
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            {t("icodeeasySetup.localStorageHint")}
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-500/20 bg-blue-500/[0.025] shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CodexIcon size={24} />
            {t("icodeeasySetup.codexSuite.title")}
          </CardTitle>
          <CardDescription>
            {t("icodeeasySetup.codexSuite.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3">
              <Monitor className="h-5 w-5 text-blue-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">ChatGPT Codex</p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    codexSuiteStatus?.desktopInstalled
                      ? "icodeeasySetup.codexSuite.installed"
                      : monitorCodexInstall
                        ? "icodeeasySetup.codexSuite.waitingForInstall"
                        : "icodeeasySetup.codexSuite.willInstall",
                  )}
                </p>
              </div>
              {codexSuiteStatus?.desktopInstalled && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3">
              <Terminal className="h-5 w-5 text-blue-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Codex CLI</p>
                <p className="truncate text-xs text-muted-foreground">
                  {codexSuiteStatus?.cliInstalled
                    ? t("icodeeasySetup.codexSuite.version", {
                        version: codexSuiteStatus.cliVersion,
                      })
                    : codexSuiteStatus?.cliBroken
                      ? t("icodeeasySetup.codexSuite.needsRepair")
                      : codexSuiteStatus && !codexSuiteStatus.npmAvailable
                        ? t("icodeeasySetup.codexSuite.nodeMissing")
                        : t("icodeeasySetup.codexSuite.willInstall")}
                </p>
              </div>
              {codexSuiteStatus?.cliInstalled && (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
            </div>
          </div>
          {codexSuiteError && (
            <div className="flex items-start gap-2 text-xs leading-5 text-amber-600">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{codexSuiteError}</span>
            </div>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            {t("icodeeasySetup.codexSuite.officialInstallerHint")}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">
            {t("icodeeasySetup.selectAppsTitle")}
          </CardTitle>
          <CardDescription>
            {t("icodeeasySetup.selectAppsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {SETUP_APPS.map((app) => {
            const checked = selectedApps.has(app.id);
            const configured = configuredApps.has(app.id);
            const failed = failedApps.has(app.id);
            return (
              <label
                key={app.id}
                className={cn(
                  "relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                  checked
                    ? "border-blue-500/50 bg-blue-500/5"
                    : "border-border hover:border-blue-500/30",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => toggleApp(app.id, value === true)}
                  aria-label={t(app.labelKey)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <SetupAppIcon appId={app.id} />
                    <span className="font-medium">{t(app.labelKey)}</span>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t(app.descriptionKey)}
                  </p>
                  {(configured || failed) && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium",
                        failed ? "text-amber-600" : "text-emerald-600",
                      )}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t(
                        failed
                          ? "icodeeasySetup.configureFailed"
                          : "icodeeasySetup.configured",
                      )}
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
          {t("icodeeasySetup.compatibilityHint")}
        </p>
        <Button
          size="lg"
          className="min-w-40 bg-blue-600 text-white hover:bg-blue-700"
          disabled={!apiKey.trim() || selectedApps.size === 0 || saving}
          onClick={() => void handleConfigure()}
        >
          {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
          {t(
            selectedApps.has("codex")
              ? "icodeeasySetup.installConfigureButton"
              : "icodeeasySetup.configureButton",
            { count: selectedApps.size },
          )}
        </Button>
      </div>
    </div>
  );
}
