// 危険なパターンの定義
const DANGEROUS_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /disregard\s+(all\s+)?(previous\s+)?instructions/i,
    /forget\s+(all\s+)?(previous\s+)?instructions/i,
    /you\s+are\s+now/i,
    /act\s+as\s+(a\s+)?/i,
    /pretend\s+(to\s+be|you\s+are)/i,
    /roleplay\s+as/i,
    /system\s*:\s*/i,
    /\[system\]/i,
    /\{system\}/i,
    /<system>/i,
    /assistant\s*:\s*/i,
    /\[assistant\]/i,
];

// 最大メッセージ長
const MAX_MESSAGE_LENGTH = 500;

/**
 * ユーザー入力をサニタイズ
 * @throws Error 危険なパターンが検出された場合
 */
export function sanitizeUserInput(input: string): string {
    // 空白をトリム
    const trimmed = input.trim();

    // 長さチェック
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
        throw new Error(`メッセージは${MAX_MESSAGE_LENGTH}文字以内で入力してください`);
    }

    // 空チェック
    if (trimmed.length === 0) {
        throw new Error('メッセージを入力してください');
    }

    // 危険なパターンをチェック
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(trimmed)) {
            console.warn('Potential prompt injection detected:', trimmed.substring(0, 50));
            throw new Error('無効な入力が検出されました');
        }
    }

    // 制御文字を除去
    const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '');

    return sanitized;
}

/**
 * 入力が安全かどうかをチェック（例外を投げない）
 */
export function isInputSafe(input: string): boolean {
    try {
        sanitizeUserInput(input);
        return true;
    } catch {
        return false;
    }
}
