import { settingsApi } from "@/lib/api";
import { useClientSuite } from "@/hooks/useClientSuite";

const GROK_SUITE_ADAPTER = {
  tool: "grok",
  logLabel: "useGrokSuite",
  getStatus: () => settingsApi.getGrokSuiteStatus(),
  runCliAction: (action: "install" | "update") =>
    settingsApi.runToolLifecycleAction(["grok"], action),
  // Grok Build is a terminal product and has no desktop client here.
};

/** Grok Build CLI lifecycle and ICodeEasy relay readiness. */
export function useGrokSuite() {
  return useClientSuite(GROK_SUITE_ADAPTER);
}
