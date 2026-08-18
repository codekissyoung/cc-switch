use crate::services::env_checker::{check_env_conflicts as check_conflicts, EnvConflict};

/// Check environment variable conflicts for a specific app
#[tauri::command]
pub fn check_env_conflicts(app: String) -> Result<Vec<EnvConflict>, String> {
    check_conflicts(&app)
}
