import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { CodexIcon } from "@/components/BrandIcons";
import { ICodeEasyClientSuiteCard } from "@/components/icodeeasy/ICodeEasyClientSuiteCard";
import { providersApi, settingsApi, universalProvidersApi } from "@/lib/api";
import type { UniversalProvider } from "@/types";
import {
  createICodeEasyUniversalProvider,
  ICODEEASY_UNIVERSAL_PROVIDER_ID,
} from "@/config/universalProviderPresets";
import { useCodexSuite } from "@/hooks/useCodexSuite";
import { extractErrorMessage } from "@/utils/errorUtils";

const CODEX_PROVIDER_ID = `universal-codex-${ICODEEASY_UNIVERSAL_PROVIDER_ID}`;

export function ICodeEasyCodexPage() {
  const { t } = useTranslation();
  const {
    status: suiteStatus,
    monitoring: monitoringInstall,
    installCli,
    launchDesktop,
    cliLatestVersion,
  } = useCodexSuite();

  const [provider, setProvider] = useState<UniversalProvider | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installingCli, setInstallingCli] = useState(false);
  const [launchingDesktop, setLaunchingDesktop] = useState(false);
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
        const currentId = await providersApi.getCurrent("codex");

        if (!active) return;
        setProvider(currentProvider);
        setConfigured(currentId === CODEX_PROVIDER_ID);
      } catch (error) {
        console.error("[ICodeEasyCodex] Failed to load configuration", error);
        toast.error(
          t("icodeeasyCodex.loadError", {
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
    try {
      const normalizedProvider = createICodeEasyUniversalProvider(
        provider.apiKey,
        provider,
      );
      await universalProvidersApi.upsert(normalizedProvider);
      await universalProvidersApi.sync(ICODEEASY_UNIVERSAL_PROVIDER_ID);
      await providersApi.switch(CODEX_PROVIDER_ID, "codex");

      setProvider(normalizedProvider);
      setConfigured(true);
      toast.success(t("icodeeasyCodex.relay.configureSuccess"));
    } catch (error) {
      console.error("[ICodeEasyCodex] Failed to configure relay", error);
      toast.error(
        t("icodeeasyCodex.relay.configureError", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleInstallCli = async (_action: "install" | "update") => {
    if (installingCli) return;

    setInstallingCli(true);
    try {
      const next = await installCli();
      if (!next.cliInstalled) {
        toast.error(t("icodeeasyCodex.suite.cliVerificationFailed"));
      } else {
        toast.success(t("icodeeasyCodex.cli.installSuccess"));
      }
    } catch (error) {
      console.error("[ICodeEasyCodex] Failed to install Codex CLI", error);
      toast.error(
        t("icodeeasyCodex.cli.installFailed", {
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
      console.error("[ICodeEasyCodex] Failed to launch Codex desktop", error);
      toast.error(
        t("icodeeasyCodex.desktop.launchFailed", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setLaunchingDesktop(false);
    }
  };

  // 打开系统首选终端（落在用户家目录）；中转配置已在 ~/.codex 里，无需注入
  const handleOpenTerminal = async () => {
    if (openingTerminal) return;

    setOpeningTerminal(true);
    try {
      await settingsApi.openHomeTerminal();
      toast.success(t("icodeeasyCodex.cli.terminalOpened"));
    } catch (error) {
      console.error("[ICodeEasyCodex] Failed to open terminal", error);
      toast.error(
        t("icodeeasyCodex.cli.terminalOpenFailed", {
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
        <LoaderCircle className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <ICodeEasyClientSuiteCard
        icon={<CodexIcon size={24} />}
        i18nPrefix="icodeeasyCodex"
        status={suiteStatus}
        monitoringInstall={monitoringInstall}
        cliLatestVersion={cliLatestVersion}
        relay={{
          configured,
          saving,
          hasApiKey,
          onConfigure: () => void handleConfigure(),
        }}
        cliInstallBlocked={Boolean(suiteStatus && !suiteStatus.npmAvailable)}
        installingCli={installingCli}
        launchingDesktop={launchingDesktop}
        onCliAction={(action) => void handleInstallCli(action)}
        onLaunchDesktop={() => void handleLaunchDesktop()}
        launchingCli={openingTerminal}
        onLaunchCli={() => void handleOpenTerminal()}
      />
    </div>
  );
}
