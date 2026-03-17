/**
 * Token 估算工具
 *
 * 简单的 token 估算，基于字符数
 * 中文字符约 1.5-2 tokens，英文单词约 1-1.5 tokens
 */

/**
 * 估算文本的 token 数量
 * @param text 要估算的文本
 * @returns 估算的 token 数量
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // 统计中文字符数
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;

  // 统计英文单词数（简单按空格分割）
  const englishWords = text
    .replace(/[\u4e00-\u9fa5]/g, '') // 移除中文
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0).length;

  // 统计其他字符（标点、数字等）
  const otherChars = text.length - chineseChars - text.replace(/[\u4e00-\u9fa5]/g, '').length;

  // 估算公式：
  // - 中文字符：1.5 tokens/字
  // - 英文单词：1.3 tokens/词
  // - 其他字符：0.5 tokens/字符
  const estimatedTokens = Math.ceil(
    chineseChars * 1.5 +
    englishWords * 1.3 +
    otherChars * 0.5
  );

  return estimatedTokens;
}

/**
 * 估算消息的 token 数量
 * @param content 消息内容
 * @returns 估算的 token 数量
 */
export function estimateMessageTokens(content: string): number {
  // 基础内容 tokens
  const contentTokens = estimateTokens(content);

  // 消息格式开销（role, timestamp 等）
  const overhead = 10;

  return contentTokens + overhead;
}
