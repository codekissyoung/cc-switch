import { settingsApi } from "@/lib/api";
import { useClientSuite } from "@/hooks/useClientSuite";

const GEMINI_SUITE_ADAPTER = {
  tool: "gemini",
  logLabel: "useGeminiSuite",
  getStatus: () => settingsApi.getGeminiSuiteStatus(),
  runCliAction: (action: "install" | "update") =>
    settingsApi.runToolLifecycleAction(["gemini"], action),
  launchDesktop: () => settingsApi.launchOrInstallAntigravityDesktop(),
};

/**
 * Google 套件（Gemini CLI + Antigravity 桌面版）的安装状态探测与安装/启动动作。
 *
 * 桌面版未安装时打开 Google 官方下载页，安装完成需要时间；`monitoring` 期间
 * 每 3 秒重新探测一次，直到桌面版出现或达到尝试上限。
 */
export function useGeminiSuite() {
  return useClientSuite(GEMINI_SUITE_ADAPTER);
}
