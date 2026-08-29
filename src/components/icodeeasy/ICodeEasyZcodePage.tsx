import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { ZcodeIcon } from "@/components/BrandIcons";
import { ICodeEasyClientSuiteCard } from "@/components/icodeeasy/ICodeEasyClientSuiteCard";
import { settingsApi, universalProvidersApi } from "@/lib/api";
import type { UniversalProvider } from "@/types";
import {
  createICodeEasyUniversalProvider,
  ICODEEASY_UNIVERSAL_PROVIDER_ID,
} from "@/config/universalProviderPresets";
import { useZcodeSuite } from "@/hooks/useZcodeSuite";
import { extractErrorMessage } from "@/utils/errorUtils";

export function ICodeEasyZcodePage() {
  const { t } = useTranslation();
  const {
    status: suiteStatus,
    monitoring: monitoringInstall,
    refresh: refreshSuite,
    launchDesktop,
  } = useZcodeSuite();

  const [provider, setProvider] = useState<UniversalProvider | null>(null);
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

        if (!active) return;
        setProvider(currentProvider);
      } catch (error) {
        console.error("[ICodeEasyZcode] Failed to load configuration", error);
        toast.error(
          t("icodeeasyZcode.loadError", {
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
      await settingsApi.configureZcodeRelay(provider.apiKey.trim());
      await refreshSuite();
      toast.success(t("icodeeasyZcode.relay.configureSuccess"));
    } catch (error) {
      console.error("[ICodeEasyZcode] Failed to configure relay", error);
      toast.error(
        t("icodeeasyZcode.relay.configureError", {
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
      console.error("[ICodeEasyZcode] Failed to launch ZCode", error);
      toast.error(
        t("icodeeasyZcode.desktop.launchFailed", {
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
        <LoaderCircle className="h-7 w-7 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <ICodeEasyClientSuiteCard
        icon={<ZcodeIcon size={24} />}
        i18nPrefix="icodeeasyZcode"
        status={suiteStatus}
        monitoringInstall={monitoringInstall}
        cliLatestVersion={null}
        relay={{
          configured,
          saving,
          hasApiKey,
          onConfigure: () => void handleConfigure(),
          hint: t("icodeeasyZcode.relay.hint"),
        }}
        installingCli={false}
        launchingDesktop={launchingDesktop}
        onLaunchDesktop={() => void handleLaunchDesktop()}
      />
    </div>
  );
}
