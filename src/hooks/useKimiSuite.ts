import { settingsApi } from "@/lib/api";
import { useClientSuite } from "@/hooks/useClientSuite";

const KIMI_SUITE_ADAPTER = {
  tool: "kimi",
  logLabel: "useKimiSuite",
  getStatus: () => settingsApi.getKimiSuiteStatus(),
  runCliAction: (action: "install" | "update") =>
    settingsApi.runToolLifecycleAction(["kimi"], action),
  // Kimi Code 是终端产品，没有桌面版：不提供 launchDesktop。
};

/** Kimi Code CLI 的安装状态探测与安装/更新动作；中转配置状态随 status 一并返回。 */
export function useKimiSuite() {
  return useClientSuite(KIMI_SUITE_ADAPTER);
}
