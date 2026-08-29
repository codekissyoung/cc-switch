import { settingsApi } from "@/lib/api";
import { useClientSuite } from "@/hooks/useClientSuite";

const CLAUDE_DESKTOP_SUITE_ADAPTER = {
  logLabel: "useClaudeDesktopSuite",
  getStatus: () => settingsApi.getClaudeSuiteStatus(),
  // Claude Desktop 没有独立 CLI：不提供 tool/runCliAction，套件卡只渲染桌面行。
  launchDesktop: () => settingsApi.launchOrInstallClaudeDesktop(),
};

/**
 * Claude Desktop 的安装状态探测与启动/下载引导；复用 Claude 套件的状态命令，
 * 但不暴露 CLI 生命周期（CLI 维度留在 Claude 页）。
 *
 * 桌面版未安装时打开官方下载页，安装完成需要时间；`monitoring` 期间
 * 每 3 秒重新探测一次，直到桌面版出现或达到尝试上限。
 */
export function useClaudeDesktopSuite() {
  return useClientSuite(CLAUDE_DESKTOP_SUITE_ADAPTER);
}
