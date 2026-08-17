import { settingsApi } from "@/lib/api";
import { useClientSuite } from "@/hooks/useClientSuite";

const CODEX_SUITE_ADAPTER = {
  tool: "codex",
  logLabel: "useCodexSuite",
  getStatus: () => settingsApi.getCodexSuiteStatus(),
  runCliAction: (_action: "install" | "update") =>
    settingsApi.installNativeCodexCli(),
  launchDesktop: () => settingsApi.launchOrInstallCodexDesktop(),
};

/**
 * Codex 套件（Codex CLI + ChatGPT Codex 桌面版）的安装状态探测与安装/启动动作。
 *
 * 桌面版走 OpenAI/Microsoft 官方安装流，安装完成需要时间；`monitoring` 期间
 * 每 3 秒重新探测一次，直到桌面版出现或达到尝试上限。
 */
export function useCodexSuite() {
  const suite = useClientSuite(CODEX_SUITE_ADAPTER);

  return {
    ...suite,
    installCli: () => suite.runCliAction("install"),
  };
}
