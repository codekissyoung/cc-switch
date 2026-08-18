import { settingsApi } from "@/lib/api";
import { useClientSuite } from "@/hooks/useClientSuite";

const OPENCODE_SUITE_ADAPTER = {
  tool: "opencode",
  logLabel: "useOpencodeSuite",
  getStatus: () => settingsApi.getOpencodeSuiteStatus(),
  runCliAction: (action: "install" | "update") =>
    settingsApi.runToolLifecycleAction(["opencode"], action),
  // OpenCode is a terminal product and has no desktop client here.
};

/** OpenCode CLI lifecycle and ICodeEasy relay readiness. */
export function useOpencodeSuite() {
  return useClientSuite(OPENCODE_SUITE_ADAPTER);
}
