import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { google } from 'googleapis';

// 1. Tenta carregar a chave que você salvou no GitHub Secrets
let serviceAccount;
try {
    serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
} catch (e) {
    console.error("Erro: A variável GOOGLE_SERVICE_ACCOUNT_KEY não é um JSON válido.");
    process.exit(1);
}

// 2. COLOQUE O ID DA SUA PASTA AQUI
const FOLDER_ID = '1Yp2dr9832tOuheqvvMZ6iMrNKgH1T5l1';

async function syncDrive() {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // Busca arquivos que não estão na lixeira
        const res = await drive.files.list({
            q: `'${FOLDER_ID}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, size)',
        });

        const files = res.data.files.map(f => ({
            name: f.name,
            // Gera link de download direto
            url: `https://drive.google.com/uc?id=${f.id}&export=download&confirm=t`,
            size: f.size ? (f.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'
        }));

        // Cria a pasta downloads se não existir e salva o resultado
        if (!existsSync('./downloads')) mkdirSync('./downloads');
        writeFileSync('./downloads/arquivos.json', JSON.stringify(files, null, 2));
        
        console.log(`✅ Sincronizado: ${files.length} arquivos encontrados.`);
    } catch (error) {
        console.error('❌ Erro ao acessar o Drive:', error.message);
        process.exit(1);
    }
}

syncDrive();
