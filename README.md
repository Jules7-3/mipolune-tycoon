# Mipolune Tycoon · V6

Un jeu de gestion en français situé dans une ville côtière. Servez vos premiers clients, recrutez, développez neuf commerces et investissez dans trois quartiers. Les missions, les événements, les directeurs, la collection et le prestige accompagnent la progression. La boutique n’utilise que l’argent fictif du jeu.

## Jouer et compiler

Avec Node.js 22.12 ou plus récent :

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Le dossier `dist/` est autonome et peut être hébergé sur un serveur statique, y compris sous un sous-répertoire. En HTTPS, le jeu se met en cache après le premier chargement. Sur iPhone, Safari permet de l’ajouter à l’écran d’accueil.

La V6 lit la clé locale `mipolune` utilisée par les versions précédentes. La reprise dépend de l’origine du site et du conteneur. Une installation Safari et une installation iOS native ont chacune leur stockage local. Les revenus d’absence sont plafonnés à quatre heures.

## Projet iPhone

Le projet Capacitor est dans `ios/App/App.xcodeproj` et utilise Swift Package Manager. Il cible l’iPhone sous iOS 16 ou plus récent. Le rendu équilibré limite la résolution et la fréquence des images ; le mode Économie désactive également les ombres. Les géométries statiques sont regroupées par matériau et les ombres statiques sont recalculées lors des changements de scène. Le rendu se met en pause lorsque le jeu passe en arrière-plan.

```sh
npm ci
npm run ios:sync
npx cap open ios
```

Dans Xcode sur macOS, sélectionnez l’équipe de signature et adaptez si nécessaire l’identifiant `fr.jules73.mipolune`. Testez la compilation et l’exécution sur iPhone, notamment les gestes, la reprise après suspension, le rendu WebGL et le budget GPU. Le projet iOS est fourni sans archive signée. La diffusion et TestFlight requièrent normalement l’adhésion à l’[Apple Developer Program](https://developer.apple.com/programs/).

## Ressources

Les bâtiments, la ville, les véhicules, les textures procédurales et la musique ont été réalisés pour le jeu. Les trois ressources suivantes proviennent de [Poly Haven](https://polyhaven.com/fr/license), sous licence CC0. La texture d’asphalte est intégrée en 2K et les modèles de mobilier utilisent des textures 1K. Les ressources sont embarquées et les textures JPG ont été recompressées pour le mobile.

| Ressource | Utilisation |
| --- | --- |
| [Asphalt Track](https://polyhaven.com/a/asphalt_track) | Routes |
| [Painted Wooden Bench](https://polyhaven.com/a/painted_wooden_bench) | Bancs de la promenade |
| [Street Lamp 01](https://polyhaven.com/a/street_lamp_01) | Lampadaires de la baie |
