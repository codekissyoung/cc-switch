import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { GeminiIcon } from "@/components/BrandIcons";
import { ICodeEasyClientSuiteCard } from "@/components/icodeeasy/ICodeEasyClientSuiteCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { providersApi, settingsApi, universalProvidersApi } from "@/lib/api";
import type { UniversalProvider } from "@/types";
import {
  createICodeEasyUniversalProvider,
  ICODEEASY_UNIVERSAL_PROVIDER_ID,
} from "@/config/universalProviderPresets";
import { useGeminiSuite } from "@/hooks/useGeminiSuite";
import { extractErrorMessage } from "@/utils/errorUtils";

const GEMINI_PROVIDER_ID = `universal-gemini-${ICODEEASY_UNIVERSAL_PROVIDER_ID}`;

interface AgyState {
  version: string | null;
  broken: boolean;
}

export function ICodeEasyGooglePage() {
  const { t } = useTranslation();
  const {
    status: suiteStatus,
    monitoring: monitoringInstall,
    runCliAction,
    launchDesktop,
    cliLatestVersion,
  } = useGeminiSuite();

  const [provider, setProvider] = useState<UniversalProvider | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installingCli, setInstallingCli] = useState(false);
  const [launchingDesktop, setLaunchingDesktop] = useState(false);
  const [agy, setAgy] = useState<AgyState | null>(null);
  const [installingAgy, setInstallingAgy] = useState(false);

  const refreshAgy = useCallback(async (): Promise<AgyState | null> => {
    try {
      const versions = await settingsApi.getToolVersions(["agy"]);
      const tool = versions.find((item) => item.name === "agy");
      const next: AgyState = {
        version: tool?.version ?? null,
        broken: Boolean(tool?.installed_but_broken),
      };
      setAgy(next);
      return next;
    } catch (error) {
      console.warn("[ICodeEasyGoogle] Failed to probe agy CLI", error);
      return null;
    }
  }, []);

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
        const currentId = await providersApi.getCurrent("gemini");

        if (!active) return;
        setProvider(currentProvider);
        setConfigured(currentId === GEMINI_PROVIDER_ID);
      } catch (error) {
        console.error("[ICodeEasyGoogle] Failed to load configuration", error);
        toast.error(
          t("icodeeasyGoogle.loadError", {
            error: extractErrorMessage(error),
          }),
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    void refreshAgy();
    return () => {
      active = false;
    };
  }, [t, refreshAgy]);

  const hasApiKey = Boolean(provider?.apiKey.trim());

  const handleConfigure = async () => {
    if (!provider || !hasApiKey || saving) return;

    setSaving(true);
    try {
      const normalizedProvider = createICodeEasyUniversalProvider(
        provider.apiKey,
        provider,
      );
      await universalProvidersApi.upsert(normalizedProvider);
      await universalProvidersApi.sync(ICODEEASY_UNIVERSAL_PROVIDER_ID);
      await providersApi.switch(GEMINI_PROVIDER_ID, "gemini");

      setProvider(normalizedProvider);
      setConfigured(true);
      toast.success(t("icodeeasyGoogle.relay.configureSuccess"));
    } catch (error) {
      console.error("[ICodeEasyGoogle] Failed to configure relay", error);
      toast.error(
        t("icodeeasyGoogle.relay.configureError", {
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
        toast.error(t("icodeeasyGoogle.suite.cliVerificationFailed"));
      } else {
        toast.success(t("icodeeasyGoogle.cli.installSuccess"));
      }
    } catch (error) {
      console.error("[ICodeEasyGoogle] Failed to manage Gemini CLI", error);
      toast.error(
        t("icodeeasyGoogle.cli.installFailed", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setInstallingCli(false);
    }
  };

  const handleInstallAgy = async () => {
    if (installingAgy) return;

    setInstallingAgy(true);
    try {
      await settingsApi.runToolLifecycleAction(["agy"], "install");
      const next = await refreshAgy();
      if (!next?.version) {
        toast.error(t("icodeeasyGoogle.suite.cliVerificationFailed"));
      } else {
        toast.success(t("icodeeasyGoogle.agy.installSuccess"));
      }
    } catch (error) {
      console.error("[ICodeEasyGoogle] Failed to install agy CLI", error);
      toast.error(
        t("icodeeasyGoogle.agy.installFailed", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setInstallingAgy(false);
    }
  };

  const handleLaunchDesktop = async () => {
    if (launchingDesktop) return;

    setLaunchingDesktop(true);
    try {
      await launchDesktop();
    } catch (error) {
      console.error("[ICodeEasyGoogle] Failed to launch Antigravity", error);
      toast.error(
        t("icodeeasyGoogle.desktop.launchFailed", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setLaunchingDesktop(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoaderCircle className="h-7 w-7 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-violet-500" />
            {t("icodeeasyGoogle.relay.title")}
          </CardTitle>
          <CardDescription>
            {t("icodeeasyGoogle.relay.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {configured ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium text-emerald-600">
                  {t("icodeeasyGoogle.relay.configured")}
                </span>
              </>
            ) : (
              <>
                <CircleAlert className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-amber-600">
                  {t("icodeeasyGoogle.relay.notConfigured")}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {!hasApiKey && (
              <p className="text-xs leading-5 text-muted-foreground">
                {t("icodeeasyGoogle.relay.noKeyHint")}
              </p>
            )}
            <Button
              size="sm"
              className="ml-auto bg-violet-600 text-white hover:bg-violet-700"
              disabled={!hasApiKey || saving}
              onClick={() => void handleConfigure()}
            >
              {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {t(
                configured
                  ? "icodeeasyGoogle.relay.reconfigure"
                  : "icodeeasyGoogle.relay.configure",
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ICodeEasyClientSuiteCard
        icon={<GeminiIcon size={24} />}
        i18nPrefix="icodeeasyGoogle"
        status={suiteStatus}
        monitoringInstall={monitoringInstall}
        cliLatestVersion={cliLatestVersion}
        cliInstallBlocked={Boolean(suiteStatus && !suiteStatus.npmAvailable)}
        installingCli={installingCli}
        launchingDesktop={launchingDesktop}
        onCliAction={(action) => void handleCliAction(action)}
        onLaunchDesktop={() => void handleLaunchDesktop()}
        extraCli={{
          name: t("icodeeasyGoogle.agy.name"),
          version: agy?.version ?? null,
          broken: Boolean(agy?.broken),
          installing: installingAgy,
          blocked: false,
          onInstall: () => void handleInstallAgy(),
        }}
      />
    </div>
  );
}
