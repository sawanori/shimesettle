'use client';

import { useState } from 'react';
import { Document } from '@/types/supabase';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FileText, Image as ImageIcon, Eye, Trash2, Download, Calendar, AlertCircle, FileImage, File } from 'lucide-react';
import { PdfThumbnail } from './PdfThumbnail';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
    certificate: '証明書',
    license: '許可証・免許証',
    registration: '登記書類',
    contract: '契約書',
    insurance: '保険証書',
    tax: '税務書類',
    financial: '財務書類',
    other: 'その他',
};

interface DocumentListProps {
    documents: Document[];
    onDelete?: () => void;
}

export function DocumentList({ documents, onDelete }: DocumentListProps) {
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<Document | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [filterType, setFilterType] = useState<string>('all');

    const filteredDocuments = filterType === 'all'
        ? documents
        : documents.filter(d => d.document_type === filterType);

    const isExpiringSoon = (expiryDate: string | null) => {
        if (!expiryDate) return false;
        const expiry = new Date(expiryDate);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    };

    const isExpired = (expiryDate: string | null) => {
        if (!expiryDate) return false;
        return new Date(expiryDate) < new Date();
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        setIsDeleting(true);

        try {
            const supabase = createClient();
            const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', deleteConfirm.id);

            if (error) throw error;

            setDeleteConfirm(null);
            onDelete?.();
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('削除に失敗しました');
        } finally {
            setIsDeleting(false);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('ja-JP');
    };

    const isImageFile = (fileType: string | null) => {
        return fileType?.startsWith('image/');
    };

    const isPdfFile = (fileType: string | null) => {
        return fileType === 'application/pdf';
    };

    if (documents.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>登録されている書類はありません</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 w-full">
            {/* フィルター */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-sm text-gray-500">種別で絞り込み:</span>
                <div className="flex items-center gap-2">
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-40 sm:w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">すべて</SelectItem>
                            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-500">
                        {filteredDocuments.length}件
                    </span>
                </div>
            </div>

            {/* 書類一覧 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocuments.map((doc) => (
                    <Card key={doc.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <div
                            className="h-48 bg-gray-50 flex items-center justify-center cursor-pointer relative group overflow-hidden"
                            onClick={() => setSelectedDocument(doc)}
                        >
                            {isImageFile(doc.file_type) ? (
                                <>
                                    <img
                                        src={doc.file_path}
                                        alt={doc.title}
                                        className="w-full h-full object-contain bg-white"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                    </div>
                                </>
                            ) : isPdfFile(doc.file_type) ? (
                                <>
                                    <PdfThumbnail url={doc.file_path} className="w-full h-full bg-white" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-gray-500 transition-colors">
                                    <File className="h-16 w-16 mb-2" />
                                    <span className="text-xs uppercase tracking-wide">
                                        {doc.file_type?.split('/')[1] || 'FILE'}
                                    </span>
                                </div>
                            )}
                            {isExpired(doc.expiry_date) && (
                                <Badge variant="destructive" className="absolute top-2 right-2">
                                    期限切れ
                                </Badge>
                            )}
                            {isExpiringSoon(doc.expiry_date) && !isExpired(doc.expiry_date) && (
                                <Badge variant="secondary" className="absolute top-2 right-2 bg-yellow-500 text-white">
                                    まもなく期限
                                </Badge>
                            )}
                            {isImageFile(doc.file_type) && (
                                <Badge variant="secondary" className="absolute bottom-2 left-2 bg-blue-500 text-white text-xs">
                                    <FileImage className="h-3 w-3 mr-1" />
                                    画像
                                </Badge>
                            )}
                            {isPdfFile(doc.file_type) && (
                                <Badge variant="secondary" className="absolute bottom-2 left-2 bg-red-500 text-white text-xs">
                                    <FileText className="h-3 w-3 mr-1" />
                                    PDF
                                </Badge>
                            )}
                        </div>
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-medium truncate" title={doc.title}>
                                        {doc.title}
                                    </h3>
                                    <Badge variant="outline" className="mt-1">
                                        {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                                    </Badge>
                                </div>
                            </div>
                            {doc.expiry_date && (
                                <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                                    <Calendar className="h-3 w-3" />
                                    <span>有効期限: {formatDate(doc.expiry_date)}</span>
                                </div>
                            )}
                            <div className="flex gap-2 mt-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => setSelectedDocument(doc)}
                                >
                                    <Eye className="h-4 w-4 mr-1" />
                                    詳細
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDeleteConfirm(doc)}
                                >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* 詳細ダイアログ */}
            <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedDocument?.title}</DialogTitle>
                        <DialogDescription>
                            {DOCUMENT_TYPE_LABELS[selectedDocument?.document_type || ''] || selectedDocument?.document_type}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedDocument && (
                            <>
                                <div className="bg-gray-100 rounded-lg overflow-hidden">
                                    {isImageFile(selectedDocument.file_type) ? (
                                        <img
                                            src={selectedDocument.file_path}
                                            alt={selectedDocument.title}
                                            className="w-full max-h-[500px] object-contain bg-white"
                                        />
                                    ) : isPdfFile(selectedDocument.file_type) ? (
                                        <div className="h-[400px] bg-white">
                                            <PdfThumbnail url={selectedDocument.file_path} className="w-full h-full" />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                                            <File className="h-16 w-16 mb-2" />
                                            <span className="text-sm">{selectedDocument.file_name}</span>
                                            <span className="text-xs mt-1 uppercase">
                                                {selectedDocument.file_type?.split('/')[1] || 'ファイル'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {selectedDocument.description && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-500">説明</h4>
                                        <p className="mt-1">{selectedDocument.description}</p>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">発行日:</span>
                                        <span className="ml-2">{formatDate(selectedDocument.issue_date)}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">有効期限:</span>
                                        <span className={`ml-2 ${isExpired(selectedDocument.expiry_date) ? 'text-red-500 font-medium' : ''}`}>
                                            {formatDate(selectedDocument.expiry_date)}
                                            {isExpired(selectedDocument.expiry_date) && ' (期限切れ)'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">ファイル名:</span>
                                        <span className="ml-2">{selectedDocument.file_name}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">登録日:</span>
                                        <span className="ml-2">{formatDate(selectedDocument.created_at)}</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedDocument(null)}>
                            閉じる
                        </Button>
                        <Button asChild>
                            <a href={selectedDocument?.file_path} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4 mr-2" />
                                ダウンロード
                            </a>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 削除確認ダイアログ */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>書類を削除</DialogTitle>
                        <DialogDescription>
                            「{deleteConfirm?.title}」を削除してもよろしいですか？
                            この操作は取り消せません。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                            キャンセル
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? '削除中...' : '削除'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
