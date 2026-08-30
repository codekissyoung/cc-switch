//! ZCode 桌面版的 ICodeEasy 中转配置读写（`~/.zcode/v2/config.json`）。
//!
//! ZCode 不在 AppType 供应商切换链路里（那一套牵动 provider 全链路/数据库/
//! deeplink）。它的配置是单个 JSON 文件：顶层 `provider` map，内置渠道用
//! `builtin:` 前缀键，UI 添加的自定义 provider 用裸 UUID 键。这里用 serde_json
//! （preserve_order）做条目级 upsert：只新建/覆盖指向 ICodeEasy 端点的那个
//! provider 条目，其余 provider、模型与未知字段原样保留。

use std::path::PathBuf;

use serde_json::{json, Map, Value};

use crate::config::{get_home_dir, write_text_file};
use crate::error::AppError;

/// ICodeEasy 中转在 ZCode 配置里的 provider 显示名。
/// 端点不再硬编码：写入时由 `icodeeasy_endpoints` 按当前选定接入点派生
/// （ZCode 的 baseURL 是纯 origin 形态，不带 /v1）。
pub const ZCODE_RELAY_PROVIDER_NAME: &str = "ICodeEasy";
/// 首次配置中转时写入的默认模型条目（与 Codex 套件同一网关模型，256K 上下文）。
pub const ZCODE_RELAY_MODEL: &str = "gpt-5.6-sol";
pub const ZCODE_RELAY_MODEL_CONTEXT: u64 = 256_000;

/// ZCode 的配置文件路径：`~/.zcode/v2/config.json`。
pub fn get_zcode_config_path() -> PathBuf {
    get_home_dir().join(".zcode").join("v2").join("config.json")
}

/// 读取现有配置文本；文件不存在时视为空（首次配置场景）。
pub fn read_zcode_config_text() -> Result<String, AppError> {
    let path = get_zcode_config_path();
    if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| AppError::io(&path, e))
    } else {
        Ok(String::new())
    }
}

fn base_url_matches(provider: &Value) -> bool {
    provider
        .get("options")
        .and_then(|options| options.get("baseURL"))
        .and_then(Value::as_str)
        .map(crate::icodeeasy_endpoints::is_known_relay_base_url)
        .unwrap_or(false)
}

fn has_api_key(provider: &Value) -> bool {
    provider
        .get("options")
        .and_then(|options| options.get("apiKey"))
        .and_then(Value::as_str)
        .map(|key| !key.trim().is_empty())
        .unwrap_or(false)
}

/// 中转是否已配置：存在指向 ICodeEasy 端点且 apiKey 非空的自定义 provider。
pub fn zcode_relay_configured(config_text: &str) -> bool {
    let Ok(value) = serde_json::from_str::<Value>(config_text) else {
        return false;
    };
    let Some(providers) = value.get("provider").and_then(Value::as_object) else {
        return false;
    };
    providers
        .values()
        .any(|provider| base_url_matches(provider) && has_api_key(provider))
}

fn seed_model_entry() -> Value {
    json!({
        "limit": { "context": ZCODE_RELAY_MODEL_CONTEXT },
        "modalities": { "input": ["text"], "output": ["text"] }
    })
}

/// 在既有配置文本上 upsert ICodeEasy 中转，返回新的配置文本。
///
/// 覆盖范围：指向 ICodeEasy 端点（任一已知接入点）的那个自定义 provider 条目
/// （没有就新建，键为随机 UUID，与 ZCode UI 添加自定义 provider 的键形态一致）；
/// 条目下已有非空模型列表时保留，否则补一条默认模型。其余 provider（官方
/// Z.ai / 智谱渠道、用户自建渠道）与未知顶层字段原样保留。
/// `relay_origin` 是纯 origin（不带 /v1），原样写入 baseURL。
pub fn apply_zcode_relay_config(
    config_text: &str,
    api_key: &str,
    relay_origin: &str,
) -> Result<String, AppError> {
    let mut root = if config_text.trim().is_empty() {
        Value::Object(Map::new())
    } else {
        serde_json::from_str::<Value>(config_text)
            .map_err(|e| AppError::Message(format!("Invalid ZCode config.json: {e}")))?
    };

    let root_obj = root.as_object_mut().ok_or_else(|| {
        AppError::Message("Invalid ZCode config.json: top level is not an object".to_string())
    })?;
    if !root_obj.contains_key("provider") {
        root_obj.insert("provider".to_string(), Value::Object(Map::new()));
    }
    let providers = root_obj
        .get_mut("provider")
        .and_then(Value::as_object_mut)
        .ok_or_else(|| {
            AppError::Message("Invalid ZCode config.json: `provider` is not an object".to_string())
        })?;

    let key = providers
        .iter()
        .filter(|(key, _)| !key.starts_with("builtin:"))
        .find(|(_, value)| base_url_matches(value))
        .map(|(key, _)| key.clone())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let existing_models = providers
        .get(&key)
        .and_then(|value| value.get("models"))
        .and_then(Value::as_object)
        .filter(|models| !models.is_empty())
        .cloned();
    let models = existing_models.unwrap_or_else(|| {
        let mut models = Map::new();
        models.insert(ZCODE_RELAY_MODEL.to_string(), seed_model_entry());
        models
    });

    let mut entry = Map::new();
    entry.insert(
        "name".to_string(),
        Value::String(ZCODE_RELAY_PROVIDER_NAME.to_string()),
    );
    entry.insert("kind".to_string(), Value::String("openai".to_string()));
    entry.insert(
        "options".to_string(),
        json!({
            "apiKey": api_key,
            "baseURL": relay_origin,
            "apiKeyRequired": true
        }),
    );
    entry.insert("source".to_string(), Value::String("custom".to_string()));
    entry.insert("models".to_string(), Value::Object(models));
    providers.insert(key, Value::Object(entry));

    serde_json::to_string_pretty(&root)
        .map_err(|e| AppError::Message(format!("Failed to serialize ZCode config.json: {e}")))
}

/// 把 ICodeEasy 中转写入 `~/.zcode/v2/config.json`。`write_text_file` 走
/// 临时文件 + rename 的原子写，失败不会留下半写状态，无需额外回滚。
/// ZCode 只在 UI 操作时回写该文件（运行中与退出时都不会覆盖外部改动），
/// 但运行中的实例不会自动重载，改动需重启 ZCode 生效。
pub fn write_zcode_icodeeasy_relay(api_key: &str, relay_origin: &str) -> Result<(), AppError> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::localized(
            "zcode_relay_key_required",
            "请先填写 ICodeEasy API Key",
            "Enter the ICodeEasy API key first",
        ));
    }

    let path = get_zcode_config_path();
    let old_text = read_zcode_config_text()?;
    let new_text = apply_zcode_relay_config(&old_text, api_key, relay_origin)?;
    write_text_file(&path, &new_text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_relay_writes_uuid_keyed_provider_with_default_model() {
        let text = apply_zcode_relay_config("", "sk-test-key", "https://api.icodeeasy.cc")
            .expect("apply on empty config");
        let value: Value = serde_json::from_str(&text).expect("valid JSON output");

        let providers = value["provider"].as_object().expect("provider map");
        assert_eq!(providers.len(), 1);
        let (key, entry) = providers.iter().next().expect("one provider entry");
        assert!(
            uuid::Uuid::parse_str(key).is_ok(),
            "custom provider key should be a bare UUID, got {key}"
        );
        assert_eq!(entry["name"].as_str(), Some("ICodeEasy"));
        assert_eq!(entry["kind"].as_str(), Some("openai"));
        assert_eq!(
            entry["options"]["baseURL"].as_str(),
            Some("https://api.icodeeasy.cc")
        );
        assert_eq!(entry["options"]["apiKey"].as_str(), Some("sk-test-key"));
        assert_eq!(entry["options"]["apiKeyRequired"].as_bool(), Some(true));
        assert_eq!(entry["source"].as_str(), Some("custom"));
        assert_eq!(
            entry["models"]["gpt-5.6-sol"]["limit"]["context"].as_u64(),
            Some(256_000)
        );

        assert!(zcode_relay_configured(&text));
    }

    #[test]
    fn apply_relay_preserves_builtin_and_other_providers() {
        let existing = r#"{
  "provider": {
    "builtin:zai": {
      "name": "Z.ai - API Key",
      "kind": "anthropic",
      "options": { "apiKey": "", "baseURL": "https://api.z.ai/api/anthropic" },
      "source": "custom",
      "models": {}
    },
    "8b2c6d3e-0000-4f1b-9831-38cad9547872": {
      "name": "My Team Gateway",
      "kind": "openai",
      "options": { "apiKey": "user-own-key", "baseURL": "https://example.com/v1" },
      "source": "custom",
      "models": {}
    }
  }
}"#;
        let text = apply_zcode_relay_config(existing, "sk-new", "https://api.icodeeasy.cc")
            .expect("apply on existing");
        let value: Value = serde_json::from_str(&text).expect("valid JSON output");
        let providers = value["provider"].as_object().expect("provider map");

        // 官方内置渠道与用户自建渠道原样保留
        assert_eq!(
            providers["builtin:zai"]["options"]["baseURL"].as_str(),
            Some("https://api.z.ai/api/anthropic")
        );
        assert_eq!(
            providers["8b2c6d3e-0000-4f1b-9831-38cad9547872"]["options"]["apiKey"].as_str(),
            Some("user-own-key")
        );
        // 新建的是第三个条目
        assert_eq!(providers.len(), 3);
        assert!(zcode_relay_configured(&text));
    }

    #[test]
    fn reapply_reuses_key_and_keeps_user_models() {
        let existing = r#"{
  "provider": {
    "11b3e487-6abb-4f1b-9831-38cad9547872": {
      "name": "I Code Easy",
      "kind": "openai",
      "options": { "apiKey": "sk-old", "baseURL": "https://api.icodeeasy.cc/", "apiKeyRequired": true },
      "source": "custom",
      "enabled": false,
      "models": {
        "glm-5.3": { "limit": { "context": 1000000 } }
      }
    }
  }
}"#;
        let text = apply_zcode_relay_config(existing, "sk-new", "https://api.icodeeasy.cc")
            .expect("re-apply");
        let value: Value = serde_json::from_str(&text).expect("valid JSON output");
        let providers = value["provider"].as_object().expect("provider map");

        // 沿用既有 UUID 键（baseURL 尾斜杠差异也能命中），不新增条目
        assert_eq!(providers.len(), 1);
        let entry = &providers["11b3e487-6abb-4f1b-9831-38cad9547872"];
        assert_eq!(entry["options"]["apiKey"].as_str(), Some("sk-new"));
        assert_eq!(entry["name"].as_str(), Some("ICodeEasy"));
        // 用户已配的模型列表保留
        assert!(entry["models"]["glm-5.3"].is_object());
        // 重新配置视为重新启用：丢弃 UI 写入的 enabled:false
        assert!(entry.get("enabled").is_none());
        assert!(zcode_relay_configured(&text));
    }

    #[test]
    fn relay_configured_requires_base_url_and_key() {
        assert!(!zcode_relay_configured(""));
        assert!(!zcode_relay_configured("{not valid json"));
        assert!(!zcode_relay_configured(r#"{"provider": {}}"#));
        assert!(!zcode_relay_configured(
            r#"{"provider": {"x": {"options": {"baseURL": "https://api.icodeeasy.cc", "apiKey": " "}}}}"#
        ));
        assert!(!zcode_relay_configured(
            r#"{"provider": {"x": {"options": {"baseURL": "https://example.com/v1", "apiKey": "sk-x"}}}}"#
        ));
        assert!(zcode_relay_configured(
            r#"{"provider": {"x": {"options": {"baseURL": "https://api.icodeeasy.cc", "apiKey": "sk-x"}}}}"#
        ));
    }

    #[test]
    fn relay_follows_selected_endpoint() {
        // 换到日本节点：写入纯 origin，探测命中
        let text = apply_zcode_relay_config("", "sk-k", "https://jp.icodeeasy.cc")
            .expect("apply with jp endpoint");
        let value: Value = serde_json::from_str(&text).expect("valid JSON output");
        let providers = value["provider"].as_object().expect("provider map");
        let (_, entry) = providers.iter().next().expect("one provider entry");
        assert_eq!(
            entry["options"]["baseURL"].as_str(),
            Some("https://jp.icodeeasy.cc")
        );
        assert!(zcode_relay_configured(&text));

        // 已按主站配置过的条目换节点重配：沿用同一 UUID 键并更新 baseURL
        let existing = r#"{
  "provider": {
    "11b3e487-6abb-4f1b-9831-38cad9547872": {
      "name": "ICodeEasy",
      "kind": "openai",
      "options": { "apiKey": "sk-old", "baseURL": "https://api.icodeeasy.cc", "apiKeyRequired": true },
      "source": "custom",
      "models": {}
    }
  }
}"#;
        let text = apply_zcode_relay_config(existing, "sk-new", "https://jp.icodeeasy.cc")
            .expect("re-apply with jp endpoint");
        let value: Value = serde_json::from_str(&text).expect("valid JSON output");
        let providers = value["provider"].as_object().expect("provider map");
        assert_eq!(providers.len(), 1);
        let entry = &providers["11b3e487-6abb-4f1b-9831-38cad9547872"];
        assert_eq!(
            entry["options"]["baseURL"].as_str(),
            Some("https://jp.icodeeasy.cc")
        );
        assert_eq!(entry["options"]["apiKey"].as_str(), Some("sk-new"));
        assert!(zcode_relay_configured(&text));
    }

    #[test]
    fn apply_relay_rejects_invalid_existing_json() {
        let err = apply_zcode_relay_config(
            r#"{"provider": [broken]"#,
            "sk-x",
            "https://api.icodeeasy.cc",
        )
        .expect_err("invalid JSON must not be overwritten");
        assert!(err.to_string().contains("Invalid ZCode config.json"));
    }
}
