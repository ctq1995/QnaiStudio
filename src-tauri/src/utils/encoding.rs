#[cfg(windows)]
use encoding_rs::GB18030;

pub fn decode_cli_output(bytes: &[u8]) -> String {
    if bytes.is_empty() {
        return String::new();
    }

    if let Ok(text) = std::str::from_utf8(bytes) {
        return text.to_string();
    }

    #[cfg(windows)]
    {
        let (decoded, _, _) = GB18030.decode(bytes);
        if !decoded.is_empty() {
            return decoded.into_owned();
        }
    }

    String::from_utf8_lossy(bytes).into_owned()
}

pub fn decode_cli_line(bytes: &[u8]) -> String {
    let mut text = decode_cli_output(bytes);
    while text.ends_with('\n') || text.ends_with('\r') {
        text.pop();
    }
    text
}
