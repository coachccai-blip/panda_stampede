# 🐼 Panda Stampede

Un *crowd runner* où l'on ne gagne pas en écrasant, mais en **ralliant**.

Un panda moine-guerrier traverse des terres envahies en grossissant son armée.
À chaque rencontre, deux portes : **⚔ combattre** (rapide, sûr, ne rapporte que
du nombre) ou **🤝 apprivoiser** (plus lent, risqué, mais l'ennemi rejoint tes
rangs avec ses propres capacités). La vraie force d'une armée, c'est sa
diversité.

**▶️ Jouable directement dans le navigateur — aucune installation, aucun build.**

---

## Comment jouer

| Action | Clavier | Tactile |
|---|---|---|
| Diriger la troupe | `←` `→` ou `Q` `D` | glisser le doigt |
| Capacité de style | `Espace` | tap rapide |
| Éveil (Chi) | `E` ou `Maj` | toucher le bouton ☯ |
| Changer de style | `1` `2` `3` `4` *(playtest)* | ramasser les jetons |
| Pause | `Échap` ou `P` | bouton ⏸ |

### La roue des styles

🎋 Bambou bat 🔥 Feu bat 🌪️ Vent bat 💧 Eau bat 🎋 Bambou.

Le bon style **divise le coût d'un combat** et **augmente le taux
d'apprivoisement de 20 points**. Les chiffres affichés sur les deux portes se
recalculent en direct quand tu changes de style : c'est ainsi qu'on apprend la
table élémentaire sans tutoriel.

---

## Publier sur GitHub Pages

Le dépôt est **déjà prêt à être servi tel quel depuis la racine de `main`** :
pas de build, pas de bundler, pas de dépendance externe au moment de
l'exécution (Phaser 3 est embarqué dans `vendor/`).

1. Fusionne la branche de développement dans `main`.
2. Dans GitHub : **Settings → Pages**
   - *Source* : **Deploy from a branch**
   - *Branch* : **`main`** — dossier **`/ (root)`**
3. Sauvegarde. Le jeu est en ligne une à deux minutes plus tard sur
   `https://<utilisateur>.github.io/<dépôt>/`.

Aucune autre configuration n'est nécessaire. Le fichier `.nojekyll` empêche
Jekyll de filtrer des fichiers, et tous les chemins sont relatifs, donc le jeu
fonctionne aussi bien à la racine d'un domaine que dans un sous-dossier de
projet.

### Tester en local

Les modules ES ne se chargent pas depuis `file://` : il faut un petit serveur.

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

---

## Modes de jeu

- **Aventure** — 5 biomes, un général par biome, progression déblocable.
- **Défi du jour** — une graine identique pour tout le monde, qui change à
  minuit. Un score à battre, le même piste pour tous.
- **Marche Infinie** — les biomes s'enchaînent sans fin, la difficulté monte de
  28 % à chaque étape. Débloqué en terminant l'Aventure.

## Mécaniques

| Système | Ce qu'il apporte |
|---|---|
| **Combat / Apprivoisement** | Le cœur : un vrai dilemme chiffré à chaque rencontre. |
| **Styles élémentaires** | Pierre-feuille-ciseaux vivant, à entretenir en ramassant des jetons. |
| **Équilibre Yin-Yang** | Plus l'armée est grosse, plus elle est large et lente. La piste elle-même plafonne ta taille : les unités qui dépassent des bords sont perdues. |
| **Chi / Éveil** | Apprivoiser remplit une jauge. Pleine, elle offre 7 s où les quatre styles ne font qu'un, l'apprivoisement ne rate jamais et l'armée ne perd rien. La voie pacifique devient une vraie puissance, pas juste un cosmétique. |
| **Instant de Sagesse** | Le temps ralentit une fraction de seconde avant une décision serrée. Un runner de décision, pas de réflexe. |
| **Formations bonus** | Un pochoir au sol, une porte ×2 plus loin : un skill visuel et spatial. |
| **Diversité d'armée** | Chaque espèce ralliée donne un bonus distinct (maniabilité, puissance, résistance, récolte, apprivoisement), avec rendements décroissants. |
| **Généraux** | Hybride nombre + style : seule la riposte qui bat leur garde ouvre une brèche. Les vaincre en gardant l'harmonie haute (≥ 70 %) les rallie et débloque leur robe. |
| **Dojo** | Progression méta : entraînement, codex, skins, compagnons de départ, réglages. |

## Structure du projet

```
index.html            page unique, charge Phaser puis src/main.js
vendor/phaser.min.js  Phaser 3.80.1 embarqué (MIT)
src/
  main.js             configuration du jeu
  scenes/             Boot · Menu · Run · Dojo · Result
  systems/            ArmyManager · StyleManager · WaveSpawner ·
                      FormationChecker · ComboSystem · ChiSystem
  entities/           Panda · AnimalUnit · EnemyGroup · Gate · Boss
  data/               styles · enemies · biomes · upgrades  (design piloté par données)
  core/               perspective · WorldRenderer · textures · audio · save · rng
  ui/                 HUD · StyleIndicator · ChoiceGatePreview · theme
```

**Aucun asset binaire.** Les sprites sont dessinés en vectoriel puis cuits en
textures au démarrage (`core/textures.js`), et toute la bande-son est
synthétisée au WebAudio (`core/audio.js`), avec des couches qui s'ajoutent à
mesure que l'armée grossit.

**Équilibrage sans toucher au code.** Effectifs ennemis, cadence des portes,
longueur des biomes, coûts du Dojo : tout vit dans `src/data/`.

## Notes techniques

- **Rendu pseudo-3D** : la piste fuit vers l'horizon par projection
  perspective (`core/perspective.js`), sans moteur 3D.
- **Zéro allocation dans la boucle de rendu** : sprites, textes, Graphics et
  points de polygone sont tous recyclés.
- **Qualité adaptative** : si le framerate descend sous 42 fps, le moteur
  réduit le nombre de segments de piste, de décors et d'unités dessinées. Le
  réglage est forçable dans le Dojo.
- **Ciel et vignette pré-cuits en texture** plutôt que redessinés chaque frame
  (poste de dépense n°1 sur un GPU limité en fill-rate).
- **Progression** stockée dans le `localStorage` du navigateur ; si le stockage
  est indisponible (navigation privée), le jeu tourne quand même, sans
  sauvegarde.

## Licence

Code du jeu : libre d'usage.
Phaser 3 (`vendor/phaser.min.js`) est distribué sous licence MIT — © Phaser Studio Inc.
