import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  ClaudeIcon,
  CodexIcon,
  GeminiIcon,
  GrokIcon,
  HermesIcon,
  KimiIcon,
  OpenClawIcon,
  OpenCodeIcon,
  PiIcon,
  ZcodeIcon,
} from "@/components/BrandIcons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ICodeEasyAppInfoCard } from "@/components/icodeeasy/ICodeEasyAppInfoCard";
import { ICodeEasyEndpointCard } from "@/components/icodeeasy/ICodeEasyEndpointCard";
import {
  ICODEEASY_ENDPOINT_PRIMARY,
  normalizeIcodeeasyEndpointOrigin,
} from "@/config/icodeeasyEndpoints";
import { providersApi, settingsApi, universalProvidersApi } from "@/lib/api";
import type { UniversalProvider } from "@/types";
import {
  createICodeEasyUniversalProvider,
  ICODEEASY_KEYS_URL,
  ICODEEASY_UNIVERSAL_PROVIDER_ID,
} from "@/config/universalProviderPresets";
import { extractErrorMessage } from "@/utils/errorUtils";

export type ICodeEasyToolView =
  | "codex"
  | "claude"
  | "claudeDesktop"
  | "google"
  | "kimi"
  | "grok"
  | "zcode"
  | "opencode"
  | "pi"
  | "openclaw"
  | "hermes";

type ToolStatus = "configured" | "unconfigured" | "unknown";

interface ToolEntry {
  view: ICodeEasyToolView;
  labelKey: string;
  icon: ReactNode;
  probe: () => Promise<boolean>;
}

const currentProviderIs = async (
  appId: "claude" | "codex" | "gemini",
  providerId: string,
): Promise<boolean> => (await providersApi.getCurrent(appId)) === providerId;

const TOOLS: ToolEntry[] = [
  {
    view: "codex",
    labelKey: "icodeeasyNavigation.codex",
    icon: <CodexIcon size={24} />,
    probe: () =>
      currentProviderIs(
        "codex",
        `universal-codex-${ICODEEASY_UNIVERSAL_PROVIDER_ID}`,
      ),
  },
  {
    view: "claude",
    labelKey: "icodeeasyNavigation.claude",
    icon: <ClaudeIcon size={24} />,
    probe: () =>
      currentProviderIs(
        "claude",
        `universal-claude-${ICODEEASY_UNIVERSAL_PROVIDER_ID}`,
      ),
  },
  {
    view: "claudeDesktop",
    labelKey: "icodeeasyNavigation.claudeDesktop",
    icon: <ClaudeIcon size={24} />,
    probe: async () =>
      (await providersApi.getCurrent("claude-desktop")) ===
      `universal-claude-${ICODEEASY_UNIVERSAL_PROVIDER_ID}`,
  },
  {
    view: "google",
    labelKey: "icodeeasyNavigation.google",
    icon: <GeminiIcon size={24} />,
    probe: () =>
      currentProviderIs(
        "gemini",
        `universal-gemini-${ICODEEASY_UNIVERSAL_PROVIDER_ID}`,
      ),
  },
  {
    view: "kimi",
    labelKey: "icodeeasyNavigation.kimi",
    icon: <KimiIcon size={24} />,
    probe: async () => (await settingsApi.getKimiSuiteStatus()).relayConfigured,
  },
  {
    view: "grok",
    labelKey: "icodeeasyNavigation.grok",
    icon: <GrokIcon size={24} />,
    probe: async () => (await settingsApi.getGrokSuiteStatus()).relayConfigured,
  },
  {
    view: "zcode",
    labelKey: "icodeeasyNavigation.zcode",
    icon: <ZcodeIcon size={24} />,
    probe: async () =>
      (await settingsApi.getZcodeSuiteStatus()).relayConfigured,
  },
  {
    view: "opencode",
    labelKey: "icodeeasyNavigation.opencode",
    icon: <OpenCodeIcon size={24} />,
    probe: async () =>
      (await settingsApi.getOpencodeSuiteStatus()).relayConfigured,
  },
  {
    view: "pi",
    labelKey: "icodeeasyNavigation.pi",
    icon: <PiIcon size={24} />,
    probe: async () => (await settingsApi.getPiSuiteStatus()).relayConfigured,
  },
  {
    view: "openclaw",
    labelKey: "icodeeasyNavigation.openclaw",
    icon: <OpenClawIcon size={24} />,
    probe: async () =>
      (await settingsApi.getOpenclawSuiteStatus()).relayConfigured,
  },
  {
    view: "hermes",
    labelKey: "icodeeasyNavigation.hermes",
    icon: <HermesIcon size={24} />,
    probe: async () =>
      (await settingsApi.getHermesSuiteStatus()).relayConfigured,
  },
];

interface ICodeEasySetupPageProps {
  onNavigate: (view: ICodeEasyToolView) => void;
}

export function ICodeEasySetupPage({ onNavigate }: ICodeEasySetupPageProps) {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<UniversalProvider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [statuses, setStatuses] = useState<Partial<
    Record<ICodeEasyToolView, ToolStatus>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        let currentProvider = await universalProvidersApi.get(
          ICODEEASY_UNIVERSAL_PROVIDER_ID,
        );
        if (!currentProvider) {
          currentProvider = createICodeEasyUniversalProvider("");
          await universalProvidersApi.upsert(currentProvider);
        }

        const entries = await Promise.all(
          TOOLS.map(async (tool) => {
            try {
              const configured = await tool.probe();
              return [
                tool.view,
                configured ? "configured" : "unconfigured",
              ] as const;
            } catch (error) {
              console.warn(
                `[ICodeEasySetup] Failed to probe ${tool.view} relay status`,
                error,
              );
              return [tool.view, "unknown"] as const;
            }
          }),
        );

        if (!active) return;
        setProvider(currentProvider);
        setApiKey(currentProvider.apiKey);
        setStatuses(Object.fromEntries(entries));
      } catch (error) {
        console.error("[ICodeEasySetup] Failed to load configuration", error);
        toast.error(
          t("icodeeasySetup.loadError", {
            error: extractErrorMessage(error),
          }),
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [t]);

  const apiKeyDirty = apiKey.trim() !== (provider?.apiKey ?? "");

  const handleSaveKey = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey || !apiKeyDirty || saving) return;

    setSaving(true);
    try {
      const normalizedProvider = createICodeEasyUniversalProvider(
        trimmedKey,
        provider,
      );
      await universalProvidersApi.upsert(normalizedProvider);
      await universalProvidersApi.sync(ICODEEASY_UNIVERSAL_PROVIDER_ID);

      setProvider(normalizedProvider);
      setApiKey(trimmedKey);
      toast.success(t("icodeeasySetup.apiKeySaved"));
    } catch (error) {
      console.error("[ICodeEasySetup] Failed to save API key", error);
      toast.error(
        t("icodeeasySetup.apiKeySaveError", {
          error: extractErrorMessage(error),
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  const openKeysPage = async () => {
    try {
      await settingsApi.openExternal(ICODEEASY_KEYS_URL);
    } catch (error) {
      toast.error(
        t("icodeeasySetup.openKeysError", {
          error: extractErrorMessage(error),
        }),
      );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoaderCircle className="h-7 w-7 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5 text-blue-500" />
            {t("icodeeasySetup.apiKeyTitle")}
          </CardTitle>
          <CardDescription>
            {t("icodeeasySetup.apiKeyDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={t("icodeeasySetup.apiKeyPlaceholder")}
                aria-label={t("icodeeasySetup.apiKeyLabel")}
                autoComplete="off"
                className="h-11 pr-11 font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-9 w-9 text-muted-foreground"
                onClick={() => setShowApiKey((visible) => !visible)}
                aria-label={t(
                  showApiKey
                    ? "icodeeasySetup.hideApiKey"
                    : "icodeeasySetup.showApiKey",
                )}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              type="button"
              className="h-11 shrink-0 bg-blue-600 text-white hover:bg-blue-700"
              disabled={!apiKey.trim() || !apiKeyDirty || saving}
              onClick={() => void handleSaveKey()}
            >
              {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              {t("icodeeasySetup.saveApiKey")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0"
              onClick={() => void openKeysPage()}
            >
              {t("icodeeasySetup.getApiKey")}
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            {t("icodeeasySetup.localStorageHint")}
          </div>
        </CardContent>
      </Card>

      <ICodeEasyEndpointCard
        selectedOrigin={
          normalizeIcodeeasyEndpointOrigin(provider?.baseUrl ?? "") ??
          ICODEEASY_ENDPOINT_PRIMARY
        }
        onSwitched={(result) =>
          setProvider((previous) =>
            previous ? { ...previous, baseUrl: result.origin } : previous,
          )
        }
      />

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">
            {t("icodeeasySetup.statusTitle")}
          </CardTitle>
          <CardDescription>
            {t("icodeeasySetup.statusDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {TOOLS.map((tool) => {
            const status = statuses?.[tool.view] ?? null;
            const name = t(tool.labelKey);
            return (
              <button
                key={tool.view}
                type="button"
                onClick={() => onNavigate(tool.view)}
                aria-label={t("icodeeasySetup.openTool", { name })}
                className="flex items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:border-blue-500/30 hover:bg-blue-500/5"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                  {tool.icon}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {name}
                </span>
                {status === null && (
                  <LoaderCircle className="h-4 w-4 flex-shrink-0 animate-spin text-muted-foreground" />
                )}
                {status === "configured" && (
                  <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("icodeeasySetup.toolConfigured")}
                  </span>
                )}
                {status === "unconfigured" && (
                  <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-amber-600">
                    <CircleAlert className="h-3.5 w-3.5" />
                    {t("icodeeasySetup.toolNotConfigured")}
                  </span>
                )}
                {status === "unknown" && (
                  <span className="flex-shrink-0 text-xs text-muted-foreground">
                    {t("icodeeasySetup.toolStatusUnknown")}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </CardContent>
      </Card>

      <ICodeEasyAppInfoCard />
    </div>
  );
}
