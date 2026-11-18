import { useState } from "react";
import { ask } from "../../../shared/Dialog.jsx";
import { useArvore } from "../state/contexts";
import { BRANCH_POINTS, pointsForType, ROOT_ID } from "../lib/constants";
import { generateId } from "../lib/ids";
import { recordLabel } from "../lib/html";

const PER_PAGE = 8;

/** Contador de pontos + histórico de evolução. */
export default function PointsWidget() {
  const { data, points, pointsLog, setPointsLog } = useArvore();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(pointsLog.length / PER_PAGE));
  const current = Math.min(page, totalPages);
  const items = pointsLog.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const rebuild = async () => {
    if (!(await ask({ title: "Recriar o histórico de pontos?", message: "Ele é recalculado com base em tudo que existe na árvore hoje.", yes: "Recriar" }))) return;
    const log = [];
    let total = 0;
    const now = new Date().toLocaleString("pt-BR");
    const walk = (node, depth) => {
      for (const child of node.children || []) {
        const pts = (depth === 1 ? BRANCH_POINTS.main : BRANCH_POINTS.sub) + BRANCH_POINTS.growth;
        total += pts;
        log.push({ id: generateId(), pontos: pts, total, descricao: `${depth === 1 ? "Galho" : "Subgalho"}: ${child.name}`, data: now });
        walk(child, depth + 1);
      }
    };
    if (data.tree.id === ROOT_ID) walk(data.tree, 1);
    for (const r of data.records) {
      const pts = pointsForType(r.type);
      total += pts;
      log.push({
        id: generateId(),
        pontos: pts,
        total,
        descricao: `Nota [${r.type || "Ideia"}]: ${recordLabel(r, 24)}`,
        data: r.date ? new Date(r.date).toLocaleString("pt-BR") : now,
      });
    }
    setPointsLog(log.reverse());
    setPage(1);
  };

  return (
    <div className="points-widget">
      {open && (
        <div className="points-panel">
          <div className="points-header">
            <div>
              <div className="section-title">Evolução</div>
              <div className="points-total">{points} <span>pontos</span></div>
            </div>
            <button type="button" className="link-button" onClick={rebuild} title="Recalcular o histórico a partir dos dados atuais">
              🔄 Sincronizar
            </button>
          </div>
          <div className="points-list">
            {items.length === 0 ? (
              <span className="muted small">Nenhum registro ainda.</span>
            ) : (
              items.map((item) => (
                <div key={item.id} className="points-item">
                  <div className="row space-between strong">
                    <span className="ellipsis">{item.descricao}</span>
                    <span className="gain">+{item.pontos}</span>
                  </div>
                  <div className="row space-between muted tiny">
                    <span>{item.data}</span>
                    <span>Total: {item.total} pts</span>
                  </div>
                </div>
              ))
            )}
          </div>
          {totalPages > 1 && (
            <div className="row space-between">
              <button type="button" className="btn small" disabled={current <= 1} onClick={() => setPage(current - 1)}>←</button>
              <span className="muted tiny">{current} / {totalPages}</span>
              <button type="button" className="btn small" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>→</button>
            </div>
          )}
        </div>
      )}
      <button type="button" className="points-pill" onClick={() => setOpen((v) => !v)} title="Ver evolução">
        <span>🌱</span>
        <strong>{points} pts</strong>
      </button>
    </div>
  );
}
