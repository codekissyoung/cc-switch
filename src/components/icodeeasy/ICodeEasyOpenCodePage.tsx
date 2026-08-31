import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { OpenCodeIcon } from "@/components/BrandIcons";
import { ICodeEasyClientSuiteCard } from "@/components/icodeeasy/ICodeEasyClientSuiteCard";
import { settingsApi, universalProvidersApi } from "@/lib/api";
import type { UniversalProvider } from "@/types";
import {
  createICodeEasyUniversalProvider,
  ICODEEASY_UNIVERSAL_PROVIDER_ID,
} from "@/config/universalProviderPresets";
import { useOpencodeSuite } from "@/hooks/useOpencodeSuite";
import { extractErrorMessage } from "@/utils/errorUtils";

export function ICodeEasyOpenCodePage() {
  const { t } = useTranslation();
  const {
    status: suiteStatus,
    refresh: refreshSuite,
    runCliAction,
    cliLatestVersion,
  } = useOpencodeSuite();

  const [provider, setProvider] = useState<UniversalProvider | null>(null);
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

        if (!active) return;
        setProvider(currentProvider);
      } catch (error) {
        console.error(
          "[ICodeEasyOpenCode] Failed to load configuration",
          error,
        );
        toast.error(
          t("icodeeasyOpencode.loadError", {
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
      await settingsApi.configureOpencodeRelay(provider.apiKey.trim());
      await refreshSuite();
      toast.success(t("icodeeasyOpencode.relay.configureSuccess"));
    } catch (error) {
      console.error("[ICodeEasyOpenCode] Failed to configure relay", error);
      toast.error(
        t("icodeeasyOpencode.relay.configureError", {
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
        toast.error(t("icodeeasyOpencode.suite.cliVerificationFailed"));
      } else {
        toast.success(t("icodeeasyOpencode.cli.installSuccess"));
      }
    } catch (error) {
      console.error("[ICodeEasyOpenCode] Failed to manage OpenCode CLI", error);
      toast.error(
        t("icodeeasyOpencode.cli.installFailed", {
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
      toast.success(t("icodeeasyOpencode.cli.terminalOpened"));
    } catch (error) {
      console.error("[ICodeEasyOpenCode] Failed to open terminal", error);
      toast.error(
        t("icodeeasyOpencode.cli.terminalOpenFailed", {
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
        <LoaderCircle className="h-7 w-7 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <ICodeEasyClientSuiteCard
        icon={<OpenCodeIcon size={24} />}
        i18nPrefix="icodeeasyOpencode"
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
