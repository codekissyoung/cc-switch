import { useCallback, useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";
import type { CodexSuiteStatus } from "@/lib/api/settings";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 100;

/**
 * Codex 套件（Codex CLI + ChatGPT Codex 桌面版）的安装状态探测与安装/启动动作。
 *
 * 桌面版走 OpenAI/Microsoft 官方安装流，安装完成需要时间；`monitoring` 期间
 * 每 3 秒重新探测一次，直到桌面版出现或达到尝试上限。
 */
export function useCodexSuite() {
  const [status, setStatus] = useState<CodexSuiteStatus | null>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [cliLatestVersion, setCliLatestVersion] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<CodexSuiteStatus | null> => {
    try {
      const next = await settingsApi.getCodexSuiteStatus();
      setStatus(next);
      return next;
    } catch (error) {
      console.warn("[useCodexSuite] Failed to probe Codex suite", error);
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // npm 最新版本只在挂载时查一次：安装监控期间状态探测每 3 秒轮询一次，
  // 若把 registry 网络请求挂进同一探测路径会被轮询放大。安装/更新成功后
  // 由 installCli 补查一次即可。
  const refreshCliLatestVersion = useCallback(async () => {
    try {
      const versions = await settingsApi.getToolVersions(["codex"]);
      const codex = versions.find((tool) => tool.name === "codex");
      setCliLatestVersion(codex?.latest_version ?? null);
    } catch (error) {
      console.warn(
        "[useCodexSuite] Failed to fetch latest Codex CLI version",
        error,
      );
    }
  }, []);

  useEffect(() => {
    void refreshCliLatestVersion();
  }, [refreshCliLatestVersion]);

  useEffect(() => {
    if (!monitoring) return;

    let active = true;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      let next: CodexSuiteStatus | null = null;
      try {
        next = await settingsApi.getCodexSuiteStatus();
      } catch (error) {
        console.warn("[useCodexSuite] Failed to refresh suite status", error);
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
  }, [monitoring]);

  /** 通过 npm 安装/更新原生 Codex CLI；返回安装后的探测结果（可能仍未通过验证） */
  const installCli = useCallback(async (): Promise<CodexSuiteStatus> => {
    await settingsApi.installNativeCodexCli();
    const next = await settingsApi.getCodexSuiteStatus();
    setStatus(next);
    void refreshCliLatestVersion();
    return next;
  }, [refreshCliLatestVersion]);

  /** 启动已安装的桌面版；未安装时转交官方安装流程并进入安装监控 */
  const launchDesktop = useCallback(async () => {
    const result = await settingsApi.launchOrInstallCodexDesktop();
    if (!result.desktopWasInstalled) setMonitoring(true);
    return result;
  }, []);

  return {
    status,
    monitoring,
    refresh,
    installCli,
    launchDesktop,
    cliLatestVersion,
  };
}
