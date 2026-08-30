//! ICodeEasy 接入点（endpoint）模型与延迟探测。
//!
//! 客户端允许用户在多个网关 origin 之间切换（主站/日本/新加坡）。选择存于
//! ICodeEasy 统一供应商的 `base_url` 字段（唯一事实源）；各套件的中转写入与
//! 「已配置」探测都从此派生，不再硬编码单一域名。

use crate::database::dao::universal_providers::ICODEEASY_UNIVERSAL_PROVIDER_ID;
use crate::database::Database;
use serde::Serialize;

/// 主站（默认）。
pub const ENDPOINT_ORIGIN_PRIMARY: &str = "https://api.icodeeasy.cc";
/// 日本节点。
pub const ENDPOINT_ORIGIN_JAPAN: &str = "https://jp.icodeeasy.cc";
/// 新加坡节点。
pub const ENDPOINT_ORIGIN_SINGAPORE: &str = "https://sg.icodeeasy.cc";

/// 全部已知接入点 origin（不带路径、不带尾斜杠）。
pub const KNOWN_ENDPOINT_ORIGINS: [&str; 3] = [
    ENDPOINT_ORIGIN_PRIMARY,
    ENDPOINT_ORIGIN_JAPAN,
    ENDPOINT_ORIGIN_SINGAPORE,
];

/// 归一化并匹配已知 origin：忽略首尾空白与尾斜杠，未知返回 None。
pub fn normalize_endpoint_origin(raw: &str) -> Option<&'static str> {
    let trimmed = raw.trim().trim_end_matches('/');
    KNOWN_ENDPOINT_ORIGINS
        .iter()
        .copied()
        .find(|origin| *origin == trimmed)
}

pub fn default_endpoint_origin() -> &'static str {
    ENDPOINT_ORIGIN_PRIMARY
}

/// 当前选定 origin：统一供应商 `icodeeasy` 的 `base_url`；未知/缺失/非法时回退主站。
pub fn current_endpoint_origin(db: &Database) -> String {
    db.get_universal_provider(ICODEEASY_UNIVERSAL_PROVIDER_ID)
        .ok()
        .flatten()
        .and_then(|provider| normalize_endpoint_origin(&provider.base_url).map(str::to_string))
        .unwrap_or_else(|| default_endpoint_origin().to_string())
}

/// OpenAI 兼容（Responses/Chat）API 的 /v1 基址：Kimi/Grok/OpenCode/Pi/OpenClaw/
/// Hermes 的中转条目都写这个形态。
pub fn relay_api_v1_base(origin: &str) -> String {
    format!("{}/v1", origin.trim_end_matches('/'))
}

/// 判断中转 base_url 是否指向任一已知 ICodeEasy 端点（兼容带不带 `/v1`、
/// 带不带尾斜杠）。「已配置」探测用它，避免用户切过节点后被误判为未配置。
pub fn is_known_relay_base_url(url: &str) -> bool {
    let trimmed = url.trim().trim_end_matches('/');
    if normalize_endpoint_origin(trimmed).is_some() {
        return true;
    }
    trimmed
        .strip_suffix("/v1")
        .and_then(normalize_endpoint_origin)
        .is_some()
}

/// 单个接入点的延迟探测结果（全部采样失败时 latency_ms 为 None）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EndpointLatency {
    pub origin: String,
    pub latency_ms: Option<u64>,
}

const PROBE_SAMPLES: usize = 3;
const PROBE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(3);

fn median_ms(samples: &[u64]) -> u64 {
    let mut sorted = samples.to_vec();
    sorted.sort_unstable();
    let mid = sorted.len() / 2;
    if sorted.len() % 2 == 1 {
        sorted[mid]
    } else {
        (sorted[mid - 1] + sorted[mid]) / 2
    }
}

async fn probe_one(origin: &str) -> EndpointLatency {
    let client = match reqwest::Client::builder().timeout(PROBE_TIMEOUT).build() {
        Ok(client) => client,
        Err(_) => {
            return EndpointLatency {
                origin: origin.to_string(),
                latency_ms: None,
            };
        }
    };

    let mut samples = Vec::new();
    for sample in 0..PROBE_SAMPLES {
        // 与官网测速一致：打 /health，加一次性参数防缓存
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let url = format!("{origin}/health?_latency_probe={sample}-{now_ms}");
        let started = std::time::Instant::now();
        // 单个采样失败不否决整端点：代理链路偶发抖动时，取成功采样的中位数
        if client.get(&url).send().await.is_ok() {
            samples.push(started.elapsed().as_millis() as u64);
        }
    }

    EndpointLatency {
        origin: origin.to_string(),
        latency_ms: if samples.is_empty() {
            None
        } else {
            Some(median_ms(&samples))
        },
    }
}

/// 并发探测全部已知接入点（与官网控制台测速同口径：3 次采样取中位数）。
pub async fn probe_all_endpoints() -> Vec<EndpointLatency> {
    futures::future::join_all(
        KNOWN_ENDPOINT_ORIGINS
            .iter()
            .map(|origin| probe_one(origin)),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_known_origins() {
        assert_eq!(
            normalize_endpoint_origin("https://api.icodeeasy.cc"),
            Some(ENDPOINT_ORIGIN_PRIMARY)
        );
        assert_eq!(
            normalize_endpoint_origin("https://jp.icodeeasy.cc/"),
            Some(ENDPOINT_ORIGIN_JAPAN)
        );
        assert_eq!(
            normalize_endpoint_origin(" https://sg.icodeeasy.cc "),
            Some(ENDPOINT_ORIGIN_SINGAPORE)
        );
        assert_eq!(normalize_endpoint_origin("https://evil.example.com"), None);
        assert_eq!(normalize_endpoint_origin(""), None);
    }

    #[test]
    fn relay_base_url_detection_accepts_all_endpoints() {
        assert!(is_known_relay_base_url("https://api.icodeeasy.cc/v1"));
        assert!(is_known_relay_base_url("https://jp.icodeeasy.cc/v1/"));
        assert!(is_known_relay_base_url("https://sg.icodeeasy.cc"));
        assert!(!is_known_relay_base_url("https://api.icodeeasy.cc/v2"));
        assert!(!is_known_relay_base_url("https://evil.example.com/v1"));
        assert!(!is_known_relay_base_url("not a url"));
    }

    #[test]
    fn relay_v1_base_appends_once() {
        assert_eq!(
            relay_api_v1_base(ENDPOINT_ORIGIN_JAPAN),
            "https://jp.icodeeasy.cc/v1"
        );
        assert_eq!(
            relay_api_v1_base("https://jp.icodeeasy.cc/"),
            "https://jp.icodeeasy.cc/v1"
        );
    }

    #[test]
    fn median_of_samples() {
        assert_eq!(median_ms(&[30, 10, 20]), 20);
        assert_eq!(median_ms(&[10, 20]), 15);
    }

    // 前端按 camelCase 读 latencyMs——serde 字段名错一拍就会全员「超时」。
    #[test]
    fn endpoint_latency_serializes_camel_case() {
        let json = serde_json::to_value(EndpointLatency {
            origin: "https://jp.icodeeasy.cc".to_string(),
            latency_ms: Some(45),
        })
        .expect("serialize EndpointLatency");
        assert_eq!(json["origin"], "https://jp.icodeeasy.cc");
        assert_eq!(json["latencyMs"], 45);
        assert!(json.get("latency_ms").is_none());
    }
}
