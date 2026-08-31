import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { ClaudeIcon } from "@/components/BrandIcons";
import { ICodeEasyClientSuiteCard } from "@/components/icodeeasy/ICodeEasyClientSuiteCard";
import { providersApi, settingsApi, universalProvidersApi } from "@/lib/api";
import type { UniversalProvider } from "@/types";
import {
  createICodeEasyUniversalProvider,
  ICODEEASY_UNIVERSAL_PROVIDER_ID,
} from "@/config/universalProviderPresets";
import { useClaudeSuite } from "@/hooks/useClaudeSuite";
import { extractErrorMessage } from "@/utils/errorUtils";

const CLAUDE_PROVIDER_ID = `universal-claude-${ICODEEASY_UNIVERSAL_PROVIDER_ID}`;

export function ICodeEasyClaudePage() {
  const { t } = useTranslation();
  const {
    status: suiteStatus,
    runCliAction,
    cliLatestVersion,
  } = useClaudeSuite();

  const [provider, setProvider] = useState<UniversalProvider | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installingCli, setInstallingCli] = useState(false);
  const [openingTerminal, setOpeningTerminal] = useState(false);

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
        const claudeId = await providersApi.getCurrent("claude");

        if (!active) return;
        setProvider(currentProvider);
        setConfigured(claudeId === CLAUDE_PROVIDER_ID);
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

  const handleConfigure = async () => {
    if (!provider || !hasApiKey || saving) return;

    setSaving(true);
    let previousClaudeId: string | null = null;
    let switchAttempted = false;
    try {
      const normalizedProvider = createICodeEasyUniversalProvider(
        provider.apiKey,
        provider,
      );
      await universalProvidersApi.upsert(normalizedProvider);
      await universalProvidersApi.sync(ICODEEASY_UNIVERSAL_PROVIDER_ID);

      previousClaudeId = await providersApi.getCurrent("claude");
      switchAttempted = true;
      await providersApi.switch(CLAUDE_PROVIDER_ID, "claude");

      setProvider(normalizedProvider);
      setConfigured(true);
      toast.success(t("icodeeasyClaude.relay.configureSuccess"));
    } catch (error) {
      // switch 可能在写入部分配置后才失败，尽量切回原供应商。
      if (
        switchAttempted &&
        previousClaudeId &&
        previousClaudeId !== CLAUDE_PROVIDER_ID
      ) {
        await providersApi
          .switch(previousClaudeId, "claude")
          .catch(() => undefined);
      }
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

  // 打开系统首选终端（落在用户家目录）；中转配置已写入 CLI 配置，无需注入环境变量
  const handleOpenTerminal = async () => {
    if (openingTerminal) return;

    setOpeningTerminal(true);
    try {
      await settingsApi.openHomeTerminal();
      toast.success(t("icodeeasyClaude.cli.terminalOpened"));
    } catch (error) {
      console.error("[ICodeEasyClaude] Failed to open terminal", error);
      toast.error(
        t("icodeeasyClaude.cli.terminalOpenFailed", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setOpeningTerminal(false);
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
        i18nPrefix="icodeeasyClaude"
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
        launchingCli={openingTerminal}
        onLaunchCli={() => void handleOpenTerminal()}
      />
    </div>
  );
}
