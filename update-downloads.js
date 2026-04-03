import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { google } from 'googleapis';

let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
} catch (e) {
    console.error("Erro: A variável GOOGLE_SERVICE_ACCOUNT_KEY não é um JSON válido.");
    process.exit(1);
}

const FOLDER_ID = '1Yp2dr9832tOuheqvvMZ6iMrNKgH1T5l1';

function formatSize(bytes) {
    if (!bytes) return 'N/A';
    const mb = bytes / 1024 / 1024;
    if (mb >= 1000) return (mb / 1024).toFixed(1) + ' GB';
    if (mb >= 1) return Math.round(mb) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
}

async function syncDrive() {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const drive = google.drive({ version: 'v3', auth });

        const res = await drive.files.list({
            q: `'${FOLDER_ID}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, size)',
        });

        const files = res.data.files.map(f => ({
            name: f.name,
            url: `https://drive.google.com/uc?id=${f.id}&export=download&confirm=t`,
            size: formatSize(f.size),
            mimeType: f.mimeType || 'application/octet-stream',
        }));

        const output = {
            updatedAt: new Date().toISOString(),
            files,
        };

        if (!existsSync('./downloads')) mkdirSync('./downloads');
        writeFileSync('./downloads/arquivos.json', JSON.stringify(output, null, 2));

        console.log(`✅ Sincronizado: ${files.length} arquivos encontrados.`);
    } catch (error) {
        console.error('❌ Erro ao acessar o Drive:', error.message);
        process.exit(1);
    }
}

syncDrive();
