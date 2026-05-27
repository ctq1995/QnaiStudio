/**
 * ReviewSecurity Agent - 安全审查Agent
 *
 * 专注于安全风险：
 * - 注入漏洞（SQL、XSS、命令注入）
 * - 认证漏洞
 * - 数据暴露
 * - 不安全的命令/文件处理
 * - 权限提升
 * - 信任边界错误
 */

import { BaseReviewAgent } from './base-review'
import type { ReviewConfig } from './base-review'

/**
 * 安全审查Agent
 */
export class ReviewSecurityAgent extends BaseReviewAgent {
  // 危险函数模式
  private readonly DANGEROUS_PATTERNS = {
    // SQL注入
    sqlInjection: [
      /`SELECT.*\$\{.*\}.*`/,
      /`INSERT.*\$\{.*\}.*`/,
      /`UPDATE.*\$\{.*\}.*`/,
      /`DELETE.*\$\{.*\}.*`/,
      /query\(['"]\w+.*\+/,
      /exec\(['"]\w+.*\+/,
    ],
    // XSS
    xss: [
      /innerHTML\s*=/,
      /dangerouslySetInnerHTML/,
      /document\.write\(/,
      /v-html=/,
    ],
    // 命令注入
    commandInjection: [
      /exec\(/,
      /spawn\(/,
      /execSync\(/,
      /child_process/,
      /eval\(/,
      /Function\(/,
    ],
    // 路径遍历
    pathTraversal: [
      /\.\.\/\.\.\//,
      /path\.join\(.*\+/,
      /fs\.readFile\(.*\+/,
      /fs\.writeFile\(.*\+/,
    ],
    // 敏感数据暴露
    dataExposure: [
      /password\s*[=:]\s*['"]/,
      /api[_-]?key\s*[=:]\s*['"]/,
      /secret\s*[=:]\s*['"]/,
      /token\s*[=:]\s*['"]/,
      /private[_-]?key/,
    ],
    // 不安全的加密
    weakCrypto: [
      /md5\(/,
      /sha1\(/,
      /Math\.random\(\).*token/,
      /DES/,
      /ECB/,
    ],
    // 不安全的随机数
    weakRandom: [
      /Math\.random\(\).*password/,
      /Math\.random\(\).*token/,
      /Math\.random\(\).*key/,
    ],
  }

  constructor(config?: Partial<ReviewConfig>) {
    super('ReviewSecurity', config)
  }

  /**
   * 审查单个文件
   */
  protected async reviewFile(file: string): Promise<void> {
    const content = await this.readFileContent(file)
    if (!content) return

    // 执行安全检查
    this.checkSQLInjection(file, content)
    this.checkXSS(file, content)
    this.checkCommandInjection(file, content)
    this.checkPathTraversal(file, content)
    this.checkDataExposure(file, content)
    this.checkWeakCrypto(file, content)
    this.checkAuthPatterns(file, content)
    this.checkCORS(file, content)
  }

  /**
   * 检查SQL注入
   */
  private checkSQLInjection(file: string, content: string): void {
    for (const pattern of this.DANGEROUS_PATTERNS.sqlInjection) {
      const matches = content.match(pattern)
      if (matches) {
        const lineNumber = this.getLineNumber(content, matches[0])
        this.addIssue({
          severity: 'critical',
          type: 'sql-injection',
          file,
          line: lineNumber,
          message: 'Potential SQL injection vulnerability detected',
          suggestion: 'Use parameterized queries or prepared statements instead of string interpolation',
          snippet: matches[0],
        })
      }
    }
  }

  /**
   * 检查XSS
   */
  private checkXSS(file: string, content: string): void {
    for (const pattern of this.DANGEROUS_PATTERNS.xss) {
      const matches = content.match(pattern)
      if (matches) {
        const lineNumber = this.getLineNumber(content, matches[0])
        this.addIssue({
          severity: 'critical',
          type: 'xss',
          file,
          line: lineNumber,
          message: 'Potential Cross-Site Scripting (XSS) vulnerability detected',
          suggestion: 'Sanitize user input or use textContent instead of innerHTML',
          snippet: matches[0],
        })
      }
    }
  }

  /**
   * 检查命令注入
   */
  private checkCommandInjection(file: string, content: string): void {
    for (const pattern of this.DANGEROUS_PATTERNS.commandInjection) {
      const matches = content.match(pattern)
      if (matches) {
        const lineNumber = this.getLineNumber(content, matches[0])

        // eval和Function更危险
        const severity = matches[0].includes('eval') || matches[0].includes('Function') ? 'critical' : 'high'

        this.addIssue({
          severity,
          type: 'command-injection',
          file,
          line: lineNumber,
          message: 'Potential command injection vulnerability detected',
          suggestion: 'Avoid executing dynamic code. Use safer alternatives and validate all inputs',
          snippet: matches[0],
        })
      }
    }
  }

  /**
   * 检查路径遍历
   */
  private checkPathTraversal(file: string, content: string): void {
    for (const pattern of this.DANGEROUS_PATTERNS.pathTraversal) {
      const matches = content.match(pattern)
      if (matches) {
        const lineNumber = this.getLineNumber(content, matches[0])
        this.addIssue({
          severity: 'high',
          type: 'path-traversal',
          file,
          line: lineNumber,
          message: 'Potential path traversal vulnerability detected',
          suggestion: 'Validate and sanitize file paths. Use path.resolve and check against allowed directories',
          snippet: matches[0],
        })
      }
    }
  }

  /**
   * 检查敏感数据暴露
   */
  private checkDataExposure(file: string, content: string): void {
    for (const pattern of this.DANGEROUS_PATTERNS.dataExposure) {
      const matches = content.match(pattern)
      if (matches) {
        const lineNumber = this.getLineNumber(content, matches[0])

        // 检查是否在测试文件中
        if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) {
          continue // 测试文件中的假密码可以接受
        }

        this.addIssue({
          severity: 'high',
          type: 'sensitive-data-exposure',
          file,
          line: lineNumber,
          message: 'Hardcoded sensitive data detected',
          suggestion: 'Use environment variables or secure secret management instead of hardcoding credentials',
          snippet: matches[0].slice(0, 50) + '...', // 不暴露完整敏感信息
        })
      }
    }
  }

  /**
   * 检查弱加密
   */
  private checkWeakCrypto(file: string, content: string): void {
    for (const pattern of this.DANGEROUS_PATTERNS.weakCrypto) {
      const matches = content.match(pattern)
      if (matches) {
        const lineNumber = this.getLineNumber(content, matches[0])
        this.addIssue({
          severity: 'medium',
          type: 'weak-cryptography',
          file,
          line: lineNumber,
          message: 'Weak cryptographic algorithm detected',
          suggestion: 'Use modern cryptographic algorithms (SHA-256+, AES-GCM, RSA-2048+)',
          snippet: matches[0],
        })
      }
    }
  }

  /**
   * 检查认证模式
   */
  private checkAuthPatterns(file: string, content: string): void {
    // 检查不安全的密码比较
    const unsafeCompare = content.match(/password\s*===?\s*\w+|password\s*==\s*\w+/)
    if (unsafeCompare) {
      this.addIssue({
        severity: 'medium',
        type: 'timing-attack',
        file,
        message: 'Potential timing attack vulnerability in password comparison',
        suggestion: 'Use constant-time comparison functions for sensitive data',
      })
    }

    // 检查缺少CSRF保护
    if (content.includes('fetch(') && content.includes('POST') && !content.includes('csrf') && !content.includes('X-CSRF')) {
      this.addIssue({
        severity: 'medium',
        type: 'csrf',
        file,
        message: 'POST request may lack CSRF protection',
        suggestion: 'Implement CSRF tokens for state-changing requests',
      })
    }

    // 检查不安全的会话管理
    if (content.includes('session') && !content.includes('httpOnly') && !content.includes('secure')) {
      this.addIssue({
        severity: 'medium',
        type: 'session-security',
        file,
        message: 'Session cookie may lack secure attributes',
        suggestion: 'Set httpOnly, secure, and sameSite attributes on session cookies',
      })
    }
  }

  /**
   * 检查CORS配置
   */
  private checkCORS(file: string, content: string): void {
    // 检查过于宽松的CORS
    if (content.includes("Access-Control-Allow-Origin: '*'") || content.includes("origin: '*'")) {
      this.addIssue({
        severity: 'high',
        type: 'cors-misconfiguration',
        file,
        message: 'Overly permissive CORS configuration detected',
        suggestion: 'Specify allowed origins explicitly instead of using wildcard',
      })
    }
  }

  /**
   * 获取行号
   */
  private getLineNumber(content: string, match: string): number {
    const index = content.indexOf(match)
    if (index === -1) return 1
    return content.slice(0, index).split('\n').length
  }
}

// 注册
import { registerSubagent } from '../../subagent-registry'
registerSubagent('ReviewSecurity', (config) => new ReviewSecurityAgent(config as Partial<ReviewConfig>))
