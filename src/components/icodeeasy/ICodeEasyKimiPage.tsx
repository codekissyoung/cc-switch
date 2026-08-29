import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  TerminalSquare,
} from "lucide-react";
import { toast } from "sonner";
import { KimiIcon } from "@/components/BrandIcons";
import { ICodeEasyClientSuiteCard } from "@/components/icodeeasy/ICodeEasyClientSuiteCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { settingsApi, universalProvidersApi } from "@/lib/api";
import type { UniversalProvider } from "@/types";
import {
  createICodeEasyUniversalProvider,
  ICODEEASY_UNIVERSAL_PROVIDER_ID,
} from "@/config/universalProviderPresets";
import { useKimiSuite } from "@/hooks/useKimiSuite";
import { extractErrorMessage } from "@/utils/errorUtils";

export function ICodeEasyKimiPage() {
  const { t } = useTranslation();
  const {
    status: suiteStatus,
    refresh: refreshSuite,
    runCliAction,
    cliLatestVersion,
  } = useKimiSuite();

  const [provider, setProvider] = useState<UniversalProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installingCli, setInstallingCli] = useState(false);
  const [installingGitBash, setInstallingGitBash] = useState(false);

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

        if (!active) return;
        setProvider(currentProvider);
      } catch (error) {
        console.error("[ICodeEasyKimi] Failed to load configuration", error);
        toast.error(
          t("icodeeasyKimi.loadError", {
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

  const hasApiKey = Boolean(provider?.apiKey.trim());
  const configured = Boolean(suiteStatus?.relayConfigured);

  const handleConfigure = async () => {
    if (!provider || !hasApiKey || saving) return;

    setSaving(true);
    try {
      await settingsApi.configureKimiRelay(provider.apiKey.trim());
      await refreshSuite();
      toast.success(t("icodeeasyKimi.relay.configureSuccess"));
    } catch (error) {
      console.error("[ICodeEasyKimi] Failed to configure relay", error);
      toast.error(
        t("icodeeasyKimi.relay.configureError", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCliAction = async (action: "install" | "update") => {
    if (installingCli) return;

    setInstallingCli(true);
    try {
      const next = await runCliAction(action);
      if (!next.cliInstalled) {
        toast.error(t("icodeeasyKimi.suite.cliVerificationFailed"));
      } else {
        toast.success(t("icodeeasyKimi.cli.installSuccess"));
      }
    } catch (error) {
      console.error("[ICodeEasyKimi] Failed to manage Kimi Code CLI", error);
      toast.error(
        t("icodeeasyKimi.cli.installFailed", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setInstallingCli(false);
    }
  };

  const handleInstallGitBash = async () => {
    if (installingGitBash) return;

    setInstallingGitBash(true);
    try {
      await settingsApi.installGitBash();
      await refreshSuite();
      toast.success(t("icodeeasyKimi.gitbash.installSuccess"));
    } catch (error) {
      console.error("[ICodeEasyKimi] Failed to install Git Bash", error);
      toast.error(
        t("icodeeasyKimi.gitbash.installFailed", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setInstallingGitBash(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoaderCircle className="h-7 w-7 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <ICodeEasyClientSuiteCard
        icon={<KimiIcon size={24} />}
        i18nPrefix="icodeeasyKimi"
        status={suiteStatus}
        monitoringInstall={false}
        cliLatestVersion={cliLatestVersion}
        relay={{
          configured,
          saving,
          hasApiKey,
          onConfigure: () => void handleConfigure(),
        }}
        installingCli={installingCli}
        onCliAction={(action) => void handleCliAction(action)}
      />

      {suiteStatus?.platform === "windows" && suiteStatus.gitBash.supported && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TerminalSquare className="h-5 w-5 text-sky-500" />
              {t("icodeeasyKimi.gitbash.title")}
            </CardTitle>
            <CardDescription>
              {t("icodeeasyKimi.gitbash.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              {suiteStatus.gitBash.installed ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="font-medium text-emerald-600">
                    {t("icodeeasyKimi.gitbash.installed")}
                  </span>
                </>
              ) : (
                <>
                  <CircleAlert className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-amber-600">
                    {t("icodeeasyKimi.gitbash.notInstalled")}
                  </span>
                </>
              )}
            </div>
            {suiteStatus.gitBash.installed && suiteStatus.gitBash.path && (
              <p className="break-all font-mono text-xs text-muted-foreground">
                {suiteStatus.gitBash.path}
              </p>
            )}
            {!suiteStatus.gitBash.installed && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("icodeeasyKimi.gitbash.restartHint")}
                </p>
                <Button
                  size="sm"
                  className="ml-auto bg-sky-600 text-white hover:bg-sky-700"
                  disabled={installingGitBash}
                  onClick={() => void handleInstallGitBash()}
                >
                  {installingGitBash && (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t(
                    installingGitBash
                      ? "icodeeasyKimi.gitbash.installing"
                      : "icodeeasyKimi.gitbash.install",
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
