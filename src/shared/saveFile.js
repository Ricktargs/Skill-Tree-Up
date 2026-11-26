// =========================================================
// SALVAR ARQUIVO (backup e exportações)
// PC e site: baixa o arquivo como sempre.
// Celular (APK): o "baixar" do navegador não funciona dentro do app, então
// pergunta para onde vai: pasta Documentos/ORBE-G do celular ou
// Google Drive / outro app (pela janela de compartilhar do Android).
// =========================================================
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { choose, inform } from './Dialog.jsx';
import { tx } from '../i18n/index.jsx';

const isNativeApp = () => {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  return Boolean(cap && cap.isNativePlatform && cap.isNativePlatform());
};

function download(fileName, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function shareFile(fileName, text, title) {
  await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
  await Share.share({ title, files: [uri], dialogTitle: tx('Salvar no Google Drive ou em outro app') });
}

async function saveToPhone(fileName, text) {
  try {
    await Filesystem.requestPermissions();
  } catch {
    /* Android 11+ não precisa */
  }
  await Filesystem.writeFile({
    path: `ORBE-G/${fileName}`,
    data: text,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true
  });
}

/** Salva um arquivo de texto. Devolve true se salvou (ou abriu o compartilhar). */
export async function saveTextFile(fileName, text, { mime = 'application/json', title = tx('Backup do ORBE-G'), question = tx('Onde salvar o backup?') } = {}) {
  if (!isNativeApp()) {
    download(fileName, text, mime);
    return true;
  }
  const where = await choose({
    title: question,
    message: fileName,
    options: [
      { value: 'phone', label: `📁 ${tx('Arquivos do celular')}`, hint: tx('Na pasta Documentos/ORBE-G') },
      { value: 'share', label: `☁️ ${tx('Google Drive ou outro app')}`, hint: tx('Escolha o Drive (ou outro lugar) na próxima tela') }
    ]
  });
  if (!where) return false;
  try {
    if (where === 'phone') {
      await saveToPhone(fileName, text);
      await inform({ title: tx('Arquivo salvo'), message: tx('Salvo em Documentos/ORBE-G/{f}', { f: fileName }) });
    } else {
      await shareFile(fileName, text, title);
    }
    return true;
  } catch (err) {
    const msg = String((err && err.message) || err || '');
    // fechou a janela de compartilhar sem escolher: não é erro
    if (/cancel/i.test(msg)) return false;
    if (where === 'phone') {
      // sem acesso à pasta: oferece mandar pelo compartilhar
      try {
        await shareFile(fileName, text, title);
        return true;
      } catch {
        /* cai no aviso abaixo */
      }
    }
    await inform({ title: tx('Não deu para salvar'), message: msg || tx('Tente a outra opção.') });
    return false;
  }
}
