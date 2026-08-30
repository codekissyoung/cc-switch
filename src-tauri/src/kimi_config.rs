//! Kimi Code CLI 的 ICodeEasy 中转配置读写（`~/.kimi-code/config.toml`）。
//!
//! Kimi Code 不在 AppType 供应商切换链路里（那一套牵动 provider 全链路/数据库/
//! deeplink）。这里用 toml_edit 做文档级 upsert：只覆盖 ICodeEasy 托管的 provider
//! 与两个模型条目，保留用户的 OAuth、其他 provider、注释等既有内容。

use std::path::PathBuf;

use toml_edit::{DocumentMut, Item, Table};

use crate::config::{get_home_dir, write_text_file};
use crate::error::AppError;

/// ICodeEasy 中转在 Kimi Code 配置里的 provider 名。
/// 端点不再硬编码：写入时由 `icodeeasy_endpoints` 按当前选定接入点派生。
pub const KIMI_RELAY_PROVIDER_KEY: &str = "icodeeasy";
/// 配置中转后写入的默认模型（256K 变体；1M 的 `kimi-k3` 条目一并写入，供 `/model` 切换）。
pub const KIMI_RELAY_DEFAULT_MODEL: &str = "icodeeasy/k3-256k";

/// Kimi Code 的数据目录：`$KIMI_CODE_HOME`（非空时）或 `~/.kimi-code`。
pub fn get_kimi_config_dir() -> PathBuf {
    if let Some(custom) = std::env::var_os("KIMI_CODE_HOME") {
        if !custom.is_empty() {
            return PathBuf::from(custom);
        }
    }
    get_home_dir().join(".kimi-code")
}

pub fn get_kimi_config_path() -> PathBuf {
    get_kimi_config_dir().join("config.toml")
}

/// 读取现有配置文本；文件不存在时视为空（首次配置场景）。
pub fn read_kimi_config_text() -> Result<String, AppError> {
    let path = get_kimi_config_path();
    if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| AppError::io(&path, e))
    } else {
        Ok(String::new())
    }
}

/// 中转是否已配置：`providers.icodeeasy` 指向 ICodeEasy 端点且 api_key 非空。
pub fn kimi_relay_configured(config_text: &str) -> bool {
    let Ok(doc) = config_text.parse::<DocumentMut>() else {
        return false;
    };
    let Some(provider) = doc
        .get("providers")
        .and_then(|item| item.as_table_like())
        .and_then(|table| table.get(KIMI_RELAY_PROVIDER_KEY))
    else {
        return false;
    };
    let base_url_matches = provider
        .as_table_like()
        .and_then(|table| table.get("base_url"))
        .and_then(|item| item.as_str())
        .map(crate::icodeeasy_endpoints::is_known_relay_base_url)
        .unwrap_or(false);
    let has_key = provider
        .as_table_like()
        .and_then(|table| table.get("api_key"))
        .and_then(|item| item.as_str())
        .map(|key| !key.trim().is_empty())
        .unwrap_or(false);
    base_url_matches && has_key
}

/// ICodeEasy 托管的模型条目（alias 形如 `icodeeasy/k3-256k`）。
fn kimi_relay_model_table(model: &str, max_context_size: i64, display_name: &str) -> Table {
    let mut table = Table::new();
    table["provider"] = toml_edit::value(KIMI_RELAY_PROVIDER_KEY);
    table["model"] = toml_edit::value(model);
    table["max_context_size"] = toml_edit::value(max_context_size);
    let mut capabilities = toml_edit::Array::new();
    for capability in [
        "thinking",
        "always_thinking",
        "image_in",
        "video_in",
        "tool_use",
    ] {
        capabilities.push(capability);
    }
    table["capabilities"] = toml_edit::value(capabilities);
    table["display_name"] = toml_edit::value(display_name);
    let mut efforts = toml_edit::Array::new();
    efforts.push("max");
    table["support_efforts"] = toml_edit::value(efforts);
    table["default_effort"] = toml_edit::value("max");
    table
}

/// 取 `doc[key]` 的 table-like 可变引用；缺失（或类型不对）时先补一张空表。
/// 不能用 `doc["a"]["b"] = ...` 链式索引：父键缺失时 toml_edit 会落成内联空表
/// `{}`，子表赋值被静默丢掉。
fn ensure_table_like<'a>(doc: &'a mut DocumentMut, key: &str) -> &'a mut dyn toml_edit::TableLike {
    let needs_create = doc
        .get(key)
        .map(|item| item.as_table_like().is_none())
        .unwrap_or(true);
    if needs_create {
        doc[key] = Item::Table(Table::new());
    }
    doc[key]
        .as_table_like_mut()
        .expect("ensured table-like entry")
}

/// 在既有配置文本上 upsert ICodeEasy 中转，返回新的配置文本。
///
/// 覆盖范围：`default_model`、`providers.icodeeasy`、`models."icodeeasy/*"` 两个条目；
/// 其余内容（OAuth 引用的官方 provider、用户自建 provider/模型、注释）原样保留。
pub fn apply_kimi_relay_config(
    config_text: &str,
    api_key: &str,
    relay_base_url: &str,
) -> Result<String, AppError> {
    let mut doc = if config_text.trim().is_empty() {
        DocumentMut::new()
    } else {
        config_text
            .parse::<DocumentMut>()
            .map_err(|e| AppError::Message(format!("Invalid Kimi Code config.toml: {e}")))?
    };

    doc["default_model"] = toml_edit::value(KIMI_RELAY_DEFAULT_MODEL);

    let mut provider = Table::new();
    provider["type"] = toml_edit::value("kimi");
    provider["base_url"] = toml_edit::value(relay_base_url);
    provider["api_key"] = toml_edit::value(api_key);
    ensure_table_like(&mut doc, "providers").insert(KIMI_RELAY_PROVIDER_KEY, Item::Table(provider));

    let models = ensure_table_like(&mut doc, "models");
    models.insert(
        "icodeeasy/k3-256k",
        Item::Table(kimi_relay_model_table(
            "k3-256k",
            262_144,
            "Kimi K3 256K (I Code Easy)",
        )),
    );
    models.insert(
        "icodeeasy/k3",
        Item::Table(kimi_relay_model_table(
            "kimi-k3",
            1_048_576,
            "Kimi K3 1M (I Code Easy)",
        )),
    );

    Ok(doc.to_string())
}

/// 把 ICodeEasy 中转写入 `~/.kimi-code/config.toml`。`write_text_file` 走
/// 临时文件 + rename 的原子写，失败不会留下半写状态，无需额外回滚。
pub fn write_kimi_icodeeasy_relay(api_key: &str, relay_base_url: &str) -> Result<(), AppError> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::localized(
            "kimi_relay_key_required",
            "请先填写 ICodeEasy API Key",
            "Enter the ICodeEasy API key first",
        ));
    }

    let path = get_kimi_config_path();
    let old_text = read_kimi_config_text()?;
    let new_text = apply_kimi_relay_config(&old_text, api_key, relay_base_url)?;
    write_text_file(&path, &new_text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_relay_writes_provider_models_and_default_model() {
        let text = apply_kimi_relay_config("", "sk-test-key", "https://api.icodeeasy.cc/v1")
            .expect("apply on empty config");
        let doc = text.parse::<DocumentMut>().expect("valid TOML output");

        assert_eq!(doc["default_model"].as_str(), Some("icodeeasy/k3-256k"));
        let provider = &doc["providers"]["icodeeasy"];
        assert_eq!(provider["type"].as_str(), Some("kimi"));
        assert_eq!(
            provider["base_url"].as_str(),
            Some("https://api.icodeeasy.cc/v1")
        );
        assert_eq!(provider["api_key"].as_str(), Some("sk-test-key"));

        let small = &doc["models"]["icodeeasy/k3-256k"];
        assert_eq!(small["model"].as_str(), Some("k3-256k"));
        assert_eq!(small["max_context_size"].as_integer(), Some(262_144));
        let large = &doc["models"]["icodeeasy/k3"];
        assert_eq!(large["model"].as_str(), Some("kimi-k3"));
        assert_eq!(large["max_context_size"].as_integer(), Some(1_048_576));

        assert!(kimi_relay_configured(&text));
    }

    #[test]
    fn apply_relay_preserves_oauth_and_other_providers() {
        let existing = r#"
default_model = "kimi-code/k3"

[providers."managed:kimi-code"]
type = "kimi"
base_url = "https://api.kimi.com/coding/v1"

[providers."managed:kimi-code".oauth]
storage = "file"
key = "oauth/kimi-code"

[providers.my-openai]
type = "openai"
base_url = "https://example.com/v1"
api_key = "user-own-key"

[models."kimi-code/k3"]
provider = "managed:kimi-code"
model = "k3"
max_context_size = 1048576
"#;
        let text = apply_kimi_relay_config(existing, "sk-new", "https://api.icodeeasy.cc/v1")
            .expect("apply on existing config");
        let doc = text.parse::<DocumentMut>().expect("valid TOML output");

        // 官方 OAuth provider 与用户自建 provider 原样保留
        assert_eq!(
            doc["providers"]["managed:kimi-code"]["oauth"]["key"].as_str(),
            Some("oauth/kimi-code")
        );
        assert_eq!(
            doc["providers"]["my-openai"]["api_key"].as_str(),
            Some("user-own-key")
        );
        assert_eq!(doc["models"]["kimi-code/k3"]["model"].as_str(), Some("k3"));
        // 默认模型切到 ICodeEasy
        assert_eq!(doc["default_model"].as_str(), Some("icodeeasy/k3-256k"));
    }

    #[test]
    fn apply_relay_replaces_stale_icodeeasy_key() {
        let existing = r#"
[providers.icodeeasy]
type = "kimi"
base_url = "https://api.icodeeasy.cc/v1"
api_key = "sk-old"
"#;
        let text = apply_kimi_relay_config(existing, "sk-new", "https://api.icodeeasy.cc/v1")
            .expect("re-apply");
        let doc = text.parse::<DocumentMut>().expect("valid TOML output");
        assert_eq!(
            doc["providers"]["icodeeasy"]["api_key"].as_str(),
            Some("sk-new")
        );
        assert!(kimi_relay_configured(&text));
    }

    #[test]
    fn relay_follows_selected_endpoint() {
        let text = apply_kimi_relay_config("", "sk-k", "https://jp.icodeeasy.cc/v1")
            .expect("apply with jp endpoint");
        let doc = text.parse::<DocumentMut>().expect("valid TOML");
        assert_eq!(
            doc["providers"]["icodeeasy"]["base_url"].as_str(),
            Some("https://jp.icodeeasy.cc/v1")
        );
        assert!(kimi_relay_configured(&text));
    }

    #[test]
    fn relay_configured_requires_base_url_and_key() {
        assert!(!kimi_relay_configured(""));
        assert!(!kimi_relay_configured("not = [valid"));
        assert!(!kimi_relay_configured(
            r#"[providers.icodeeasy]
type = "kimi"
base_url = "https://api.icodeeasy.cc/v1"
api_key = " "
"#
        ));
        assert!(!kimi_relay_configured(
            r#"[providers.icodeeasy]
type = "kimi"
base_url = "https://example.com/v1"
api_key = "sk-x"
"#
        ));
    }

    #[test]
    fn apply_relay_rejects_invalid_existing_toml() {
        let err =
            apply_kimi_relay_config("providers = [broken", "sk-x", "https://api.icodeeasy.cc/v1")
                .expect_err("invalid TOML must not be overwritten");
        assert!(err.to_string().contains("Invalid Kimi Code config.toml"));
    }
}
