/**
 * ICodeEasy 接入点（endpoint）配置
 *
 * 客户端允许用户在多个网关 origin 之间切换。选择存于统一供应商的 `baseUrl`
 * （唯一事实源），各套件的中转写入由 Rust 侧按此派生。本模块只放清单与
 * 归一化助手，UI 文案走 i18n。
 */

export interface ICodeEasyEndpoint {
  id: "primary" | "japan" | "singapore";
  origin: string;
  labelKey: string;
}

export const ICODEEASY_ENDPOINT_PRIMARY = "https://api.icodeeasy.cc";

export const ICODEEASY_ENDPOINTS: readonly ICodeEasyEndpoint[] = [
  {
    id: "primary",
    origin: ICODEEASY_ENDPOINT_PRIMARY,
    labelKey: "icodeeasySetup.endpointPrimary",
  },
  {
    id: "japan",
    origin: "https://jp.icodeeasy.cc",
    labelKey: "icodeeasySetup.endpointJapan",
  },
  {
    id: "singapore",
    origin: "https://sg.icodeeasy.cc",
    labelKey: "icodeeasySetup.endpointSingapore",
  },
];

/**
 * 归一化并匹配已知 origin（忽略首尾空白与尾斜杠），未知返回 null。
 * 与 Rust 侧 `icodeeasy_endpoints::normalize_endpoint_origin` 同口径。
 */
export function normalizeIcodeeasyEndpointOrigin(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return (
    ICODEEASY_ENDPOINTS.find((endpoint) => endpoint.origin === trimmed)
      ?.origin ?? null
  );
}
