import type { CSSProperties } from "react";
import {
  Home,
  Route,
  Settings2,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import appIcon from "@/assets/icons/app-icon.png";
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
import { cn } from "@/lib/utils";

export type ICodeEasySettingsSection =
  | "general"
  | "proxy"
  | "advanced"
  | "environment";

export const ICODEEASY_SIDEBAR_WIDTH = 224;

export const ICODEEASY_SETTINGS_NAV_ITEMS = [
  {
    id: "general",
    labelKey: "settings.tabGeneral",
    icon: Settings2,
  },
  {
    id: "proxy",
    labelKey: "settings.tabProxy",
    icon: Route,
  },
  {
    id: "advanced",
    labelKey: "settings.tabAdvanced",
    icon: SlidersHorizontal,
  },
  {
    id: "environment",
    labelKey: "settings.tabEnvironment",
    icon: Wrench,
  },
] as const satisfies ReadonlyArray<{
  id: ICodeEasySettingsSection;
  labelKey: string;
  icon: typeof Home;
}>;

interface ICodeEasySidebarProps {
  isHomeActive: boolean;
  isCodexActive: boolean;
  isClaudeActive: boolean;
  isClaudeDesktopActive: boolean;
  isGoogleActive: boolean;
  isKimiActive: boolean;
  isGrokActive: boolean;
  isZcodeActive: boolean;
  isOpencodeActive: boolean;
  isPiActive: boolean;
  isOpenclawActive: boolean;
  isHermesActive: boolean;
  activeSettingsSection: ICodeEasySettingsSection;
  onHomeSelect: () => void;
  onCodexSelect: () => void;
  onClaudeSelect: () => void;
  onClaudeDesktopSelect: () => void;
  onGoogleSelect: () => void;
  onKimiSelect: () => void;
  onGrokSelect: () => void;
  onZcodeSelect: () => void;
  onOpencodeSelect: () => void;
  onPiSelect: () => void;
  onOpenclawSelect: () => void;
  onHermesSelect: () => void;
  onSettingsSectionSelect: (section: ICodeEasySettingsSection) => void;
  style?: CSSProperties;
}

export function ICodeEasySidebar({
  isHomeActive,
  isCodexActive,
  isClaudeActive,
  isClaudeDesktopActive,
  isGoogleActive,
  isKimiActive,
  isGrokActive,
  isZcodeActive,
  isOpencodeActive,
  isPiActive,
  isOpenclawActive,
  isHermesActive,
  activeSettingsSection,
  onHomeSelect,
  onCodexSelect,
  onClaudeSelect,
  onClaudeDesktopSelect,
  onGoogleSelect,
  onKimiSelect,
  onGrokSelect,
  onZcodeSelect,
  onOpencodeSelect,
  onPiSelect,
  onOpenclawSelect,
  onHermesSelect,
  onSettingsSectionSelect,
  style,
}: ICodeEasySidebarProps) {
  const { t } = useTranslation();

  const itemClass = (active: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
    );

  return (
    <aside
      aria-label={t("icodeeasyNavigation.ariaLabel")}
      className="fixed bottom-0 left-0 z-[60] flex w-56 flex-col border-r border-border/60 bg-card/95 backdrop-blur-md"
      style={style}
    >
      <div className="flex h-16 flex-shrink-0 items-center border-b border-border/60 px-4">
        <button
          type="button"
          onClick={onHomeSelect}
          className="flex min-w-0 items-center gap-3 rounded-lg text-left hover:opacity-80"
        >
          <img
            src={appIcon}
            alt=""
            className="h-8 w-8 flex-shrink-0 rounded-lg"
          />
          <span className="truncate text-base font-semibold text-foreground">
            ICodeEasy
          </span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <button
          type="button"
          aria-current={isHomeActive ? "page" : undefined}
          onClick={onHomeSelect}
          className={itemClass(isHomeActive)}
        >
          <Home className="h-[18px] w-[18px] flex-shrink-0" />
          <span>{t("icodeeasyNavigation.home")}</span>
        </button>

        <button
          type="button"
          aria-current={isCodexActive ? "page" : undefined}
          onClick={onCodexSelect}
          className={itemClass(isCodexActive)}
        >
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
            <CodexIcon size={16} />
          </span>
          <span>{t("icodeeasyNavigation.codex")}</span>
        </button>

        <button
          type="button"
          aria-current={isClaudeActive ? "page" : undefined}
          onClick={onClaudeSelect}
          className={itemClass(isClaudeActive)}
        >
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
            <ClaudeIcon size={16} />
          </span>
          <span>{t("icodeeasyNavigation.claude")}</span>
        </button>

        <button
          type="button"
          aria-current={isClaudeDesktopActive ? "page" : undefined}
          onClick={onClaudeDesktopSelect}
          className={itemClass(isClaudeDesktopActive)}
        >
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
            <ClaudeIcon size={16} />
          </span>
          <span>{t("icodeeasyNavigation.claudeDesktop")}</span>
        </button>

        <button
          type="button"
          aria-current={isGoogleActive ? "page" : undefined}
          onClick={onGoogleSelect}
          className={itemClass(isGoogleActive)}
        >
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
            <GeminiIcon size={16} />
          </span>
          <span>{t("icodeeasyNavigation.google")}</span>
        </button>

        <button
          type="button"
          aria-current={isKimiActive ? "page" : undefined}
          onClick={onKimiSelect}
          className={itemClass(isKimiActive)}
        >
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
            <KimiIcon size={16} />
          </span>
          <span>{t("icodeeasyNavigation.kimi")}</span>
        </button>

        <button
          type="button"
          aria-current={isGrokActive ? "page" : undefined}
          onClick={onGrokSelect}
          className={itemClass(isGrokActive)}
        >
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
            <GrokIcon size={16} />
          </span>
          <span>{t("icodeeasyNavigation.grok")}</span>
        </button>

        <button
          type="button"
          aria-current={isZcodeActive ? "page" : undefined}
          onClick={onZcodeSelect}
          className={itemClass(isZcodeActive)}
        >
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
            <ZcodeIcon size={16} />
          </span>
          <span>{t("icodeeasyNavigation.zcode")}</span>
        </button>

        <button
          type="button"
          aria-current={isOpencodeActive ? "page" : undefined}
          onClick={onOpencodeSelect}
          className={itemClass(isOpencodeActive)}
        >
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
            <OpenCodeIcon size={16} />
          </span>
          <span>{t("icodeeasyNavigation.opencode")}</span>
        </button>

        <button
          type="button"
          aria-current={isPiActive ? "page" : undefined}
          onClick={onPiSelect}
          className={itemClass(isPiActive)}
        >
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
            <PiIcon size={16} />
          </span>
          <span>{t("icodeeasyNavigation.pi")}</span>
        </button>

        <button
          type="button"
          aria-current={isOpenclawActive ? "page" : undefined}
          onClick={onOpenclawSelect}
          className={itemClass(isOpenclawActive)}
        >
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
            <OpenClawIcon size={16} />
          </span>
          <span>{t("icodeeasyNavigation.openclaw")}</span>
        </button>

        <button
          type="button"
          aria-current={isHermesActive ? "page" : undefined}
          onClick={onHermesSelect}
          className={itemClass(isHermesActive)}
        >
          <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center">
            <HermesIcon size={16} />
          </span>
          <span>{t("icodeeasyNavigation.hermes")}</span>
        </button>

        <div className="my-3 border-t border-border/60" />

        <div className="space-y-1">
          {ICODEEASY_SETTINGS_NAV_ITEMS.map((item) => {
            const active =
              !isHomeActive &&
              !isCodexActive &&
              !isClaudeActive &&
              !isClaudeDesktopActive &&
              !isGoogleActive &&
              !isKimiActive &&
              !isGrokActive &&
              !isZcodeActive &&
              !isOpencodeActive &&
              !isPiActive &&
              !isOpenclawActive &&
              !isHermesActive &&
              activeSettingsSection === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onSettingsSectionSelect(item.id)}
                className={itemClass(active)}
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
