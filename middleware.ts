import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// 認証が必要なパス
const PROTECTED_PATHS = [
    '/',
    '/sales',
    '/expenses',
    '/management',
    '/bank',
];

// 認証が必要なAPIパス
const PROTECTED_API_PATHS = [
    '/api/analyze-receipt',
    '/api/analyze-invoice',
    '/api/export-csv',
    '/api/bank',
    '/api/sales',
];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 認証が必要なパスかチェック
    const isProtectedPath = PROTECTED_PATHS.some(path =>
        pathname === path || pathname.startsWith(path + '/')
    );
    const isProtectedApi = PROTECTED_API_PATHS.some(path =>
        pathname.startsWith(path)
    );

    if (!isProtectedPath && !isProtectedApi) {
        return NextResponse.next();
    }

    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // 未認証ユーザーの場合
    if (!user) {
        // APIリクエストの場合は401を返す
        if (isProtectedApi) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // ページリクエストの場合はログインページにリダイレクト
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         * - login page
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|login).*)',
    ],
};
