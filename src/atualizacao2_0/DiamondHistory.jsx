import React, { useState } from 'react';
import { tx, getLocale } from '../i18n/index.jsx';
import './DiamondHistory.css';

// =========================================================
// Histórico de diamantes e de missões — ambos leem o mesmo registro
// (diamondLog), salvo no perfil com data, hora e origem de cada ganho.
// =========================================================

const SOURCE_META = {
  mission: { icon: '📜', label: 'Missão' },
  bonus: { icon: '🎉', label: 'Bônus' },
  manual: { icon: '🛠️', label: 'Ajuste' },
  task: { icon: '✅', label: 'Tarefas' },
  upgrade: { icon: '⬆️', label: 'Upgrade' }
};

const toDayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dayLabel = (key) => {
  if (key === 'unknown') return tx('Data não registrada');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (key === toDayKey(today)) return tx('Hoje');
  if (key === toDayKey(yesterday)) return tx('Ontem');
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(getLocale(), {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: y === today.getFullYear() ? undefined : 'numeric'
  });
};

const timeLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
};

// Agrupa por dia (mais recente primeiro); entradas sem data vão para o fim
const groupByDay = (entries) => {
  const groups = new Map();
  entries.forEach((e) => {
    const d = e.at ? new Date(e.at) : null;
    const key = d && !isNaN(d.getTime()) ? toDayKey(d) : 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'unknown' ? 1 : b === 'unknown' ? -1 : b.localeCompare(a)))
    .map(([key, list]) => ({
      key,
      list: [...list].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)),
      total: list.reduce((n, e) => n + (e.amount || 0), 0)
    }));
};

const entryTitle = (e) => {
  if (e.source === 'mission') return e.text || tx('Missão concluída');
  if (e.source === 'bonus') return tx('Bônus: todas as missões do dia');
  if (e.source === 'task') return tx('Lista completa: {name}', { name: e.label || '' });
  return tx(e.label || 'Ajuste manual');
};

const entrySubtitle = (e) => {
  if (e.source === 'mission') return e.skillName ? `${e.skillName} · ${tx('Missão diária')}` : tx('Missão diária');
  if (e.source === 'bonus') return e.missionsCount ? tx('{n} missões concluídas', { n: e.missionsCount }) : tx('Missões do dia completas');
  if (e.source === 'upgrade') return tx('Upgrade de personagem');
  if (e.source === 'task') return tx('Todas as tarefas da lista concluídas');
  return tx('Painel de ajustes');
};

function HistoryList({ entries, emptyText }) {
  if (entries.length === 0) return <div className="dh-empty">{emptyText}</div>;

  return (
    <div className="dh-list">
      {groupByDay(entries).map((group) => (
        <div key={group.key} className="dh-group">
          <div className="dh-group-head">
            <span>{dayLabel(group.key)}</span>
            <span className={`dh-group-total ${group.total < 0 ? 'neg' : ''}`}>
              {group.total > 0 ? '+' : ''}
              {group.total} 💎
            </span>
          </div>
          {group.list.map((e) => {
            const meta = SOURCE_META[e.source] || SOURCE_META.manual;
            return (
              <div key={e.id} className={`dh-entry ${e.source}`}>
                <span className="dh-entry-icon">{meta.icon}</span>
                <div className="dh-entry-body">
                  <span className="dh-entry-title">{entryTitle(e)}</span>
                  <span className="dh-entry-sub">
                    {entrySubtitle(e)}
                    {e.at && ` · ${timeLabel(e.at)}`}
                  </span>
                </div>
                <span className={`dh-amount ${e.amount < 0 ? 'neg' : ''}`}>
                  {e.amount > 0 ? '+' : ''}
                  {e.amount} 💎
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function HistoryShell({ title, subtitle, onClose, playSound, children }) {
  const close = () => {
    if (playSound) playSound('click');
    onClose();
  };
  return (
    <div className="modal-backdrop high-z-backdrop" onClick={close}>
      <div className="modal-window dh-window high-z-window" onClick={(e) => e.stopPropagation()}>
        <div className="dh-header">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="dh-close" onClick={close} title={tx("Fechar (Esc)")}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Histórico de Diamantes (clicando no contador da tela inicial) ----------
export function DiamondHistoryModal({ isOpen, onClose, diamondLog = [], diamonds = 0, playSound }) {
  const [filter, setFilter] = useState('all');
  if (!isOpen) return null;

  const todayKey = toDayKey(new Date());
  const earnedToday = diamondLog
    .filter((e) => e.at && toDayKey(new Date(e.at)) === todayKey && e.amount > 0)
    .reduce((n, e) => n + e.amount, 0);
  const fromMissions = diamondLog.filter((e) => e.source === 'mission' || e.source === 'bonus').reduce((n, e) => n + e.amount, 0);
  const logged = diamondLog.reduce((n, e) => n + (e.amount || 0), 0);
  const beforeHistory = diamonds - logged;

  const visible = filter === 'all' ? diamondLog : diamondLog.filter((e) => e.source === filter);
  const counts = {
    all: diamondLog.length,
    mission: diamondLog.filter((e) => e.source === 'mission').length,
    bonus: diamondLog.filter((e) => e.source === 'bonus').length,
    manual: diamondLog.filter((e) => e.source === 'manual').length,
    task: diamondLog.filter((e) => e.source === 'task').length,
    upgrade: diamondLog.filter((e) => e.source === 'upgrade').length
  };

  return (
    <HistoryShell title={tx("💎 Histórico de Diamantes")} subtitle={tx("De onde veio cada diamante")} onClose={onClose} playSound={playSound}>
      <div className="dh-stats">
        <div className="dh-stat main">
          <span className="dh-stat-value">{diamonds}</span>
          <span className="dh-stat-label">{tx("Saldo atual")}</span>
        </div>
        <div className="dh-stat">
          <span className="dh-stat-value">+{earnedToday}</span>
          <span className="dh-stat-label">{tx("Ganhos hoje")}</span>
        </div>
        <div className="dh-stat">
          <span className="dh-stat-value">{fromMissions}</span>
          <span className="dh-stat-label">{tx("Vindos de missões")}</span>
        </div>
      </div>

      <div className="dh-filters">
        {[
          ['all', 'Tudo'],
          ['mission', '📜 Missões'],
          ['bonus', '🎉 Bônus'],
          ['task', '✅ Tarefas'],
          ['manual', '🛠️ Ajustes'],
          ['upgrade', '⬆️ Upgrades']
        ].map(([value, label]) =>
          value !== 'all' && counts[value] === 0 ? null : (
            <button
              key={value}
              type="button"
              className={filter === value ? 'active' : ''}
              onClick={() => {
                if (playSound) playSound('click');
                setFilter(value);
              }}
            >
              {tx(label)}
              <span>{counts[value]}</span>
            </button>
          )
        )}
      </div>

      <HistoryList
        entries={visible}
        emptyText={tx("Nenhum diamante registrado ainda. Conclua missões diárias para ganhar diamantes!")}
      />

      {beforeHistory !== 0 && filter === 'all' && (
        <div className="dh-footnote">
          {beforeHistory > 0 ? `+${beforeHistory}` : beforeHistory}{' '}{tx("💎 de antes do histórico começar a ser registrado.")}
        </div>
      )}
    </HistoryShell>
  );
}

// ---------- Histórico de Missões (botão "Histórico" nas Missões de Hoje) ----------
export function MissionHistoryModal({ isOpen, onClose, diamondLog = [], playSound }) {
  if (!isOpen) return null;

  const entries = diamondLog.filter((e) => e.source === 'mission' || e.source === 'bonus');
  const missions = entries.filter((e) => e.source === 'mission');
  const earned = entries.reduce((n, e) => n + (e.amount || 0), 0);
  const activeDays = new Set(missions.filter((e) => e.at).map((e) => toDayKey(new Date(e.at)))).size;

  return (
    <HistoryShell
      title={tx("📜 Histórico de Missões")}
      subtitle={tx("Missões concluídas, com data e hora")}
      onClose={onClose}
      playSound={playSound}
    >
      <div className="dh-stats">
        <div className="dh-stat main">
          <span className="dh-stat-value">{missions.length}</span>
          <span className="dh-stat-label">{tx("Missões concluídas")}</span>
        </div>
        <div className="dh-stat">
          <span className="dh-stat-value">+{earned}</span>
          <span className="dh-stat-label">{tx("Diamantes ganhos")}</span>
        </div>
        <div className="dh-stat">
          <span className="dh-stat-value">{activeDays}</span>
          <span className="dh-stat-label">{tx("Dias com missões")}</span>
        </div>
      </div>

      <HistoryList entries={entries} emptyText={tx("Nenhuma missão concluída ainda.")} />
    </HistoryShell>
  );
}
