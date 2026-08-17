import { useCallback, useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100;

export interface ClientSuiteStatus {
  supported: boolean;
  cliInstalled: boolean;
  cliVersion: string | null;
  cliBroken: boolean;
  desktopInstalled: boolean;
}

interface DesktopLaunchResult {
  desktopWasInstalled: boolean;
}

interface ClientSuiteAdapter<TStatus extends ClientSuiteStatus> {
  tool: string;
  logLabel: string;
  getStatus: () => Promise<TStatus>;
  runCliAction: (action: "install" | "update") => Promise<void>;
  launchDesktop: () => Promise<DesktopLaunchResult>;
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
    try {
      const versions = await settingsApi.getToolVersions([adapter.tool]);
      const tool = versions.find((item) => item.name === adapter.tool);
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
      await adapter.runCliAction(action);
      const next = await adapter.getStatus();
      setStatus(next);
      void refreshCliLatestVersion();
      return next;
    },
    [adapter, refreshCliLatestVersion],
  );

  const launchDesktop = useCallback(async () => {
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
