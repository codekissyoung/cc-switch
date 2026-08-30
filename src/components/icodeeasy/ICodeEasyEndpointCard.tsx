import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  settingsApi,
  type EndpointLatency,
  type EndpointSwitchResult,
} from "@/lib/api/settings";
import { ICODEEASY_ENDPOINTS } from "@/config/icodeeasyEndpoints";
import { extractErrorMessage } from "@/utils/errorUtils";
import { cn } from "@/lib/utils";

// 测速打 3 个端点 × 3 次采样，结果走模块级缓存（5 分钟）：首页与套件页来回
// 切换会重挂首页，无缓存则每次落地都发一轮探测。
const PROBE_CACHE_TTL_MS = 5 * 60 * 1000;
let probeCache: { results: EndpointLatency[]; at: number } | null = null;

interface ICodeEasyEndpointCardProps {
  /** 当前选中的接入点 origin（统一供应商 baseUrl） */
  selectedOrigin: string;
  /** 切换成功后回调，父组件据此更新本地 provider 状态 */
  onSwitched?: (result: EndpointSwitchResult) => void;
}

export function ICodeEasyEndpointCard({
  selectedOrigin,
  onSwitched,
}: ICodeEasyEndpointCardProps) {
  const { t } = useTranslation();
  const [latencies, setLatencies] = useState<EndpointLatency[] | null>(
    () => probeCache?.results ?? null,
  );
  const [testing, setTesting] = useState(false);
  const [switching, setSwitching] = useState(false);

  const runProbe = useCallback(async () => {
    setTesting(true);
    try {
      const results = await settingsApi.probeIcodeeasyEndpoints();
      probeCache = { results, at: Date.now() };
      setLatencies(results);
    } catch (error) {
      // 探测整体失败时各端点一律按超时展示，不打扰用户
      console.error("[ICodeEasyEndpointCard] Probe failed", error);
      setLatencies(
        ICODEEASY_ENDPOINTS.map((endpoint) => ({
          origin: endpoint.origin,
          latencyMs: null,
        })),
      );
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    if (probeCache && Date.now() - probeCache.at < PROBE_CACHE_TTL_MS) {
      return;
    }
    void runProbe();
  }, [runProbe]);

  const latencyByOrigin = new Map(
    (latencies ?? []).map((entry) => [entry.origin, entry.latencyMs]),
  );
  // 推荐 = 成功的端点里延迟最低者
  const recommendedOrigin = (latencies ?? []).reduce<string | null>(
    (best, entry) => {
      if (entry.latencyMs === null) return best;
      const bestMs = best === null ? null : latencyByOrigin.get(best);
      if (bestMs === null || bestMs === undefined || entry.latencyMs < bestMs) {
        return entry.origin;
      }
      return best;
    },
    null,
  );

  const handleSelect = async (origin: string, labelKey: string) => {
    if (switching || origin === selectedOrigin) return;
    setSwitching(true);
    try {
      const result = await settingsApi.setIcodeeasyEndpoint(origin);
      const label = t(labelKey);
      if (result.failed.length > 0) {
        toast.warning(
          t("icodeeasySetup.endpointSwitchPartial", {
            tools: result.failed.join("、"),
          }),
          { closeButton: true },
        );
      } else if (result.updated.length > 0) {
        toast.success(
          t("icodeeasySetup.endpointSwitched", {
            label,
            count: result.updated.length,
          }),
          { closeButton: true },
        );
      } else {
        toast.success(t("icodeeasySetup.endpointSwitchedNoop", { label }), {
          closeButton: true,
        });
      }
      onSwitched?.(result);
    } catch (error) {
      console.error("[ICodeEasyEndpointCard] Switch failed", error);
      toast.error(
        t("icodeeasySetup.endpointSwitchFailed", {
          error: extractErrorMessage(error),
        }),
        { closeButton: true },
      );
    } finally {
      setSwitching(false);
    }
  };

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-blue-500" />
            {t("icodeeasySetup.endpointTitle")}
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void runProbe()}
            disabled={testing}
          >
            {testing ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {testing
              ? t("icodeeasySetup.endpointTesting")
              : latencies === null
                ? t("icodeeasySetup.endpointTest")
                : t("icodeeasySetup.endpointRetest")}
          </Button>
        </div>
        <CardDescription>
          {t("icodeeasySetup.endpointDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {ICODEEASY_ENDPOINTS.map((endpoint) => {
          const isSelected = endpoint.origin === selectedOrigin;
          const isRecommended =
            recommendedOrigin !== null && endpoint.origin === recommendedOrigin;
          const latencyMs = latencyByOrigin.get(endpoint.origin);
          const probed = latencyByOrigin.has(endpoint.origin);

          return (
            <button
              key={endpoint.id}
              type="button"
              disabled={switching}
              onClick={() =>
                void handleSelect(endpoint.origin, endpoint.labelKey)
              }
              aria-pressed={isSelected}
              className={cn(
                "flex min-w-0 flex-col gap-2 rounded-xl border p-4 text-left transition-colors",
                isSelected
                  ? "border-blue-500/50 bg-blue-500/5"
                  : "border-border hover:border-blue-500/30 hover:bg-blue-500/5",
                switching && "opacity-60",
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {t(endpoint.labelKey)}
                </span>
                {isSelected ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-blue-500" />
                ) : isRecommended ? (
                  <span className="inline-flex flex-shrink-0 items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                    {t("icodeeasySetup.endpointRecommended")}
                  </span>
                ) : null}
              </span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {new URL(endpoint.origin).hostname}
              </span>
              <span className="flex min-h-5 items-center text-xs">
                {testing ? (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <LoaderCircle className="h-3 w-3 animate-spin" />
                    {t("icodeeasySetup.endpointTesting")}
                  </span>
                ) : probed && latencyMs !== null && latencyMs !== undefined ? (
                  <span className="tabular-nums font-medium">
                    {latencyMs} ms
                  </span>
                ) : probed ? (
                  <span className="inline-flex items-center gap-1 text-red-500">
                    <WifiOff className="h-3 w-3" />
                    {t("icodeeasySetup.endpointTimeout")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {t("icodeeasySetup.endpointPending")}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
