import { useMemo, useState } from "react";
import FloatingWindow from "./FloatingWindow";
import { useArvore, useUi } from "../state/contexts";
import { getEffectiveBranchId, getItemName } from "../lib/folders";
import { stripHtml, recordLabel } from "../lib/html";

/** Janela de pesquisa em todas as notas. */
export default function SearchWindow(windowProps) {
  const { data } = useArvore();
  const { openNote, openLinkedBranch } = useUi();
  const [query, setQuery] = useState("");

  const indexed = useMemo(
    () =>
      data.records.map((r) => {
        const plain = stripHtml(r.text || "");
        const branchId = getEffectiveBranchId(data.tree, data.foldersMap, r);
        return {
          record: r,
          plain,
          haystack: `${r.title || ""} ${plain} ${r.type || ""}`.toLowerCase(),
          branchId,
          branchName: getItemName(data.tree, data.foldersMap, branchId),
        };
      }),
    [data]
  );

  const q = query.trim().toLowerCase();
  const results = (q ? indexed.filter((i) => i.haystack.includes(q)) : indexed).slice().reverse();

  return (
    <FloatingWindow {...windowProps} title="Pesquisar notas" icon="🔍" className="search-window" width={500} height={480} minWidth={320} minHeight={280}>
      <input
        className="search-input"
        type="search"
        placeholder="Digite para buscar em títulos e textos..."
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="muted small">{results.length} nota(s)</div>
      <div className="search-results">
        {results.length === 0 ? (
          <div className="empty">Nenhuma nota encontrada.</div>
        ) : (
          results.map(({ record, plain, branchId, branchName }) => (
            <button
              type="button"
              key={record.id}
              className="search-item"
              onClick={() => {
                openLinkedBranch(branchId);
                openNote(record.id);
              }}
            >
              <div className="row space-between">
                <strong className="ellipsis">{recordLabel(record, 50)}</strong>
                <span className="badge">{branchName}</span>
              </div>
              <div className="ellipsis muted small">{plain.replace(/\s+/g, " ") || "Nota sem conteúdo…"}</div>
            </button>
          ))
        )}
      </div>
    </FloatingWindow>
  );
}
