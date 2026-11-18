// =========================================================
// Gera src/shared/nanquim.generated.css a partir do CSS das Habilidades.
// Cada regra com cor é repetida com o prefixo do tema Nanquim e as cores
// traduzidas (claro e noturno). O CSS original fica intacto (Gameficado).
//   npm run nanquim
// =========================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { mapValue, roleOf } from '../src/shared/nanquimColors.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'src/index.css',
  'src/App.css',
  'src/SetMobileGrande.css',
  'src/SetMobilePequeno.css',
  'src/Responsive.css',
  ...fs
    .readdirSync(path.join(ROOT, 'src/atualizacao2_0'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => `src/atualizacao2_0/${f}`)
];

// As cores saem como variáveis (--nq-*): uma só versão serve para todos os
// temas do Nanquim, no claro e no noturno
const PREFIX = "html[data-ui-theme='nanquim']";

// Variáveis CSS: o nome diz o papel da cor
const roleOfCustom = (prop) => {
  const p = prop.toLowerCase();
  if (/accent|glow|neon|highlight/.test(p)) return null; // cor do tema: fica
  if (/text|muted|ink|label|title/.test(p)) return 'text';
  if (/border|line|stroke/.test(p)) return 'line';
  if (/bg|background|modal|surface|panel|card|box|paper|wash/.test(p)) return 'bg';
  return null;
};

const prefixSelector = (sel, prefix) =>
  sel
    .split(',')
    .map((part) => {
      const s = part.trim();
      if (!s) return s;
      if (/^:root\b/.test(s)) return s.replace(/^:root/, prefix);
      if (/^html\b/.test(s)) return s.replace(/^html/, prefix);
      return `${prefix} ${s}`;
    })
    .join(', ');

const insideKeyframes = (node) => {
  let p = node.parent;
  while (p) {
    if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return true;
    p = p.parent;
  }
  return false;
};

function convert(css, prefix) {
  const root = postcss.parse(css);
  const out = postcss.root();
  root.walkRules((rule) => {
    if (insideKeyframes(rule)) return;
    const decls = [];
    rule.each((node) => {
      if (node.type !== 'decl') return;
      const role = node.prop.startsWith('--') ? roleOfCustom(node.prop) : roleOf(node.prop);
      if (!role) return;
      const value = mapValue(node.value, role);
      if (value !== node.value) decls.push(postcss.decl({ prop: node.prop, value, important: node.important }));
    });
    if (decls.length === 0) return;
    const clone = postcss.rule({ selector: prefixSelector(rule.selector, prefix) });
    decls.forEach((d) => clone.append(d));
    // Mantém os @media em volta
    let target = clone;
    let parent = rule.parent;
    while (parent && parent.type === 'atrule') {
      const wrap = postcss.atRule({ name: parent.name, params: parent.params });
      wrap.append(target);
      target = wrap;
      parent = parent.parent;
    }
    out.append(target);
  });
  return out.toString();
}

let result = '/* GERADO por scripts/build-nanquim.mjs — não editar à mão (npm run nanquim) */\n';
for (const file of FILES) {
  const css = fs.readFileSync(path.join(ROOT, file), 'utf8');
  result += `\n/* ===== ${file} ===== */\n${convert(css, PREFIX)}\n`;
}
const target = path.join(ROOT, 'src/shared/nanquim.generated.css');
fs.writeFileSync(target, result);
console.log(`ok: ${path.relative(ROOT, target)} (${Math.round(result.length / 1024)} KB)`);
