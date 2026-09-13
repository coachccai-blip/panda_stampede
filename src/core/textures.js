// Art procédural (§13) : silhouettes rondes, lisibles, générées au boot.
// Aucun sprite externe — tout est dessiné puis converti en texture GPU.

import { SPECIES } from '../data/enemies.js';
import { STYLES } from '../data/styles.js';

const SIZE = 96;

function shade(color, amount) {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = amount >= 0
    ? (v) => Math.round(v + (255 - v) * amount)
    : (v) => Math.round(v * (1 + amount));
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

/**
 * Dessine une unité vue de dos (elle court vers l'horizon).
 * Origine : bas-centre de la texture.
 */
function drawUnit(g, key, bodyColor, accentColor) {
  const cx = SIZE / 2;
  const baseY = SIZE - 6;
  const dark = shade(bodyColor, -0.35);
  const light = shade(bodyColor, 0.25);

  // ombre douce au sol
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(cx, baseY + 2, 46, 12);

  switch (key) {
    case 'elephant': {
      g.fillStyle(dark, 1); g.fillEllipse(cx - 26, baseY - 44, 34, 40);
      g.fillStyle(dark, 1); g.fillEllipse(cx + 26, baseY - 44, 34, 40);
      g.fillStyle(bodyColor, 1); g.fillEllipse(cx, baseY - 26, 56, 46);
      g.fillStyle(light, 1); g.fillEllipse(cx, baseY - 50, 40, 36);
      g.fillStyle(accentColor, 1);
      g.fillEllipse(cx - 15, baseY - 54, 7, 7);
      g.fillEllipse(cx + 15, baseY - 54, 7, 7);
      g.fillStyle(dark, 1); g.fillRoundedRect(cx - 5, baseY - 46, 10, 22, 5);
      break;
    }
    case 'eagle': {
      g.fillStyle(dark, 1);
      g.fillTriangle(cx - 12, baseY - 44, cx - 46, baseY - 62, cx - 14, baseY - 26);
      g.fillTriangle(cx + 12, baseY - 44, cx + 46, baseY - 62, cx + 14, baseY - 26);
      g.fillStyle(bodyColor, 1); g.fillEllipse(cx, baseY - 30, 38, 48);
      g.fillStyle(light, 1); g.fillEllipse(cx, baseY - 54, 28, 26);
      g.fillStyle(accentColor, 1);
      g.fillTriangle(cx - 6, baseY - 52, cx + 6, baseY - 52, cx, baseY - 40);
      break;
    }
    case 'snake': {
      g.fillStyle(dark, 1); g.fillEllipse(cx, baseY - 14, 52, 20);
      g.fillStyle(bodyColor, 1); g.fillEllipse(cx, baseY - 26, 44, 22);
      g.fillStyle(light, 1); g.fillEllipse(cx, baseY - 40, 34, 22);
      g.fillStyle(bodyColor, 1); g.fillEllipse(cx, baseY - 54, 26, 22);
      g.fillStyle(accentColor, 1);
      g.fillEllipse(cx - 7, baseY - 58, 6, 6);
      g.fillEllipse(cx + 7, baseY - 58, 6, 6);
      break;
    }
    case 'wolf': {
      g.fillStyle(bodyColor, 1); g.fillEllipse(cx, baseY - 28, 42, 50);
      g.fillStyle(dark, 1);
      g.fillTriangle(cx - 22, baseY - 56, cx - 6, baseY - 50, cx - 18, baseY - 80);
      g.fillTriangle(cx + 22, baseY - 56, cx + 6, baseY - 50, cx + 18, baseY - 80);
      g.fillStyle(light, 1); g.fillEllipse(cx, baseY - 56, 32, 30);
      g.fillStyle(shade(bodyColor, -0.2), 1); g.fillEllipse(cx, baseY - 20, 22, 26);
      g.fillStyle(accentColor, 1);
      g.fillEllipse(cx - 8, baseY - 60, 5, 5);
      g.fillEllipse(cx + 8, baseY - 60, 5, 5);
      break;
    }
    case 'boar': {
      g.fillStyle(bodyColor, 1); g.fillEllipse(cx, baseY - 26, 50, 46);
      g.fillStyle(dark, 1); g.fillEllipse(cx, baseY - 52, 36, 34);
      g.fillStyle(accentColor, 1);
      g.fillTriangle(cx - 20, baseY - 46, cx - 12, baseY - 44, cx - 26, baseY - 66);
      g.fillTriangle(cx + 20, baseY - 46, cx + 12, baseY - 44, cx + 26, baseY - 66);
      g.fillStyle(shade(bodyColor, 0.3), 1);
      g.fillTriangle(cx - 6, baseY - 74, cx + 6, baseY - 74, cx, baseY - 58);
      break;
    }
    case 'crane': {
      g.fillStyle(bodyColor, 1); g.fillEllipse(cx, baseY - 24, 40, 40);
      g.fillStyle(shade(bodyColor, -0.15), 1);
      g.fillTriangle(cx - 14, baseY - 34, cx - 40, baseY - 50, cx - 16, baseY - 16);
      g.fillTriangle(cx + 14, baseY - 34, cx + 40, baseY - 50, cx + 16, baseY - 16);
      g.fillStyle(bodyColor, 1); g.fillRoundedRect(cx - 5, baseY - 66, 10, 30, 5);
      g.fillStyle(light, 1); g.fillEllipse(cx, baseY - 70, 22, 20);
      g.fillStyle(accentColor, 1); g.fillEllipse(cx, baseY - 80, 12, 10);
      break;
    }
    default: { // panda
      g.fillStyle(accentColor, 1);
      g.fillEllipse(cx - 20, baseY - 70, 20, 20);
      g.fillEllipse(cx + 20, baseY - 70, 20, 20);
      g.fillStyle(bodyColor, 1); g.fillEllipse(cx, baseY - 28, 46, 50);
      g.fillStyle(accentColor, 1);
      g.fillEllipse(cx - 24, baseY - 28, 16, 34);
      g.fillEllipse(cx + 24, baseY - 28, 16, 34);
      g.fillStyle(bodyColor, 1); g.fillEllipse(cx, baseY - 58, 38, 34);
      g.fillStyle(accentColor, 1);
      g.fillEllipse(cx - 11, baseY - 62, 9, 10);
      g.fillEllipse(cx + 11, baseY - 62, 9, 10);
      break;
    }
  }
}

export function buildTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // --- unités du bestiaire ---
  Object.values(SPECIES).forEach((sp) => {
    g.clear();
    drawUnit(g, sp.key, sp.color, sp.accent);
    g.generateTexture(`unit_${sp.key}`, SIZE, SIZE);
  });

  // --- skins de panda (couleurs des généraux apprivoisés) ---
  const skinDefs = {
    skin_default: [0xf5f5f4, 0x1f2937],
    skin_boar: [0xfbbf24, 0x7c2d12],
    skin_wolf: [0xe2e8f0, 0x334155],
    skin_eagle: [0xbae6fd, 0x0369a1],
    skin_snake: [0xbbf7d0, 0x14532d],
    skin_crane: [0xfef3c7, 0x7c3aed],
  };
  Object.entries(skinDefs).forEach(([key, [body, accent]]) => {
    g.clear();
    drawUnit(g, 'panda', body, accent);
    g.generateTexture(`unit_${key}`, SIZE, SIZE);
  });

  // --- jetons de style ---
  Object.values(STYLES).forEach((st) => {
    g.clear();
    g.fillStyle(shade(st.color, -0.5), 0.9);
    g.fillCircle(32, 32, 27);
    g.fillStyle(st.color, 1);
    g.fillCircle(32, 32, 22);
    g.fillStyle(shade(st.color, 0.55), 1);
    g.fillCircle(26, 25, 8);
    g.lineStyle(3, 0xffffff, 0.85);
    g.strokeCircle(32, 32, 27);
    g.generateTexture(`token_${st.key}`, 64, 64);
  });

  // --- particule ronde ---
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(16, 16, 14);
  g.generateTexture('spark', 32, 32);

  // --- nuage de poussière type comics (combat sans violence) ---
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(28, 40, 20);
  g.fillCircle(52, 30, 26);
  g.fillCircle(78, 42, 18);
  g.fillCircle(44, 56, 22);
  g.fillCircle(68, 58, 20);
  g.generateTexture('puff', 104, 80);

  // --- ombre portée ---
  g.clear();
  g.fillStyle(0x000000, 0.32);
  g.fillEllipse(32, 16, 60, 26);
  g.generateTexture('shadow', 64, 32);

  // --- pixel utilitaire (dégradés, voiles) ---
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 4, 4);
  g.generateTexture('pixel', 4, 4);

  // --- goutte de pluie / braise / pétale ---
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(0, 0, 4, 18, 2);
  g.generateTexture('drop', 4, 18);

  g.destroy();
}

/** Texture d'unité à utiliser pour une espèce (le panda suit le skin choisi). */
export function unitTexture(speciesKey, skinKey = 'default') {
  if (speciesKey === 'panda') return `unit_skin_${skinKey}`;
  return `unit_${speciesKey}`;
}
