import { settingsApi } from "@/lib/api";
import { useClientSuite } from "@/hooks/useClientSuite";

const OPENCLAW_SUITE_ADAPTER = {
  tool: "openclaw",
  logLabel: "useOpenclawSuite",
  getStatus: () => settingsApi.getOpenclawSuiteStatus(),
  runCliAction: (action: "install" | "update") =>
    settingsApi.runToolLifecycleAction(["openclaw"], action),
  // OpenClaw is a terminal product and has no desktop client here.
};

/** OpenClaw CLI lifecycle and ICodeEasy relay readiness. */
export function useOpenclawSuite() {
  return useClientSuite(OPENCLAW_SUITE_ADAPTER);
}
