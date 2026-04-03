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
const FOLDER_MIME = 'application/vnd.google-apps.folder';

const MIME_TO_TYPE = {
    'application/pdf': 'pdf',
    'application/x-apple-diskimage': 'dmg',
    'application/x-diskcopy': 'dmg',
    'application/octet-stream': 'dmg',
    'application/vnd.android.package-archive': 'apk',
    'application/x-msdownload': 'exe',
    'application/x-msdos-program': 'exe',
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
    'application/x-rar-compressed': 'zip',
    'application/x-7z-compressed': 'zip',
    'application/gzip': 'zip',
    'application/x-tar': 'zip',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
    'application/vnd.google-apps.document': 'doc',
    'application/vnd.ms-excel': 'sheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'sheet',
    'application/vnd.google-apps.spreadsheet': 'sheet',
    'text/csv': 'sheet',
    'application/vnd.ms-powerpoint': 'doc',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'doc',
};

const EXT_TO_TYPE = {
    pdf: 'pdf', dmg: 'dmg', exe: 'exe', apk: 'apk',
    jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', heic: 'image',
    mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', m4v: 'video',
    mp3: 'audio', wav: 'audio', aac: 'audio', m4a: 'audio', flac: 'audio', ogg: 'audio',
    zip: 'zip', rar: 'zip', '7z': 'zip', tar: 'zip', gz: 'zip', bz2: 'zip',
    doc: 'doc', docx: 'doc',
    xls: 'sheet', xlsx: 'sheet', csv: 'sheet',
};

function resolveFileType(name, mimeType) {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (EXT_TO_TYPE[ext]) return EXT_TO_TYPE[ext];
    if (mimeType && MIME_TO_TYPE[mimeType]) return MIME_TO_TYPE[mimeType];
    if (mimeType) {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('video/')) return 'video';
        if (mimeType.startsWith('audio/')) return 'audio';
    }
    return 'file';
}

function formatSize(bytes) {
    if (!bytes) return 'N/A';
    const mb = bytes / 1024 / 1024;
    if (mb >= 1000) return (mb / 1024).toFixed(1) + ' GB';
    if (mb >= 1) return Math.round(mb) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
}

function mapFile(f) {
    return {
        name: f.name,
        url: `https://drive.google.com/uc?id=${f.id}&export=download&confirm=t`,
        size: formatSize(f.size),
        mimeType: f.mimeType || 'application/octet-stream',
        fileType: resolveFileType(f.fileExtension || f.name, f.mimeType),
    };
}

async function listFiles(drive, folderId) {
    const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, size, fileExtension)',
        orderBy: 'name',
    });
    return res.data.files || [];
}

async function syncDrive() {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const drive = google.drive({ version: 'v3', auth });

        const rootItems = await listFiles(drive, FOLDER_ID);

        const rootFiles = rootItems.filter(f => f.mimeType !== FOLDER_MIME);
        const subFolders = rootItems.filter(f => f.mimeType === FOLDER_MIME);

        // Grupos: arquivos da raiz sem grupo nomeado
        const groups = [];

        if (rootFiles.length > 0) {
            groups.push({
                name: null, // null = sem título (raiz)
                files: rootFiles.map(mapFile),
            });
        }

        // Arquivos de cada subpasta
        for (const folder of subFolders) {
            const items = await listFiles(drive, folder.id);
            const files = items.filter(f => f.mimeType !== FOLDER_MIME).map(mapFile);
            if (files.length > 0) {
                groups.push({
                    name: folder.name,
                    files,
                });
            }
        }

        const totalFiles = groups.reduce((acc, g) => acc + g.files.length, 0);

        const output = {
            updatedAt: new Date().toISOString(),
            groups,
        };

        if (!existsSync('./downloads')) mkdirSync('./downloads');
        writeFileSync('./downloads/arquivos.json', JSON.stringify(output, null, 2));

        console.log(`✅ Sincronizado: ${totalFiles} arquivos em ${groups.length} grupo(s).`);
    } catch (error) {
        console.error('❌ Erro ao acessar o Drive:', error.message);
        process.exit(1);
    }
}

syncDrive();