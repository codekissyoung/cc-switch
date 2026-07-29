import type { CSSProperties } from "react";
import {
  BarChart3,
  Home,
  Info,
  KeyRound,
  Route,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import appIcon from "@/assets/icons/app-icon.png";
import { cn } from "@/lib/utils";

export type ICodeEasySettingsSection =
  | "general"
  | "proxy"
  | "auth"
  | "advanced"
  | "usage"
  | "about";

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
    id: "auth",
    labelKey: "settings.tabAuth",
    icon: KeyRound,
  },
  {
    id: "advanced",
    labelKey: "settings.tabAdvanced",
    icon: SlidersHorizontal,
  },
  {
    id: "usage",
    labelKey: "icodeeasyNavigation.statistics",
    icon: BarChart3,
  },
  {
    id: "about",
    labelKey: "common.about",
    icon: Info,
  },
] as const satisfies ReadonlyArray<{
  id: ICodeEasySettingsSection;
  labelKey: string;
  icon: typeof Home;
}>;

interface ICodeEasySidebarProps {
  isHomeActive: boolean;
  activeSettingsSection: ICodeEasySettingsSection;
  onHomeSelect: () => void;
  onSettingsSectionSelect: (section: ICodeEasySettingsSection) => void;
  style?: CSSProperties;
}

export function ICodeEasySidebar({
  isHomeActive,
  activeSettingsSection,
  onHomeSelect,
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

        <div className="my-3 border-t border-border/60" />

        <div className="space-y-1">
          {ICODEEASY_SETTINGS_NAV_ITEMS.map((item) => {
            const active = !isHomeActive && activeSettingsSection === item.id;
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
