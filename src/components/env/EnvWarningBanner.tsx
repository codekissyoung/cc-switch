import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EnvConflict } from "@/types/env";

interface EnvWarningBannerProps {
  conflicts: EnvConflict[];
  onDismiss: () => void;
}

export function EnvWarningBanner({
  conflicts,
  onDismiss,
}: EnvWarningBannerProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (conflicts.length === 0) {
    return null;
  }

  const getSourceDescription = (conflict: EnvConflict): string => {
    if (conflict.sourceType === "system") {
      if (conflict.sourcePath.includes("HKEY_CURRENT_USER")) {
        return t("env.source.userRegistry");
      } else if (conflict.sourcePath.includes("HKEY_LOCAL_MACHINE")) {
        return t("env.source.systemRegistry");
      } else {
        return t("env.source.systemEnv");
      }
    } else {
      return conflict.sourcePath;
    }
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[100] bg-yellow-50 dark:bg-yellow-950 border-b border-yellow-200 dark:border-yellow-900 shadow-lg animate-slide-down">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                    {t("env.warning.title")}
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-0.5">
                    {t("env.warning.description", { count: conflicts.length })}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-yellow-900 dark:text-yellow-100 hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                  >
                    {isExpanded ? (
                      <>
                        {t("env.actions.collapse")}
                        <ChevronUp className="h-4 w-4 ml-1" />
                      </>
                    ) : (
                      <>
                        {t("env.actions.expand")}
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDismiss}
                    className="text-yellow-900 dark:text-yellow-100 hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-3">
                  <div className="space-y-1 border-b border-yellow-200 pb-3 text-sm text-yellow-900 dark:border-yellow-900/50 dark:text-yellow-100">
                    <p className="font-medium">{t("env.guidance.title")}</p>
                    <ol className="list-decimal space-y-1 pl-5">
                      <li>{t("env.guidance.review")}</li>
                      <li>{t("env.guidance.edit")}</li>
                      <li>{t("env.guidance.restart")}</li>
                    </ol>
                    <p className="pt-1 text-xs text-yellow-800 dark:text-yellow-200">
                      {t("env.guidance.readOnly")}
                    </p>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {conflicts.map((conflict) => {
                      const key = `${conflict.varName}:${conflict.sourcePath}`;
                      return (
                        <div
                          key={key}
                          className="p-3 bg-white dark:bg-gray-900 rounded-md border border-yellow-200 dark:border-yellow-900/50"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {conflict.varName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 break-all">
                              {t("env.field.source")}:{" "}
                              {getSourceDescription(conflict)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
