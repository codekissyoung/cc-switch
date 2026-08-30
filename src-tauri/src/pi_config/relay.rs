//! ICodeEasy relay upsert for Pi's native `models.json`.
//!
//! 只写 `models.json` 里的 `providers.icodeeasy` 条目；Pi 的默认
//! provider/model 选择住在 `settings.json`，尊重用户，这里刻意不碰。

use serde_json::{json, Value};

use super::{
    insert_pi_provider, provider_base_url, read_pi_native_provider, replace_pi_provider_if_present,
};
use crate::error::AppError;

/// ICodeEasy 中转在 Pi `models.json` 里的 provider key 与显示名。
/// 端点不再硬编码：写入时由调用方经 `icodeeasy_endpoints` 按当前选定接入点派生。
pub(crate) const PI_RELAY_PROVIDER_KEY: &str = "icodeeasy";
pub(crate) const PI_RELAY_PROVIDER_NAME: &str = "ICodeEasy";
/// 与 Codex/OpenCode 套件同一网关模型；Pi 走 Responses 协议（`openai-responses`），
/// 模型元数据与 `piModelCatalog.ts` 的 `openai/gpt-5.6-sol` 条目保持一致。
pub(crate) const PI_RELAY_MODEL_ID: &str = "gpt-5.6-sol";
pub(crate) const PI_RELAY_MODEL_NAME: &str = "GPT-5.6 Sol";
pub(crate) const PI_RELAY_MODEL_CONTEXT: u64 = 272_000;
pub(crate) const PI_RELAY_MODEL_MAX_TOKENS: u64 = 128_000;

fn icodeeasy_model_definition() -> Value {
    json!({
        "id": PI_RELAY_MODEL_ID,
        "name": PI_RELAY_MODEL_NAME,
        "reasoning": true,
        "input": ["text", "image"],
        "contextWindow": PI_RELAY_MODEL_CONTEXT,
        "maxTokens": PI_RELAY_MODEL_MAX_TOKENS,
    })
}

/// Build the canonical ICodeEasy provider entry. 用户在条目下自加的其它模型
/// 保留；默认模型条目每次重写回 canonical 形状，保证重新配置后恢复可用。
fn icodeeasy_provider_entry(
    existing: Option<&Value>,
    api_key: &str,
    relay_base_url: &str,
) -> Value {
    let mut models: Vec<Value> = existing
        .and_then(|entry| entry.get("models"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    models.retain(|model| model.get("id").and_then(Value::as_str) != Some(PI_RELAY_MODEL_ID));
    models.insert(0, icodeeasy_model_definition());

    json!({
        "name": PI_RELAY_PROVIDER_NAME,
        "baseUrl": relay_base_url,
        "api": "openai-responses",
        "apiKey": api_key,
        "models": models,
    })
}

/// Upsert the ICodeEasy relay entry into Pi's `models.json`：已存在则整条目
/// 替换（保留用户自加模型），不存在则插入；同值重写是无写 no-op。
pub(crate) fn write_pi_icodeeasy_relay(
    api_key: &str,
    relay_base_url: &str,
) -> Result<(), AppError> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::localized(
            "pi_relay_key_required",
            "请先填写 ICodeEasy API Key",
            "Enter the ICodeEasy API key first",
        ));
    }

    let existing = read_pi_native_provider(PI_RELAY_PROVIDER_KEY)?;
    let entry = icodeeasy_provider_entry(existing.as_ref(), api_key, relay_base_url);
    if existing.is_some() {
        replace_pi_provider_if_present(PI_RELAY_PROVIDER_KEY, &entry)?;
    } else {
        insert_pi_provider(PI_RELAY_PROVIDER_KEY, &entry)?;
    }
    Ok(())
}

/// Whether `models.json` already has the ICodeEasy entry pointing at the relay
/// with a non-empty key. 默认模型选择尊重用户，不参与 configured 判定。
pub(crate) fn pi_relay_configured() -> Result<bool, AppError> {
    let Some(entry) = read_pi_native_provider(PI_RELAY_PROVIDER_KEY)? else {
        return Ok(false);
    };
    let base_url_matches = provider_base_url(&entry)
        .map(|url| crate::icodeeasy_endpoints::is_known_relay_base_url(&url))
        .unwrap_or(false);
    let has_key = entry
        .get("apiKey")
        .and_then(Value::as_str)
        .is_some_and(|key| !key.trim().is_empty());
    Ok(base_url_matches && has_key)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pi_config::test_support::TestAgentDir;
    use crate::pi_config::{get_pi_models_path, read_pi_native_providers};
    use serial_test::serial;

    /// 主站接入点的中转 base_url：写入调用点统一传这个（生产端点由
    /// `icodeeasy_endpoints` 派生，测试里钉住字面值）。
    const PRIMARY_RELAY_BASE_URL: &str = "https://api.icodeeasy.cc/v1";

    fn relay_entry() -> Value {
        read_pi_native_provider(PI_RELAY_PROVIDER_KEY)
            .expect("read relay provider")
            .expect("relay provider present")
    }

    /// Seed/replace the icodeeasy entry with a custom shape (bypassing the
    /// relay writer) to drive the configured-detection matrix.
    fn seed_entry(entry: Value) {
        if read_pi_native_provider(PI_RELAY_PROVIDER_KEY)
            .expect("read relay provider")
            .is_some()
        {
            replace_pi_provider_if_present(PI_RELAY_PROVIDER_KEY, &entry).expect("replace entry");
        } else {
            insert_pi_provider(PI_RELAY_PROVIDER_KEY, &entry).expect("insert entry");
        }
    }

    fn custom_entry(base_url: Option<&str>, api_key: Option<&str>) -> Value {
        let mut entry = json!({
            "name": "ICodeEasy",
            "api": "openai-responses",
            "models": [{"id": PI_RELAY_MODEL_ID}],
        });
        if let Some(base_url) = base_url {
            entry["baseUrl"] = json!(base_url);
        }
        if let Some(api_key) = api_key {
            entry["apiKey"] = json!(api_key);
        }
        entry
    }

    #[test]
    #[serial]
    fn write_relay_into_missing_models_file_creates_canonical_entry() {
        let _agent = TestAgentDir::new();
        write_pi_icodeeasy_relay("sk-test-key", PRIMARY_RELAY_BASE_URL).expect("write relay");

        let entry = relay_entry();
        assert_eq!(entry["name"], PI_RELAY_PROVIDER_NAME);
        assert_eq!(entry["baseUrl"], PRIMARY_RELAY_BASE_URL);
        assert_eq!(entry["api"], "openai-responses");
        assert_eq!(entry["apiKey"], "sk-test-key");

        let models = entry["models"].as_array().expect("models array");
        assert_eq!(models.len(), 1);
        let model = &models[0];
        assert_eq!(model["id"], PI_RELAY_MODEL_ID);
        assert_eq!(model["name"], PI_RELAY_MODEL_NAME);
        assert_eq!(model["reasoning"], json!(true));
        assert_eq!(model["input"], json!(["text", "image"]));
        assert_eq!(model["contextWindow"], json!(PI_RELAY_MODEL_CONTEXT));
        assert_eq!(model["maxTokens"], json!(PI_RELAY_MODEL_MAX_TOKENS));

        assert!(pi_relay_configured().expect("configured check"));
    }

    #[test]
    #[serial]
    fn rewriting_with_same_key_is_a_no_op() {
        let _agent = TestAgentDir::new();
        write_pi_icodeeasy_relay("sk-test-key", PRIMARY_RELAY_BASE_URL).expect("write relay");
        let path = get_pi_models_path().expect("models path");
        let before = std::fs::read(&path).expect("read models file");

        write_pi_icodeeasy_relay("sk-test-key", PRIMARY_RELAY_BASE_URL)
            .expect("idempotent rewrite");

        let after = std::fs::read(&path).expect("read models file");
        assert_eq!(before, after, "identical rewrite must not touch the file");
    }

    #[test]
    #[serial]
    fn rewriting_with_new_key_replaces_entry() {
        let _agent = TestAgentDir::new();
        write_pi_icodeeasy_relay("sk-old-key", PRIMARY_RELAY_BASE_URL).expect("write relay");
        write_pi_icodeeasy_relay("sk-new-key", PRIMARY_RELAY_BASE_URL).expect("rewrite relay");

        assert_eq!(relay_entry()["apiKey"], "sk-new-key");
        assert!(pi_relay_configured().expect("configured check"));
    }

    #[test]
    #[serial]
    fn rewrite_preserves_other_providers_and_user_added_models() {
        let _agent = TestAgentDir::new();
        insert_pi_provider(
            "other-provider",
            &json!({
                "name": "Other",
                "baseUrl": "https://example.com/v1",
                "api": "openai-completions",
                "apiKey": "other-key",
                "models": [{"id": "other-model"}],
            }),
        )
        .expect("seed other provider");
        insert_pi_provider(
            PI_RELAY_PROVIDER_KEY,
            &json!({
                "name": PI_RELAY_PROVIDER_NAME,
                "baseUrl": PRIMARY_RELAY_BASE_URL,
                "api": "openai-responses",
                "apiKey": "sk-old-key",
                "models": [
                    {"id": PI_RELAY_MODEL_ID, "name": "Tampered"},
                    {"id": "user-model", "name": "User Added", "contextWindow": 8192},
                ],
            }),
        )
        .expect("seed relay provider");

        write_pi_icodeeasy_relay("sk-new-key", PRIMARY_RELAY_BASE_URL).expect("rewrite relay");

        let providers = read_pi_native_providers().expect("read providers");
        assert_eq!(providers["other-provider"]["apiKey"], "other-key");

        let entry = &providers[PI_RELAY_PROVIDER_KEY];
        assert_eq!(entry["apiKey"], "sk-new-key");
        let models = entry["models"].as_array().expect("models array");
        assert_eq!(models.len(), 2);
        // 默认模型条目重写回 canonical 形状
        assert_eq!(models[0], icodeeasy_model_definition());
        // 用户自加的模型保留
        assert_eq!(models[1]["id"], "user-model");
        assert_eq!(models[1]["name"], "User Added");
        assert!(pi_relay_configured().expect("configured check"));
    }

    #[test]
    #[serial]
    fn configured_detection_matrix() {
        let _agent = TestAgentDir::new();
        // models.json 不存在
        assert!(!pi_relay_configured().expect("no file"));

        // 端点指向别处
        seed_entry(custom_entry(
            Some("https://example.com/v1"),
            Some("sk-test-key"),
        ));
        assert!(!pi_relay_configured().expect("other endpoint"));

        // 密钥空白
        seed_entry(custom_entry(Some(PRIMARY_RELAY_BASE_URL), Some(" ")));
        assert!(!pi_relay_configured().expect("blank key"));

        // 缺 apiKey 字段
        seed_entry(custom_entry(Some(PRIMARY_RELAY_BASE_URL), None));
        assert!(!pi_relay_configured().expect("missing key"));

        // 端点带尾斜杠也算匹配
        seed_entry(custom_entry(
            Some("https://api.icodeeasy.cc/v1/"),
            Some("sk-test-key"),
        ));
        assert!(pi_relay_configured().expect("trailing slash matches"));

        // 顶层缺 baseUrl 时回落第一个模型的 baseUrl
        let mut fallback = custom_entry(None, Some("sk-test-key"));
        fallback["models"] = json!([{"id": PI_RELAY_MODEL_ID, "baseUrl": PRIMARY_RELAY_BASE_URL}]);
        seed_entry(fallback);
        assert!(pi_relay_configured().expect("model-level baseUrl fallback"));

        // 完整 canonical 条目
        seed_entry(custom_entry(
            Some(PRIMARY_RELAY_BASE_URL),
            Some("sk-test-key"),
        ));
        assert!(pi_relay_configured().expect("fully configured"));
    }

    #[test]
    #[serial]
    fn write_relay_rejects_blank_key_without_creating_entry() {
        let _agent = TestAgentDir::new();
        let error = write_pi_icodeeasy_relay("  ", PRIMARY_RELAY_BASE_URL)
            .expect_err("blank key must fail");
        assert!(matches!(error, AppError::Localized { .. }));
        assert!(read_pi_native_provider(PI_RELAY_PROVIDER_KEY)
            .expect("read relay provider")
            .is_none());
        assert!(!pi_relay_configured().expect("no entry no configure"));
    }

    #[test]
    #[serial]
    fn write_relay_with_japan_endpoint_writes_and_detects() {
        let _agent = TestAgentDir::new();
        write_pi_icodeeasy_relay("sk-test-key", "https://jp.icodeeasy.cc/v1")
            .expect("write relay via japan endpoint");

        let entry = relay_entry();
        assert_eq!(entry["baseUrl"], "https://jp.icodeeasy.cc/v1");
        assert!(pi_relay_configured().expect("configured check"));
    }
}
