use crate::config::write_json_file_with_contents;
use crate::error::AppError;
use crate::provider::OpenCodeProviderConfig;
use crate::settings::get_opencode_override_dir;
use indexmap::IndexMap;
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

const STANDARD_OMO_PLUGIN_PREFIXES: [&str; 2] = ["oh-my-openagent", "oh-my-opencode"];
const SLIM_OMO_PLUGIN_PREFIXES: [&str; 1] = ["oh-my-opencode-slim"];
fn opencode_config_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn read_config_contents(path: &Path) -> Result<Option<Vec<u8>>, AppError> {
    match std::fs::read(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(AppError::io(path, err)),
    }
}

fn matches_plugin_prefix(plugin_name: &str, prefix: &str) -> bool {
    plugin_name == prefix
        || plugin_name
            .strip_prefix(prefix)
            .map(|suffix| suffix.starts_with('@'))
            .unwrap_or(false)
}

fn matches_any_plugin_prefix(plugin_name: &str, prefixes: &[&str]) -> bool {
    prefixes
        .iter()
        .any(|prefix| matches_plugin_prefix(plugin_name, prefix))
}

fn canonicalize_plugin_name(plugin_name: &str) -> String {
    if let Some(suffix) = plugin_name.strip_prefix("oh-my-opencode") {
        if suffix.is_empty() || suffix.starts_with('@') {
            return format!("oh-my-openagent{suffix}");
        }
    }
    plugin_name.to_string()
}

pub fn get_opencode_dir() -> PathBuf {
    if let Some(override_dir) = get_opencode_override_dir() {
        return override_dir;
    }

    crate::config::get_home_dir()
        .join(".config")
        .join("opencode")
}

pub fn get_opencode_config_path() -> PathBuf {
    get_opencode_dir().join("opencode.json")
}

/// 获取 OpenCode SQLite 数据库路径
/// 优先级: OPENCODE_DB 环境变量 > XDG_DATA_HOME > ~/.local/share/opencode
pub fn get_opencode_db_path() -> PathBuf {
    // 支持 OPENCODE_DB 环境变量覆盖（忽略空字符串）
    if let Ok(custom_path) = std::env::var("OPENCODE_DB") {
        if !custom_path.is_empty() {
            let path = PathBuf::from(&custom_path);
            if path.is_absolute() {
                return path;
            }
            // 相对路径基于数据目录
            return get_opencode_data_dir().join(path);
        }
    }

    get_opencode_data_dir().join("opencode.db")
}

fn get_opencode_data_dir() -> PathBuf {
    // 尊重 XDG_DATA_HOME（按 XDG 规范，空字符串视为未设置）
    if let Ok(xdg_data) = std::env::var("XDG_DATA_HOME") {
        if !xdg_data.is_empty() {
            return PathBuf::from(xdg_data).join("opencode");
        }
    }

    // OpenCode 使用 xdg-basedir，不遵守 macOS/Windows 平台约定，
    // 所有平台默认都落在 ~/.local/share/opencode
    crate::config::get_home_dir()
        .join(".local")
        .join("share")
        .join("opencode")
}

#[allow(dead_code)]
pub fn get_opencode_env_path() -> PathBuf {
    get_opencode_dir().join(".env")
}

fn read_opencode_config_from_path(path: &Path) -> Result<Value, AppError> {
    let content = match std::fs::read_to_string(path) {
        Ok(content) => content,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            return Ok(json!({
                "$schema": "https://opencode.ai/config.json"
            }));
        }
        Err(err) => return Err(AppError::io(path, err)),
    };
    let value: Value = json5::from_str(&content).map_err(|e| {
        AppError::Config(format!(
            "Failed to parse OpenCode config: {}: {e}",
            path.display()
        ))
    })?;

    // 根节点必须是对象：下游 set_provider / set_mcp_server / add_plugin 都对它做
    // `config["key"] = …` 索引赋值，而 serde_json 只把 Null 自动升级成对象，
    // 数组或标量会直接 panic（panic 发生在 Tauri command 内、跨 FFI 展开）。
    //
    // 这里选择报错而不是重建根节点：opencode.json 里还有 model / theme 等用户自有
    // 配置，静默重建等于删掉它们。让用户自己修文件，与 read_claude_live 的做法一致。
    if !value.is_object() {
        return Err(AppError::Config(format!(
            "OpenCode 配置文件根节点必须是 JSON 对象: {}",
            path.display()
        )));
    }

    Ok(value)
}

pub fn read_opencode_config() -> Result<Value, AppError> {
    read_opencode_config_from_path(&get_opencode_config_path())
}

fn write_opencode_config_to_path_with_contents(
    path: &Path,
    config: &Value,
) -> Result<Vec<u8>, AppError> {
    let contents = write_json_file_with_contents(path, config)?;

    log::debug!("OpenCode config written to {path:?}");
    Ok(contents)
}

pub fn get_providers() -> Result<Map<String, Value>, AppError> {
    let config = read_opencode_config()?;
    Ok(config
        .get("provider")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default())
}

pub fn set_provider(id: &str, config: Value) -> Result<(), AppError> {
    let _guard = opencode_config_lock().lock()?;
    let path = get_opencode_config_path();
    let mut full_config = read_opencode_config_from_path(&path)?;

    // 判空要连「存在但不是对象」一起算：否则下面 as_object_mut 拿不到，
    // 写入会静默失效——界面显示添加成功而文件里没有。provider 段是 cc-switch
    // 的投影区，归一化不会碰用户自有的 model / theme 等顶层配置。
    if !full_config.get("provider").is_some_and(Value::is_object) {
        if full_config.get("provider").is_some() {
            log::warn!("opencode.json 的 provider 不是对象，已重置为空对象");
        }
        full_config["provider"] = json!({});
    }

    if let Some(providers) = full_config
        .get_mut("provider")
        .and_then(|v| v.as_object_mut())
    {
        providers.insert(id.to_string(), config);
    }

    write_opencode_config_to_path_with_contents(&path, &full_config).map(|_| ())
}

pub fn remove_provider(id: &str) -> Result<(), AppError> {
    let _guard = opencode_config_lock().lock()?;
    let path = get_opencode_config_path();
    let mut config = read_opencode_config_from_path(&path)?;

    if let Some(providers) = config.get_mut("provider").and_then(|v| v.as_object_mut()) {
        providers.remove(id);
    } else if config.get("provider").is_some() {
        log::warn!("opencode.json 的 provider 不是对象，无法删除供应商 '{id}'");
    }

    write_opencode_config_to_path_with_contents(&path, &config).map(|_| ())
}

pub fn get_typed_providers() -> Result<IndexMap<String, OpenCodeProviderConfig>, AppError> {
    let providers = get_providers()?;
    let mut result = IndexMap::new();

    for (id, value) in providers {
        match serde_json::from_value::<OpenCodeProviderConfig>(value.clone()) {
            Ok(config) => {
                result.insert(id, config);
            }
            Err(e) => {
                log::warn!("Failed to parse provider '{id}': {e}");
            }
        }
    }

    Ok(result)
}

pub fn set_typed_provider(id: &str, config: &OpenCodeProviderConfig) -> Result<(), AppError> {
    let value = serde_json::to_value(config).map_err(|e| AppError::JsonSerialize { source: e })?;
    set_provider(id, value)
}

pub fn get_mcp_servers() -> Result<Map<String, Value>, AppError> {
    let config = read_opencode_config()?;
    Ok(config
        .get("mcp")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default())
}

pub fn set_mcp_server(id: &str, config: Value) -> Result<(), AppError> {
    let _guard = opencode_config_lock().lock()?;
    let path = get_opencode_config_path();
    let mut full_config = read_opencode_config_from_path(&path)?;

    if !full_config.get("mcp").is_some_and(Value::is_object) {
        if full_config.get("mcp").is_some() {
            log::warn!("opencode.json 的 mcp 不是对象，已重置为空对象");
        }
        full_config["mcp"] = json!({});
    }

    if let Some(mcp) = full_config.get_mut("mcp").and_then(|v| v.as_object_mut()) {
        mcp.insert(id.to_string(), config);
    }

    write_opencode_config_to_path_with_contents(&path, &full_config).map(|_| ())
}

pub fn remove_mcp_server(id: &str) -> Result<(), AppError> {
    let _guard = opencode_config_lock().lock()?;
    let path = get_opencode_config_path();
    let mut config = read_opencode_config_from_path(&path)?;

    if let Some(mcp) = config.get_mut("mcp").and_then(|v| v.as_object_mut()) {
        mcp.remove(id);
    } else if config.get("mcp").is_some() {
        log::warn!("opencode.json 的 mcp 不是对象，无法删除服务器 '{id}'");
    }

    write_opencode_config_to_path_with_contents(&path, &config).map(|_| ())
}

pub fn add_plugin(path: &Path, plugin_name: &str) -> Result<(), AppError> {
    let _guard = opencode_config_lock().lock()?;
    let mut config = read_opencode_config_from_path(path)?;
    let normalized_plugin_name = canonicalize_plugin_name(plugin_name);
    let target_is_omo =
        matches_any_plugin_prefix(&normalized_plugin_name, &STANDARD_OMO_PLUGIN_PREFIXES)
            || matches_any_plugin_prefix(&normalized_plugin_name, &SLIM_OMO_PLUGIN_PREFIXES);
    let mut changed = false;

    let plugins = config.get_mut("plugin").and_then(|v| v.as_array_mut());

    match plugins {
        Some(arr) => {
            let mut found_target = false;
            arr.retain(|value| {
                let Some(existing_name) = value.as_str() else {
                    return true;
                };
                if existing_name == normalized_plugin_name {
                    if found_target {
                        changed = true;
                        return false;
                    }
                    found_target = true;
                    return true;
                }

                // Standard OMO and OMO Slim are mutually exclusive.
                if target_is_omo
                    && (matches_any_plugin_prefix(existing_name, &STANDARD_OMO_PLUGIN_PREFIXES)
                        || matches_any_plugin_prefix(existing_name, &SLIM_OMO_PLUGIN_PREFIXES))
                {
                    changed = true;
                    return false;
                }
                true
            });

            if !found_target {
                arr.push(Value::String(normalized_plugin_name));
                changed = true;
            }
        }
        None => {
            config["plugin"] = json!([normalized_plugin_name]);
            changed = true;
        }
    }

    if !changed {
        return Ok(());
    }

    write_opencode_config_to_path_with_contents(path, &config).map(|_| ())
}

pub fn remove_plugins_by_prefixes(path: &Path, prefixes: &[&str]) -> Result<bool, AppError> {
    let _guard = opencode_config_lock().lock()?;
    let previous_contents = read_config_contents(path)?;
    let mut config = read_opencode_config_from_path(path)?;

    let mut changed = false;
    if let Some(arr) = config.get_mut("plugin").and_then(|v| v.as_array_mut()) {
        let previous_len = arr.len();
        arr.retain(|v| {
            v.as_str()
                .map(|s| !matches_any_plugin_prefix(s, prefixes))
                .unwrap_or(true)
        });
        changed = arr.len() != previous_len;

        if changed && arr.is_empty() {
            config.as_object_mut().map(|obj| obj.remove("plugin"));
        }
    }

    if !changed {
        return Ok(false);
    }

    let current_contents = read_config_contents(path)?;
    if current_contents != previous_contents {
        return Err(AppError::Config(
            "OpenCode config changed on disk. Please reload and try again.".to_string(),
        ));
    }

    write_opencode_config_to_path_with_contents(path, &config)?;
    Ok(true)
}

/// ICodeEasy 中转在 OpenCode 配置里的 provider id 与显示名。
/// 端点不再硬编码：写入时由 `icodeeasy_endpoints` 按当前选定接入点派生。
pub const OPENCODE_RELAY_PROVIDER_ID: &str = "icodeeasy";
pub const OPENCODE_RELAY_PROVIDER_NAME: &str = "ICodeEasy";
/// 与 Codex 套件同一网关模型；high 推理档作为模型基础 options 写入（默认生效），
/// low/medium/xhigh 仍保留在 variants 里供运行时切换。模型元数据与
/// `opencodeProviderPresets.ts` 里 `@ai-sdk/openai` 的 gpt-5.6-sol 条目保持一致。
pub const OPENCODE_RELAY_MODEL: &str = "gpt-5.6-sol";
pub const OPENCODE_RELAY_MODEL_NAME: &str = "GPT-5.6 Sol";
pub const OPENCODE_RELAY_MODEL_CONTEXT: u64 = 400_000;
pub const OPENCODE_RELAY_MODEL_OUTPUT: u64 = 128_000;

/// OpenCode 走 Responses 协议（`@ai-sdk/openai`），与网关的 Codex/Grok 链路一致。
const OPENCODE_RELAY_NPM: &str = "@ai-sdk/openai";

fn relay_model_variant(effort: &str) -> Value {
    json!({
        "reasoningEffort": effort,
        "reasoningSummary": "auto",
        "textVerbosity": "medium",
    })
}

fn icodeeasy_model_definition() -> Value {
    json!({
        "name": OPENCODE_RELAY_MODEL_NAME,
        "limit": {
            "context": OPENCODE_RELAY_MODEL_CONTEXT,
            "output": OPENCODE_RELAY_MODEL_OUTPUT,
        },
        "modalities": { "input": ["text", "image"], "output": ["text"] },
        "options": relay_model_variant("high"),
        "variants": {
            "low": relay_model_variant("low"),
            "medium": relay_model_variant("medium"),
            "high": relay_model_variant("high"),
            "xhigh": relay_model_variant("xhigh"),
        },
    })
}

fn relay_base_url_matches(entry: &Value) -> bool {
    entry
        .get("options")
        .and_then(|options| options.get("baseURL"))
        .and_then(Value::as_str)
        .is_some_and(crate::icodeeasy_endpoints::is_known_relay_base_url)
}

fn relay_has_api_key(entry: &Value) -> bool {
    entry
        .get("options")
        .and_then(|options| options.get("apiKey"))
        .and_then(Value::as_str)
        .is_some_and(|key| !key.trim().is_empty())
}

/// Whether the live OpenCode config selects the ICodeEasy relay as default model.
pub fn opencode_relay_configured(config: &Value) -> bool {
    let Some(entry) = config
        .get("provider")
        .and_then(Value::as_object)
        .and_then(|providers| providers.get(OPENCODE_RELAY_PROVIDER_ID))
    else {
        return false;
    };
    let default_matches = config
        .get("model")
        .and_then(Value::as_str)
        .is_some_and(|model| {
            model == format!("{OPENCODE_RELAY_PROVIDER_ID}/{OPENCODE_RELAY_MODEL}")
        });

    relay_base_url_matches(entry) && relay_has_api_key(entry) && default_matches
}

/// Upsert the ICodeEasy relay provider into an OpenCode config document and
/// select the relay model as default. 用户在 ICodeEasy 条目下自行添加的其它
/// 模型、其余 provider 条目与顶层配置（theme / plugin / mcp 等）都会保留；
/// 默认模型条目本身每次重写回 canonical 形状，保证重新配置后能恢复可用。
pub fn apply_opencode_icodeeasy_relay(
    config: &Value,
    api_key: &str,
    relay_base_url: &str,
) -> Result<Value, AppError> {
    let mut full_config = config.clone();

    // 与 set_provider 同一归一化语义：provider 段缺失或不是对象时重置为空对象。
    if !full_config.get("provider").is_some_and(Value::is_object) {
        if full_config.get("provider").is_some() {
            log::warn!("opencode.json 的 provider 不是对象，已重置为空对象");
        }
        full_config["provider"] = json!({});
    }
    let providers = full_config["provider"]
        .as_object_mut()
        .expect("provider section normalized to object");

    let entry = providers
        .entry(OPENCODE_RELAY_PROVIDER_ID.to_string())
        .or_insert_with(|| json!({}));
    if !entry.is_object() {
        log::warn!("opencode.json 的 provider.{OPENCODE_RELAY_PROVIDER_ID} 不是对象，已重置");
        *entry = json!({});
    }

    let mut models = entry
        .get("models")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    models.insert(
        OPENCODE_RELAY_MODEL.to_string(),
        icodeeasy_model_definition(),
    );

    *entry = json!({
        "npm": OPENCODE_RELAY_NPM,
        "name": OPENCODE_RELAY_PROVIDER_NAME,
        "options": {
            "baseURL": relay_base_url,
            "apiKey": api_key,
        },
        "models": models,
    });

    full_config["model"] = Value::String(format!(
        "{OPENCODE_RELAY_PROVIDER_ID}/{OPENCODE_RELAY_MODEL}"
    ));
    Ok(full_config)
}

/// Persist the ICodeEasy OpenCode relay atomically. The file contains a secret,
/// so the config is tightened to owner read/write on Unix after writing.
pub fn write_opencode_icodeeasy_relay(api_key: &str, relay_base_url: &str) -> Result<(), AppError> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::localized(
            "opencode_relay_key_required",
            "请先填写 ICodeEasy API Key",
            "Enter the ICodeEasy API key first",
        ));
    }

    let _guard = opencode_config_lock().lock()?;
    let path = get_opencode_config_path();
    let config = read_opencode_config_from_path(&path)?;
    let updated = apply_opencode_icodeeasy_relay(&config, api_key, relay_base_url)?;
    write_opencode_config_to_path_with_contents(&path, &updated)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| AppError::io(&path, error))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestHomeGuard(Option<std::ffi::OsString>);
    impl TestHomeGuard {
        fn set(home: &std::path::Path) -> Self {
            let guard = Self(std::env::var_os("CC_SWITCH_TEST_HOME"));
            std::env::set_var("CC_SWITCH_TEST_HOME", home);
            guard
        }
    }
    impl Drop for TestHomeGuard {
        fn drop(&mut self) {
            match self.0.take() {
                Some(value) => std::env::set_var("CC_SWITCH_TEST_HOME", value),
                None => std::env::remove_var("CC_SWITCH_TEST_HOME"),
            }
        }
    }

    fn write_config(home: &std::path::Path, content: &str) {
        let dir = home.join(".config").join("opencode");
        std::fs::create_dir_all(&dir).expect("create config dir");
        std::fs::write(dir.join("opencode.json"), content).expect("write config");
    }

    #[test]
    #[serial_test::serial]
    fn read_rejects_non_object_root_instead_of_panicking_downstream() {
        let temp = tempfile::tempdir().expect("tempdir");
        let _guard = TestHomeGuard::set(temp.path());

        // 顶层数组/标量会让下游 `config["provider"] = …` 触发 serde_json panic。
        // 顶层 null 例外——serde_json 会把它自动升级成对象，本来就不炸。
        for malformed in ["[]", "[{\"a\":1}]", "42", "\"oops\""] {
            write_config(temp.path(), malformed);
            let result = read_opencode_config();
            assert!(
                result.is_err(),
                "non-object root must be rejected: {malformed}"
            );
        }

        write_config(temp.path(), "{\"model\": \"x\"}");
        assert!(
            read_opencode_config().is_ok(),
            "a normal object config must still load"
        );
    }

    #[test]
    #[serial_test::serial]
    fn set_mcp_server_normalizes_non_object_section() {
        let temp = tempfile::tempdir().expect("tempdir");
        let _guard = TestHomeGuard::set(temp.path());

        // `"mcp": []` 时旧代码的 as_object_mut 返回 None → 写入静默失效
        write_config(temp.path(), "{\"model\": \"keep-me\", \"mcp\": []}");

        set_mcp_server("echo", json!({"command": "npx"})).expect("set must succeed");

        let config = read_opencode_config().expect("reload");
        assert_eq!(
            config["mcp"]["echo"]["command"], "npx",
            "server must actually be written"
        );
        assert_eq!(
            config["model"], "keep-me",
            "unrelated user config must be preserved"
        );
    }

    #[test]
    fn apply_icodeeasy_relay_writes_provider_and_default_model() {
        let config = json!({ "$schema": "https://opencode.ai/config.json" });
        let updated =
            apply_opencode_icodeeasy_relay(&config, "sk-test-key", "https://api.icodeeasy.cc/v1")
                .expect("apply relay");

        let entry = &updated["provider"][OPENCODE_RELAY_PROVIDER_ID];
        assert_eq!(entry["npm"], "@ai-sdk/openai");
        assert_eq!(entry["name"], OPENCODE_RELAY_PROVIDER_NAME);
        assert_eq!(entry["options"]["baseURL"], "https://api.icodeeasy.cc/v1");
        assert_eq!(entry["options"]["apiKey"], "sk-test-key");

        let model = &entry["models"][OPENCODE_RELAY_MODEL];
        assert_eq!(model["name"], OPENCODE_RELAY_MODEL_NAME);
        assert_eq!(
            model["limit"]["context"].as_u64(),
            Some(OPENCODE_RELAY_MODEL_CONTEXT)
        );
        // 默认 high 档落在模型基础 options 上，variants 里保留全部档位
        assert_eq!(model["options"]["reasoningEffort"], "high");
        assert_eq!(model["variants"]["xhigh"]["reasoningEffort"], "xhigh");

        assert_eq!(updated["model"], "icodeeasy/gpt-5.6-sol");
        assert!(opencode_relay_configured(&updated));
    }

    #[test]
    fn apply_icodeeasy_relay_preserves_user_config_and_extra_models() {
        let config = json!({
            "theme": "opencode",
            "model": "other/some-model",
            "provider": {
                "other": {
                    "npm": "@ai-sdk/anthropic",
                    "options": { "baseURL": "https://example.com", "apiKey": "other-key" },
                    "models": {},
                },
                OPENCODE_RELAY_PROVIDER_ID: {
                    "npm": "@ai-sdk/openai",
                    "name": "ICodeEasy",
                    "options": { "baseURL": "https://api.icodeeasy.cc/v1", "apiKey": "old-key" },
                    "models": { "gpt-5.6-sol-mini": { "name": "User Added" } },
                },
            },
        });

        let updated =
            apply_opencode_icodeeasy_relay(&config, "sk-new-key", "https://api.icodeeasy.cc/v1")
                .expect("apply relay");

        assert_eq!(updated["theme"], "opencode");
        assert_eq!(
            updated["provider"]["other"]["options"]["apiKey"],
            "other-key"
        );
        let entry = &updated["provider"][OPENCODE_RELAY_PROVIDER_ID];
        // 刷新密钥，同时保留用户自行添加的模型条目
        assert_eq!(entry["options"]["apiKey"], "sk-new-key");
        assert_eq!(entry["models"]["gpt-5.6-sol-mini"]["name"], "User Added");
        assert!(opencode_relay_configured(&updated));
    }

    #[test]
    fn relay_detection_requires_base_url_key_and_default_selection() {
        assert!(!opencode_relay_configured(&json!({})));

        let configured = apply_opencode_icodeeasy_relay(
            &json!({}),
            "sk-test-key",
            "https://api.icodeeasy.cc/v1",
        )
        .expect("relay config");

        // 缺默认模型选择
        let mut no_default = configured.clone();
        no_default["model"] = json!("other/model");
        assert!(!opencode_relay_configured(&no_default));

        // 密钥为空
        let mut no_key = configured.clone();
        no_key["provider"][OPENCODE_RELAY_PROVIDER_ID]["options"]["apiKey"] = json!(" ");
        assert!(!opencode_relay_configured(&no_key));

        // 端点指向别处
        let mut other_endpoint = configured.clone();
        other_endpoint["provider"][OPENCODE_RELAY_PROVIDER_ID]["options"]["baseURL"] =
            json!("https://example.com/v1");
        assert!(!opencode_relay_configured(&other_endpoint));
    }

    #[test]
    fn relay_follows_selected_endpoint() {
        let updated =
            apply_opencode_icodeeasy_relay(&json!({}), "sk-jp-key", "https://jp.icodeeasy.cc/v1")
                .expect("apply with jp endpoint");

        let entry = &updated["provider"][OPENCODE_RELAY_PROVIDER_ID];
        assert_eq!(entry["options"]["baseURL"], "https://jp.icodeeasy.cc/v1");
        assert_eq!(entry["options"]["apiKey"], "sk-jp-key");
        assert!(opencode_relay_configured(&updated));
    }

    #[test]
    #[serial_test::serial]
    fn write_icodeeasy_relay_rejects_empty_key_and_persists() {
        let temp = tempfile::tempdir().expect("tempdir");
        let _guard = TestHomeGuard::set(temp.path());

        assert!(write_opencode_icodeeasy_relay("  ", "https://api.icodeeasy.cc/v1").is_err());

        write_opencode_icodeeasy_relay("sk-test-key", "https://api.icodeeasy.cc/v1")
            .expect("write relay");
        let config = read_opencode_config().expect("reload");
        assert!(opencode_relay_configured(&config));

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(get_opencode_config_path())
                .expect("metadata")
                .permissions()
                .mode();
            assert_eq!(mode & 0o777, 0o600, "config contains a secret");
        }
    }

    #[test]
    fn remove_missing_plugin_does_not_create_config_file() {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("opencode.json");

        let result = remove_plugins_by_prefixes(&path, &["oh-my-openagent"]).unwrap();

        assert!(!result);
        assert!(!path.exists());
    }

    #[test]
    fn remove_missing_plugin_preserves_existing_source() {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("opencode.json");
        let original = r#"{
  // Keep formatting when the target plugin is absent.
  "plugin": ["unrelated-plugin"],
  "theme": "dark",
}"#;
        std::fs::write(&path, original).unwrap();

        let result = remove_plugins_by_prefixes(&path, &["oh-my-openagent"]).unwrap();

        assert!(!result);
        assert_eq!(std::fs::read_to_string(&path).unwrap(), original);
    }

    #[test]
    fn add_existing_plugin_preserves_existing_source() {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("opencode.json");
        let original = r#"{
  // Keep comments and formatting when the plugin is already configured.
  plugin: ['oh-my-openagent@latest'],
  theme: 'dark',
}"#;
        std::fs::write(&path, original).unwrap();

        add_plugin(&path, "oh-my-openagent@latest").unwrap();

        assert_eq!(std::fs::read_to_string(&path).unwrap(), original);
    }
}
