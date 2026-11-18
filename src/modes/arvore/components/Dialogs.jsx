import { useEffect, useState } from "react";
import { ask, inform } from "../../../shared/Dialog.jsx";
import Modal from "./Modal";
import NoteForm from "./NoteForm";
import { useArvore } from "../state/contexts";
import { listRevisions } from "../lib/storage";
import { countDescendants, isValidTree } from "../lib/tree";
import { pointsForType, ROOT_ID } from "../lib/constants";
import { generateId } from "../lib/ids";
import { recordLabel } from "../lib/html";
import { sfx, setSoundSettings, useSoundSettings } from "../lib/sound";

/* ---------------- Nota rápida (salva no tronco) ---------------- */
export function QuickNoteModal({ onClose }) {
  const { commit, logPoints } = useArvore();
  return (
    <Modal title="Nova nota no Tronco" icon="📝" onClose={onClose}>
      <NoteForm
        autoFocusTitle
        titlePlaceholder="Ex.: Ideia rápida para o tronco..."
        submitLabel="Salvar no Tronco"
        onCancel={onClose}
        onSave={({ type, title, text }) => {
          const record = { id: generateId(), branchId: ROOT_ID, folderId: null, title, type, text, date: new Date().toISOString() };
          commit((d) => ({ ...d, records: [...d.records, record] }));
          logPoints(pointsForType(type), `Nota [${type}]: ${recordLabel(record, 24)}`);
          onClose();
        }}
      />
    </Modal>
  );
}

/* ---------------- Configurações ---------------- */
export function SettingsModal({ onClose, onShuffle, onOpenRevisions, onOpenInfo }) {
  const { data, commit, darkMode } = useArvore();
  const sound = useSoundSettings();

  const handleExport = () => {
    const backup = {
      app: "Eu Sou Árvore",
      version: 4,
      exportedAt: new Date().toISOString(),
      settings: { darkMode },
      ...data,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `eu-sou-arvore-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const backup = JSON.parse(reader.result);
        if (!backup || backup.app !== "Eu Sou Árvore" || !isValidTree(backup.tree)) {
          inform({ title: "Arquivo inválido", message: "Este arquivo não parece ser um backup da Árvore." });
          return;
        }
        const count = Array.isArray(backup.records) ? backup.records.length : 0;
        const ok = await ask({
          title: "Importar backup?",
          message: `O backup tem ${count} nota(s) e substitui os dados atuais.\n(Ctrl+Z desfaz)`,
          yes: "Importar",
        });
        if (!ok) return;
        commit(() => ({
          tree: backup.tree,
          records: Array.isArray(backup.records) ? backup.records.filter((r) => r && r.id) : [],
          offsets: backup.offsets && typeof backup.offsets === "object" ? backup.offsets : {},
          foldersMap: backup.foldersMap && typeof backup.foldersMap === "object" ? backup.foldersMap : {},
        }));
        onClose();
      } catch {
        inform({ title: "Erro", message: "Não foi possível ler o arquivo de backup." });
      }
    };
    reader.readAsText(file);
  };

  return (
    <Modal title="Configurações" icon="⚙️" onClose={onClose} width={440}>
      <section className="settings-section">
        <h4 className="section-title">Árvore</h4>
        <div className="settings-grid">
          <button type="button" className="tile" onClick={onShuffle} title="Ctrl + M">
            <span className="tile-icon">🔀</span>
            <span>Aleatorizar galhos</span>
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h4 className="section-title">Dados</h4>
        <div className="settings-grid three">
          <button type="button" className="tile" onClick={onOpenRevisions}>
            <span className="tile-icon">📜</span>
            <span>Restaurar</span>
          </button>
          <button type="button" className="tile" onClick={handleExport}>
            <span className="tile-icon">💾</span>
            <span>Exportar</span>
          </button>
          <label className="tile">
            <span className="tile-icon">📥</span>
            <span>Importar</span>
            <input type="file" accept=".json,application/json" onChange={handleImport} hidden />
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h4 className="section-title">Som</h4>
        <div className="settings-card">
          <label className="switch-row">
            <span>Efeitos sonoros</span>
            <input type="checkbox" className="switch" checked={sound.enabled} onChange={(e) => setSoundSettings({ enabled: e.target.checked })} />
          </label>
          <label className="switch-row">
            <span>Som ambiente <span className="muted">(vento e pássaros)</span></span>
            <input
              type="checkbox"
              className="switch"
              checked={sound.ambient}
              disabled={!sound.enabled}
              onChange={(e) => setSoundSettings({ ambient: e.target.checked })}
            />
          </label>
          <label className="switch-row">
            <span>Volume</span>
            <input
              type="range"
              className="slider"
              min="0"
              max="1"
              step="0.05"
              value={sound.volume}
              disabled={!sound.enabled}
              onChange={(e) => setSoundSettings({ volume: Number(e.target.value) })}
              onPointerUp={() => sfx.play("tick")}
            />
          </label>
        </div>
      </section>

      <button type="button" className="link-button footer-link" onClick={onOpenInfo}>
        ℹ️ Atalhos e dicas
      </button>
    </Modal>
  );
}

/* ---------------- Pontos de restauração ---------------- */
export function RevisionsModal({ onClose }) {
  const { commit } = useArvore();
  const [revisions, setRevisions] = useState(null);

  useEffect(() => {
    let alive = true;
    listRevisions().then((list) => alive && setRevisions(list));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Modal title="Pontos de restauração" icon="📜" onClose={onClose} width={480} className="tall">
      <p className="muted small">
        O app guarda 1 ponto de restauração por dia (o último estado do dia). Pontos com mais de 2 meses são apagados automaticamente.
      </p>
      <div className="modal-list">
        {revisions === null ? (
          <div className="empty">Carregando…</div>
        ) : revisions.length === 0 ? (
          <div className="empty">Nenhum ponto de restauração ainda.</div>
        ) : (
          revisions.map((rev) => (
            <div key={rev.dateKey} className="revision-item">
              <div>
                <strong>{rev.dateLabel}</strong>
                <div className="muted small">
                  {countDescendants(rev.tree)} galho(s) • {rev.records?.length || 0} nota(s)
                </div>
              </div>
              <button
                type="button"
                className="btn small btn-primary"
                onClick={async () => {
                  if (!(await ask({ title: "Restaurar esta versão?", message: `Versão de ${rev.dateLabel}.\n(Ctrl+Z desfaz)`, yes: "Restaurar" }))) return;
                  if (!isValidTree(rev.tree)) return inform({ title: "Não foi possível", message: "Este ponto de restauração está corrompido." });
                  sfx.play("save");
                  commit(() => ({
                    tree: rev.tree,
                    records: rev.records || [],
                    offsets: rev.offsets || {},
                    foldersMap: rev.foldersMap || {},
                  }));
                  onClose();
                }}
              >
                Restaurar
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

/* ---------------- Informações ---------------- */
export function InfoModal({ onClose }) {
  return (
    <Modal title="Atalhos e dicas" icon="ℹ️" onClose={onClose} width={460}>
      <ul className="info-list">
        <li><kbd>Clique</kbd> em um galho: abre o painel dele.</li>
        <li><kbd>Shift</kbd> + clique: abre mais um painel sem fechar os outros.</li>
        <li><kbd>Arrastar</kbd> um galho: reposiciona (os subgalhos vão junto).</li>
        <li><kbd>Segurar</kbd> um galho por 1,5s: modo de troca de posição.</li>
        <li><kbd>Arrastar</kbd> uma nota até um galho da árvore: move a nota (segurar em cima por 1s abre o galho).</li>
        <li><kbd>Roda do mouse</kbd>: zoom • <kbd>Espaço</kbd> 2x: centraliza a visão.</li>
        <li><kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd>: desfaz e refaz (na árvore ou dentro do editor da nota).</li>
        <li><kbd>Ctrl</kbd> + <kbd>M</kbd>: aleatoriza os galhos do tronco.</li>
        <li><kbd>Ctrl</kbd> + clique no ×: fecha todas as janelas.</li>
        <li><kbd>Esc</kbd>: fecha a janela da frente.</li>
        <li><kbd>Ctrl</kbd> + <kbd>S</kbd> no editor: salva a nota.</li>
      </ul>
      <p>Use <strong>[palavra]</strong> nas notas para criar cipós (conexões) entre galhos!</p>
      <div className="form-buttons">
        <button type="button" className="save-button primary" onClick={onClose}>Entendi</button>
      </div>
    </Modal>
  );
}
