//! 统一供应商 (Universal Provider) DAO
//!
//! 提供统一供应商的 CRUD 操作。

use crate::database::{lock_conn, to_json_string, Database};
use crate::error::AppError;
use crate::provider::{
    CodexModelConfig, GeminiModelConfig, UniversalProvider, UniversalProviderApps,
    UniversalProviderModels,
};
use std::collections::HashMap;

/// 统一供应商的 Settings Key
const UNIVERSAL_PROVIDERS_KEY: &str = "universal_providers";
pub(crate) const ICODEEASY_UNIVERSAL_PROVIDER_ID: &str = "icodeeasy";
const ICODEEASY_API_BASE_URL: &str = "https://api.icodeeasy.cc";

fn default_icodeeasy_universal_provider() -> UniversalProvider {
    let mut provider = UniversalProvider::new(
        ICODEEASY_UNIVERSAL_PROVIDER_ID.to_string(),
        "ICodeEasy".to_string(),
        "icodeeasy".to_string(),
        ICODEEASY_API_BASE_URL.to_string(),
        String::new(),
    );
    provider.apps = UniversalProviderApps {
        claude: true,
        codex: true,
        gemini: true,
    };
    provider.models = UniversalProviderModels {
        claude: None,
        codex: Some(CodexModelConfig {
            model: Some("gpt-5.6-sol".to_string()),
            reasoning_effort: Some("high".to_string()),
        }),
        gemini: Some(GeminiModelConfig {
            model: Some("gemini-3.6-flash".to_string()),
        }),
    };
    provider.website_url = Some("https://icodeeasy.cc".to_string());
    provider.icon_color = Some("#3B82F6".to_string());
    provider
}

impl Database {
    /// 获取所有统一供应商
    pub fn get_all_universal_providers(
        &self,
    ) -> Result<HashMap<String, UniversalProvider>, AppError> {
        let conn = lock_conn!(self.conn);

        let mut stmt = conn
            .prepare("SELECT value FROM settings WHERE key = ?")
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result: Option<String> = stmt
            .query_row([UNIVERSAL_PROVIDERS_KEY], |row| row.get(0))
            .ok();

        match result {
            Some(json) => serde_json::from_str(&json)
                .map_err(|e| AppError::Database(format!("解析统一供应商数据失败: {e}"))),
            None => Ok(HashMap::new()),
        }
    }

    /// 获取单个统一供应商
    pub fn get_universal_provider(&self, id: &str) -> Result<Option<UniversalProvider>, AppError> {
        let providers = self.get_all_universal_providers()?;
        Ok(providers.get(id).cloned())
    }

    /// 保存统一供应商（添加或更新）
    pub fn save_universal_provider(&self, provider: &UniversalProvider) -> Result<(), AppError> {
        let mut providers = self.get_all_universal_providers()?;
        providers.insert(provider.id.clone(), provider.clone());
        self.save_all_universal_providers(&providers)
    }

    /// 为 ICodeEasy 分发版补充唯一的用户侧供应商壳。
    ///
    /// 这里只在固定 ID 缺失时插入空 Key 配置，不生成子供应商、不写入 CLI，
    /// 也不修改任何历史 Universal Provider。用户提交 Key 后才由显式配置流程同步。
    pub fn ensure_icodeeasy_universal_provider(&self) -> Result<bool, AppError> {
        if self
            .get_universal_provider(ICODEEASY_UNIVERSAL_PROVIDER_ID)?
            .is_some()
        {
            return Ok(false);
        }

        self.save_universal_provider(&default_icodeeasy_universal_provider())?;
        Ok(true)
    }

    /// 删除统一供应商
    pub fn delete_universal_provider(&self, id: &str) -> Result<bool, AppError> {
        let mut providers = self.get_all_universal_providers()?;
        let existed = providers.remove(id).is_some();
        if existed {
            self.save_all_universal_providers(&providers)?;
        }
        Ok(existed)
    }

    /// 保存所有统一供应商（内部方法）
    fn save_all_universal_providers(
        &self,
        providers: &HashMap<String, UniversalProvider>,
    ) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        let json = to_json_string(providers)?;

        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            [UNIVERSAL_PROVIDERS_KEY, &json],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ensure_icodeeasy_inserts_default_without_removing_legacy_providers() {
        let db = Database::memory().expect("memory db");
        let legacy = UniversalProvider::new(
            "legacy-provider".to_string(),
            "Legacy Provider".to_string(),
            "custom".to_string(),
            "https://legacy.example.com".to_string(),
            "legacy-key".to_string(),
        );
        db.save_universal_provider(&legacy).expect("save legacy");

        assert!(db
            .ensure_icodeeasy_universal_provider()
            .expect("ensure ICodeEasy"));

        let providers = db
            .get_all_universal_providers()
            .expect("load universal providers");
        assert_eq!(providers.len(), 2);
        assert!(providers.contains_key("legacy-provider"));

        let icodeeasy = providers
            .get(ICODEEASY_UNIVERSAL_PROVIDER_ID)
            .expect("ICodeEasy provider");
        assert_eq!(icodeeasy.provider_type, "icodeeasy");
        assert_eq!(icodeeasy.base_url, ICODEEASY_API_BASE_URL);
        assert!(icodeeasy.api_key.is_empty());
        assert!(icodeeasy.apps.claude && icodeeasy.apps.codex && icodeeasy.apps.gemini);
        assert_eq!(
            icodeeasy
                .models
                .codex
                .as_ref()
                .and_then(|config| config.model.as_deref()),
            Some("gpt-5.6-sol")
        );
        assert_eq!(
            icodeeasy
                .models
                .gemini
                .as_ref()
                .and_then(|config| config.model.as_deref()),
            Some("gemini-3.6-flash")
        );
    }

    #[test]
    fn ensure_icodeeasy_preserves_existing_user_data() {
        let db = Database::memory().expect("memory db");
        let mut existing = default_icodeeasy_universal_provider();
        existing.api_key = "saved-user-key".to_string();
        existing.base_url = "https://saved.example.com".to_string();
        db.save_universal_provider(&existing)
            .expect("save existing ICodeEasy");

        assert!(!db
            .ensure_icodeeasy_universal_provider()
            .expect("ensure ICodeEasy"));

        let after = db
            .get_universal_provider(ICODEEASY_UNIVERSAL_PROVIDER_ID)
            .expect("query ICodeEasy")
            .expect("existing ICodeEasy");
        assert_eq!(after.api_key, "saved-user-key");
        assert_eq!(after.base_url, "https://saved.example.com");
    }
}
