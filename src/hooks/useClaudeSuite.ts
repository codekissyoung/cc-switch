import { settingsApi } from "@/lib/api";
import { useClientSuite } from "@/hooks/useClientSuite";

const CLAUDE_SUITE_ADAPTER = {
  tool: "claude",
  logLabel: "useClaudeSuite",
  getStatus: () => settingsApi.getClaudeSuiteStatus(),
  runCliAction: (action: "install" | "update") =>
    settingsApi.runToolLifecycleAction(["claude"], action),
  launchDesktop: () => settingsApi.launchOrInstallClaudeDesktop(),
};

export function useClaudeSuite() {
  return useClientSuite(CLAUDE_SUITE_ADAPTER);
}
