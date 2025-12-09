'use client';

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';

interface PdfThumbnailProps {
    url: string;
    className?: string;
}

export function PdfThumbnail({ url, className = '' }: PdfThumbnailProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    if (hasError) {
        return (
            <div className={`flex flex-col items-center justify-center text-gray-400 ${className}`}>
                <FileText className="h-12 w-12 mb-2" />
                <span className="text-xs">PDF</span>
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            )}
            <iframe
                src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                className="w-full h-full border-0 pointer-events-none"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                    setHasError(true);
                    setIsLoading(false);
                }}
                title="PDF Preview"
                style={{
                    transform: 'scale(1)',
                    transformOrigin: 'top left'
                }}
            />
            {/* Overlay to prevent browser controls on hover */}
            <div className="absolute inset-0 bg-transparent z-20" />
        </div>
    );
}
