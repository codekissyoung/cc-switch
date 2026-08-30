import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Globe, Info, LoaderCircle, RefreshCw } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { settingsApi } from "@/lib/api";
import type { AppVersionCheckResult } from "@/lib/api/settings";
import { DOWNLOAD_PAGE_URL } from "@/config/constants";
import appIcon from "@/assets/icons/app-icon.png";

// 版本检查走网络（官网 release API），每次回到首页都查一遍太浪费：模块级缓存 +
// TTL（与套件卡工具版本探测同一思路）。缓存只记「检查结果」，不记检查中状态。
const VERSION_CHECK_CACHE_TTL_MS = 10 * 60 * 1000; // 10 分钟
let versionCheckCache: { data: AppVersionCheckResult; at: number } | null =
  null;

export function ICodeEasyAppInfoCard() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const [isPortable, setIsPortable] = useState(false);
  const [appUpdate, setAppUpdate] = useState<AppVersionCheckResult | null>(
    () => versionCheckCache?.data ?? null,
  );
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const checkAppVersion = useCallback(
    async (silent: boolean) => {
      setIsCheckingUpdate(true);
      try {
        const result = await settingsApi.checkAppVersion();
        versionCheckCache = { data: result, at: Date.now() };
        setAppUpdate(result);
        if (!silent && !result.hasUpdate) {
          toast.success(t("settings.upToDate"), { closeButton: true });
        }
      } catch (error) {
        // 后端已对任何失败兜底返回 hasUpdate=false，这里是极端情况
        console.error("[ICodeEasyAppInfoCard] Check app version failed", error);
        if (!silent) toast.error(t("settings.checkUpdateFailed"));
      } finally {
        setIsCheckingUpdate(false);
      }
    },
    [t],
  );

  useEffect(() => {
    let active = true;

    const loadLocalInfo = async () => {
      // getVersion / isPortable 都是本地调用，无网络，失败只影响徽标显示。
      try {
        const appVersion = await getVersion();
        if (active) setVersion(appVersion);
      } catch (error) {
        console.error("[ICodeEasyAppInfoCard] Failed to load version", error);
      }
      try {
        const portable = await settingsApi.isPortable();
        if (active) setIsPortable(portable);
      } catch (error) {
        console.error(
          "[ICodeEasyAppInfoCard] Failed to load portable state",
          error,
        );
      }
    };

    void loadLocalInfo();
    // 命中新鲜缓存直接复用，否则静默检查一次（有新版本时按钮变为下载入口）。
    if (
      versionCheckCache &&
      Date.now() - versionCheckCache.at < VERSION_CHECK_CACHE_TTL_MS
    ) {
      setAppUpdate(versionCheckCache.data);
    } else {
      void checkAppVersion(true);
    }
    return () => {
      active = false;
    };
  }, [checkAppVersion]);

  const handleCheckUpdate = useCallback(async () => {
    if (appUpdate?.hasUpdate) {
      // 已有检查结果且存在新版本：直接打开下载页
      try {
        await settingsApi.openExternal(
          appUpdate.downloadUrl ?? DOWNLOAD_PAGE_URL,
        );
      } catch (error) {
        console.error(
          "[ICodeEasyAppInfoCard] Failed to open download page",
          error,
        );
      }
      return;
    }
    await checkAppVersion(false);
  }, [appUpdate, checkAppVersion]);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="space-y-4 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={appIcon}
              alt=""
              className="h-8 w-8 flex-shrink-0 rounded-lg"
            />
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-foreground">
                ICodeEasy
              </span>
              <Badge variant="outline" className="gap-1.5 bg-background/80">
                <span className="text-muted-foreground">
                  {t("common.version")}
                </span>
                {version === null ? (
                  <LoaderCircle className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="font-medium">{`v${version}`}</span>
                )}
              </Badge>
              {isPortable && (
                <Badge variant="secondary" className="gap-1.5">
                  <Info className="h-3 w-3" />
                  {t("settings.portableMode")}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => settingsApi.openExternal("https://icodeeasy.cc")}
              className="h-8 gap-1.5 text-xs"
            >
              <Globe className="h-3.5 w-3.5" />
              {t("settings.officialWebsite")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => settingsApi.openExternal(DOWNLOAD_PAGE_URL)}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              {t("settings.releaseNotes")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCheckUpdate}
              disabled={isCheckingUpdate}
              className="h-8 gap-1.5 text-xs"
            >
              {isCheckingUpdate ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  {t("settings.checking")}
                </>
              ) : appUpdate?.hasUpdate ? (
                <>
                  <Download className="h-3.5 w-3.5" />
                  {t("settings.updateTo", {
                    version: appUpdate.latestVersion ?? "",
                  })}
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t("settings.checkForUpdates")}
                </>
              )}
            </Button>
          </div>
        </div>

        {appUpdate?.hasUpdate && (
          <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm">
            <p className="mb-1 font-medium text-primary">
              {t("settings.updateAvailable", {
                version: appUpdate.latestVersion ?? "",
              })}
            </p>
            {appUpdate.notes && (
              <p className="line-clamp-3 leading-relaxed text-muted-foreground">
                {appUpdate.notes}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
