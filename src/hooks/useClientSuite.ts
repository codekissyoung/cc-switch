import { useCallback, useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100;

export interface ClientSuiteStatus {
  supported: boolean;
  /** 桌面-only 产品（如 ZCode）没有 CLI，这三个字段缺席。 */
  cliInstalled?: boolean;
  cliVersion?: string | null;
  cliBroken?: boolean;
  /** 终端型产品（如 Kimi Code）没有桌面版，该字段缺席。 */
  desktopInstalled?: boolean;
}

interface DesktopLaunchResult {
  desktopWasInstalled: boolean;
}

interface ClientSuiteAdapter<TStatus extends ClientSuiteStatus> {
  /** 有 CLI 的产品提供工具 id 用于版本探测；桌面-only 产品缺席。 */
  tool?: string;
  logLabel: string;
  getStatus: () => Promise<TStatus>;
  /** 无 CLI 的产品不提供此回调；卡片也不会渲染 CLI 行。 */
  runCliAction?: (action: "install" | "update") => Promise<void>;
  /** 无桌面版的产品不提供此回调；卡片也不会渲染桌面行与安装轮询。 */
  launchDesktop?: () => Promise<DesktopLaunchResult>;
}

/** Shared install/status state machine for the first-party client suite pages. */
export function useClientSuite<TStatus extends ClientSuiteStatus>(
  adapter: ClientSuiteAdapter<TStatus>,
) {
  const [status, setStatus] = useState<TStatus | null>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [cliLatestVersion, setCliLatestVersion] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<TStatus | null> => {
    try {
      const next = await adapter.getStatus();
      setStatus(next);
      return next;
    } catch (error) {
      console.warn(`[${adapter.logLabel}] Failed to probe client suite`, error);
      return null;
    }
  }, [adapter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshCliLatestVersion = useCallback(async () => {
    if (!adapter.tool) return;
    const toolName = adapter.tool;
    try {
      const versions = await settingsApi.getToolVersions([toolName]);
      const tool = versions.find((item) => item.name === toolName);
      setCliLatestVersion(tool?.latest_version ?? null);
    } catch (error) {
      console.warn(
        `[${adapter.logLabel}] Failed to fetch latest CLI version`,
        error,
      );
    }
  }, [adapter]);

  useEffect(() => {
    void refreshCliLatestVersion();
  }, [refreshCliLatestVersion]);

  useEffect(() => {
    if (!monitoring) return;

    let active = true;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      let next: TStatus | null = null;
      try {
        next = await adapter.getStatus();
      } catch (error) {
        console.warn(
          `[${adapter.logLabel}] Failed to refresh suite status`,
          error,
        );
      }
      if (!active) return;
      if (next) setStatus(next);
      if (next?.desktopInstalled || attempts >= MAX_POLL_ATTEMPTS) {
        setMonitoring(false);
      }
    };

    const interval = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    void poll();
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [adapter, monitoring]);

  const runCliAction = useCallback(
    async (action: "install" | "update"): Promise<TStatus> => {
      if (!adapter.runCliAction) {
        throw new Error(`${adapter.logLabel} has no CLI lifecycle`);
      }
      await adapter.runCliAction(action);
      const next = await adapter.getStatus();
      setStatus(next);
      void refreshCliLatestVersion();
      return next;
    },
    [adapter, refreshCliLatestVersion],
  );

  const launchDesktop = useCallback(async () => {
    if (!adapter.launchDesktop) return undefined;
    const result = await adapter.launchDesktop();
    if (!result.desktopWasInstalled) setMonitoring(true);
    return result;
  }, [adapter]);

  return {
    status,
    monitoring,
    refresh,
    runCliAction,
    launchDesktop,
    cliLatestVersion,
  };
}
