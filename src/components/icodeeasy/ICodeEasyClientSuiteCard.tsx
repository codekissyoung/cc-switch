import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUpCircle,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Monitor,
  Play,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClientSuiteStatus } from "@/hooks/useClientSuite";
import { isUpdateAvailable } from "@/lib/version";

interface ICodeEasyClientSuiteCardProps {
  icon: ReactNode;
  i18nPrefix:
    | "icodeeasyCodex"
    | "icodeeasyClaude"
    | "icodeeasyClaudeDesktop"
    | "icodeeasyGoogle"
    | "icodeeasyKimi"
    | "icodeeasyGrok"
    | "icodeeasyZcode"
    | "icodeeasyOpencode"
    | "icodeeasyPi"
    | "icodeeasyOpenclaw"
    | "icodeeasyHermes";
  status: ClientSuiteStatus | null;
  monitoringInstall: boolean;
  cliLatestVersion: string | null;
  /** ICodeEasy 中转配置合并为卡片首行；不传则不渲染该行。 */
  relay?: {
    configured: boolean;
    saving: boolean;
    hasApiKey: boolean;
    onConfigure: () => void;
    /** 行下补充提示（如 Pi 的 /model 指引、Claude Desktop/ZCode 的重启提示）。 */
    hint?: string;
  };
  cliInstallBlocked?: boolean;
  installingCli: boolean;
  /** 无桌面版的产品（Kimi Code / Grok Build）不传这两个 prop，桌面行整体不渲染。 */
  launchingDesktop?: boolean;
  onLaunchDesktop?: () => void;
  /** 无 CLI 的产品（ZCode）不传此 prop，CLI 行整体不渲染。 */
  onCliAction?: (action: "install" | "update") => void;
  /** 「在终端启动」按钮：终端落在用户家目录，不带目录选择。 */
  launchingCli?: boolean;
  onLaunchCli?: () => void;
  /** 额外的第三个 CLI 行（如 Google 页的 agy）：安装/修复 + 可选的终端启动，无更新入口。 */
  extraCli?: {
    name: string;
    version: string | null;
    broken: boolean;
    installing: boolean;
    blocked: boolean;
    onInstall: () => void;
    /** 可选「在终端启动」按钮；agy 这类不走中转的工具不受 relay 配置状态门控。 */
    launching?: boolean;
    onLaunch?: () => void;
  };
}

export function ICodeEasyClientSuiteCard({
  icon,
  i18nPrefix,
  status,
  monitoringInstall,
  cliLatestVersion,
  relay,
  cliInstallBlocked = false,
  installingCli,
  launchingDesktop = false,
  onLaunchDesktop,
  onCliAction,
  launchingCli = false,
  onLaunchCli,
  extraCli,
}: ICodeEasyClientSuiteCardProps) {
  const { t } = useTranslation();
  const suiteSupported = status?.supported !== false;
  const cliReady = Boolean(status?.cliInstalled);
  const desktopInstalled = Boolean(status?.desktopInstalled);
  const cliUpdateAvailable =
    cliReady && isUpdateAvailable(status?.cliVersion, cliLatestVersion);

  return (
    <Card className="border-blue-500/20 bg-blue-500/[0.025] shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {t(`${i18nPrefix}.clients.title`)}
        </CardTitle>
        <CardDescription>
          {t(`${i18nPrefix}.clients.description`)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {relay && (
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 shrink-0 text-blue-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {t(`${i18nPrefix}.relay.name`)}
                </p>
                <p
                  className={
                    relay.configured
                      ? "text-xs font-medium text-emerald-600"
                      : "text-xs font-medium text-amber-600"
                  }
                >
                  {t(
                    relay.configured
                      ? `${i18nPrefix}.relay.configured`
                      : `${i18nPrefix}.relay.notConfigured`,
                  )}
                </p>
              </div>
              {relay.configured && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={!relay.hasApiKey || relay.saving}
                onClick={relay.onConfigure}
              >
                {relay.saving && (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t(
                  relay.configured
                    ? `${i18nPrefix}.relay.reconfigure`
                    : `${i18nPrefix}.relay.configure`,
                )}
              </Button>
            </div>
            {!relay.hasApiKey && (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t(`${i18nPrefix}.relay.noKeyHint`)}
              </p>
            )}
            {relay.hint && (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {relay.hint}
              </p>
            )}
          </div>
        )}

        {onLaunchDesktop && (
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3">
            <Monitor className="h-5 w-5 shrink-0 text-blue-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {t(`${i18nPrefix}.desktop.name`)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  desktopInstalled
                    ? `${i18nPrefix}.suite.installed`
                    : monitoringInstall
                      ? `${i18nPrefix}.suite.waitingForInstall`
                      : `${i18nPrefix}.suite.notInstalled`,
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
              onClick={onLaunchDesktop}
            >
              {launchingDesktop && (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t(
                desktopInstalled
                  ? `${i18nPrefix}.desktop.launch`
                  : `${i18nPrefix}.desktop.get`,
              )}
            </Button>
          </div>
        )}

        {onCliAction && (
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3">
            <Terminal className="h-5 w-5 shrink-0 text-blue-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {t(`${i18nPrefix}.cli.name`)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {cliReady
                  ? cliUpdateAvailable
                    ? t(`${i18nPrefix}.suite.versionOutdated`, {
                        version: status?.cliVersion,
                        latest: cliLatestVersion,
                      })
                    : t(`${i18nPrefix}.suite.version`, {
                        version: status?.cliVersion,
                      })
                  : status?.cliBroken
                    ? t(`${i18nPrefix}.suite.needsRepair`)
                    : cliInstallBlocked
                      ? t(`${i18nPrefix}.suite.installerUnavailable`)
                      : t(`${i18nPrefix}.suite.notInstalled`)}
              </p>
            </div>
            {cliReady && !cliUpdateAvailable && (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            )}
            {!cliReady && (
              <Button
                size="sm"
                variant="outline"
                disabled={!suiteSupported || installingCli || cliInstallBlocked}
                onClick={() => onCliAction("install")}
              >
                {installingCli && (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t(
                  status?.cliBroken
                    ? `${i18nPrefix}.cli.repair`
                    : `${i18nPrefix}.cli.install`,
                )}
              </Button>
            )}
            {cliUpdateAvailable && (
              <Button
                size="sm"
                variant="outline"
                disabled={!suiteSupported || installingCli}
                onClick={() => onCliAction("update")}
              >
                {installingCli ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpCircle className="mr-1.5 h-4 w-4" />
                )}
                {t(`${i18nPrefix}.cli.update`)}
              </Button>
            )}
            {onLaunchCli && cliReady && (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  !suiteSupported ||
                  launchingCli ||
                  Boolean(relay && !relay.configured)
                }
                onClick={onLaunchCli}
              >
                {launchingCli ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-1.5 h-4 w-4" />
                )}
                {t(`${i18nPrefix}.cli.launchTerminal`)}
              </Button>
            )}
          </div>
        )}

        {extraCli && (
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3">
            <Terminal className="h-5 w-5 shrink-0 text-blue-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{extraCli.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {extraCli.version
                  ? t(`${i18nPrefix}.suite.version`, {
                      version: extraCli.version,
                    })
                  : extraCli.broken
                    ? t(`${i18nPrefix}.suite.needsRepair`)
                    : extraCli.blocked
                      ? t(`${i18nPrefix}.suite.installerUnavailable`)
                      : t(`${i18nPrefix}.suite.notInstalled`)}
              </p>
            </div>
            {extraCli.version && (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            )}
            {!extraCli.version && (
              <Button
                size="sm"
                variant="outline"
                disabled={
                  !suiteSupported || extraCli.installing || extraCli.blocked
                }
                onClick={extraCli.onInstall}
              >
                {extraCli.installing && (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t(
                  extraCli.broken
                    ? `${i18nPrefix}.cli.repair`
                    : `${i18nPrefix}.cli.install`,
                )}
              </Button>
            )}
            {extraCli.onLaunch && extraCli.version && (
              <Button
                size="sm"
                variant="outline"
                disabled={!suiteSupported || extraCli.launching}
                onClick={extraCli.onLaunch}
              >
                {extraCli.launching ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-1.5 h-4 w-4" />
                )}
                {t(`${i18nPrefix}.cli.launchTerminal`)}
              </Button>
            )}
          </div>
        )}

        <p className="text-xs leading-5 text-muted-foreground">
          {t(`${i18nPrefix}.suite.officialInstallerHint`)}
        </p>
      </CardContent>
    </Card>
  );
}
