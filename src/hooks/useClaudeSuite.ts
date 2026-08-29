import { settingsApi } from "@/lib/api";
import { useClientSuite } from "@/hooks/useClientSuite";

const CLAUDE_SUITE_ADAPTER = {
  tool: "claude",
  logLabel: "useClaudeSuite",
  getStatus: () => settingsApi.getClaudeSuiteStatus(),
  runCliAction: (action: "install" | "update") =>
    settingsApi.runToolLifecycleAction(["claude"], action),
  // 桌面版职责已拆到 Claude Desktop 页（useClaudeDesktopSuite）：这里只保留 CLI 生命周期。
};

export function useClaudeSuite() {
  return useClientSuite(CLAUDE_SUITE_ADAPTER);
}
