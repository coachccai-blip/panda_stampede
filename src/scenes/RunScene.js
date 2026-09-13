// RunScene — la boucle de jeu (§3) :
// COURIR → COLLECTER → RENCONTRER → CHOISIR (combattre / apprivoiser) → BOSS.
//
// Trois modes partagent cette scène :
//   'story'   : un biome, un général, on débloque le suivant ;
//   'daily'   : graine du jour, identique pour tout le monde, un score à battre ;
//   'endless' : les biomes s'enchaînent sans fin, la difficulté monte à chaque
//               étape — c'est le mode « encore une run ».

import { Rng } from '../core/rng.js';
import { clamp } from '../core/perspective.js';
import { WorldRenderer, EVENT_FAR } from '../core/WorldRenderer.js';
import { Audio } from '../core/audio.js';
import * as Save from '../core/save.js';

import { BIOMES, biomeAt } from '../data/biomes.js';
import { STYLES, STYLE_KEYS, matchup } from '../data/styles.js';
import { SPECIES } from '../data/enemies.js';
import { COMPANIONS } from '../data/upgrades.js';

import { ArmyManager } from '../systems/ArmyManager.js';
import { StyleManager } from '../systems/StyleManager.js';
import { ComboSystem } from '../systems/ComboSystem.js';
import { ChiSystem, CHI_GAINS } from '../systems/ChiSystem.js';
import { FormationChecker, SHAPE_LABELS } from '../systems/FormationChecker.js';
import { buildLevel } from '../systems/WaveSpawner.js';

import { Panda } from '../entities/Panda.js';
import { Boss } from '../entities/Boss.js';
import { applyGate } from '../entities/Gate.js';
import { resolveFight, resolveTame, previewFight, previewTame } from '../entities/EnemyGroup.js';

import { HUD } from '../ui/HUD.js';
import { ChoiceGatePreview } from '../ui/ChoiceGatePreview.js';
import { title, body, makeButton } from '../ui/theme.js';

const TAME_SLOW = 0.52;
const TAME_SLOW_MS = 1300;
const SLOWMO_RANGE = 1000;
const SLOWMO_MS = 750;
const SLOWMO_SCALE = 0.45;
const DECISION_RANGE = 1600;

const ARMY_MILESTONES = [25, 50, 100, 200, 400];
const DIVERSITY_MILESTONES = {
  3: ['ARMÉE MÊLÉE', 'trois peuples courent ensemble'],
  4: ['ARMÉE HYBRIDE', 'quatre peuples, une seule voie'],
  5: ['GRANDE ALLIANCE', 'cinq peuples unis'],
  6: ['L\'ARMÉE DE PAIX', 'tout le bestiaire réuni'],
};

export class RunScene extends Phaser.Scene {
  constructor() {
    super('Run');
  }

  init(data) {
    const d = data || {};
    this.mode = d.mode || 'story';
    this.biomeIndex = d.biomeIndex != null ? d.biomeIndex : 0;
    this.seed = d.seed != null ? d.seed : Math.floor(Math.random() * 1e9);
    if (this.mode === 'daily') {
      this.seed = Save.dailySeed();
      this.biomeIndex = this.seed % BIOMES.length;
    }
  }

  create() {
    const save = Save.get();
    this.save = save;
    this.rng = new Rng(this.seed);

    this.meta = {
      handling: Save.upgradeEffect('handling'),
      tame: Save.upgradeEffect('tame'),
      resist: Save.upgradeEffect('resist'),
      harvest: Save.upgradeEffect('harvest'),
      ability: Save.upgradeEffect('ability'),
      start: Save.upgradeEffect('start'),
      chi: Save.upgradeEffect('chi'),
    };
    this.codexBonus = Save.codexBonuses();

    const companions = [];
    if (save.activeCompanion) {
      const def = COMPANIONS.find((c) => c.key === save.activeCompanion);
      if (def && save.companions[def.key]) companions.push(def);
    }

    this.army = new ArmyManager({ startCount: 1 + Math.round(this.meta.start), companions });
    this.panda = new Panda(this.army);
    this.combo = new ComboSystem();
    this.chi = new ChiSystem(this.meta.chi);
    this.formation = new FormationChecker();

    // --- état global de la run ---
    this.leg = 0;                 // étape (toujours 0 hors mode infini)
    this.difficulty = 1;
    this.bamboo = 0;
    this.score = 0;
    this.edgeAccum = 0;
    this.edgeAlert = 0;
    this.tameSlowUntil = 0;
    this.slowmoUntil = 0;
    this.paused = false;
    this.phase = 'run';
    this.boss = null;
    this.bestArmy = this.army.count;
    this.musicTier = -1;
    this.armyMilestone = 0;
    this.diversityMilestone = 0;
    this.highlights = [];
    this.biggestTame = 0;

    this.biome = biomeAt(this.biomeIndex);
    this.styles = new StyleManager(this.biome.dominantStyle || 'bamboo', this.meta.ability);

    // --- rendu & UI ---
    const quality = save.quality === 'low' ? 'low' : 'high';
    this.renderer = new WorldRenderer(this, this.biome, quality);
    this.hud = new HUD(this, { onChi: () => this.useChi() });
    this.preview = new ChoiceGatePreview(this);
    this.hud.pauseBtn.on('pointerdown', () => this.togglePause());

    this.buildLeg(this.biomeIndex, 1);
    this.hud.biomeCard(this.biome, this.legSubtitle());

    this.setupInput();
    this.setupTutorial();

    Audio.startMusic('run');
    Audio.setIntensity(0);

    this.fpsTimer = 0;
    this.lowFpsTime = 0;
    this.goodFpsTime = 0;

    this.events.once('shutdown', () => this.cleanup());
    this.scale.on('resize', this.handleResize, this);
  }

  legSubtitle() {
    if (this.mode === 'daily') return `Défi du jour · graine ${this.seed % 100000}`;
    if (this.mode === 'endless') return `Étape ${this.leg + 1} · difficulté ×${this.difficulty.toFixed(2)}`;
    return this.biome.subtitle;
  }

  /** Construit (ou reconstruit, en mode infini) une étape de piste. */
  buildLeg(biomeIndex, difficulty) {
    this.biomeIndex = biomeIndex;
    this.biome = biomeAt(biomeIndex);
    this.difficulty = difficulty;
    this.level = buildLevel(this.biome, this.rng, { difficulty });
    this.distance = 0;
    this.eventCursor = 0;
    this.phase = 'run';
    this.boss = null;
    this.formation.clear();
    this.formation.setDistance(0);
    this.renderer.setBiome(this.biome);
    const best = Save.bestFor(this.biome.key);
    // « Fantôme » : jusqu'où la meilleure run précédente était allée, et quelle
    // armée elle avait atteinte. De quoi se mesurer à soi-même sans classement.
    this.ghostProgress = best && best.progress ? Math.min(best.progress, 0.99) : 0;
    this.ghostArmy = best ? best.army : 0;
  }

  // --------------------------------------------------------------- entrées

  setupInput() {
    const kb = this.input.keyboard;
    const nudge = (dir) => {
      if (this.paused || this.phase === 'over') return;
      Audio.resume();
      this.panda.nudge(dir, this.currentHalf(), this.biome.laneCount);
    };
    kb.on('keydown-LEFT', () => nudge(-1));
    kb.on('keydown-RIGHT', () => nudge(1));
    kb.on('keydown-A', () => nudge(-1));
    kb.on('keydown-Q', () => nudge(-1));
    kb.on('keydown-D', () => nudge(1));
    kb.on('keydown-SPACE', () => this.useAbility());
    kb.on('keydown-E', () => this.useChi());
    kb.on('keydown-SHIFT', () => this.useChi());
    kb.on('keydown-ESC', () => this.togglePause());
    kb.on('keydown-P', () => this.togglePause());
    STYLE_KEYS.forEach((k, i) => {
      kb.on(`keydown-${['ONE', 'TWO', 'THREE', 'FOUR'][i]}`, () => {
        if (this.styles.set(k)) Audio.sfx('style');
      });
    });

    this.dragging = false;
    this.pointerDownAt = 0;
    this.pointerMoved = 0;
    this.input.on('pointerdown', (p) => {
      Audio.resume();
      if (this.paused || this.phase === 'over') return;
      // La zone des boutons du bas ne pilote pas la course.
      if (p.y > this.scale.height - 190 && (p.x < 150 || p.x > this.scale.width - 150)) return;
      this.dragging = true;
      this.pointerDownAt = this.time.now;
      this.pointerMoved = 0;
      this.dragOriginX = p.x;
      this.dragOriginTarget = this.panda.targetX;
    });
    this.input.on('pointermove', (p) => {
      if (!this.dragging) return;
      const dx = p.x - this.dragOriginX;
      this.pointerMoved = Math.max(this.pointerMoved, Math.abs(dx));
      this.panda.aimAt(this.dragOriginTarget + dx * 1.3, this.currentHalf());
    });
    this.input.on('pointerup', () => {
      if (this.dragging && this.pointerMoved < 14 && this.time.now - this.pointerDownAt < 260) {
        this.useAbility();
      }
      this.dragging = false;
    });
  }

  useAbility() {
    if (this.paused || this.phase === 'over') return;
    Audio.resume();
    const res = this.styles.trigger();
    if (!res) { Audio.sfx('deny'); return; }
    Audio.sfx('style');
    this.hud.announce(res.ability.name, '', STYLES[res.style].css);
    this.flash(180, 255, 255, 255);
  }

  useChi() {
    if (this.paused || this.phase === 'over') return;
    Audio.resume();
    if (!this.chi.trigger()) { Audio.sfx('deny'); return; }
    Audio.sfx('win');
    this.hud.announce('☯ ÉVEIL', 'les quatre styles ne font qu\'un', '#fde68a');
    this.flash(360, 253, 224, 71);
    this.shake(300, 0.006);
  }

  setupTutorial() {
    this.hints = [];
    if (!this.biome.tutorial || this.save.seenTutorial || this.mode !== 'story') return;
    this.hints = [
      { at: 420, text: '← → ou glisse', sub: 'ta troupe suit ton doigt' },
      { at: 1500, text: 'Traverse les portes vertes', sub: 'elles grossissent ton armée' },
      { at: 2700, text: '⚔ écrase · 🤝 rallie', sub: 'les chiffres affichés sont ton vrai choix' },
      { at: 4400, text: 'Ramasse les jetons de style', sub: '🎋 bat 🔥 · 🔥 bat 🌪️ · 💧 bat 🎋 · 🌪️ bat 💧' },
      { at: 6400, text: 'Le Chi monte quand tu rallies', sub: 'plein → tape ☯ pour l\'Éveil' },
    ];
    this.save.seenTutorial = true;
    Save.save();
  }

  // ---------------------------------------------------------------- boucle

  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    if (this.paused || this.phase === 'over') {
      this.render(time, 0);
      return;
    }

    this.styles.update(dt);
    this.combo.update(dt);
    this.chi.update(dt);
    this.army.update(dt);
    this.adaptQuality(dt);

    const fx = this.effects();
    const slowmoActive = time < this.slowmoUntil;
    const timeScale = slowmoActive ? SLOWMO_SCALE : 1;
    const tameSlow = time < this.tameSlowUntil ? TAME_SLOW : 1;
    const progress = clamp(this.distance / this.level.length, 0, 1);
    const speed = this.biome.baseSpeed
      * (1 + this.biome.speedRamp * progress * 4)
      * (1 + (this.difficulty - 1) * 0.35)
      * fx.speed * tameSlow * timeScale;

    this.speed = speed;
    this.distance += speed * dt;
    this.formation.setDistance(this.distance);

    const half = this.currentHalf();
    this.panda.update(dt, {
      roadHalf: half,
      handlingBonus: this.handlingBonus(),
      perfectHandling: fx.perfectHandling,
      speedRatio: speed / this.biome.baseSpeed,
    });

    this.bamboo += speed * dt * 0.0045 * this.harvestMult() * fx.harvest;

    if (this.phase === 'run') {
      this.processEvents(half, fx, time);
      if (this.distance >= this.level.length) this.startBoss();
    } else if (this.phase === 'boss') {
      this.updateBoss(dt, half, fx);
    }

    this.applyEdgeLosses(dt, half, fx);
    this.updateHints();
    this.updateMusicTier();
    this.checkMilestones();

    if (this.chi.consumeFilledFlag()) {
      Audio.sfx('formation');
      this.hud.announce('CHI AU MAXIMUM', 'tape ☯ quand tu veux', '#fde68a');
    }

    if (this.army.count <= 0) this.endRun('defeat');

    this.render(time, slowmoActive ? 1 : 0);
  }

  /** Effets cumulés : capacité de style + Éveil. */
  effects() {
    const base = this.styles.effects();
    const chi = this.chi.effects();
    return {
      shield: base.shield || chi.noLoss,
      power: base.power * (chi.universalStyle ? 1.35 : 1),
      perfectHandling: base.perfectHandling || chi.universalStyle,
      speed: base.speed,
      harvest: base.harvest * (chi.universalStyle ? 1.5 : 1),
      universalStyle: chi.universalStyle,
      guaranteedTame: chi.guaranteedTame,
      noLoss: chi.noLoss,
    };
  }

  currentHalf() {
    return this.level.profile.halfAt(this.distance);
  }

  handlingBonus() {
    return this.meta.handling + this.army.bonus('handling');
  }

  harvestMult() {
    return 1 + this.meta.harvest + this.army.bonus('harvest') + this.codexBonus.harvest;
  }

  resolveContext(enc) {
    const fx = this.effects();
    return {
      armyCount: this.army.count,
      enemyCount: enc.count,
      playerStyle: this.styles.current,
      enemyStyle: enc.style,
      powerBonus: this.army.bonus('power') + this.codexBonus.power,
      resistBonus: this.meta.resist + this.army.bonus('resist'),
      tameBonus: this.meta.tame + this.army.bonus('tame') + this.codexBonus.tame,
      abilityPower: fx.power,
      universalStyle: fx.universalStyle,
      guaranteedTame: fx.guaranteedTame,
      noLoss: fx.noLoss,
    };
  }

  // ------------------------------------------------------------ événements

  processEvents(half, fx, time) {
    const events = this.level.events;
    for (let i = this.eventCursor; i < events.length; i++) {
      const ev = events[i];
      if (ev.z - this.distance > 0) break;
      if (!ev.done) this.triggerEvent(ev, half, fx);
      if (i === this.eventCursor) this.eventCursor++;
    }

    const next = this.nextEncounter();
    if (next) {
      const rel = next.z - this.distance;
      this.maybeSlowmo(next, rel, time);
      this.preview.show(next);
      this.preview.update(
        this.resolveContext(next),
        next.fightLeft,
        clamp(1 - rel / DECISION_RANGE, 0, 1),
        this.panda.targetX < 0 ? -1 : 1
      );
    } else {
      this.preview.hide();
    }
  }

  /**
   * « Instant de Sagesse » : le temps ralentit une fraction de seconde quand une
   * décision serrée arrive. C'est la signature du jeu — le dilemme mérite qu'on
   * le voie venir, et ça transforme un runner réflexe en runner de décision.
   */
  maybeSlowmo(enc, rel, time) {
    if (enc.slowmoDone || !this.save.slowmo) return;
    if (rel > SLOWMO_RANGE || rel < 200) return;
    enc.slowmoDone = true;
    const ctx = this.resolveContext(enc);
    const fight = previewFight(ctx);
    const tame = previewTame(ctx);
    const tense = !fight.win
      || (tame.chance > 0.3 && tame.chance < 0.8)
      || this.combo.tamed + this.combo.fought < 3;
    if (!tense) return;
    this.slowmoUntil = time + SLOWMO_MS;
    Audio.sfx('pickup');
  }

  nextEncounter() {
    const events = this.level.events;
    for (let i = this.eventCursor; i < events.length; i++) {
      const ev = events[i];
      const rel = ev.z - this.distance;
      if (rel > DECISION_RANGE) break;
      if (ev.type === 'encounter' && !ev.done && rel > -50) return ev;
    }
    return null;
  }

  triggerEvent(ev, half, fx) {
    switch (ev.type) {
      case 'gate': this.onGate(ev, half); break;
      case 'bonusGate': this.onBonusGate(ev, half); break;
      case 'token': this.onToken(ev, half); break;
      case 'encounter': this.onEncounter(ev, half); break;
      case 'formation': this.onFormationPads(ev, half); break;
      case 'obstacle': this.onObstacle(ev, half, fx); break;
      case 'narrowMark':
        ev.done = true;
        this.hud.announce('PASSAGE ÉTROIT', 'resserre ta troupe', '#fcd34d');
        break;
      default: ev.done = true; break;
    }
  }

  onGate(ev, half) {
    ev.done = true;
    const f = clamp(this.panda.x / half, -1, 1);
    const door = ev.doors.find((d) => f >= d.f0 && f <= d.f1) || ev.doors[0];
    const before = this.army.count;
    applyGate(this.army, door, 1);
    const delta = this.army.count - before;
    const screen = this.renderer.cam.project(this.panda.x, 0);
    if (delta >= 0) {
      Audio.sfx('gatePlus');
      this.hud.popup(`+${delta}`, '#86efac', screen.x, screen.y - 90);
    } else {
      Audio.sfx('gateMinus');
      this.hud.popup(`${delta}`, '#fca5a5', screen.x, screen.y - 90);
      this.shake(140, 0.004);
    }
    this.bestArmy = Math.max(this.bestArmy, this.army.count);
  }

  onBonusGate(ev, half) {
    ev.done = true;
    const check = this.formation.check(ev.shape);
    const screen = this.renderer.cam.project(this.panda.x, 0);
    if (check === 'perfect') {
      const before = this.army.count;
      this.army.multiply(ev.mult);
      const gained = this.army.count - before;
      Audio.sfx('formation');
      this.combo.success('formation');
      this.chi.gain(CHI_GAINS.formation);
      this.hud.announce('FORMATION PARFAITE', `×${ev.mult} — +${gained} unités`, '#fde68a');
      this.hud.popup(`×${ev.mult}`, '#fde68a', screen.x, screen.y - 110);
      this.flash(200, 253, 224, 71);
      this.highlights.push({ icon: '◈', text: `Formation parfaite : +${gained} unités d'un coup` });
    } else {
      const gained = this.army.add(3);
      this.hud.popup(`+${gained}`, '#cbd5e1', screen.x, screen.y - 90);
      Audio.sfx('gatePlus');
    }
    this.formation.clear();
    this.army.setFormation('blob', 0);
  }

  onToken(ev, half) {
    const x = ev.f * half;
    const reach = this.army.spread * 0.85 + 46;
    ev.done = true;
    if (Math.abs(this.panda.x - x) > reach) return;
    ev.resolved = true;
    this.chi.gain(CHI_GAINS.token);
    if (this.styles.set(ev.style)) {
      Audio.sfx('style');
      const st = STYLES[ev.style];
      const screen = this.renderer.cam.project(x, 0);
      this.hud.popup(st.icon, st.css, screen.x, screen.y - 70);
    } else {
      Audio.sfx('pickup');
      this.bamboo += 6 * this.harvestMult();
    }
  }

  onFormationPads(ev, half) {
    ev.done = true;
    const f = clamp(this.panda.x / half, -1, 1);
    const pad = ev.pads.find((p) => f >= p.f0 && f <= p.f1);
    if (!pad) return;
    this.formation.adopt(pad.shape, (ev.gateZ - ev.z) + 700);
    this.army.setFormation(pad.shape, 99999);
    Audio.sfx('pickup');
    this.hud.announce(SHAPE_LABELS[pad.shape], 'formation adoptée', '#fde68a');
  }

  onObstacle(ev, half, fx) {
    ev.done = true;
    const x0 = (ev.f - ev.width) * half;
    const x1 = (ev.f + ev.width) * half;
    const spread = this.army.spread * 0.75;
    if (this.panda.x + spread < x0 || this.panda.x - spread > x1) return;
    if (fx.shield) {
      this.hud.popup('BLOQUÉ', '#86efac', this.scale.width / 2, this.scale.height * 0.6);
      return;
    }
    const lost = this.army.remove(
      Math.max(1, Math.round(this.army.count * 0.08 * (1 - this.meta.resist)))
    );
    Audio.sfx('hurt');
    this.shake(200, 0.008);
    const screen = this.renderer.cam.project(this.panda.x, 0);
    this.hud.popup(`−${lost}`, '#fca5a5', screen.x, screen.y - 90);
  }

  // ------------------------------------------------------------ rencontres

  onEncounter(ev, half) {
    ev.done = true;
    const tameIsLeft = !ev.fightLeft;
    const choseLeft = this.panda.x < 0;
    const chose = choseLeft === tameIsLeft ? 'tame' : 'fight';
    const ctx = this.resolveContext(ev);
    const screen = this.renderer.cam.project(this.panda.x, 0);
    const sp = SPECIES[ev.species] || SPECIES.boar;

    if (chose === 'fight') {
      const res = resolveFight(ctx);
      ev.resolved = true;
      if (res.losses) this.army.remove(res.losses);
      this.bamboo += res.bamboo * this.combo.multiplier * this.harvestMult();
      this.fxPuff(ev);
      if (res.win) {
        Audio.sfx('fight');
        this.combo.success('fight', { perfectStyle: res.perfectStyle });
        this.chi.gain(res.perfectStyle ? CHI_GAINS.perfectFight : CHI_GAINS.fight);
        this.hud.announce(
          res.perfectStyle ? 'BALAYÉ !' : 'VICTOIRE',
          res.perfectStyle ? `${STYLES[this.styles.current].icon} style dominant`
            : `−${res.losses} unités`,
          res.perfectStyle ? '#fde68a' : '#ffffff'
        );
        this.shake(180, 0.006);
      } else {
        Audio.sfx('fightLost');
        this.combo.fail('fight');
        this.hud.announce('DÉBORDÉ', `−${res.losses} unités`, '#fca5a5');
        this.shake(320, 0.014);
        this.flash(260, 220, 38, 38);
      }
      if (res.losses) this.hud.popup(`−${res.losses}`, '#fca5a5', screen.x, screen.y - 100);
    } else {
      this.tameSlowUntil = this.time.now + TAME_SLOW_MS;
      const res = resolveTame(ctx, this.rng.next());
      ev.resolved = true;
      if (res.losses) this.army.remove(res.losses);
      if (res.converted) this.army.add(res.converted, ev.species);
      this.bamboo += res.bamboo * this.combo.multiplier * this.harvestMult();
      this.fxTame(ev);

      if (res.success) {
        Audio.sfx('tame', { big: res.converted >= 20 });
        const isNew = Save.recordTamed(ev.species, res.converted);
        this.combo.success('tame', { units: res.converted, perfectStyle: res.perfectStyle });
        this.chi.gain(CHI_GAINS.tame);
        if (res.converted > this.biggestTame) this.biggestTame = res.converted;
        if (isNew) {
          this.hud.announce(`${sp.icon} ${sp.name.toUpperCase()} RALLIÉ`, 'nouvelle espèce au codex', '#86efac');
          this.highlights.push({ icon: '📖', text: `${sp.name} inscrit au codex` });
        } else {
          this.hud.speciesJoin(ev.species, res.converted);
        }
        this.hud.popup(`+${res.converted}`, '#86efac', screen.x, screen.y - 100);
        this.flash(220, 74, 222, 128);
      } else {
        Audio.sfx('tamePartial');
        Save.recordTamed(ev.species, res.converted);
        this.chi.gain(CHI_GAINS.tamePartial);
        this.hud.announce('RALLIEMENT PARTIEL', `+${res.converted} · −${res.losses}`, '#fde68a');
        this.hud.popup(`+${res.converted}`, '#fde68a', screen.x, screen.y - 100);
      }
    }
    this.bestArmy = Math.max(this.bestArmy, this.army.count);
  }

  checkMilestones() {
    const n = this.army.count;
    while (this.armyMilestone < ARMY_MILESTONES.length
      && n >= ARMY_MILESTONES[this.armyMilestone]) {
      const value = ARMY_MILESTONES[this.armyMilestone];
      this.armyMilestone++;
      this.hud.announce(`${value} PANDAS`, 'la horde gronde', '#a3e635');
      this.bamboo += value * 0.5 * this.harvestMult();
    }
    const d = this.army.diversity();
    if (d > this.diversityMilestone && DIVERSITY_MILESTONES[d]) {
      this.diversityMilestone = d;
      const [t, s] = DIVERSITY_MILESTONES[d];
      this.hud.announce(t, s, '#fde68a');
      this.flash(260, 253, 224, 71);
      this.highlights.push({ icon: '☯', text: `${t} — ${d} espèces réunies` });
      this.bamboo += 40 * d * this.harvestMult();
    }
  }

  // ------------------------------------------------------------------ boss

  startBoss() {
    this.phase = 'boss';
    const def = Object.assign({}, this.biome.boss);
    def.hp = Math.round(def.hp * this.difficulty);
    this.boss = new Boss(def);
    this.preview.hide();
    Audio.sfx('boss');
    Audio.setMood('boss');
    this.hud.announce(this.biome.boss.icon + ' GÉNÉRAL', this.biome.boss.name, '#fecaca');
    this.flash(420, 255, 255, 255);
  }

  updateBoss(dt, half, fx) {
    const boss = this.boss;
    const out = boss.update(dt, {
      playerStyle: fx.universalStyle ? this.counterStyleOf(boss.requiredStyle) : this.styles.current,
      armyCount: this.army.count,
      powerBonus: this.army.bonus('power') + this.codexBonus.power,
      abilityPower: fx.power,
      shielded: fx.shield,
      playerX: this.panda.x,
      armySpread: this.army.spread,
      roadHalf: half,
      attackSpeed: this.speed * 1.15,
    });

    if (out.breach) this.chi.gain(CHI_GAINS.bossBreach * dt);

    if (out.unitsLost > 0) {
      this.bossLossAccum = (this.bossLossAccum || 0) + out.unitsLost;
      if (this.bossLossAccum >= 1) {
        const n = Math.floor(this.bossLossAccum);
        this.bossLossAccum -= n;
        this.army.remove(n);
        if (out.hit) {
          Audio.sfx('hurt');
          this.shake(260, 0.012);
          const screen = this.renderer.cam.project(this.panda.x, 0);
          this.hud.popup(`−${n}`, '#fca5a5', screen.x, screen.y - 90);
        }
      }
    }
    if (out.damage > 0 && !this.bossHitCooldown) {
      this.bossHitCooldown = 0.18;
      Audio.sfx('bossHit');
    }
    if (this.bossHitCooldown) {
      this.bossHitCooldown = Math.max(0, this.bossHitCooldown - dt);
      if (this.bossHitCooldown === 0) this.bossHitCooldown = null;
    }
    if (out.phaseChanged) {
      const st = STYLES[boss.requiredStyle];
      const counter = STYLES[this.counterStyleOf(boss.requiredStyle)];
      this.hud.announce('CHANGEMENT DE GARDE', `riposte en ${counter.icon} ${counter.short}`, st.css);
      this.flash(200, 255, 255, 255);
    }
    if (out.defeated) this.onBossDefeated();
    else if (out.timedOut) this.endRun('timeout');
  }

  onBossDefeated() {
    const tamed = this.boss.tamedVictory;
    Audio.sfx('win');
    this.flash(500, 255, 255, 255);
    if (tamed) {
      const skinKey = this.biome.boss.skin;
      if (Save.unlockSkin(skinKey)) {
        this.unlockedSkin = skinKey;
        this.highlights.push({ icon: '🎨', text: `Robe du général débloquée` });
      }
      this.save.bossesTamed[this.biome.boss.key] = true;
      Save.recordTamed(this.biome.boss.species, 1);
      this.army.add(1, this.biome.boss.species);
      Save.save();
    }
    this.score += 500 + Math.round(this.bestArmy * 4) + (tamed ? 400 : 0);

    if (this.mode === 'endless') {
      this.hud.announce(tamed ? '☯ GÉNÉRAL RALLIÉ' : '🏆 GÉNÉRAL VAINCU',
        'la route continue…', tamed ? '#fde68a' : '#86efac');
      this.leg++;
      const nextIndex = (this.biomeIndex + 1) % BIOMES.length;
      this.time.delayedCall(1400, () => {
        if (this.phase === 'over') return;
        this.buildLeg(nextIndex, this.difficulty * 1.28);
        Audio.setMood('run');
        this.hud.biomeCard(this.biome, this.legSubtitle());
      });
      this.phase = 'transition';
    } else {
      this.endRun(tamed ? 'tamed' : 'victory');
    }
  }

  // -------------------------------------------------------------- pertes

  applyEdgeLosses(dt, half, fx) {
    if (fx.shield) { this.edgeAccum = 0; this.edgeAlert *= 0.9; return; }
    const outside = this.army.countOutside(this.panda.x, half);
    if (outside <= 0) {
      this.edgeAccum = Math.max(0, this.edgeAccum - dt);
      this.edgeAlert = Math.max(0, this.edgeAlert - dt * 2);
      return;
    }
    this.edgeAlert = Math.min(1, this.edgeAlert + dt * 3);
    const resist = clamp(1 - this.meta.resist - this.army.bonus('resist'), 0.25, 1);
    this.edgeAccum += outside * dt * 0.85 * resist;
    if (this.edgeAccum >= 1) {
      const n = Math.floor(this.edgeAccum);
      this.edgeAccum -= n;
      const lost = this.army.remove(n);
      const now = this.time.now;
      if (lost > 0 && now - (this.lastEdgeWarn || 0) > 900) {
        this.lastEdgeWarn = now;
        const screen = this.renderer.cam.project(this.panda.x, 0);
        this.hud.popup('bords !', '#fca5a5', screen.x, screen.y - 60);
      }
    }
  }

  updateHints() {
    if (!this.hints.length) return;
    const h = this.hints[0];
    if (this.distance >= h.at) {
      this.hints.shift();
      this.hud.announce(h.text, h.sub, '#e2e8f0');
    }
  }

  updateMusicTier() {
    const n = this.army.count;
    const tier = n >= 160 ? 4 : n >= 80 ? 3 : n >= 35 ? 2 : n >= 12 ? 1 : 0;
    if (tier !== this.musicTier) {
      this.musicTier = tier;
      Audio.setIntensity(tier);
    }
  }

  /** Qualité adaptative : on protège le framerate avant la joliesse. */
  adaptQuality(dt) {
    if (this.save.quality !== 'auto') return;
    this.fpsTimer += dt;
    if (this.fpsTimer < 0.5) return;
    this.fpsTimer = 0;
    const fps = this.game.loop.actualFps;
    if (fps < 42) {
      this.lowFpsTime += 0.5; this.goodFpsTime = 0;
      if (this.lowFpsTime >= 1.5 && this.renderer.qualityName !== 'low') {
        this.renderer.setQuality('low');
      }
    } else if (fps > 55) {
      this.goodFpsTime += 0.5; this.lowFpsTime = 0;
      if (this.goodFpsTime >= 8 && this.renderer.qualityName !== 'high') {
        this.renderer.setQuality('high');
        this.goodFpsTime = 0;
      }
    }
  }

  // ---------------------------------------------------------------- effets

  flash(duration, r, g, b) {
    if (this.save.shake === false) return;
    this.cameras.main.flash(duration, r, g, b, false);
  }

  shake(duration, intensity) {
    if (this.save.shake === false) return;
    this.cameras.main.shake(duration, intensity);
  }

  fxPuff(ev) {
    // Nuage de poussière type comics : pas de violence graphique (§13).
    const pt = this.renderer.cam.project(0, ev.z - this.distance + 320);
    for (let i = 0; i < 5; i++) {
      const p = this.add.image(
        pt.x + Phaser.Math.Between(-70, 70),
        pt.y + Phaser.Math.Between(-50, 10),
        'puff'
      ).setDepth(650).setAlpha(0.9).setScale(0.3).setTint(0xfef3c7);
      this.tweens.add({
        targets: p,
        scale: Phaser.Math.FloatBetween(0.9, 1.4),
        alpha: 0,
        y: p.y - Phaser.Math.Between(20, 70),
        duration: Phaser.Math.Between(380, 620),
        ease: 'Quad.out',
        onComplete: () => p.destroy(),
      });
    }
  }

  fxTame(ev) {
    const pt = this.renderer.cam.project(0, ev.z - this.distance + 320);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const p = this.add.image(pt.x, pt.y - 40, 'spark')
        .setDepth(650).setScale(0.5).setTint(0x86efac);
      this.tweens.add({
        targets: p,
        x: pt.x + Math.cos(a) * Phaser.Math.Between(60, 150),
        y: pt.y - 40 + Math.sin(a) * Phaser.Math.Between(40, 110),
        alpha: 0,
        scale: 0.1,
        duration: Phaser.Math.Between(500, 800),
        ease: 'Quad.out',
        onComplete: () => p.destroy(),
      });
    }
  }

  // ---------------------------------------------------------------- rendu

  render(time, slowmo) {
    const half = this.currentHalf();
    const r = this.renderer;
    const dtReal = Math.min(this.game.loop.delta / 1000, 0.05);

    r.updateWeather(dtReal, this.speed ? this.speed / this.biome.baseSpeed : 1);
    r.drawScenery(this.distance, this.level.profile);
    r.drawRoad(this.distance, this.level.profile, this.edgeAlert);
    r.begin();

    const events = this.level.events;
    const start = Math.max(0, this.eventCursor - 6);
    for (let i = start; i < events.length; i++) {
      const ev = events[i];
      const rel = ev.z - this.distance;
      if (rel > EVENT_FAR) break;
      if (rel < -700) continue;
      const localHalf = this.level.profile.halfAt(ev.z);
      switch (ev.type) {
        case 'gate': if (!ev.done) r.drawGate(ev, rel, localHalf); break;
        case 'bonusGate': if (!ev.done) r.drawBonusGate(ev, rel, localHalf); break;
        case 'formation': if (!ev.done) r.drawFormationPads(ev, rel, localHalf); break;
        case 'token': if (!ev.done) r.drawToken(ev, rel, localHalf); break;
        case 'obstacle': if (!ev.done) r.drawObstacle(ev, rel, localHalf); break;
        case 'encounter':
          r.drawEncounter(ev, rel, localHalf, time, rel < DECISION_RANGE * 0.7);
          break;
        default: break;
      }
    }

    if (this.boss) r.drawBoss(this.boss, half, time);

    const fx = this.effects();
    const auraColor = this.chi.active
      ? 0xfcd34d
      : (fx.shield || fx.speed > 1.2 || fx.power > 1.5)
        ? STYLES[this.styles.abilityStyle || this.styles.current].color
        : null;
    r.drawArmy(this.army, this.panda.x, this.save.skin || 'default', time,
      auraColor != null ? { color: auraColor } : null);
    r.end();

    r.drawOverlay({
      speedLines: fx.speed > 1.2 ? 1 : 0,
      chiGlow: this.chi.active ? this.chi.activeRatio : 0,
      edgeAlert: this.edgeAlert,
      slowmo,
    });

    this.hud.update({
      army: this.army.count,
      diversity: this.army.diversity(),
      bamboo: Math.floor(this.bamboo),
      progress: clamp(this.distance / this.level.length, 0, 1),
      ghost: this.ghostProgress,
      record: this.ghostArmy > 0 && this.army.count > this.ghostArmy,
      biomeIcon: this.biome.boss.icon,
      biomeColor: this.biome.palette.edge,
      style: this.styles.current,
      cooldown: this.styles.cooldownProgress(),
      abilityActive: this.styles.abilityActive,
      abilityName: STYLES[this.styles.abilityStyle || this.styles.current].ability.name,
      chi: this.chi.ratio,
      chiReady: this.chi.ready,
      chiActive: this.chi.active,
      chiActiveRatio: this.chi.activeRatio,
      combo: {
        chain: this.combo.chain,
        label: this.combo.tier.label,
        mult: this.combo.multiplier,
        window: this.combo.windowProgress,
      },
      formation: this.formation.active
        ? { shape: this.formation.held, progress: this.formation.progress(2000) }
        : null,
      boss: this.boss && !this.boss.defeated ? {
        name: this.biome.boss.name,
        hp: this.boss.hpRatio,
        phaseCount: this.boss.phases.length,
        guard: this.boss.requiredStyle,
        counter: this.counterStyleOf(this.boss.requiredStyle),
        breaching: fx.universalStyle || matchup(this.styles.current, this.boss.requiredStyle) === 1,
        harmony: this.boss.harmony,
        time: this.boss.timeLeft,
      } : null,
    });
  }

  counterStyleOf(styleKey) {
    return STYLE_KEYS.find((k) => STYLES[k].strongVs === styleKey) || 'bamboo';
  }

  // ----------------------------------------------------------------- états

  togglePause() {
    if (this.phase === 'over') return;
    this.paused = !this.paused;
    if (this.paused) this.showPause(); else this.hidePause();
  }

  showPause() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.pauseLayer = this.add.container(0, 0).setDepth(950).setScrollFactor(0);
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x020617, 0.85);
    const t = this.add.text(W / 2, H * 0.22, 'PAUSE', title(46)).setOrigin(0.5);

    // Antisèche : la table élémentaire, toujours consultable.
    const wheel = this.add.text(W / 2, H * 0.30,
      '🎋 bat 🔥   ·   🔥 bat 🌪️   ·   🌪️ bat 💧   ·   💧 bat 🎋',
      body(16, '#cbd5e1')).setOrigin(0.5);
    const controls = this.add.text(W / 2, H * 0.345,
      '← →  diriger   ·   ESPACE  capacité   ·   E  Éveil',
      body(14, '#94a3b8')).setOrigin(0.5);

    const resume = makeButton(this, W / 2, H * 0.45, 280, 66, 'REPRENDRE', {
      onClick: () => this.togglePause(),
    });
    const quit = makeButton(this, W / 2, H * 0.55, 280, 58, 'ABANDONNER', {
      fill: 0x475569, color: '#ffffff', fontSize: 22,
      onClick: () => this.endRun('quit'),
    });
    const mute = makeButton(this, W / 2, H * 0.635, 280, 50,
      this.save.muted ? '🔇 SON COUPÉ' : '🔊 SON ACTIF', {
        fill: 0x1e293b, color: '#e2e8f0', fontSize: 19, radius: 14,
        onClick: () => {
          const m = !this.save.muted;
          Save.setMuted(m);
          Audio.setMuted(m);
          mute.label.setText(m ? '🔇 SON COUPÉ' : '🔊 SON ACTIF');
        },
      });
    const slow = makeButton(this, W / 2, H * 0.705, 280, 50,
      this.save.slowmo ? '⏳ RALENTI ACTIF' : '⏳ RALENTI COUPÉ', {
        fill: 0x1e293b, color: '#e2e8f0', fontSize: 19, radius: 14,
        onClick: () => {
          Save.setSetting('slowmo', !this.save.slowmo);
          slow.label.setText(this.save.slowmo ? '⏳ RALENTI ACTIF' : '⏳ RALENTI COUPÉ');
        },
      });
    this.pauseLayer.add([bg, t, wheel, controls, resume, quit, mute, slow]);
  }

  hidePause() {
    if (this.pauseLayer) { this.pauseLayer.destroy(); this.pauseLayer = null; }
  }

  endRun(outcome) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.hidePause();
    this.paused = false;
    this.preview.hide();
    Audio.setMood('run');

    const victory = outcome === 'victory' || outcome === 'tamed';
    if (!victory && outcome !== 'quit') Audio.sfx('lose');

    const harmonyBonus = 1 + this.combo.harmony * 0.35;
    const victoryBonus = victory ? 1.5 : 1;
    const legBonus = 1 + this.leg * 0.25;
    const earned = Math.round(this.bamboo * harmonyBonus * victoryBonus * legBonus);
    Save.addBamboo(earned);

    let unlockedBiome = false;
    if (victory && this.mode === 'story') {
      unlockedBiome = Save.unlockBiome(this.biomeIndex + 1);
      if (this.biomeIndex + 1 >= BIOMES.length) Save.unlockEndless();
    }

    const score = Math.round(
      this.score + this.bestArmy * 10 + this.combo.tamedUnits * 6 + earned
      + (victory ? 500 : 0) + this.leg * 1000
    );

    if (this.biggestTame >= 15) {
      this.highlights.unshift({ icon: '🤝', text: `${this.biggestTame} unités ralliées d'un seul coup` });
    }
    if (this.combo.best >= 6) {
      this.highlights.push({ icon: '🔥', text: `Enchaînement de ${this.combo.best} décisions justes` });
    }
    if (this.chi.totalSpent > 0) {
      this.highlights.push({ icon: '☯', text: `Éveil déclenché ${this.chi.totalSpent} fois` });
    }

    const summary = {
      mode: this.mode,
      outcome,
      biomeIndex: this.biomeIndex,
      biomeKey: this.biome.key,
      biomeName: this.biome.name,
      progress: clamp(this.distance / this.level.length, 0, 1),
      leg: this.leg,
      army: this.army.count,
      bestArmy: this.bestArmy,
      diversity: this.army.diversity(),
      composition: this.army.composition(),
      bamboo: earned,
      tamed: this.combo.tamed,
      tamedUnits: this.combo.tamedUnits,
      fought: this.combo.fought,
      harmony: this.combo.harmony,
      bestCombo: this.combo.best,
      score,
      unlockedBiome,
      unlockedSkin: this.unlockedSkin || null,
      highlights: this.highlights.slice(0, 3),
      prevBest: (Save.bestFor(this.biome.key) || {}).score || 0,
      seed: this.seed,
    };

    Save.finishRun(summary);

    this.time.delayedCall(outcome === 'quit' ? 0 : 900, () => {
      this.scene.start('Result', summary);
    });
  }

  handleResize() {
    if (this.renderer) this.renderer.resize();
  }

  cleanup() {
    this.scale.off('resize', this.handleResize, this);
    this.input.keyboard.removeAllListeners();
    this.input.removeAllListeners();
    if (this.renderer) this.renderer.destroy();
    if (this.preview) this.preview.destroy();
    if (this.hud) this.hud.destroy();
  }
}
