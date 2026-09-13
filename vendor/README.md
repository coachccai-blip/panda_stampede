# Dépendances embarquées

## phaser.min.js — Phaser 3.80.1

Moteur de jeu HTML5, distribué sous licence **MIT** (© Phaser Studio Inc.).
Source : https://github.com/phaserjs/phaser — paquet npm `phaser@3.80.1`,
fichier `dist/phaser.min.js`, copié tel quel sans modification.

Il est embarqué plutôt que chargé depuis un CDN pour que la page soit
autonome : elle fonctionne hors ligne, ne dépend d'aucun service tiers, et
ne transmet aucune requête vers un domaine externe. `index.html` retombe sur
jsDelivr puis cdnjs uniquement si le fichier local est introuvable.

Pour mettre à jour :

```bash
npm pack phaser@3.80.1
tar -xzf phaser-3.80.1.tgz package/dist/phaser.min.js
cp package/dist/phaser.min.js vendor/phaser.min.js
```

Pensez alors à aligner les URLs de secours dans `index.html`.
