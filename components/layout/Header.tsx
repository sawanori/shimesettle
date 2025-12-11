'use client';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/actions/auth';

interface HeaderProps {
    userEmail?: string;
}

export function Header({ userEmail }: HeaderProps) {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b">
            <div className="max-w-6xl mx-auto px-4 sm:px-8 h-12 flex items-center justify-end gap-4">
                {userEmail && (
                    <span className="text-xs text-gray-500 hidden sm:inline">
                        {userEmail}
                    </span>
                )}
                <form action={signOut}>
                    <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        <LogOut className="h-4 w-4 mr-1" />
                        <span className="text-xs">ログアウト</span>
                    </Button>
                </form>
            </div>
        </header>
    );
}
