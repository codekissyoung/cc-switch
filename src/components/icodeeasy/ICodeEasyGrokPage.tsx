import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { GrokIcon } from "@/components/BrandIcons";
import { ICodeEasyClientSuiteCard } from "@/components/icodeeasy/ICodeEasyClientSuiteCard";
import { settingsApi, universalProvidersApi } from "@/lib/api";
import type { UniversalProvider } from "@/types";
import {
  createICodeEasyUniversalProvider,
  ICODEEASY_UNIVERSAL_PROVIDER_ID,
} from "@/config/universalProviderPresets";
import { useGrokSuite } from "@/hooks/useGrokSuite";
import { extractErrorMessage } from "@/utils/errorUtils";

export function ICodeEasyGrokPage() {
  const { t } = useTranslation();
  const {
    status: suiteStatus,
    refresh: refreshSuite,
    runCliAction,
    cliLatestVersion,
  } = useGrokSuite();

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
        console.error("[ICodeEasyGrok] Failed to load configuration", error);
        toast.error(
          t("icodeeasyGrok.loadError", {
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
      await settingsApi.configureGrokRelay(provider.apiKey.trim());
      await refreshSuite();
      toast.success(t("icodeeasyGrok.relay.configureSuccess"));
    } catch (error) {
      console.error("[ICodeEasyGrok] Failed to configure relay", error);
      toast.error(
        t("icodeeasyGrok.relay.configureError", {
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
        toast.error(t("icodeeasyGrok.suite.cliVerificationFailed"));
      } else {
        toast.success(t("icodeeasyGrok.cli.installSuccess"));
      }
    } catch (error) {
      console.error("[ICodeEasyGrok] Failed to manage Grok Build CLI", error);
      toast.error(
        t("icodeeasyGrok.cli.installFailed", {
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
      <ICodeEasyClientSuiteCard
        icon={<GrokIcon size={24} />}
        i18nPrefix="icodeeasyGrok"
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
    </div>
  );
}
