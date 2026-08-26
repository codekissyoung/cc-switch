//! Git Bash（MinGit）检测与一键安装：Kimi Code CLI 在 Windows 上需要 bash
//! 作为 shell 环境，缺失时 CLI 启动即报错退出。官方给的两种解法是装
//! Git for Windows 或把 `KIMI_SHELL_PATH` 指到某个 bash.exe——这里实现后者：
//! 下载我们托管的 MinGit zip → 校验 sha256 → 解压到 `%LOCALAPPDATA%\ICodeEasy\mingit`
//! → `setx KIMI_SHELL_PATH`，全程免管理员权限。
//!
//! 托管文件是 Git for Windows 官方 release 的 MinGit 原包（GPL-2.0，来源与校验值见
//! 下载目录里的 README.txt），sha256 常量取自官方 release notes，下载后必须复核。

use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::error::AppError;

/// 托管的 MinGit 版本与下载源（ICodeEasy 官网静态目录，内容同上游 release）。
pub const MINGIT_VERSION: &str = "2.55.0.5";
const MINGIT_BASE_URL: &str = "https://icodeeasy.cc/mingit";
/// 官方 release notes 公布的 sha256，下载完成后逐项复核，防篡改与传输损坏。
const MINGIT_X64_SHA256: &str = "56d7b226b7693196cfc71fef26568f536c4a021ab6c37ff2db4287bed908e96e";
const MINGIT_ARM64_SHA256: &str =
    "05843f9d6e60306c3ab886799e2c67200caab921571f10512df3493049179ddb";

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Windows 上 Git Bash 的可用性，随 Kimi 套件状态一起返回给前端。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBashStatus {
    /// 仅 Windows 需要 Git Bash；其它平台恒为 false，前端不渲染该卡片。
    pub supported: bool,
    pub installed: bool,
    pub path: Option<String>,
    /// 命中来源：`env-override` / `icodeeasy-managed` / `git-on-path` / `well-known-location`。
    pub source: Option<&'static str>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBashInstallResult {
    pub bash_path: String,
    pub already_installed: bool,
}

/// 按 CPU 架构选择 MinGit 资产（文件名 + 官方 sha256）；不支持的架构返回 None。
fn select_mingit_asset(arch: &str) -> Option<(String, &'static str)> {
    let (suffix, sha256) = match arch {
        "x86_64" => ("64-bit", MINGIT_X64_SHA256),
        "aarch64" => ("arm64", MINGIT_ARM64_SHA256),
        _ => return None,
    };
    Some((format!("MinGit-{MINGIT_VERSION}-{suffix}.zip"), sha256))
}

/// ICodeEasy 自管理的 MinGit 安装目录（Windows 上即 `%LOCALAPPDATA%\ICodeEasy\mingit`）。
fn managed_mingit_dir() -> Option<PathBuf> {
    dirs::data_local_dir().map(|dir| dir.join("ICodeEasy").join("mingit"))
}

#[cfg(target_os = "windows")]
pub fn probe_git_bash() -> GitBashStatus {
    let (path, source) = env_override_bash_path()
        .map(|p| (p, "env-override"))
        .or_else(|| managed_bash_path().map(|p| (p, "icodeeasy-managed")))
        .or_else(|| bash_alongside_git_on_path().map(|p| (p, "git-on-path")))
        .or_else(|| well_known_bash_path().map(|p| (p, "well-known-location")))
        .unzip();

    GitBashStatus {
        supported: true,
        installed: path.is_some(),
        path: path.map(|p| p.to_string_lossy().into_owned()),
        source,
    }
}

#[cfg(not(target_os = "windows"))]
pub fn probe_git_bash() -> GitBashStatus {
    GitBashStatus {
        supported: false,
        installed: false,
        path: None,
        source: None,
    }
}

/// `KIMI_SHELL_PATH` 指向的 bash.exe（文件必须真实存在）。
///
/// 读注册表而不是进程环境变量：应用启动后用户（或我们自己的安装流程）可能刚
/// `setx` 过，进程 env 只是启动时的快照，注册表里的才是最新值。
#[cfg(target_os = "windows")]
fn env_override_bash_path() -> Option<PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    let hives = [
        (HKEY_CURRENT_USER, "Environment"),
        (
            HKEY_LOCAL_MACHINE,
            r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment",
        ),
    ];
    for (root, subkey) in hives {
        if let Ok(env) = RegKey::predef(root).open_subkey(subkey) {
            if let Ok(value) = env.get_value::<String, _>("KIMI_SHELL_PATH") {
                let path = PathBuf::from(value.trim());
                if path.is_file() {
                    return Some(path);
                }
            }
        }
    }
    // 进程 env 兜底（例如从已设置该变量的终端里启动应用的场景）。
    if let Some(value) = std::env::var_os("KIMI_SHELL_PATH") {
        let path = PathBuf::from(value);
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

/// 我们自管理安装落点下的 bash.exe。
#[cfg(target_os = "windows")]
fn managed_bash_path() -> Option<PathBuf> {
    let path = managed_mingit_dir()?.join("bin").join("bash.exe");
    path.is_file().then_some(path)
}

/// PATH 上的每个 git.exe → 同发行版里的 bash.exe。
/// Git for Windows 布局：`<root>/cmd/git.exe` 对应 `<root>/bin/bash.exe`。
/// Scoop shim 之类解析不到就跳过，交给后续候选与安装流程兜底。
#[cfg(target_os = "windows")]
fn bash_alongside_git_on_path() -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        if !dir.join("git.exe").is_file() {
            continue;
        }
        if let Some(candidate) = dir.parent().map(|root| root.join("bin").join("bash.exe")) {
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

/// Git for Windows 的两个默认安装位置（机器级 / 用户级）。
#[cfg(target_os = "windows")]
fn well_known_bash_path() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        candidates.push(
            PathBuf::from(program_files)
                .join("Git")
                .join("bin")
                .join("bash.exe"),
        );
    }
    if let Some(local) = dirs::data_local_dir() {
        candidates.push(
            local
                .join("Programs")
                .join("Git")
                .join("bin")
                .join("bash.exe"),
        );
    }
    candidates.into_iter().find(|path| path.is_file())
}

/// 一键安装入口：已装过（无论来源）直接幂等返回，否则下载托管 MinGit 并落盘。
pub async fn install_managed_git_bash() -> Result<GitBashInstallResult, AppError> {
    if !cfg!(target_os = "windows") {
        return Err(AppError::localized(
            "git_bash_only_windows",
            "只有 Windows 上的 Kimi Code CLI 需要 Git Bash",
            "Git Bash is only required by Kimi Code CLI on Windows",
        ));
    }

    let status = probe_git_bash();
    if status.installed {
        return Ok(GitBashInstallResult {
            bash_path: status.path.unwrap_or_default(),
            already_installed: true,
        });
    }

    let (asset, expected_sha256) =
        select_mingit_asset(std::env::consts::ARCH).ok_or_else(|| {
            AppError::localized(
                "git_bash_unsupported_arch",
                format!(
                    "当前 CPU 架构（{}）没有可用的 MinGit 包",
                    std::env::consts::ARCH
                ),
                format!(
                    "No MinGit package is available for CPU architecture {}",
                    std::env::consts::ARCH
                ),
            )
        })?;
    let target_dir = managed_mingit_dir().ok_or_else(|| {
        AppError::localized(
            "git_bash_no_localappdata",
            "无法定位用户数据目录（%LOCALAPPDATA%）",
            "Cannot locate the per-user data directory (%LOCALAPPDATA%)",
        )
    })?;

    let staging =
        tempfile::tempdir().map_err(|e| AppError::Message(format!("创建临时目录失败: {e}")))?;
    let zip_path = staging.path().join(&asset);
    let url = format!("{MINGIT_BASE_URL}/{asset}");
    download_to_file(&url, &zip_path).await?;

    let actual_sha256 = file_sha256(&zip_path)?;
    if !actual_sha256.eq_ignore_ascii_case(expected_sha256) {
        return Err(AppError::localized(
            "git_bash_checksum_mismatch",
            format!("MinGit 下载校验失败（期望 {expected_sha256}，实际 {actual_sha256}）"),
            format!(
                "MinGit download checksum mismatch (expected {expected_sha256}, got {actual_sha256})"
            ),
        ));
    }

    let bash_path = tokio::task::spawn_blocking(move || extract_mingit(&zip_path, &target_dir))
        .await
        .map_err(|e| AppError::Message(format!("解压任务失败: {e}")))??;

    set_kimi_shell_path(&bash_path)?;

    Ok(GitBashInstallResult {
        bash_path: bash_path.to_string_lossy().into_owned(),
        already_installed: false,
    })
}

/// 流式下载到本地文件。reqwest 默认遵循 HTTP(S)_PROXY 等系统代理变量。
async fn download_to_file(url: &str, dest: &Path) -> Result<(), AppError> {
    use futures::StreamExt;

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(15 * 60))
        .build()
        .map_err(|e| AppError::Message(format!("创建下载客户端失败: {e}")))?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| AppError::Message(format!("下载 MinGit 失败: {e}")))?
        .error_for_status()
        .map_err(|e| AppError::Message(format!("下载 MinGit 返回错误: {e}")))?;

    let mut file = std::fs::File::create(dest).map_err(|e| AppError::io(dest, e))?;
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| AppError::Message(format!("下载 MinGit 中断: {e}")))?;
        file.write_all(&chunk).map_err(|e| AppError::io(dest, e))?;
    }
    file.sync_all().map_err(|e| AppError::io(dest, e))?;
    Ok(())
}

/// 计算文件的 sha256（十六进制小写）。
fn file_sha256(path: &Path) -> Result<String, AppError> {
    use sha2::Digest;

    let mut file = std::fs::File::open(path).map_err(|e| AppError::io(path, e))?;
    let mut hasher = sha2::Sha256::new();
    std::io::copy(&mut file, &mut hasher).map_err(|e| AppError::io(path, e))?;
    Ok(format!("{:x}", hasher.finalize()))
}

/// 解压 MinGit zip 并原子换入目标目录，返回 bash.exe 路径。
///
/// 先解到同目录下的 `mingit.new-<pid>` 暂存区，确认 `bin/bash.exe` 存在后再
/// rename 换入（同分区 rename 是原子操作，中途失败不会留下半解包状态）。
/// 目标目录由 ICodeEasy 独占管理，已存在时（上次安装）直接整体替换。
fn extract_mingit(zip_path: &Path, target_dir: &Path) -> Result<PathBuf, AppError> {
    let staging = target_dir.with_file_name(format!("mingit.new-{}", std::process::id()));
    if staging.exists() {
        std::fs::remove_dir_all(&staging).map_err(|e| AppError::io(&staging, e))?;
    }
    std::fs::create_dir_all(&staging).map_err(|e| AppError::io(&staging, e))?;

    let extract_result = (|| -> Result<(), AppError> {
        let file = std::fs::File::open(zip_path).map_err(|e| AppError::io(zip_path, e))?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| AppError::Message(format!("MinGit 包不是有效的 zip: {e}")))?;
        for index in 0..archive.len() {
            let mut entry = archive
                .by_index(index)
                .map_err(|e| AppError::Message(format!("读取 zip 条目失败: {e}")))?;
            // enclosed_name 过滤掉绝对路径与 `..` 逃逸条目（Zip Slip）。
            let Some(relative) = entry.enclosed_name() else {
                continue;
            };
            let out_path = staging.join(relative);
            if entry.is_dir() {
                std::fs::create_dir_all(&out_path).map_err(|e| AppError::io(&out_path, e))?;
                continue;
            }
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| AppError::io(parent, e))?;
            }
            let mut out =
                std::fs::File::create(&out_path).map_err(|e| AppError::io(&out_path, e))?;
            std::io::copy(&mut entry, &mut out).map_err(|e| AppError::io(&out_path, e))?;
        }
        Ok(())
    })();

    let bash_path = staging.join("bin").join("bash.exe");
    if let Err(err) = extract_result {
        std::fs::remove_dir_all(&staging).ok();
        return Err(err);
    }
    if !bash_path.is_file() {
        std::fs::remove_dir_all(&staging).ok();
        return Err(AppError::Message(
            "MinGit 解压后缺少 bin/bash.exe，包内容不符合预期".to_string(),
        ));
    }

    if target_dir.exists() {
        std::fs::remove_dir_all(target_dir).map_err(|e| AppError::io(target_dir, e))?;
    }
    if let Some(parent) = target_dir.parent() {
        std::fs::create_dir_all(parent).map_err(|e| AppError::io(parent, e))?;
    }
    std::fs::rename(&staging, target_dir).map_err(|e| AppError::io(target_dir, e))?;

    Ok(target_dir.join("bin").join("bash.exe"))
}

/// 把 bash.exe 路径写进用户级 `KIMI_SHELL_PATH`。
///
/// 用 `setx` 而不是手写注册表：它会顺带广播 WM_SETTINGCHANGE，之后新开的终端
/// 才能继承到该变量；本进程与已打开的终端看不到，UI 层负责提示用户新开终端。
#[cfg(target_os = "windows")]
fn set_kimi_shell_path(bash_path: &Path) -> Result<(), AppError> {
    use std::os::windows::process::CommandExt;

    let value = bash_path.to_string_lossy();
    let output = std::process::Command::new("setx")
        .args(["KIMI_SHELL_PATH", value.as_ref()])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| AppError::Message(format!("写入 KIMI_SHELL_PATH 失败: {e}")))?;
    if !output.status.success() {
        return Err(AppError::localized(
            "git_bash_setx_failed",
            format!(
                "写入 KIMI_SHELL_PATH 失败：{}",
                String::from_utf8_lossy(&output.stderr)
            ),
            format!(
                "Failed to set KIMI_SHELL_PATH: {}",
                String::from_utf8_lossy(&output.stderr)
            ),
        ));
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn set_kimi_shell_path(_bash_path: &Path) -> Result<(), AppError> {
    Err(AppError::localized(
        "git_bash_only_windows",
        "只有 Windows 上的 Kimi Code CLI 需要 Git Bash",
        "Git Bash is only required by Kimi Code CLI on Windows",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn asset_selection_covers_supported_arches() {
        let (x64_name, x64_sha) = select_mingit_asset("x86_64").expect("x64 asset");
        assert!(x64_name.contains("64-bit"));
        assert_eq!(x64_sha.len(), 64);
        let (arm64_name, arm64_sha) = select_mingit_asset("aarch64").expect("arm64 asset");
        assert!(arm64_name.contains("arm64"));
        assert_eq!(arm64_sha.len(), 64);
        assert!(select_mingit_asset("x86").is_none());
    }

    #[test]
    fn probe_reports_unsupported_off_windows() {
        #[cfg(not(target_os = "windows"))]
        {
            let status = probe_git_bash();
            assert!(!status.supported);
            assert!(!status.installed);
        }
    }

    #[test]
    fn file_sha256_matches_known_value() {
        let dir = tempfile::tempdir().expect("tempdir");
        let file = dir.path().join("hello.bin");
        std::fs::write(&file, b"hello world").expect("write fixture");
        // `printf 'hello world' | sha256sum`
        assert_eq!(
            file_sha256(&file).expect("sha256"),
            "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
        );
    }

    #[test]
    fn extract_mingit_unpacks_and_finds_bash() {
        let dir = tempfile::tempdir().expect("tempdir");
        let zip_path = dir.path().join("mingit.zip");
        {
            let file = std::fs::File::create(&zip_path).expect("create zip");
            let mut writer = zip::ZipWriter::new(file);
            let options = zip::write::SimpleFileOptions::default();
            writer.add_directory("bin/", options).expect("add bin dir");
            writer
                .start_file("bin/bash.exe", options)
                .expect("add bash");
            writer.write_all(b"fake-bash").expect("write bash");
            writer.start_file("cmd/git.exe", options).expect("add git");
            writer.write_all(b"fake-git").expect("write git");
            writer.finish().expect("finish zip");
        }

        let target = dir.path().join("ICodeEasy").join("mingit");
        let bash = extract_mingit(&zip_path, &target).expect("extract");
        assert!(bash.is_file());
        assert_eq!(std::fs::read(&bash).expect("read bash"), b"fake-bash");
        assert!(target.join("cmd").join("git.exe").is_file());
        // 暂存区已换入目标目录，不应残留
        assert!(!target
            .with_file_name(format!("mingit.new-{}", std::process::id()))
            .exists());
    }

    #[test]
    fn extract_mingit_rejects_archive_without_bash() {
        let dir = tempfile::tempdir().expect("tempdir");
        let zip_path = dir.path().join("broken.zip");
        {
            let file = std::fs::File::create(&zip_path).expect("create zip");
            let mut writer = zip::ZipWriter::new(file);
            let options = zip::write::SimpleFileOptions::default();
            writer.start_file("README.md", options).expect("add file");
            writer.write_all(b"nope").expect("write file");
            writer.finish().expect("finish zip");
        }

        let target = dir.path().join("ICodeEasy").join("mingit");
        let err = extract_mingit(&zip_path, &target).expect_err("must reject");
        assert!(err.to_string().contains("bash.exe"));
        assert!(!target.exists());
    }

    #[test]
    fn extract_mingit_replaces_previous_install() {
        let dir = tempfile::tempdir().expect("tempdir");
        let zip_path = dir.path().join("mingit.zip");
        {
            let file = std::fs::File::create(&zip_path).expect("create zip");
            let mut writer = zip::ZipWriter::new(file);
            let options = zip::write::SimpleFileOptions::default();
            writer
                .start_file("bin/bash.exe", options)
                .expect("add bash");
            writer.write_all(b"v2").expect("write bash");
            writer.finish().expect("finish zip");
        }

        let target = dir.path().join("ICodeEasy").join("mingit");
        std::fs::create_dir_all(target.join("bin")).expect("seed old install");
        std::fs::write(target.join("bin").join("bash.exe"), b"v1").expect("seed bash");
        std::fs::write(target.join("stale-marker"), b"old").expect("seed marker");

        let bash = extract_mingit(&zip_path, &target).expect("extract over old");
        assert_eq!(std::fs::read(&bash).expect("read bash"), b"v2");
        assert!(!target.join("stale-marker").exists());
    }
}
