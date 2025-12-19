import fs from 'fs';
import path from 'path';

console.log('--- Verifying Chat Feature Week 3 Implementation ---\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`✅ ${message}`);
        passed++;
    } else {
        console.error(`❌ ${message}`);
        failed++;
    }
}

const COMPONENTS_DIR = path.join(process.cwd(), 'components/chat');
const HOOKS_DIR = path.join(process.cwd(), 'hooks');
const API_DIR = path.join(process.cwd(), 'app/api/chat/suggestions');

// 1. Check Files Existence
console.log('\n[File Existence]');
const requiredFiles = [
    { dir: COMPONENTS_DIR, name: 'ChatWidget.tsx' },
    { dir: COMPONENTS_DIR, name: 'ChatContainer.tsx' },
    { dir: COMPONENTS_DIR, name: 'ChatHeader.tsx' },
    { dir: COMPONENTS_DIR, name: 'ChatMessages.tsx' },
    { dir: COMPONENTS_DIR, name: 'ChatMessage.tsx' },
    { dir: COMPONENTS_DIR, name: 'ChatInput.tsx' },
    { dir: COMPONENTS_DIR, name: 'ChatSuggestions.tsx' },
    { dir: COMPONENTS_DIR, name: 'DataTable.tsx' },
    { dir: HOOKS_DIR, name: 'useChatMessages.ts' },
    { dir: API_DIR, name: 'route.ts' },
];

requiredFiles.forEach(file => {
    const filePath = path.join(file.dir, file.name);
    assert(fs.existsSync(filePath), `File exists: ${file.name}`);
});

// 2. Basic Syntax Check (simple grep for export/import)
console.log('\n[Basic Syntax Check]');
requiredFiles.forEach(file => {
    const filePath = path.join(file.dir, file.name);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const hasExport = content.includes('export');
        assert(hasExport, `${file.name} has export statement`);
    }
});

console.log(`\n--- Summary: ${passed} Passed, ${failed} Failed ---`);
if (failed > 0) process.exit(1);
