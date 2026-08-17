import { settingsApi } from "@/lib/api";
import { useClientSuite } from "@/hooks/useClientSuite";

const ZCODE_SUITE_ADAPTER = {
  logLabel: "useZcodeSuite",
  getStatus: () => settingsApi.getZcodeSuiteStatus(),
  // ZCode 是桌面-only 产品，没有独立 CLI：不提供 tool/runCliAction。
  launchDesktop: () => settingsApi.launchOrInstallZcodeDesktop(),
};

/**
 * ZCode 桌面版的安装状态探测与启动/下载引导；中转配置状态随 status 一并返回。
 *
 * 桌面版未安装时打开 Z.ai 官方下载页，安装完成需要时间；`monitoring` 期间
 * 每 3 秒重新探测一次，直到桌面版出现或达到尝试上限。
 */
export function useZcodeSuite() {
  return useClientSuite(ZCODE_SUITE_ADAPTER);
}
