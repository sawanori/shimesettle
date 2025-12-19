import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export type ChatErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INVALID_QUERY'
  | 'NO_DATA'
  | 'INTERNAL_ERROR';

export interface ChatErrorResponse {
  error: string;
  code: ChatErrorCode;
  details?: string;
}

export const ChatErrors = {
  UNAUTHORIZED: {
    error: '認証が必要です',
    code: 'UNAUTHORIZED' as const,
    statusCode: 401,
  },
  RATE_LIMITED: {
    error: 'リクエスト制限に達しました。しばらく待ってから再度お試しください。',
    code: 'RATE_LIMITED' as const,
    statusCode: 429,
  },
  INVALID_QUERY: {
    error: '質問を理解できませんでした。別の言い方でお試しください。',
    code: 'INVALID_QUERY' as const,
    statusCode: 400,
  },
  NO_DATA: {
    error: '該当するデータがありません',
    code: 'NO_DATA' as const,
    statusCode: 200,
  },
  INTERNAL_ERROR: {
    error: 'エラーが発生しました。しばらく待ってから再度お試しください。',
    code: 'INTERNAL_ERROR' as const,
    statusCode: 500,
  },
} as const;

export function createErrorResponse(
  error: keyof typeof ChatErrors,
  details?: string
): NextResponse {
  const errorInfo = ChatErrors[error];
  return NextResponse.json(
    {
      error: errorInfo.error,
      code: errorInfo.code,
      details,
    },
    { status: errorInfo.statusCode }
  );
}

export function formatZodError(error: ZodError): string {
  return error.issues.map((e) => e.message).join(', ');
}

export function handleApiError(error: unknown): NextResponse {
  console.error('Chat API Error:', error);

  if (error instanceof ZodError) {
    return createErrorResponse('INVALID_QUERY', formatZodError(error));
  }

  if (error instanceof Error) {
    if (error.message.includes('rate limit')) {
      return createErrorResponse('RATE_LIMITED');
    }
    if (error.message.includes('unauthorized')) {
      return createErrorResponse('UNAUTHORIZED');
    }
  }

  return createErrorResponse('INTERNAL_ERROR');
}
