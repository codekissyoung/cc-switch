import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  LoaderCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ClaudeIcon } from "@/components/BrandIcons";
import { ICodeEasyClientSuiteCard } from "@/components/icodeeasy/ICodeEasyClientSuiteCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { providersApi, universalProvidersApi } from "@/lib/api";
import type { AppId } from "@/lib/api";
import type { UniversalProvider } from "@/types";
import {
  createICodeEasyUniversalProvider,
  ICODEEASY_UNIVERSAL_PROVIDER_ID,
} from "@/config/universalProviderPresets";
import { useClaudeSuite } from "@/hooks/useClaudeSuite";
import { extractErrorMessage } from "@/utils/errorUtils";

const CLAUDE_PROVIDER_ID = `universal-claude-${ICODEEASY_UNIVERSAL_PROVIDER_ID}`;

interface PreviousProvider {
  appId: Extract<AppId, "claude" | "claude-desktop">;
  id: string;
  switched: boolean;
}

export function ICodeEasyClaudePage() {
  const { t } = useTranslation();
  const {
    status: suiteStatus,
    monitoring: monitoringInstall,
    runCliAction,
    launchDesktop,
    cliLatestVersion,
  } = useClaudeSuite();

  const [provider, setProvider] = useState<UniversalProvider | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installingCli, setInstallingCli] = useState(false);
  const [launchingDesktop, setLaunchingDesktop] = useState(false);

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
        const [claudeId, desktopId] = await Promise.all([
          providersApi.getCurrent("claude"),
          providersApi.getCurrent("claude-desktop"),
        ]);

        if (!active) return;
        setProvider(currentProvider);
        setConfigured(
          claudeId === CLAUDE_PROVIDER_ID && desktopId === CLAUDE_PROVIDER_ID,
        );
      } catch (error) {
        console.error("[ICodeEasyClaude] Failed to load configuration", error);
        toast.error(
          t("icodeeasyClaude.loadError", {
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

  const rollbackProviders = async (previous: PreviousProvider[]) => {
    await Promise.allSettled(
      previous
        .filter((item) => item.switched && item.id !== CLAUDE_PROVIDER_ID)
        .map((item) => providersApi.switch(item.id, item.appId)),
    );
  };

  const handleConfigure = async () => {
    if (!provider || !hasApiKey || saving) return;

    setSaving(true);
    const previous: PreviousProvider[] = [];
    try {
      const normalizedProvider = createICodeEasyUniversalProvider(
        provider.apiKey,
        provider,
      );
      await universalProvidersApi.upsert(normalizedProvider);
      await universalProvidersApi.sync(ICODEEASY_UNIVERSAL_PROVIDER_ID);
      await providersApi.syncClaudeProviderToDesktop(CLAUDE_PROVIDER_ID);

      previous.push(
        {
          appId: "claude-desktop",
          id: await providersApi.getCurrent("claude-desktop"),
          switched: false,
        },
        {
          appId: "claude",
          id: await providersApi.getCurrent("claude"),
          switched: false,
        },
      );

      previous[0].switched = true;
      await providersApi.switch(CLAUDE_PROVIDER_ID, "claude-desktop");
      previous[1].switched = true;
      await providersApi.switch(CLAUDE_PROVIDER_ID, "claude");

      setProvider(normalizedProvider);
      setConfigured(true);
      toast.success(t("icodeeasyClaude.relay.configureSuccess"));
    } catch (error) {
      await rollbackProviders(previous);
      console.error("[ICodeEasyClaude] Failed to configure relay", error);
      toast.error(
        t("icodeeasyClaude.relay.configureError", {
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
        toast.error(t("icodeeasyClaude.suite.cliVerificationFailed"));
      } else {
        toast.success(t("icodeeasyClaude.cli.installSuccess"));
      }
    } catch (error) {
      console.error("[ICodeEasyClaude] Failed to manage Claude Code", error);
      toast.error(
        t("icodeeasyClaude.cli.installFailed", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setInstallingCli(false);
    }
  };

  const handleLaunchDesktop = async () => {
    if (launchingDesktop) return;

    setLaunchingDesktop(true);
    try {
      await launchDesktop();
    } catch (error) {
      console.error("[ICodeEasyClaude] Failed to launch Claude Desktop", error);
      toast.error(
        t("icodeeasyClaude.desktop.launchFailed", {
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
        <LoaderCircle className="h-7 w-7 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-orange-500" />
            {t("icodeeasyClaude.relay.title")}
          </CardTitle>
          <CardDescription>
            {t("icodeeasyClaude.relay.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {configured ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium text-emerald-600">
                  {t("icodeeasyClaude.relay.configured")}
                </span>
              </>
            ) : (
              <>
                <CircleAlert className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-amber-600">
                  {t("icodeeasyClaude.relay.notConfigured")}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {!hasApiKey && (
              <p className="text-xs leading-5 text-muted-foreground">
                {t("icodeeasyClaude.relay.noKeyHint")}
              </p>
            )}
            <Button
              size="sm"
              className="ml-auto bg-orange-600 text-white hover:bg-orange-700"
              disabled={!hasApiKey || saving}
              onClick={() => void handleConfigure()}
            >
              {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {t(
                configured
                  ? "icodeeasyClaude.relay.reconfigure"
                  : "icodeeasyClaude.relay.configure",
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ICodeEasyClientSuiteCard
        icon={<ClaudeIcon size={24} />}
        i18nPrefix="icodeeasyClaude"
        status={suiteStatus}
        monitoringInstall={monitoringInstall}
        cliLatestVersion={cliLatestVersion}
        installingCli={installingCli}
        launchingDesktop={launchingDesktop}
        onCliAction={(action) => void handleCliAction(action)}
        onLaunchDesktop={() => void handleLaunchDesktop()}
      />
    </div>
  );
}
