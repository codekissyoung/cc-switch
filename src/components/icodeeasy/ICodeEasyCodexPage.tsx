import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  LoaderCircle,
  Monitor,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { CodexIcon } from "@/components/BrandIcons";
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
  const suiteSupported = suiteStatus?.supported !== false;

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

  const handleInstallCli = async () => {
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

  const handleOpenTerminal = async () => {
    if (openingTerminal) return;

    setOpeningTerminal(true);
    try {
      const selectedDir = await settingsApi.pickDirectory();
      if (!selectedDir) return;

      await providersApi.openTerminal(CODEX_PROVIDER_ID, "codex", {
        cwd: selectedDir,
      });
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

  const cliReady = Boolean(suiteStatus?.cliInstalled);
  const desktopInstalled = Boolean(suiteStatus?.desktopInstalled);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-blue-500" />
            {t("icodeeasyCodex.relay.title")}
          </CardTitle>
          <CardDescription>
            {t("icodeeasyCodex.relay.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {configured ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium text-emerald-600">
                  {t("icodeeasyCodex.relay.configured")}
                </span>
              </>
            ) : (
              <>
                <CircleAlert className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-amber-600">
                  {t("icodeeasyCodex.relay.notConfigured")}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {!hasApiKey && (
              <p className="text-xs leading-5 text-muted-foreground">
                {t("icodeeasyCodex.relay.noKeyHint")}
              </p>
            )}
            <Button
              size="sm"
              className="ml-auto bg-blue-600 text-white hover:bg-blue-700"
              disabled={!hasApiKey || saving}
              onClick={() => void handleConfigure()}
            >
              {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {t(
                configured
                  ? "icodeeasyCodex.relay.reconfigure"
                  : "icodeeasyCodex.relay.configure",
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-500/20 bg-blue-500/[0.025] shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CodexIcon size={24} />
            {t("icodeeasyCodex.clients.title")}
          </CardTitle>
          <CardDescription>
            {t("icodeeasyCodex.clients.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3">
            <Monitor className="h-5 w-5 shrink-0 text-blue-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {t("icodeeasyCodex.desktop.name")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  desktopInstalled
                    ? "icodeeasyCodex.suite.installed"
                    : monitoringInstall
                      ? "icodeeasyCodex.suite.waitingForInstall"
                      : "icodeeasyCodex.suite.notInstalled",
                )}
              </p>
            </div>
            {desktopInstalled && (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={!suiteSupported || launchingDesktop}
              onClick={() => void handleLaunchDesktop()}
            >
              {launchingDesktop && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t(
                desktopInstalled
                  ? "icodeeasyCodex.desktop.launch"
                  : "icodeeasyCodex.desktop.get",
              )}
            </Button>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3">
            <Terminal className="h-5 w-5 shrink-0 text-blue-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {t("icodeeasyCodex.cli.name")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {cliReady
                  ? t("icodeeasyCodex.suite.version", {
                      version: suiteStatus?.cliVersion,
                    })
                  : suiteStatus?.cliBroken
                    ? t("icodeeasyCodex.suite.needsRepair")
                    : suiteStatus && !suiteStatus.npmAvailable
                      ? t("icodeeasyCodex.suite.nodeMissing")
                      : t("icodeeasyCodex.suite.notInstalled")}
              </p>
            </div>
            {cliReady && (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            )}
            {!cliReady && (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  !suiteSupported ||
                  installingCli ||
                  Boolean(suiteStatus && !suiteStatus.npmAvailable)
                }
                onClick={() => void handleInstallCli()}
              >
                {installingCli && (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t(
                  suiteStatus?.cliBroken
                    ? "icodeeasyCodex.cli.repair"
                    : "icodeeasyCodex.cli.install",
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={!cliReady || !configured || openingTerminal}
              onClick={() => void handleOpenTerminal()}
            >
              {openingTerminal && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("icodeeasyCodex.cli.launchTerminal")}
            </Button>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            {t("icodeeasyCodex.suite.officialInstallerHint")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
