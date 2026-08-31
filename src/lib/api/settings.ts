import { invoke } from "@tauri-apps/api/core";
import type {
  Settings,
  WebDavSyncSettings,
  S3SyncSettings,
  RemoteSnapshotInfo,
} from "@/types";
import type { AppId } from "./types";

export interface ConfigTransferResult {
  success: boolean;
  message: string;
  filePath?: string;
  backupId?: string;
}

export interface WebDavTestResult {
  success: boolean;
  message?: string;
}

export interface CodexUnifyHistoryRestoreResult {
  restoredJsonlFiles: number;
  restoredStateRows: number;
  /** 还原被跳过的原因（如当前目录没有账本）；存在时不应报成功 */
  skippedReason?: string;
}

export interface WebDavSyncResult {
  status: string;
}

/** ICodeEasy 接入点延迟探测结果（对应 Rust EndpointLatency） */
export interface EndpointLatency {
  origin: string;
  latencyMs: number | null;
}

/** 接入点切换结果（对应 Rust EndpointSwitchResult） */
export interface EndpointSwitchResult {
  origin: string;
  universalSynced: boolean;
  updated: string[];
  skipped: string[];
  failed: string[];
}

export interface AppVersionCheckResult {
  hasUpdate: boolean;
  latestVersion: string | null;
  downloadUrl: string | null;
  notes: string | null;
}

export interface CodexSuiteStatus {
  supported: boolean;
  platform: "macos" | "windows" | "unsupported";
  cliInstalled: boolean;
  cliVersion: string | null;
  cliBroken: boolean;
  desktopInstalled: boolean;
  npmAvailable: boolean;
}

export interface ClaudeSuiteStatus {
  supported: boolean;
  platform: "macos" | "windows" | "unsupported";
  cliInstalled: boolean;
  cliVersion: string | null;
  cliBroken: boolean;
  desktopInstalled: boolean;
}

export interface CodexDesktopLaunchResult {
  method: "codex-app" | "official-download";
  desktopWasInstalled: boolean;
}

export interface ClaudeDesktopLaunchResult {
  method: "claude-app" | "official-download";
  desktopWasInstalled: boolean;
}

export interface GeminiSuiteStatus {
  supported: boolean;
  platform: "macos" | "windows" | "unsupported";
  cliInstalled: boolean;
  cliVersion: string | null;
  cliBroken: boolean;
  desktopInstalled: boolean;
  npmAvailable: boolean;
}

export interface AntigravityDesktopLaunchResult {
  method: "antigravity-app" | "official-download";
  desktopWasInstalled: boolean;
}

export interface GitBashStatus {
  /** 仅 Windows 需要 Git Bash；其它平台为 false，不渲染对应卡片。 */
  supported: boolean;
  installed: boolean;
  path: string | null;
  /** 命中来源：env-override / icodeeasy-managed / git-on-path / well-known-location */
  source: string | null;
}

export interface GitBashInstallResult {
  bashPath: string;
  alreadyInstalled: boolean;
}

export interface KimiSuiteStatus {
  supported: boolean;
  platform: "macos" | "windows" | "unsupported";
  cliInstalled: boolean;
  cliVersion: string | null;
  cliBroken: boolean;
  relayConfigured: boolean;
  gitBash: GitBashStatus;
}

export interface GrokSuiteStatus {
  supported: boolean;
  platform: "macos" | "windows" | "unsupported";
  cliInstalled: boolean;
  cliVersion: string | null;
  cliBroken: boolean;
  relayConfigured: boolean;
}

export interface OpencodeSuiteStatus {
  supported: boolean;
  platform: "macos" | "windows" | "unsupported";
  cliInstalled: boolean;
  cliVersion: string | null;
  cliBroken: boolean;
  relayConfigured: boolean;
}

export interface PiSuiteStatus {
  supported: boolean;
  platform: "macos" | "windows" | "unsupported";
  cliInstalled: boolean;
  cliVersion: string | null;
  cliBroken: boolean;
  relayConfigured: boolean;
}

export interface OpenclawSuiteStatus {
  supported: boolean;
  platform: "macos" | "windows" | "unsupported";
  cliInstalled: boolean;
  cliVersion: string | null;
  cliBroken: boolean;
  relayConfigured: boolean;
}

export interface HermesSuiteStatus {
  supported: boolean;
  platform: "macos" | "windows" | "unsupported";
  cliInstalled: boolean;
  cliVersion: string | null;
  cliBroken: boolean;
  relayConfigured: boolean;
}

export interface ZcodeSuiteStatus {
  supported: boolean;
  platform: "macos" | "windows" | "unsupported";
  desktopInstalled: boolean;
  relayConfigured: boolean;
}

export interface ZcodeDesktopLaunchResult {
  method: "zcode-app" | "official-download";
  desktopWasInstalled: boolean;
}

export const settingsApi = {
  async get(): Promise<Settings> {
    return await invoke("get_settings");
  },

  async save(settings: Settings): Promise<boolean> {
    return await invoke("save_settings", { settings });
  },

  /** 是否存在统一 Codex 会话历史的迁移备份（关闭弹窗据此显示"恢复备份"勾选） */
  async hasCodexUnifyHistoryBackup(): Promise<boolean> {
    return await invoke("has_codex_unify_history_backup");
  },

  /** 按迁移备份账本把当时迁入共享桶的官方会话还原回 openai 桶（幂等） */
  async restoreCodexUnifiedHistory(): Promise<CodexUnifyHistoryRestoreResult> {
    return await invoke("restore_codex_unified_history");
  },

  async restart(): Promise<boolean> {
    return await invoke("restart_app");
  },

  /** 轻量版本检查：GET 远端 version.json 比对版本，任何失败都返回 hasUpdate=false */
  async checkAppVersion(): Promise<AppVersionCheckResult> {
    return await invoke("check_app_version");
  },

  async checkUpdates(): Promise<void> {
    await invoke("check_for_updates");
  },

  async isPortable(): Promise<boolean> {
    return await invoke("is_portable_mode");
  },

  async getConfigDir(appId: AppId): Promise<string> {
    return await invoke("get_config_dir", { app: appId });
  },

  async openConfigFolder(appId: AppId): Promise<void> {
    await invoke("open_config_folder", { app: appId });
  },

  async pickDirectory(defaultPath?: string): Promise<string | null> {
    return await invoke("pick_directory", { defaultPath });
  },

  async selectConfigDirectory(defaultPath?: string): Promise<string | null> {
    return await invoke("pick_directory", { defaultPath });
  },

  async getClaudeCodeConfigPath(): Promise<string> {
    return await invoke("get_claude_code_config_path");
  },

  async getAppConfigPath(): Promise<string> {
    return await invoke("get_app_config_path");
  },

  async openAppConfigFolder(): Promise<void> {
    await invoke("open_app_config_folder");
  },

  async getAppConfigDirOverride(): Promise<string | null> {
    return await invoke("get_app_config_dir_override");
  },

  async setAppConfigDirOverride(path: string | null): Promise<boolean> {
    return await invoke("set_app_config_dir_override", { path });
  },

  async applyClaudePluginConfig(options: {
    official: boolean;
  }): Promise<boolean> {
    const { official } = options;
    return await invoke("apply_claude_plugin_config", { official });
  },

  async applyClaudeOnboardingSkip(): Promise<boolean> {
    return await invoke("apply_claude_onboarding_skip");
  },

  async clearClaudeOnboardingSkip(): Promise<boolean> {
    return await invoke("clear_claude_onboarding_skip");
  },

  async saveFileDialog(defaultName: string): Promise<string | null> {
    return await invoke("save_file_dialog", { defaultName });
  },

  async openFileDialog(): Promise<string | null> {
    return await invoke("open_file_dialog");
  },

  async exportConfigToFile(filePath: string): Promise<ConfigTransferResult> {
    return await invoke("export_config_to_file", { filePath });
  },

  async importConfigFromFile(filePath: string): Promise<ConfigTransferResult> {
    return await invoke("import_config_from_file", { filePath });
  },

  // ─── WebDAV sync ──────────────────────────────────────────

  async webdavTestConnection(
    settings: WebDavSyncSettings,
    preserveEmptyPassword = true,
  ): Promise<WebDavTestResult> {
    return await invoke("webdav_test_connection", {
      settings,
      preserveEmptyPassword,
    });
  },

  async webdavSyncUpload(): Promise<WebDavSyncResult> {
    return await invoke("webdav_sync_upload");
  },

  async webdavSyncDownload(): Promise<WebDavSyncResult> {
    return await invoke("webdav_sync_download");
  },

  async webdavSyncSaveSettings(
    settings: WebDavSyncSettings,
    passwordTouched = false,
  ): Promise<{ success: boolean }> {
    return await invoke("webdav_sync_save_settings", {
      settings,
      passwordTouched,
    });
  },

  async webdavSyncFetchRemoteInfo(): Promise<
    RemoteSnapshotInfo | { empty: true }
  > {
    return await invoke("webdav_sync_fetch_remote_info");
  },

  // ===== S3 Sync API =====

  async s3TestConnection(
    settings: S3SyncSettings,
    preserveEmptyPassword = true,
  ): Promise<WebDavTestResult> {
    return await invoke("s3_test_connection", {
      settings,
      preserveEmptyPassword,
    });
  },

  async s3SyncUpload(): Promise<WebDavSyncResult> {
    return await invoke("s3_sync_upload");
  },

  async s3SyncDownload(): Promise<WebDavSyncResult> {
    return await invoke("s3_sync_download");
  },

  async s3SyncSaveSettings(
    settings: S3SyncSettings,
    passwordTouched: boolean,
  ): Promise<{ success: boolean }> {
    return await invoke("s3_sync_save_settings", {
      settings,
      passwordTouched,
    });
  },

  async s3SyncFetchRemoteInfo(): Promise<RemoteSnapshotInfo | { empty: true }> {
    return await invoke("s3_sync_fetch_remote_info");
  },

  async syncCurrentProvidersLive(): Promise<void> {
    const result = (await invoke("sync_current_providers_live")) as {
      success?: boolean;
      message?: string;
    };
    if (!result?.success) {
      throw new Error(result?.message || "Sync current providers failed");
    }
  },

  async openExternal(url: string): Promise<void> {
    try {
      const u = new URL(url);
      const scheme = u.protocol.replace(":", "").toLowerCase();
      if (scheme !== "http" && scheme !== "https") {
        throw new Error("Unsupported URL scheme");
      }
    } catch {
      throw new Error("Invalid URL");
    }
    await invoke("open_external", { url });
  },

  async setAutoLaunch(enabled: boolean): Promise<boolean> {
    return await invoke("set_auto_launch", { enabled });
  },

  async getAutoLaunchStatus(): Promise<boolean> {
    return await invoke("get_auto_launch_status");
  },

  async getToolVersions(
    tools?: string[],
    wslShellByTool?: Record<
      string,
      { wslShell?: string | null; wslShellFlag?: string | null }
    >,
  ): Promise<
    Array<{
      name: string;
      version: string | null;
      latest_version: string | null;
      error: string | null;
      installed_but_broken: boolean;
      env_type: "windows" | "wsl" | "macos" | "linux" | "unknown";
      wsl_distro: string | null;
    }>
  > {
    return await invoke("get_tool_versions", { tools, wslShellByTool });
  },

  async runToolLifecycleAction(
    tools: string[],
    action: "install" | "update",
    wslShellByTool?: Record<
      string,
      { wslShell?: string | null; wslShellFlag?: string | null }
    >,
  ): Promise<void> {
    await invoke("run_tool_lifecycle_action", {
      tools,
      action,
      wslShellByTool,
    });
  },

  async getCodexSuiteStatus(): Promise<CodexSuiteStatus> {
    return await invoke("get_codex_suite_status");
  },

  async installNativeCodexCli(): Promise<void> {
    await invoke("install_native_codex_cli");
  },

  async launchOrInstallCodexDesktop(): Promise<CodexDesktopLaunchResult> {
    return await invoke("launch_or_install_codex_desktop");
  },

  async getClaudeSuiteStatus(): Promise<ClaudeSuiteStatus> {
    return await invoke("get_claude_suite_status");
  },

  async launchOrInstallClaudeDesktop(): Promise<ClaudeDesktopLaunchResult> {
    return await invoke("launch_or_install_claude_desktop");
  },

  async getGeminiSuiteStatus(): Promise<GeminiSuiteStatus> {
    return await invoke("get_gemini_suite_status");
  },

  async launchOrInstallAntigravityDesktop(): Promise<AntigravityDesktopLaunchResult> {
    return await invoke("launch_or_install_antigravity_desktop");
  },

  async getKimiSuiteStatus(): Promise<KimiSuiteStatus> {
    return await invoke("get_kimi_suite_status");
  },

  async configureKimiRelay(apiKey: string): Promise<void> {
    await invoke("configure_kimi_relay", { apiKey });
  },

  async installGitBash(): Promise<GitBashInstallResult> {
    return await invoke("install_git_bash");
  },

  async getGrokSuiteStatus(): Promise<GrokSuiteStatus> {
    return await invoke("get_grok_suite_status");
  },

  async configureGrokRelay(apiKey: string): Promise<void> {
    await invoke("configure_grok_relay", { apiKey });
  },

  async getOpencodeSuiteStatus(): Promise<OpencodeSuiteStatus> {
    return await invoke("get_opencode_suite_status");
  },

  async configureOpencodeRelay(apiKey: string): Promise<void> {
    await invoke("configure_opencode_relay", { apiKey });
  },

  async getPiSuiteStatus(): Promise<PiSuiteStatus> {
    return await invoke("get_pi_suite_status");
  },

  async configurePiRelay(apiKey: string): Promise<void> {
    await invoke("configure_pi_relay", { apiKey });
  },

  async getOpenclawSuiteStatus(): Promise<OpenclawSuiteStatus> {
    return await invoke("get_openclaw_suite_status");
  },

  async configureOpenclawRelay(apiKey: string): Promise<void> {
    await invoke("configure_openclaw_relay", { apiKey });
  },

  async getHermesSuiteStatus(): Promise<HermesSuiteStatus> {
    return await invoke("get_hermes_suite_status");
  },

  async configureHermesRelay(apiKey: string): Promise<void> {
    await invoke("configure_hermes_relay", { apiKey });
  },

  async getZcodeSuiteStatus(): Promise<ZcodeSuiteStatus> {
    return await invoke("get_zcode_suite_status");
  },

  async launchOrInstallZcodeDesktop(): Promise<ZcodeDesktopLaunchResult> {
    return await invoke("launch_or_install_zcode_desktop");
  },

  async configureZcodeRelay(apiKey: string): Promise<void> {
    await invoke("configure_zcode_relay", { apiKey });
  },

  /** 切换 ICodeEasy 接入点：写统一供应商 base_url 并重写所有已配置工具的中转 */
  async setIcodeeasyEndpoint(origin: string): Promise<EndpointSwitchResult> {
    return await invoke("set_icodeeasy_endpoint", { origin });
  },

  /** 探测全部 ICodeEasy 接入点的延迟（3 次采样取中位数） */
  async probeIcodeeasyEndpoints(): Promise<EndpointLatency[]> {
    return await invoke("probe_icodeeasy_endpoints");
  },

  /** 打开系统首选终端（落在用户家目录） */
  async openHomeTerminal(): Promise<void> {
    await invoke("open_home_terminal");
  },

  /** 探测各工具安装分布：枚举所有安装、标记冲突、生成锚定升级命令。
   *  诊断按钮、升级前确认、升级后补诊共用此命令，各取所需字段。 */
  async probeToolInstallations(
    tools: string[],
  ): Promise<ToolInstallationReport[]> {
    return await invoke("probe_tool_installations", { tools });
  },

  async getRectifierConfig(): Promise<RectifierConfig> {
    return await invoke("get_rectifier_config");
  },

  async setRectifierConfig(config: RectifierConfig): Promise<boolean> {
    return await invoke("set_rectifier_config", { config });
  },

  async getOptimizerConfig(): Promise<OptimizerConfig> {
    return await invoke("get_optimizer_config");
  },

  async setOptimizerConfig(config: OptimizerConfig): Promise<boolean> {
    return await invoke("set_optimizer_config", { config });
  },

  async getLogConfig(): Promise<LogConfig> {
    return await invoke("get_log_config");
  },

  async setLogConfig(config: LogConfig): Promise<boolean> {
    return await invoke("set_log_config", { config });
  },
};

/** 单处工具安装的诊断信息（多处安装冲突检测）。字段对应后端 ToolInstallation。 */
export interface ToolInstallation {
  path: string;
  version: string | null;
  runnable: boolean;
  error: string | null;
  source: string;
  is_path_default: boolean;
}

/** 一次"探测工具安装分布"的结果。字段对应后端 ToolInstallationReport。 */
export interface ToolInstallationReport {
  tool: string;
  installs: ToolInstallation[];
  is_conflict: boolean;
  needs_confirmation: boolean;
  command: string;
  anchored: boolean;
}

export interface RectifierConfig {
  enabled: boolean;
  requestThinkingSignature: boolean;
  requestThinkingBudget: boolean;
  requestMediaFallback: boolean;
  requestMediaHeuristic: boolean;
}

export interface OptimizerConfig {
  enabled: boolean;
  thinkingOptimizer: boolean;
  cacheInjection: boolean;
}

export interface LogConfig {
  enabled: boolean;
  level: "error" | "warn" | "info" | "debug" | "trace";
}

export interface BackupEntry {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export const backupsApi = {
  async createDbBackup(): Promise<string> {
    return await invoke("create_db_backup");
  },

  async listDbBackups(): Promise<BackupEntry[]> {
    return await invoke("list_db_backups");
  },

  async restoreDbBackup(filename: string): Promise<string> {
    return await invoke("restore_db_backup", { filename });
  },

  async renameDbBackup(oldFilename: string, newName: string): Promise<string> {
    return await invoke("rename_db_backup", { oldFilename, newName });
  },

  async deleteDbBackup(filename: string): Promise<void> {
    await invoke("delete_db_backup", { filename });
  },
};
