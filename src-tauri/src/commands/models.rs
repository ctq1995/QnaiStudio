use crate::error::{AppError, Result};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde_json::Value;
use std::time::Duration;

const MODELS_PATH: &str = "/v1/models";
const API_V1_PATH: &str = "/v1";
const REQUEST_TIMEOUT_SECS: u64 = 15;

fn build_models_url(base_url: &str) -> Result<String> {
    let trimmed = base_url.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidPath("API Base URL 不能为空".to_string()));
    }

    let normalized = trimmed.trim_end_matches('/');
    if normalized.ends_with(MODELS_PATH) {
        return Ok(normalized.to_string());
    }

    if normalized.ends_with(API_V1_PATH) {
        return Ok(format!("{}/models", normalized));
    }

    Ok(format!("{}{}", normalized, MODELS_PATH))
}

fn build_headers(api_key: Option<&str>) -> Result<HeaderMap> {
    let mut headers = HeaderMap::new();
    let Some(api_key) = api_key.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(headers);
    };

    let value = format!("Bearer {}", api_key);
    let header_value = HeaderValue::from_str(&value)
        .map_err(|e| AppError::ConfigError(format!("无效的 API Key: {}", e)))?;
    headers.insert(AUTHORIZATION, header_value);
    Ok(headers)
}

fn parse_models_response(payload: Value) -> Result<Vec<String>> {
    let data = payload
        .get("data")
        .and_then(|value| value.as_array())
        .ok_or_else(|| AppError::ParseError("响应缺少 data 数组".to_string()))?;

    let mut ids = Vec::new();
    for item in data {
        let id = item.get("id").and_then(|value| value.as_str());
        if let Some(id) = id {
            ids.push(id.to_string());
        }
    }

    if ids.is_empty() {
        return Err(AppError::ParseError("响应中未找到模型 id".to_string()));
    }

    ids.sort();
    ids.dedup();
    Ok(ids)
}

#[tauri::command]
pub async fn fetch_models(base_url: String, api_key: Option<String>) -> Result<Vec<String>> {
    let models_url = build_models_url(&base_url)?;
    let headers = build_headers(api_key.as_deref())?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .default_headers(headers)
        .build()
        .map_err(|e| AppError::Unknown(format!("创建 HTTP 客户端失败: {}", e)))?;

    let response = client
        .get(models_url)
        .send()
        .await
        .map_err(|e| AppError::Unknown(format!("请求模型列表失败: {}", e)))?;

    let status = response.status();
    if !status.is_success() {
        let body = response
            .text()
            .await
            .map_err(|e| AppError::Unknown(format!("读取错误响应失败: {}", e)))?;
        return Err(AppError::Unknown(format!(
            "请求模型列表失败 (HTTP {}): {}",
            status, body
        )));
    }

    let payload = response
        .json::<Value>()
        .await
        .map_err(|e| AppError::ParseError(format!("解析模型列表失败: {}", e)))?;

    parse_models_response(payload)
}

