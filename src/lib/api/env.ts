import { invoke } from "@tauri-apps/api/core";
import type { EnvConflict } from "@/types/env";

/**
 * 环境变量管理 API
 */

/**
 * 检查指定应用的环境变量冲突
 * @param appType 应用类型 ("claude" | "codex" | "gemini" | "grokbuild")
 * @returns 环境变量冲突列表
 */
export async function checkEnvConflicts(
  appType: string,
): Promise<EnvConflict[]> {
  return invoke<EnvConflict[]>("check_env_conflicts", { app: appType });
}

/**
 * 检查所有应用的环境变量冲突
 * @returns 按应用类型分组的环境变量冲突
 */
export async function checkAllEnvConflicts(): Promise<
  Record<string, EnvConflict[]>
> {
  const apps = ["claude", "codex", "gemini", "grokbuild"];
  const results: Record<string, EnvConflict[]> = {};

  await Promise.all(
    apps.map(async (app) => {
      try {
        results[app] = await checkEnvConflicts(app);
      } catch (error) {
        console.error(`检查 ${app} 环境变量失败:`, error);
        results[app] = [];
      }
    }),
  );

  return results;
}
