use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs;
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};

use crate::error::AppError;

/// 获取用户主目录，带回退和日志
///
/// ## Windows 注意事项
///
/// - `dirs::home_dir()` 在 Windows 上使用 `SHGetKnownFolderPath(FOLDERID_Profile)`，
///   返回的是真实用户目录（类似 `C:\\Users\\Alice`），与 v3.10.2 行为一致。
/// - 不要直接使用 `HOME` 环境变量：它可能由 Git/Cygwin/MSYS 等第三方工具注入，
///   且不一定等于用户目录，可能导致 `.cc-switch/cc-switch.db` 路径变化，从而“看起来像数据丢失”。
///
/// ## 测试隔离
///
/// 为了让 Windows CI/本地测试能稳定隔离真实用户数据，可通过 `CC_SWITCH_TEST_HOME`
/// 显式覆盖 home dir（仅用于测试/调试场景）。
pub fn get_home_dir() -> PathBuf {
    if let Ok(home) = std::env::var("CC_SWITCH_TEST_HOME") {
        let trimmed = home.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    dirs::home_dir().unwrap_or_else(|| {
        log::warn!("无法获取用户主目录，回退到当前目录");
        PathBuf::from(".")
    })
}

/// 获取 Claude Code 配置目录路径
pub fn get_claude_config_dir() -> PathBuf {
    if let Some(custom) = crate::settings::get_claude_override_dir() {
        return custom;
    }

    get_home_dir().join(".claude")
}

/// 默认 Claude MCP 配置文件路径 (~/.claude.json)
pub fn get_default_claude_mcp_path() -> PathBuf {
    get_home_dir().join(".claude.json")
}

fn normalize_path_lexically(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();

    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    normalized.push(component.as_os_str());
                }
            }
            Component::Normal(part) => normalized.push(part),
            Component::RootDir | Component::Prefix(_) => normalized.push(component.as_os_str()),
        }
    }

    normalized
}

fn comparable_path_key(path: &Path) -> String {
    let mut key = normalize_path_lexically(path).to_string_lossy().to_string();

    #[cfg(windows)]
    {
        key = key.replace('\\', "/");
    }

    while key.len() > 1 && key.ends_with('/') {
        key.pop();
    }

    #[cfg(windows)]
    {
        key.make_ascii_lowercase();
    }

    key
}

fn path_eq_lexical(left: &Path, right: &Path) -> bool {
    comparable_path_key(left) == comparable_path_key(right)
}

#[cfg(windows)]
fn derive_wsl_default_mcp_path(dir: &Path) -> Option<PathBuf> {
    use std::path::Prefix;

    let normalized = normalize_path_lexically(dir);
    let mut components = normalized.components();
    let prefix = match components.next()? {
        Component::Prefix(prefix) => prefix,
        _ => return None,
    };

    let server = match prefix.kind() {
        Prefix::UNC(server, _) | Prefix::VerbatimUNC(server, _) => server.to_string_lossy(),
        _ => return None,
    };

    if !server.eq_ignore_ascii_case("wsl$") && !server.eq_ignore_ascii_case("wsl.localhost") {
        return None;
    }

    let mut parts = Vec::new();
    for component in components {
        match component {
            Component::RootDir | Component::CurDir => {}
            Component::Normal(part) => parts.push(part.to_string_lossy().to_string()),
            Component::ParentDir | Component::Prefix(_) => return None,
        }
    }

    let is_wsl_home_default =
        parts.len() == 3 && parts[0] == "home" && !parts[1].is_empty() && parts[2] == ".claude";
    let is_wsl_root_default = parts.len() == 2 && parts[0] == "root" && parts[1] == ".claude";

    if is_wsl_home_default || is_wsl_root_default {
        return normalized
            .parent()
            .map(|parent| parent.join(".claude.json"));
    }

    None
}

fn default_mcp_path_for_config_dir(dir: &Path) -> Option<PathBuf> {
    let default_config_dir = get_home_dir().join(".claude");
    if path_eq_lexical(dir, &default_config_dir) {
        return Some(get_default_claude_mcp_path());
    }

    #[cfg(windows)]
    {
        if let Some(path) = derive_wsl_default_mcp_path(dir) {
            return Some(path);
        }
    }

    None
}

fn derive_mcp_path_from_override(dir: &Path) -> PathBuf {
    dir.join(".claude.json")
}

/// 获取 Claude MCP 配置文件路径
pub fn get_claude_mcp_path() -> PathBuf {
    if let Some(custom_dir) = crate::settings::get_claude_override_dir() {
        if let Some(path) = default_mcp_path_for_config_dir(&custom_dir) {
            return path;
        }
        return derive_mcp_path_from_override(&custom_dir);
    }
    get_default_claude_mcp_path()
}

/// 获取 Claude Code 主配置文件路径
pub fn get_claude_settings_path() -> PathBuf {
    let dir = get_claude_config_dir();
    let settings = dir.join("settings.json");
    if settings.exists() {
        return settings;
    }
    // 兼容旧版命名：若存在旧文件则继续使用
    let legacy = dir.join("claude.json");
    if legacy.exists() {
        return legacy;
    }
    // 默认新建：回落到标准文件名 settings.json（不再生成 claude.json）
    settings
}

pub const APP_CONFIG_DIR_NAME: &str = ".icodeeasy";
pub const LEGACY_APP_CONFIG_DIR_NAME: &str = ".cc-switch";

#[derive(Debug)]
pub enum AppConfigDirMigration {
    NotNeeded,
    SkippedForOverride,
    Migrated {
        from: PathBuf,
    },
    Failed {
        from: PathBuf,
        target: PathBuf,
        error: String,
    },
}

impl AppConfigDirMigration {
    pub fn migrated_from_legacy(&self) -> bool {
        matches!(self, Self::Migrated { .. })
    }
}

#[derive(Debug)]
pub struct PreparedAppConfigDir {
    pub path: PathBuf,
    pub migration: AppConfigDirMigration,
}

fn canonical_app_config_dir() -> PathBuf {
    get_home_dir().join(APP_CONFIG_DIR_NAME)
}

fn legacy_app_config_dir() -> PathBuf {
    let default_legacy_dir = get_home_dir().join(LEGACY_APP_CONFIG_DIR_NAME);

    // 兼容 v3.10.3：当 Windows 用户环境中的 `HOME` 与真实用户目录不同，
    // 该版本可能在 `HOME/.cc-switch/` 下创建了数据库。真实用户目录中没有
    // 数据库时，继续把该位置视为迁移来源，避免升级后“看起来像数据丢失”。
    #[cfg(windows)]
    {
        if !default_legacy_dir.join("cc-switch.db").exists() {
            if let Ok(home_env) = std::env::var("HOME") {
                let trimmed = home_env.trim();
                if !trimmed.is_empty() {
                    let legacy_home_dir = PathBuf::from(trimmed).join(LEGACY_APP_CONFIG_DIR_NAME);
                    if legacy_home_dir.join("cc-switch.db").exists() {
                        return legacy_home_dir;
                    }
                }
            }
        }
    }

    default_legacy_dir
}

/// 获取未应用自定义覆盖时的本地数据目录。
///
/// 正常启动会先调用 [`prepare_app_config_dir`] 完成旧目录迁移。若迁移失败，
/// 新目录不会出现，此函数会继续返回旧目录，确保数据库和本地设置不会被当成空数据。
pub fn get_default_app_config_dir() -> PathBuf {
    let current = canonical_app_config_dir();
    if current.exists() {
        return current;
    }

    let legacy = legacy_app_config_dir();
    if legacy.exists() {
        return legacy;
    }

    current
}

/// 获取应用配置目录路径（默认 `~/.icodeeasy`）。
pub fn get_app_config_dir() -> PathBuf {
    crate::app_store::get_app_config_dir_override().unwrap_or_else(get_default_app_config_dir)
}

/// 在日志、数据库和其他服务初始化前准备应用数据目录。
///
/// 迁移使用“复制到同级临时目录，再原子改名”的方式。旧 `~/.cc-switch`
/// 会保留为回退副本；任何复制或改名错误都会回退到旧目录，不会启动一个空数据库。
pub fn prepare_app_config_dir() -> PreparedAppConfigDir {
    let override_dir = crate::app_store::get_app_config_dir_override();
    prepare_app_config_dir_with_copy(
        override_dir,
        legacy_app_config_dir(),
        canonical_app_config_dir(),
        copy_directory_contents,
    )
}

fn prepare_app_config_dir_with_copy<F>(
    override_dir: Option<PathBuf>,
    legacy: PathBuf,
    current: PathBuf,
    copier: F,
) -> PreparedAppConfigDir
where
    F: FnOnce(&Path, &Path) -> io::Result<()>,
{
    if let Some(path) = override_dir {
        return PreparedAppConfigDir {
            path,
            migration: AppConfigDirMigration::SkippedForOverride,
        };
    }

    if current.exists() || !legacy.exists() {
        return PreparedAppConfigDir {
            path: current,
            migration: AppConfigDirMigration::NotNeeded,
        };
    }

    match migrate_app_config_dir_atomically(&legacy, &current, copier) {
        Ok(()) => PreparedAppConfigDir {
            path: current,
            migration: AppConfigDirMigration::Migrated { from: legacy },
        },
        Err(error) => PreparedAppConfigDir {
            path: legacy.clone(),
            migration: AppConfigDirMigration::Failed {
                from: legacy,
                target: current,
                error: error.to_string(),
            },
        },
    }
}

fn migrate_app_config_dir_atomically<F>(legacy: &Path, current: &Path, copier: F) -> io::Result<()>
where
    F: FnOnce(&Path, &Path) -> io::Result<()>,
{
    let parent = current.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("应用数据目录没有父目录: {}", current.display()),
        )
    })?;
    fs::create_dir_all(parent)?;

    let current_name = current
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(APP_CONFIG_DIR_NAME);
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();

    let mut temp_dir = None;
    for attempt in 0..100_u32 {
        let candidate = parent.join(format!(
            "{current_name}.migrating-{}-{nonce}-{attempt}",
            std::process::id()
        ));
        match fs::create_dir(&candidate) {
            Ok(()) => {
                temp_dir = Some(candidate);
                break;
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }

    let temp_dir = temp_dir.ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::AlreadyExists,
            "无法创建唯一的应用数据迁移临时目录",
        )
    })?;

    if let Err(error) = copier(legacy, &temp_dir) {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(error);
    }

    // 另一个进程若已完成迁移，保留其结果并丢弃本进程的临时副本。
    if current.exists() {
        let _ = fs::remove_dir_all(&temp_dir);
        return Ok(());
    }

    if let Err(error) = fs::rename(&temp_dir, current) {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(error);
    }

    Ok(())
}

fn copy_directory_contents(source: &Path, destination: &Path) -> io::Result<()> {
    let source_metadata = fs::symlink_metadata(source)?;
    if !source_metadata.is_dir() || source_metadata.file_type().is_symlink() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("迁移来源不是普通目录: {}", source.display()),
        ));
    }

    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        let file_type = entry.file_type()?;

        if file_type.is_dir() {
            fs::create_dir(&destination_path)?;
            copy_directory_contents(&source_path, &destination_path)?;
        } else if file_type.is_file() {
            fs::copy(&source_path, &destination_path)?;
        } else if file_type.is_symlink() {
            copy_symlink(&source_path, &destination_path)?;
        } else {
            return Err(io::Error::new(
                io::ErrorKind::Unsupported,
                format!(
                    "应用数据目录包含不支持的文件类型: {}",
                    source_path.display()
                ),
            ));
        }
    }

    fs::set_permissions(destination, source_metadata.permissions())?;
    Ok(())
}

#[cfg(unix)]
fn copy_symlink(source: &Path, destination: &Path) -> io::Result<()> {
    std::os::unix::fs::symlink(fs::read_link(source)?, destination)
}

#[cfg(windows)]
fn copy_symlink(source: &Path, destination: &Path) -> io::Result<()> {
    let target = fs::read_link(source)?;
    if source.is_dir() {
        std::os::windows::fs::symlink_dir(target, destination)
    } else {
        std::os::windows::fs::symlink_file(target, destination)
    }
}

/// 获取应用配置文件路径
pub fn get_app_config_path() -> PathBuf {
    get_app_config_dir().join("config.json")
}

/// 清理供应商名称，确保文件名安全
#[allow(dead_code)]
pub fn sanitize_provider_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            _ => c,
        })
        .collect::<String>()
        .to_lowercase()
}

/// 获取供应商配置文件路径
#[allow(dead_code)]
pub fn get_provider_config_path(provider_id: &str, provider_name: Option<&str>) -> PathBuf {
    let base_name = provider_name
        .map(sanitize_provider_name)
        .unwrap_or_else(|| sanitize_provider_name(provider_id));

    get_claude_config_dir().join(format!("settings-{base_name}.json"))
}

/// 读取 JSON 配置文件
pub fn read_json_file<T: for<'a> Deserialize<'a>>(path: &Path) -> Result<T, AppError> {
    if !path.exists() {
        return Err(AppError::Config(format!("文件不存在: {}", path.display())));
    }

    let content = fs::read_to_string(path).map_err(|e| AppError::io(path, e))?;

    serde_json::from_str(&content).map_err(|e| AppError::json(path, e))
}

/// 递归排序 JSON 对象的键（按字母顺序），确保序列化输出是确定性的
fn sort_json_keys(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut sorted_map = Map::new();
            let mut keys: Vec<_> = map.keys().collect();
            keys.sort();
            for key in keys {
                sorted_map.insert(key.clone(), sort_json_keys(&map[key]));
            }
            Value::Object(sorted_map)
        }
        Value::Array(arr) => Value::Array(arr.iter().map(sort_json_keys).collect()),
        other => other.clone(),
    }
}

/// 写入 JSON 配置文件（键按字母排序，确保确定性输出）
pub fn write_json_file<T: Serialize>(path: &Path, data: &T) -> Result<(), AppError> {
    // 确保目录存在
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::io(parent, e))?;
    }

    let value = serde_json::to_value(data).map_err(|e| AppError::JsonSerialize { source: e })?;
    let sorted_value = sort_json_keys(&value);
    let json = serde_json::to_string_pretty(&sorted_value)
        .map_err(|e| AppError::JsonSerialize { source: e })?;

    atomic_write(path, json.as_bytes())
}

/// 原子写入文本文件（用于 TOML/纯文本）
pub fn write_text_file(path: &Path, data: &str) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::io(parent, e))?;
    }
    atomic_write(path, data.as_bytes())
}

/// 原子写入：写入临时文件后 rename 替换，避免半写状态
pub fn atomic_write(path: &Path, data: &[u8]) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::io(parent, e))?;
    }

    let parent = path
        .parent()
        .ok_or_else(|| AppError::Config("无效的路径".to_string()))?;
    let mut tmp = parent.to_path_buf();
    let file_name = path
        .file_name()
        .ok_or_else(|| AppError::Config("无效的文件名".to_string()))?
        .to_string_lossy()
        .to_string();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    tmp.push(format!("{file_name}.tmp.{ts}"));

    {
        let mut f = fs::File::create(&tmp).map_err(|e| AppError::io(&tmp, e))?;
        f.write_all(data).map_err(|e| AppError::io(&tmp, e))?;
        f.flush().map_err(|e| AppError::io(&tmp, e))?;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = fs::metadata(path) {
            let perm = meta.permissions().mode();
            let _ = fs::set_permissions(&tmp, fs::Permissions::from_mode(perm));
        }
    }

    #[cfg(windows)]
    {
        // Windows 上 rename 目标存在会失败，先移除再重命名（尽量接近原子性）
        if path.exists() {
            let _ = fs::remove_file(path);
        }
        fs::rename(&tmp, path).map_err(|e| AppError::IoContext {
            context: format!("原子替换失败: {} -> {}", tmp.display(), path.display()),
            source: e,
        })?;
    }

    #[cfg(not(windows))]
    {
        fs::rename(&tmp, path).map_err(|e| AppError::IoContext {
            context: format!("原子替换失败: {} -> {}", tmp.display(), path.display()),
            source: e,
        })?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_install_uses_icodeeasy_directory() {
        let home = tempfile::tempdir().unwrap();
        let legacy = home.path().join(LEGACY_APP_CONFIG_DIR_NAME);
        let current = home.path().join(APP_CONFIG_DIR_NAME);

        let prepared = prepare_app_config_dir_with_copy(
            None,
            legacy,
            current.clone(),
            copy_directory_contents,
        );

        assert_eq!(prepared.path, current);
        assert!(matches!(
            prepared.migration,
            AppConfigDirMigration::NotNeeded
        ));
    }

    #[test]
    fn legacy_directory_is_copied_completely_and_retained() {
        let home = tempfile::tempdir().unwrap();
        let legacy = home.path().join(LEGACY_APP_CONFIG_DIR_NAME);
        let current = home.path().join(APP_CONFIG_DIR_NAME);
        fs::create_dir_all(legacy.join("backups")).unwrap();
        fs::create_dir_all(legacy.join("skills/example-skill")).unwrap();

        let fixtures = [
            ("cc-switch.db", b"database".as_slice()),
            ("cc-switch.db-wal", b"wal".as_slice()),
            ("cc-switch.db-shm", b"shm".as_slice()),
            ("settings.json", br#"{"language":"zh"}"#.as_slice()),
            ("config.json", br#"{"version":2}"#.as_slice()),
            ("backups/snapshot.db", b"backup".as_slice()),
            ("skills/example-skill/SKILL.md", b"# Example".as_slice()),
        ];
        for (relative, contents) in fixtures {
            fs::write(legacy.join(relative), contents).unwrap();
        }

        let prepared = prepare_app_config_dir_with_copy(
            None,
            legacy.clone(),
            current.clone(),
            copy_directory_contents,
        );

        assert_eq!(prepared.path, current);
        assert!(matches!(
            prepared.migration,
            AppConfigDirMigration::Migrated { .. }
        ));
        assert!(legacy.exists(), "legacy rollback copy must be retained");
        for (relative, contents) in fixtures {
            assert_eq!(fs::read(current.join(relative)).unwrap(), contents);
            assert_eq!(fs::read(legacy.join(relative)).unwrap(), contents);
        }
    }

    #[test]
    fn existing_icodeeasy_directory_is_never_merged_or_overwritten() {
        let home = tempfile::tempdir().unwrap();
        let legacy = home.path().join(LEGACY_APP_CONFIG_DIR_NAME);
        let current = home.path().join(APP_CONFIG_DIR_NAME);
        fs::create_dir_all(&legacy).unwrap();
        fs::create_dir_all(&current).unwrap();
        fs::write(legacy.join("legacy-only"), b"legacy").unwrap();
        fs::write(current.join("current-only"), b"current").unwrap();

        let prepared = prepare_app_config_dir_with_copy(
            None,
            legacy,
            current.clone(),
            copy_directory_contents,
        );

        assert_eq!(prepared.path, current);
        assert!(matches!(
            prepared.migration,
            AppConfigDirMigration::NotNeeded
        ));
        assert_eq!(fs::read(current.join("current-only")).unwrap(), b"current");
        assert!(!current.join("legacy-only").exists());
    }

    #[test]
    fn explicit_override_skips_default_directory_migration() {
        let home = tempfile::tempdir().unwrap();
        let legacy = home.path().join(LEGACY_APP_CONFIG_DIR_NAME);
        let current = home.path().join(APP_CONFIG_DIR_NAME);
        let custom = home.path().join("custom-data");
        fs::create_dir_all(&legacy).unwrap();
        fs::create_dir_all(&custom).unwrap();

        let prepared = prepare_app_config_dir_with_copy(
            Some(custom.clone()),
            legacy,
            current.clone(),
            copy_directory_contents,
        );

        assert_eq!(prepared.path, custom);
        assert!(matches!(
            prepared.migration,
            AppConfigDirMigration::SkippedForOverride
        ));
        assert!(!current.exists());
    }

    #[test]
    fn directory_migration_is_idempotent() {
        let home = tempfile::tempdir().unwrap();
        let legacy = home.path().join(LEGACY_APP_CONFIG_DIR_NAME);
        let current = home.path().join(APP_CONFIG_DIR_NAME);
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("cc-switch.db"), b"original").unwrap();

        let first = prepare_app_config_dir_with_copy(
            None,
            legacy.clone(),
            current.clone(),
            copy_directory_contents,
        );
        assert!(first.migration.migrated_from_legacy());

        fs::write(legacy.join("legacy-after-migration"), b"do-not-merge").unwrap();
        let second = prepare_app_config_dir_with_copy(
            None,
            legacy,
            current.clone(),
            copy_directory_contents,
        );

        assert!(matches!(second.migration, AppConfigDirMigration::NotNeeded));
        assert_eq!(fs::read(current.join("cc-switch.db")).unwrap(), b"original");
        assert!(!current.join("legacy-after-migration").exists());
    }

    #[test]
    fn failed_migration_falls_back_to_legacy_without_partial_current_dir() {
        let home = tempfile::tempdir().unwrap();
        let legacy = home.path().join(LEGACY_APP_CONFIG_DIR_NAME);
        let current = home.path().join(APP_CONFIG_DIR_NAME);
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("cc-switch.db"), b"database").unwrap();

        let prepared = prepare_app_config_dir_with_copy(
            None,
            legacy.clone(),
            current.clone(),
            |_source, temporary| {
                fs::write(temporary.join("partial"), b"partial")?;
                Err(io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    "simulated copy failure",
                ))
            },
        );

        assert_eq!(prepared.path, legacy);
        assert!(matches!(
            prepared.migration,
            AppConfigDirMigration::Failed { .. }
        ));
        assert!(!current.exists());
        assert_eq!(
            fs::read(prepared.path.join("cc-switch.db")).unwrap(),
            b"database"
        );
        let leftovers = fs::read_dir(home.path())
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".icodeeasy.migrating-")
            })
            .count();
        assert_eq!(leftovers, 0);
    }

    #[cfg(unix)]
    #[test]
    fn directory_migration_preserves_symbolic_links() {
        let home = tempfile::tempdir().unwrap();
        let legacy = home.path().join(LEGACY_APP_CONFIG_DIR_NAME);
        let current = home.path().join(APP_CONFIG_DIR_NAME);
        fs::create_dir_all(legacy.join("skills/example")).unwrap();
        fs::write(legacy.join("skills/example/SKILL.md"), b"# Example").unwrap();
        std::os::unix::fs::symlink("skills/example", legacy.join("skill-link")).unwrap();

        let prepared = prepare_app_config_dir_with_copy(
            None,
            legacy,
            current.clone(),
            copy_directory_contents,
        );

        assert!(prepared.migration.migrated_from_legacy());
        assert_eq!(
            fs::read_link(current.join("skill-link")).unwrap(),
            PathBuf::from("skills/example")
        );
    }

    #[test]
    fn derive_mcp_path_from_override_uses_config_dir_for_custom_path() {
        let override_dir = PathBuf::from("/tmp/profile/.claude");
        let derived = derive_mcp_path_from_override(&override_dir);
        assert_eq!(derived, PathBuf::from("/tmp/profile/.claude/.claude.json"));
    }

    #[test]
    fn derive_mcp_path_from_override_uses_config_dir_for_non_hidden_folder() {
        let override_dir = PathBuf::from("/data/claude-config");
        let derived = derive_mcp_path_from_override(&override_dir);
        assert_eq!(derived, PathBuf::from("/data/claude-config/.claude.json"));
    }

    #[test]
    fn derive_mcp_path_from_override_supports_relative_rootless_dir() {
        let override_dir = PathBuf::from("claude");
        let derived = derive_mcp_path_from_override(&override_dir);
        assert_eq!(derived, PathBuf::from("claude/.claude.json"));
    }

    #[test]
    fn derive_mcp_path_from_root_like_dir_uses_root_file() {
        let override_dir = PathBuf::from("/");
        let derived = derive_mcp_path_from_override(&override_dir);
        assert_eq!(derived, PathBuf::from("/.claude.json"));
    }

    #[test]
    fn derive_mcp_path_from_override_preserves_leading_parent_dirs() {
        let override_dir = PathBuf::from("../../profiles/work/.claude");
        let derived = derive_mcp_path_from_override(&override_dir);
        assert_eq!(derived, override_dir.join(".claude.json"));
    }

    #[cfg(windows)]
    #[test]
    fn wsl_unc_home_default_uses_split_mcp_path() {
        let override_dir = PathBuf::from(r"\\wsl$\Ubuntu\home\travis\.claude");
        let derived = default_mcp_path_for_config_dir(&override_dir)
            .expect("WSL home default should use split MCP path");
        assert_eq!(
            derived,
            PathBuf::from(r"\\wsl$\Ubuntu\home\travis\.claude.json")
        );
    }

    #[cfg(windows)]
    #[test]
    fn wsl_unc_root_default_uses_split_mcp_path() {
        let override_dir = PathBuf::from(r"\\wsl.localhost\Ubuntu\root\.claude");
        let derived = default_mcp_path_for_config_dir(&override_dir)
            .expect("WSL root default should use split MCP path");
        assert_eq!(
            derived,
            PathBuf::from(r"\\wsl.localhost\Ubuntu\root\.claude.json")
        );
    }

    #[cfg(windows)]
    #[test]
    fn wsl_unc_custom_dir_uses_nested_mcp_path() {
        let override_dir = PathBuf::from(r"\\wsl$\Ubuntu\opt\claude\.claude");
        assert!(default_mcp_path_for_config_dir(&override_dir).is_none());
        assert_eq!(
            derive_mcp_path_from_override(&override_dir),
            PathBuf::from(r"\\wsl$\Ubuntu\opt\claude\.claude\.claude.json")
        );
    }

    #[test]
    fn sort_json_keys_sorts_top_level_object() {
        let input = serde_json::json!({
            "z": 1,
            "a": 2,
            "m": 3,
        });
        let sorted = sort_json_keys(&input);
        let serialized = serde_json::to_string(&sorted).unwrap();
        assert_eq!(serialized, r#"{"a":2,"m":3,"z":1}"#);
    }

    #[test]
    fn sort_json_keys_recurses_into_nested_objects() {
        let input = serde_json::json!({
            "outer_b": {"z": 1, "a": 2},
            "outer_a": {"y": 3, "b": 4},
        });
        let sorted = sort_json_keys(&input);
        let serialized = serde_json::to_string(&sorted).unwrap();
        assert_eq!(
            serialized,
            r#"{"outer_a":{"b":4,"y":3},"outer_b":{"a":2,"z":1}}"#
        );
    }

    #[test]
    fn sort_json_keys_preserves_array_order() {
        let input = serde_json::json!([3, 1, 2]);
        let sorted = sort_json_keys(&input);
        let serialized = serde_json::to_string(&sorted).unwrap();
        assert_eq!(serialized, "[3,1,2]");
    }

    #[test]
    fn sort_json_keys_sorts_objects_inside_arrays_but_keeps_array_order() {
        let input = serde_json::json!([
            {"z": 1, "a": 2},
            {"y": 3, "b": 4},
        ]);
        let sorted = sort_json_keys(&input);
        let serialized = serde_json::to_string(&sorted).unwrap();
        assert_eq!(serialized, r#"[{"a":2,"z":1},{"b":4,"y":3}]"#);
    }

    #[test]
    fn sort_json_keys_passes_through_primitives() {
        let cases = vec![
            serde_json::json!("hello"),
            serde_json::json!(42),
            serde_json::json!(3.5),
            serde_json::json!(true),
            serde_json::json!(null),
        ];
        for value in cases {
            let sorted = sort_json_keys(&value);
            assert_eq!(sorted, value);
        }
    }

    #[test]
    fn sort_json_keys_handles_empty_collections() {
        let empty_obj = serde_json::json!({});
        assert_eq!(
            serde_json::to_string(&sort_json_keys(&empty_obj)).unwrap(),
            "{}"
        );

        let empty_arr = serde_json::json!([]);
        assert_eq!(
            serde_json::to_string(&sort_json_keys(&empty_arr)).unwrap(),
            "[]"
        );
    }

    #[test]
    fn sort_json_keys_produces_identical_output_for_different_insertion_orders() {
        // 核心保证：同一逻辑配置无论键的插入顺序如何，写出的字节序列必须一致。
        let mut a = Map::new();
        a.insert("env".to_string(), serde_json::json!({"PATH": "/usr/bin"}));
        a.insert("model".to_string(), serde_json::json!("claude-sonnet-4-5"));
        a.insert("permissions".to_string(), serde_json::json!({"allow": []}));

        let mut b = Map::new();
        b.insert("permissions".to_string(), serde_json::json!({"allow": []}));
        b.insert("model".to_string(), serde_json::json!("claude-sonnet-4-5"));
        b.insert("env".to_string(), serde_json::json!({"PATH": "/usr/bin"}));

        let sorted_a = sort_json_keys(&Value::Object(a));
        let sorted_b = sort_json_keys(&Value::Object(b));

        assert_eq!(
            serde_json::to_string(&sorted_a).unwrap(),
            serde_json::to_string(&sorted_b).unwrap(),
        );
    }
}

/// 复制文件
pub fn copy_file(from: &Path, to: &Path) -> Result<(), AppError> {
    fs::copy(from, to).map_err(|e| AppError::IoContext {
        context: format!("复制文件失败 ({} -> {})", from.display(), to.display()),
        source: e,
    })?;
    Ok(())
}

/// 删除文件
pub fn delete_file(path: &Path) -> Result<(), AppError> {
    if path.exists() {
        fs::remove_file(path).map_err(|e| AppError::io(path, e))?;
    }
    Ok(())
}

/// 检查 Claude Code 配置状态
#[derive(Serialize, Deserialize)]
pub struct ConfigStatus {
    pub exists: bool,
    pub path: String,
}

/// 获取 Claude Code 配置状态
pub fn get_claude_config_status() -> ConfigStatus {
    let path = get_claude_settings_path();
    ConfigStatus {
        exists: path.exists(),
        path: path.to_string_lossy().to_string(),
    }
}
