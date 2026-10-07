# Administration en tableau de bord

## Objectif
Transformer `/admin` en un espace de gestion moderne avec navigation latérale, sans modifier les parcours de commande, les notifications ni les pixels existants.

## Interface
- Remplacer les onglets horizontaux par la barre latérale existante : rétractable en icônes sur ordinateur et ouverte en tiroir sur mobile.
- Afficher le logo et le nom configurés de la boutique en haut, puis les entrées **Commandes**, **Produits**, **Catégories** et **Paramètres** avec leurs icônes.
- Placer **Déconnexion** en bas et garder le bouton d’ouverture de la barre toujours accessible dans l’en-tête.
- Piloter la page active avec `?tab=orders|products|categories|settings`, avec validation et retour par défaut vers Commandes.
- Donner à chaque page un titre, un sous-titre et un contenu pleine largeur adapté aux écrans mobiles.

## Commandes
- Ajouter en haut les filtres de statut **Tous**, **En attente**, **Confirmée**, **Expédiée**, **Livrée**, **Annulée**.
- Calculer et afficher le compteur de chaque statut depuis la liste déjà chargée.
- Faire de ces onglets le filtre principal tout en conservant la recherche, la sélection multiple, la barre d’action fixe et toutes les actions existantes.

## Cadre des fonctionnalités
- Ajouter `app_settings.feature_config jsonb NOT NULL DEFAULT '{}'` sans modifier les données existantes.
- Recréer `get_public_settings()` afin d’exposer `feature_config`, puis mettre à jour le type des paramètres publics.
- Ajouter `useFeatureConfig(key)` pour lire uniquement la configuration publique d’une fonctionnalité.
- Conserver la liste `FEATURES` comme registre des clés et libellés. Les prochaines fonctionnalités auront une entrée de barre latérale et une page dédiée avec carte **Activation**, interrupteur et réglages désactivés visuellement lorsque la fonctionnalité est inactive.
- Documenter cette convention dans les règles techniques du projet. Les secrets restent dans leurs champs protégés existants, jamais dans `feature_config`.

## Vérification
- Vérifier l’affichage et la navigation sur ordinateur et mobile.
- Vérifier les compteurs et changements de filtres des commandes, la sélection multiple et la déconnexion.
- Contrôler que l’administration reste en français et de gauche à droite, et que la boutique publique ne change pas.
