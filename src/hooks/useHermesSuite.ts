import { settingsApi } from "@/lib/api";
import { useClientSuite } from "@/hooks/useClientSuite";

const HERMES_SUITE_ADAPTER = {
  tool: "hermes",
  logLabel: "Hermes",
  getStatus: () => settingsApi.getHermesSuiteStatus(),
  runCliAction: (action: "install" | "update") =>
    settingsApi.runToolLifecycleAction(["hermes"], action),
  // Hermes is a terminal product and has no desktop client here.
};

/** Hermes CLI lifecycle and ICodeEasy relay readiness. */
export function useHermesSuite() {
  return useClientSuite(HERMES_SUITE_ADAPTER);
}
