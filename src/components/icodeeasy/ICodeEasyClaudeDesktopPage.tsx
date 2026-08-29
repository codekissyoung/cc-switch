import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { ClaudeIcon } from "@/components/BrandIcons";
import { ICodeEasyClientSuiteCard } from "@/components/icodeeasy/ICodeEasyClientSuiteCard";
import { providersApi, universalProvidersApi } from "@/lib/api";
import type { AppId } from "@/lib/api";
import type { UniversalProvider } from "@/types";
import {
  createICodeEasyUniversalProvider,
  ICODEEASY_UNIVERSAL_PROVIDER_ID,
} from "@/config/universalProviderPresets";
import { useClaudeDesktopSuite } from "@/hooks/useClaudeDesktopSuite";
import { extractErrorMessage } from "@/utils/errorUtils";

const CLAUDE_PROVIDER_ID = `universal-claude-${ICODEEASY_UNIVERSAL_PROVIDER_ID}`;

interface PreviousProvider {
  appId: Extract<AppId, "claude-desktop">;
  id: string;
  switched: boolean;
}

export function ICodeEasyClaudeDesktopPage() {
  const { t } = useTranslation();
  const {
    status: suiteStatus,
    monitoring: monitoringInstall,
    launchDesktop,
  } = useClaudeDesktopSuite();

  const [provider, setProvider] = useState<UniversalProvider | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        const desktopId = await providersApi.getCurrent("claude-desktop");

        if (!active) return;
        setProvider(currentProvider);
        setConfigured(desktopId === CLAUDE_PROVIDER_ID);
      } catch (error) {
        console.error(
          "[ICodeEasyClaudeDesktop] Failed to load configuration",
          error,
        );
        toast.error(
          t("icodeeasyClaudeDesktop.loadError", {
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

      previous.push({
        appId: "claude-desktop",
        id: await providersApi.getCurrent("claude-desktop"),
        switched: false,
      });

      previous[0].switched = true;
      await providersApi.switch(CLAUDE_PROVIDER_ID, "claude-desktop");

      setProvider(normalizedProvider);
      setConfigured(true);
      toast.success(t("icodeeasyClaudeDesktop.relay.configureSuccess"));
    } catch (error) {
      await rollbackProviders(previous);
      console.error(
        "[ICodeEasyClaudeDesktop] Failed to configure relay",
        error,
      );
      toast.error(
        t("icodeeasyClaudeDesktop.relay.configureError", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLaunchDesktop = async () => {
    if (launchingDesktop) return;

    setLaunchingDesktop(true);
    try {
      await launchDesktop();
    } catch (error) {
      console.error(
        "[ICodeEasyClaudeDesktop] Failed to launch Claude Desktop",
        error,
      );
      toast.error(
        t("icodeeasyClaudeDesktop.desktop.launchFailed", {
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
      <ICodeEasyClientSuiteCard
        icon={<ClaudeIcon size={24} />}
        i18nPrefix="icodeeasyClaudeDesktop"
        status={suiteStatus}
        monitoringInstall={monitoringInstall}
        cliLatestVersion={null}
        relay={{
          configured,
          saving,
          hasApiKey,
          onConfigure: () => void handleConfigure(),
          hint: t("icodeeasyClaudeDesktop.relay.hint"),
        }}
        installingCli={false}
        launchingDesktop={launchingDesktop}
        onLaunchDesktop={() => void handleLaunchDesktop()}
      />
    </div>
  );
}
