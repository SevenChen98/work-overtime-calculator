use std::fs;
use std::path::PathBuf;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

fn state_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|err| err.to_string())?;
    Ok(app_data_dir.join("overtime-state.json"))
}

#[tauri::command]
fn load_state(app: AppHandle) -> Result<Value, String> {
    let state_path = state_file_path(&app)?;

    if !state_path.exists() {
        return Ok(json!({}));
    }

    let content = fs::read_to_string(&state_path).map_err(|err| err.to_string())?;
    serde_json::from_str(&content).map_err(|err| err.to_string())
}

#[tauri::command]
fn save_state(app: AppHandle, state: Value) -> Result<Value, String> {
    if !state.is_object() {
        return Err("提交的数据格式不正确".into());
    }

    let state_path = state_file_path(&app)?;
    let content = serde_json::to_string_pretty(&state).map_err(|err| err.to_string())?;
    fs::write(&state_path, format!("{content}\n")).map_err(|err| err.to_string())?;

    Ok(json!({
        "ok": true,
        "path": state_path.to_string_lossy()
    }))
}

#[tauri::command]
fn get_state_path(app: AppHandle) -> Result<String, String> {
    let state_path = state_file_path(&app)?;
    Ok(state_path.to_string_lossy().to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            get_state_path
        ])
        .run(tauri::generate_context!())
        .expect("failed to run tauri app");
}
