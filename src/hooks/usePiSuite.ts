import { settingsApi } from "@/lib/api";
import { useClientSuite } from "@/hooks/useClientSuite";

const PI_SUITE_ADAPTER = {
  tool: "pi",
  logLabel: "usePiSuite",
  getStatus: () => settingsApi.getPiSuiteStatus(),
  runCliAction: (action: "install" | "update") =>
    settingsApi.runToolLifecycleAction(["pi"], action),
  // Pi 是终端产品，没有桌面版：不提供 launchDesktop。
};

/** Pi CLI 的安装状态探测与安装/更新动作；中转配置状态随 status 一并返回。 */
export function usePiSuite() {
  return useClientSuite(PI_SUITE_ADAPTER);
}
