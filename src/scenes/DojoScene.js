// DojoScene — le hub de progression méta (§11) : améliorations, codex, skins.

import { UPGRADES, COMPANIONS, SKINS, CODEX_BONUSES } from '../data/upgrades.js';
import { SPECIES, TAMEABLE } from '../data/enemies.js';
import { Audio } from '../core/audio.js';
import * as Save from '../core/save.js';
import { FONT, title, body, makeButton } from '../ui/theme.js';

const TABS = [
  { key: 'upgrades', label: 'ENTRAÎNEMENT' },
  { key: 'codex', label: 'CODEX' },
  { key: 'looks', label: 'APPARENCE' },
  { key: 'settings', label: 'RÉGLAGES' },
];

export class DojoScene extends Phaser.Scene {
  constructor() {
    super('Dojo');
  }

  init(data) {
    this.biomeIndex = (data && data.biomeIndex) || 0;
    this.tab = (data && data.tab) || 'upgrades';
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.save = Save.get();

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1e1b4b, 0x1e1b4b, 0x0b1410, 0x0b1410, 1);
    bg.fillRect(0, 0, W, H);

    this.add.text(W / 2, H * 0.055, '🏯 DOJO DU PANDA', title(32)).setOrigin(0.5);
    this.bambooText = this.add.text(W / 2, H * 0.095, '', title(22, '#a3e635')).setOrigin(0.5);

    // --- onglets ---
    this.tabButtons = TABS.map((t, i) => {
      const x = W * (0.145 + i * 0.237);
      const btn = this.add.text(x, H * 0.145, t.label, title(14, '#cbd5e1'))
        .setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { Audio.sfx('ui'); this.setTab(t.key); });
      return { key: t.key, obj: btn };
    });
    this.tabUnderline = this.add.graphics();

    this.content = this.add.container(0, 0);

    makeButton(this, W / 2, H * 0.93, 280, 60, '‹ RETOUR', {
      fill: 0x475569, color: '#ffffff', fontSize: 22,
      onClick: () => { Audio.sfx('ui'); this.scene.start('Menu', { biomeIndex: this.biomeIndex }); },
    });

    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu', { biomeIndex: this.biomeIndex }));
    this.events.once('shutdown', () => this.input.keyboard.removeAllListeners());

    this.setTab(this.tab);
  }

  setTab(key) {
    this.tab = key;
    const H = this.scale.height;
    this.tabButtons.forEach((t) => {
      t.obj.setColor(t.key === key ? '#fcd34d' : '#94a3b8');
      t.obj.setScale(t.key === key ? 1.08 : 1);
    });
    const active = this.tabButtons.find((t) => t.key === key);
    this.tabUnderline.clear();
    if (active) {
      this.tabUnderline.fillStyle(0xfcd34d, 1);
      this.tabUnderline.fillRoundedRect(
        active.obj.x - active.obj.width / 2 - 6, H * 0.163, active.obj.width + 12, 4, 2
      );
    }
    this.render();
  }

  render() {
    this.content.removeAll(true);
    this.bambooText.setText(`🎍 ${this.save.bamboo} bambou`);
    if (this.tab === 'upgrades') this.renderUpgrades();
    else if (this.tab === 'codex') this.renderCodex();
    else if (this.tab === 'settings') this.renderSettings();
    else this.renderLooks();
  }

  // ----------------------------------------------------------------- réglages

  renderSettings() {
    const W = this.scale.width;
    const H = this.scale.height;
    const s = this.save;

    const rows = [
      {
        label: 'Qualité graphique',
        desc: 'Auto abaisse les détails si le framerate décroche.',
        value: () => ({ auto: 'AUTO', high: 'ÉLEVÉE', low: 'BASSE' })[s.quality] || 'AUTO',
        next: () => {
          const order = ['auto', 'high', 'low'];
          const i = order.indexOf(s.quality);
          Save.setSetting('quality', order[(i + 1) % order.length]);
        },
      },
      {
        label: 'Instant de Sagesse',
        desc: 'Ralenti automatique juste avant une décision serrée.',
        value: () => (s.slowmo ? 'ACTIF' : 'COUPÉ'),
        next: () => Save.setSetting('slowmo', !s.slowmo),
      },
      {
        label: 'Secousses & flashs',
        desc: 'Coupe les effets de caméra (confort visuel).',
        value: () => (s.shake === false ? 'COUPÉ' : 'ACTIF'),
        next: () => Save.setSetting('shake', s.shake === false),
      },
      {
        label: 'Son',
        desc: 'Musique additive et effets.',
        value: () => (s.muted ? 'COUPÉ' : 'ACTIF'),
        next: () => { Save.setMuted(!s.muted); Audio.setMuted(s.muted); },
      },
    ];

    rows.forEach((r, i) => {
      const y = H * 0.225 + i * 92;
      const g = this.add.graphics();
      g.fillStyle(0x0f172a, 0.78);
      g.fillRoundedRect(22, y - 34, W - 44, 76, 14);
      g.lineStyle(2, 0x334155, 0.85);
      g.strokeRoundedRect(22, y - 34, W - 44, 76, 14);
      this.content.add(g);

      this.content.add(this.add.text(44, y - 12, r.label, title(18, '#ffffff')).setOrigin(0, 0.5));
      this.content.add(this.add.text(44, y + 14, r.desc, body(12, '#94a3b8'))
        .setOrigin(0, 0.5).setWordWrapWidth(W - 230));

      const btn = makeButton(this, W - 96, y, 130, 44, r.value(), {
        fill: 0x1e293b, color: '#e2e8f0', fontSize: 16, radius: 12,
        onClick: () => { r.next(); Audio.sfx('ui'); this.render(); },
      });
      this.content.add(btn);
    });

    // --- remise à zéro, avec confirmation ---
    const resetY = H * 0.65;
    this.content.add(this.add.text(W / 2, resetY - 26,
      'Effacer toute la progression (bambou, codex, skins, records).',
      body(12, '#64748b')).setOrigin(0.5));
    const resetBtn = makeButton(this, W / 2, resetY + 10, 280, 50,
      this.confirmReset ? '⚠ CONFIRMER L\'EFFACEMENT' : 'RÉINITIALISER', {
        fill: this.confirmReset ? 0xb91c1c : 0x334155,
        color: '#ffffff', fontSize: this.confirmReset ? 16 : 18, radius: 12,
        onClick: () => {
          if (!this.confirmReset) {
            this.confirmReset = true;
            Audio.sfx('deny');
            this.render();
            this.time.delayedCall(4000, () => {
              if (this.confirmReset) { this.confirmReset = false; this.render(); }
            });
          } else {
            this.confirmReset = false;
            this.save = Save.reset();
            Audio.sfx('buy');
            this.scene.start('Menu');
          }
        },
      });
    this.content.add(resetBtn);

    this.content.add(this.add.text(W / 2, H * 0.78,
      'Progression stockée dans ce navigateur uniquement.',
      body(12, '#475569')).setOrigin(0.5));
  }

  // ------------------------------------------------------------ améliorations

  renderUpgrades() {
    const W = this.scale.width;
    const H = this.scale.height;
    const top = H * 0.20;
    const rowH = 84;

    UPGRADES.forEach((u, i) => {
      const y = top + i * rowH + rowH / 2;
      const lvl = Save.upgradeLevel(u.key);
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : u.cost(lvl);
      const affordable = !maxed && this.save.bamboo >= cost;

      const g = this.add.graphics();
      g.fillStyle(0x0f172a, 0.78);
      g.fillRoundedRect(22, y - rowH / 2 + 5, W - 44, rowH - 12, 14);
      g.lineStyle(2, maxed ? 0xfcd34d : 0x334155, 0.85);
      g.strokeRoundedRect(22, y - rowH / 2 + 5, W - 44, rowH - 12, 14);
      this.content.add(g);

      this.content.add(this.add.text(46, y - 14, u.icon, { fontFamily: FONT, fontSize: '26px' }).setOrigin(0, 0.5));
      this.content.add(this.add.text(84, y - 18, u.name, title(18, '#ffffff')).setOrigin(0, 0.5));
      this.content.add(this.add.text(84, y + 4, u.desc, body(12, '#94a3b8')).setOrigin(0, 0.5)
        .setWordWrapWidth(W - 240));
      this.content.add(this.add.text(84, y + 24,
        lvl > 0 ? u.format(lvl) : 'non entraîné',
        body(13, lvl > 0 ? '#a3e635' : '#64748b')).setOrigin(0, 0.5));

      // pastilles de niveau
      const pipG = this.add.graphics();
      for (let p = 0; p < u.max; p++) {
        pipG.fillStyle(p < lvl ? 0xa3e635 : 0x334155, 1);
        pipG.fillCircle(W - 150 + p * 13, y - 22, 4.5);
      }
      this.content.add(pipG);

      const btn = makeButton(this, W - 96, y + 6, 120, 40,
        maxed ? 'MAX' : `🎍 ${cost}`, {
          fill: affordable ? 0x22c55e : 0x334155,
          color: affordable ? '#062314' : '#94a3b8',
          fontSize: 17,
          radius: 12,
          enabled: !maxed && affordable,
          onClick: () => {
            if (Save.buyUpgrade(u.key)) {
              Audio.sfx('buy');
              this.render();
            } else {
              Audio.sfx('deny');
            }
          },
        });
      this.content.add(btn);
    });

    this.content.add(this.add.text(this.scale.width / 2, H * 0.855,
      'Le bambou se récolte en courant — et l\'harmonie le multiplie.',
      body(13, '#64748b')).setOrigin(0.5));
  }

  // -------------------------------------------------------------------- codex

  renderCodex() {
    const W = this.scale.width;
    const H = this.scale.height;
    const codex = this.save.codex || {};
    const known = Save.codexCount();

    this.content.add(this.add.text(W / 2, H * 0.20,
      `${known} / ${TABLE_LEN()} espèces inscrites`, title(18, '#a3e635')).setOrigin(0.5));

    const cols = 2;
    const cardW = (W - 66) / cols;
    const cardH = 108;
    TAMEABLE.forEach((key, i) => {
      const sp = SPECIES[key];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 24 + cardW / 2 + col * (cardW + 18);
      const y = H * 0.245 + row * (cardH + 12) + cardH / 2;
      const seen = !!codex[key];

      const g = this.add.graphics();
      g.fillStyle(seen ? 0x14532d : 0x0f172a, 0.8);
      g.fillRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 14);
      g.lineStyle(2, seen ? 0x4ade80 : 0x334155, 0.8);
      g.strokeRoundedRect(x - cardW / 2, y - cardH / 2, cardW, cardH, 14);
      this.content.add(g);

      this.content.add(this.add.text(x, y - 32, seen ? sp.icon : '❔',
        { fontFamily: FONT, fontSize: '30px' }).setOrigin(0.5));
      this.content.add(this.add.text(x, y - 2, seen ? sp.name : '???',
        title(17, seen ? '#ffffff' : '#64748b')).setOrigin(0.5));
      this.content.add(this.add.text(x, y + 20,
        seen ? sp.bonusLabel : 'jamais apprivoisé',
        body(12, seen ? '#a3e635' : '#475569')).setOrigin(0.5));
      this.content.add(this.add.text(x, y + 40,
        seen ? `${codex[key]} ralliés` : '', body(11, '#94a3b8')).setOrigin(0.5));
    });

    // bonus passifs de complétion
    let y = H * 0.755;
    this.content.add(this.add.text(W / 2, y, 'BONUS DE COMPLÉTION', title(14, '#fcd34d')).setOrigin(0.5));
    CODEX_BONUSES.forEach((b, i) => {
      const on = known >= b.at;
      this.content.add(this.add.text(W / 2, y + 24 + i * 22,
        `${on ? '✓' : '○'}  ${b.at} espèces → ${b.label}`,
        body(14, on ? '#86efac' : '#64748b')).setOrigin(0.5));
    });
  }

  // ---------------------------------------------------------------- apparence

  renderLooks() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.content.add(this.add.text(W / 2, H * 0.20, 'SKINS DE PANDA', title(18, '#fcd34d')).setOrigin(0.5));
    this.content.add(this.add.text(W / 2, H * 0.228,
      'Apprivoise un général (harmonie ≥ 70 %) pour porter ses couleurs.',
      body(12, '#94a3b8')).setOrigin(0.5));

    const keys = Object.keys(SKINS);
    const cols = 3;
    const cellW = (W - 70) / cols;
    keys.forEach((key, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 26 + cellW / 2 + col * (cellW + 9);
      const y = H * 0.30 + row * 130 + 60;
      const owned = !!this.save.skins[key];
      const active = this.save.skin === key;

      const g = this.add.graphics();
      g.fillStyle(active ? 0x14532d : 0x0f172a, 0.82);
      g.fillRoundedRect(x - cellW / 2, y - 58, cellW, 116, 14);
      g.lineStyle(2, active ? 0x4ade80 : owned ? 0x475569 : 0x1e293b, 0.9);
      g.strokeRoundedRect(x - cellW / 2, y - 58, cellW, 116, 14);
      this.content.add(g);

      const img = this.add.image(x, y + 22, `unit_skin_${key}`).setOrigin(0.5, 1).setScale(0.66);
      if (!owned) img.setTint(0x1f2937);
      this.content.add(img);
      this.content.add(this.add.text(x, y + 40,
        owned ? SKINS[key].name : '🔒 verrouillé',
        body(11, owned ? '#e2e8f0' : '#64748b')).setOrigin(0.5).setWordWrapWidth(cellW - 8));

      if (owned) {
        const hit = this.add.rectangle(x, y, cellW, 116, 0xffffff, 0.001)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            Save.setSkin(key);
            Audio.sfx('buy');
            this.render();
          });
        this.content.add(hit);
      }
    });

    // --- compagnons de départ ---
    const cy = H * 0.66;
    this.content.add(this.add.text(W / 2, cy, 'COMPAGNON DE DÉPART', title(18, '#7dd3fc')).setOrigin(0.5));
    this.content.add(this.add.text(W / 2, cy + 24,
      'Commence chaque run avec une escouade déjà ralliée.',
      body(12, '#94a3b8')).setOrigin(0.5));

    const rowY = cy + 62;
    const per = (W - 60) / COMPANIONS.length;
    COMPANIONS.forEach((c, i) => {
      const x = 30 + per / 2 + i * per;
      const owned = !!this.save.companions[c.key];
      const known = !!this.save.codex[c.key];
      const active = this.save.activeCompanion === c.key;
      const affordable = this.save.bamboo >= c.cost;

      const g = this.add.graphics();
      g.fillStyle(active ? 0x0c4a6e : 0x0f172a, 0.85);
      g.fillRoundedRect(x - per / 2 + 4, rowY - 44, per - 8, 96, 12);
      g.lineStyle(2, active ? 0x38bdf8 : 0x334155, 0.85);
      g.strokeRoundedRect(x - per / 2 + 4, rowY - 44, per - 8, 96, 12);
      this.content.add(g);

      this.content.add(this.add.text(x, rowY - 24, c.icon,
        { fontFamily: FONT, fontSize: '24px' }).setOrigin(0.5).setAlpha(known ? 1 : 0.3));
      this.content.add(this.add.text(x, rowY + 2, `+${c.count}`,
        title(15, known ? '#ffffff' : '#475569')).setOrigin(0.5));
      this.content.add(this.add.text(x, rowY + 28,
        owned ? (active ? 'ACTIF' : 'choisir') : known ? `🎍 ${c.cost}` : '🔒',
        body(12, owned ? (active ? '#7dd3fc' : '#cbd5e1') : affordable && known ? '#a3e635' : '#64748b')
      ).setOrigin(0.5));

      const hit = this.add.rectangle(x, rowY + 4, per - 8, 96, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          if (!known) { Audio.sfx('deny'); return; }
          if (!owned) {
            if (Save.spendBamboo(c.cost)) {
              this.save.companions[c.key] = true;
              this.save.activeCompanion = c.key;
              Save.save();
              Audio.sfx('buy');
            } else {
              Audio.sfx('deny');
            }
          } else {
            this.save.activeCompanion = active ? null : c.key;
            Save.save();
            Audio.sfx('ui');
          }
          this.render();
        });
      this.content.add(hit);
    });
  }
}

function TABLE_LEN() {
  return TAMEABLE.length;
}
