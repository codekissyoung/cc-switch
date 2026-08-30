/**
 * 统一供应商（Universal Provider）预设配置
 *
 * 统一供应商是跨应用共享的配置，修改后会自动同步到 Claude、Codex、Gemini 三个应用。
 * ICodeEasy 分发版只向用户暴露 ICodeEasy 网关；底层 Universal Provider
 * 数据结构继续保留，以兼容历史数据和上游同步逻辑。
 */

import type {
  UniversalProvider,
  UniversalProviderApps,
  UniversalProviderModels,
} from "@/types";
import { deepClone } from "@/utils/deepClone";

/**
 * 统一供应商预设接口
 */
export interface UniversalProviderPreset {
  /** 预设名称 */
  name: string;
  /** 供应商类型标识 */
  providerType: string;
  /** 默认启用的应用 */
  defaultApps: UniversalProviderApps;
  /** 默认模型配置 */
  defaultModels: UniversalProviderModels;
  /** 网站链接 */
  websiteUrl?: string;
  /** 图标名称 */
  icon?: string;
  /** 图标颜色 */
  iconColor?: string;
  /** 描述 */
  description?: string;
  /** 是否为自定义模板（允许用户完全自定义） */
  isCustomTemplate?: boolean;
}

/**
 * ICodeEasy 固定配置
 */
export const ICODEEASY_UNIVERSAL_PROVIDER_ID = "icodeeasy";
export const ICODEEASY_API_BASE_URL = "https://api.icodeeasy.cc";
export const ICODEEASY_WEBSITE_URL = "https://icodeeasy.cc";
export const ICODEEASY_KEYS_URL = "https://icodeeasy.cc/dashboard/keys";

const ICODEEASY_DEFAULT_MODELS: UniversalProviderModels = {
  // Claude Code 使用客户端模型名，由服务端完成别名路由。
  claude: {},
  codex: {
    model: "gpt-5.6-sol",
    reasoningEffort: "xhigh",
  },
  gemini: {
    model: "gemini-3.6-flash",
  },
};

/**
 * 统一供应商预设列表
 */
export const universalProviderPresets: UniversalProviderPreset[] = [
  {
    name: "ICodeEasy",
    providerType: "icodeeasy",
    defaultApps: {
      claude: true,
      codex: true,
      gemini: true,
    },
    defaultModels: ICODEEASY_DEFAULT_MODELS,
    websiteUrl: ICODEEASY_WEBSITE_URL,
    iconColor: "#3B82F6",
    description: "ICodeEasy 官方 AI CLI 接入服务",
  },
];

export const icodeEasyUniversalProviderPreset = universalProviderPresets[0];

/**
 * 创建或规范化用户侧唯一的 ICodeEasy 供应商。
 *
 * 只保留首次创建时间；名称、端点、模型和启用应用始终回到发行版契约，避免
 * UI 或旧版本把固定供应商漂移为自定义网关。
 */
export function createICodeEasyUniversalProvider(
  apiKey: string,
  existing?: UniversalProvider | null,
): UniversalProvider {
  return {
    id: ICODEEASY_UNIVERSAL_PROVIDER_ID,
    name: "ICodeEasy",
    providerType: "icodeeasy",
    apps: { ...icodeEasyUniversalProviderPreset.defaultApps },
    baseUrl: ICODEEASY_API_BASE_URL,
    apiKey: apiKey.trim(),
    models: deepClone(icodeEasyUniversalProviderPreset.defaultModels),
    websiteUrl: ICODEEASY_WEBSITE_URL,
    iconColor: icodeEasyUniversalProviderPreset.iconColor,
    createdAt: existing?.createdAt ?? Date.now(),
  };
}

/**
 * 根据预设创建统一供应商
 */
export function createUniversalProviderFromPreset(
  preset: UniversalProviderPreset,
  id: string,
  baseUrl: string,
  apiKey: string,
  customName?: string,
): UniversalProvider {
  return {
    id,
    name: customName || preset.name,
    providerType: preset.providerType,
    apps: { ...preset.defaultApps },
    baseUrl,
    apiKey,
    models: deepClone(preset.defaultModels),
    websiteUrl: preset.websiteUrl,
    icon: preset.icon,
    iconColor: preset.iconColor,
    createdAt: Date.now(),
  };
}

/**
 * 获取预设的显示名称（用于 UI）
 */
export function getPresetDisplayName(preset: UniversalProviderPreset): string {
  return preset.name;
}

/**
 * 根据类型查找预设
 */
export function findPresetByType(
  providerType: string,
): UniversalProviderPreset | undefined {
  return universalProviderPresets.find((p) => p.providerType === providerType);
}
