import { memo, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { portalRoot } from "../lib/portal";
import { useArvore, useUi } from "../state/contexts";
import { noteToHtml, linkifyTags, stripHtml, escapeHtml, recordHasTag, recordLabel } from "../lib/html";
import { getEffectiveBranchId, getItemName } from "../lib/folders";

/**
 * Mostra o conteúdo de uma nota com as [tags] clicáveis.
 * plain=true mostra só o texto (para os cartões compactos).
 */
function RichText({ text, recordId, plain = false, className = "", as: Tag = "div" }) {
  const { data } = useArvore();
  const { openNote, openLinkedBranch } = useUi();
  const [popover, setPopover] = useState(null);
  const hideTimer = useRef(null);

  const html = useMemo(() => {
    const base = plain ? escapeHtml(stripHtml(text || "")).replace(/\n/g, " ") : noteToHtml(text || "");
    return linkifyTags(base);
  }, [text, plain]);

  const related = useMemo(() => {
    if (!popover) return [];
    return data.records.filter((r) => r.id !== recordId && recordHasTag(r, popover.tag));
  }, [popover, data.records, recordId]);

  const openRecord = (rec) => {
    openLinkedBranch(getEffectiveBranchId(data.tree, data.foldersMap, rec));
    openNote(rec.id);
  };

  const findRelated = (tag) => data.records.filter((r) => r.id !== recordId && recordHasTag(r, tag));

  const handleClick = (e) => {
    const el = e.target.closest(".tag-link");
    if (!el) return;
    e.stopPropagation();
    e.preventDefault();
    const first = findRelated(el.dataset.tag)[0];
    if (first) openRecord(first);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && e.target.classList?.contains("tag-link")) handleClick(e);
  };

  const show = (e) => {
    const el = e.target.closest?.(".tag-link");
    if (!el) return;
    clearTimeout(hideTimer.current);
    const rect = el.getBoundingClientRect();
    setPopover({ tag: el.dataset.tag, word: el.textContent.slice(1, -1), rect });
  };

  const scheduleHide = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setPopover(null), 180);
  };

  const popoverStyle = popover
    ? (() => {
        const width = 260;
        const left = Math.min(Math.max(8, popover.rect.left + popover.rect.width / 2 - width / 2), window.innerWidth - width - 8);
        const above = popover.rect.top > 220;
        return above
          ? { left, width, bottom: window.innerHeight - popover.rect.top + 6 }
          : { left, width, top: popover.rect.bottom + 6 };
      })()
    : null;

  return (
    <>
      <Tag
        className={`rich-text ${className}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseOver={show}
        onFocus={show}
        onMouseOut={(e) => e.target.closest?.(".tag-link") && scheduleHide()}
        onBlur={scheduleHide}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {popover &&
        createPortal(
          <div
            className="tag-popover"
            style={popoverStyle}
            onMouseEnter={() => clearTimeout(hideTimer.current)}
            onMouseLeave={scheduleHide}
          >
            <div className="tag-popover-header">
              Outras notas com <strong>[{popover.word}]</strong> ({related.length})
            </div>
            {related.length === 0 ? (
              <div className="tag-popover-empty">Nenhuma outra nota conectada.</div>
            ) : (
              <ul className="tag-popover-list">
                {related.map((rel) => (
                  <li key={rel.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        openRecord(rel);
                        setPopover(null);
                      }}
                    >
                      <span className="badge">{getItemName(data.tree, data.foldersMap, getEffectiveBranchId(data.tree, data.foldersMap, rel))}</span>
                      <span className="ellipsis">{recordLabel(rel, 40)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          portalRoot()
        )}
    </>
  );
}

export default memo(RichText);
