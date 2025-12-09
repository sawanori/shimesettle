/**
 * API Security Utilities
 *
 * Centralized security logic for SSRF protection and rate limiting.
 * Used by analyze-invoice and analyze-receipt API routes.
 */

// ============================================
// SSRF Protection
// ============================================

/**
 * Allowed domains for URL validation (SSRF protection)
 */
const ALLOWED_DOMAINS = [
    'supabase.co',
    'supabase.com',
];

/**
 * Validates if a URL is allowed for fetching.
 * Protects against SSRF attacks by:
 * - Blocking private IPs and localhost
 * - Requiring HTTPS protocol
 * - Allowing only Supabase Storage URLs
 *
 * @param url - The URL to validate
 * @returns true if the URL is allowed, false otherwise
 */
export function isAllowedUrl(url: string): boolean {
    try {
        const parsed = new URL(url);

        // Block private IPs and localhost
        const hostname = parsed.hostname.toLowerCase();
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '0.0.0.0' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.') ||
            hostname.endsWith('.local') ||
            hostname.endsWith('.internal')
        ) {
            return false;
        }

        // Only allow HTTPS
        if (parsed.protocol !== 'https:') {
            return false;
        }

        // Allow Supabase Storage URLs (project URL check)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (supabaseUrl && url.startsWith(supabaseUrl)) {
            return true;
        }

        // Check against allowed domains
        return ALLOWED_DOMAINS.some(domain => hostname.endsWith(domain));
    } catch {
        return false;
    }
}

// ============================================
// Rate Limiting
// ============================================

/**
 * In-memory rate limit storage
 * Note: In production, consider using Redis for distributed systems
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Maximum requests per window
 */
const RATE_LIMIT_MAX = 10;

/**
 * Rate limit window in milliseconds (1 minute)
 */
const RATE_LIMIT_WINDOW = 60 * 1000;

/**
 * Checks if a user has exceeded the rate limit.
 *
 * @param userId - The user ID to check
 * @returns true if the request is allowed, false if rate limited
 */
export function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
        rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (userLimit.count >= RATE_LIMIT_MAX) {
        return false;
    }

    userLimit.count++;
    return true;
}
