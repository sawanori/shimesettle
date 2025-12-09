'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Document } from '@/types/supabase';
import { DocumentForm } from './DocumentForm';
import { DocumentList } from './DocumentList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

export function DocumentsPageClient() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('list');

    const fetchDocuments = async () => {
        setIsLoading(true);
        try {
            const supabase = createClient();
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments(data || []);
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    const handleFormSuccess = () => {
        fetchDocuments();
        setActiveTab('list');
    };

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="list">書類一覧</TabsTrigger>
                <TabsTrigger value="upload">新規登録</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <DocumentList documents={documents} onDelete={fetchDocuments} />
                )}
            </TabsContent>

            <TabsContent value="upload" className="mt-6">
                <div className="max-w-xl">
                    <DocumentForm onSuccess={handleFormSuccess} />
                </div>
            </TabsContent>
        </Tabs>
    );
}
