import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { OpenClawIcon } from "@/components/BrandIcons";
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
import { useOpenclawSuite } from "@/hooks/useOpenclawSuite";
import { extractErrorMessage } from "@/utils/errorUtils";

export function ICodeEasyOpenclawPage() {
  const { t } = useTranslation();
  const {
    status: suiteStatus,
    refresh: refreshSuite,
    runCliAction,
    cliLatestVersion,
  } = useOpenclawSuite();

  const [provider, setProvider] = useState<UniversalProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installingCli, setInstallingCli] = useState(false);

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
        console.error(
          "[ICodeEasyOpenclaw] Failed to load configuration",
          error,
        );
        toast.error(
          t("icodeeasyOpenclaw.loadError", {
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
      await settingsApi.configureOpenclawRelay(provider.apiKey.trim());
      await refreshSuite();
      toast.success(t("icodeeasyOpenclaw.relay.configureSuccess"));
    } catch (error) {
      console.error("[ICodeEasyOpenclaw] Failed to configure relay", error);
      toast.error(
        t("icodeeasyOpenclaw.relay.configureError", {
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
        toast.error(t("icodeeasyOpenclaw.suite.cliVerificationFailed"));
      } else {
        toast.success(t("icodeeasyOpenclaw.cli.installSuccess"));
      }
    } catch (error) {
      console.error("[ICodeEasyOpenclaw] Failed to manage OpenClaw CLI", error);
      toast.error(
        t("icodeeasyOpenclaw.cli.installFailed", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setInstallingCli(false);
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
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-sky-500" />
            {t("icodeeasyOpenclaw.relay.title")}
          </CardTitle>
          <CardDescription>
            {t("icodeeasyOpenclaw.relay.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {configured ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium text-emerald-600">
                  {t("icodeeasyOpenclaw.relay.configured")}
                </span>
              </>
            ) : (
              <>
                <CircleAlert className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-amber-600">
                  {t("icodeeasyOpenclaw.relay.notConfigured")}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {!hasApiKey && (
              <p className="text-xs leading-5 text-muted-foreground">
                {t("icodeeasyOpenclaw.relay.noKeyHint")}
              </p>
            )}
            <Button
              size="sm"
              className="ml-auto bg-sky-600 text-white hover:bg-sky-700"
              disabled={!hasApiKey || saving}
              onClick={() => void handleConfigure()}
            >
              {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {t(
                configured
                  ? "icodeeasyOpenclaw.relay.reconfigure"
                  : "icodeeasyOpenclaw.relay.configure",
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ICodeEasyClientSuiteCard
        icon={<OpenClawIcon size={24} />}
        i18nPrefix="icodeeasyOpenclaw"
        status={suiteStatus}
        monitoringInstall={false}
        cliLatestVersion={cliLatestVersion}
        installingCli={installingCli}
        onCliAction={(action) => void handleCliAction(action)}
      />
    </div>
  );
}
