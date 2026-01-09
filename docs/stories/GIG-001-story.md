# Story — GIG-001 : Démarrer le flux OAuth (POST /api/sync/gmail/start)

Epic: Auth & Gmail sync
Priority: P0
Estimation: S

Résumé utilisateur
- En tant qu'utilisateur souhaitant connecter mon compte Gmail,
- Je veux qu'une URL de consentement Google soit fournie par l'API,
- Afin de rediriger l'utilisateur vers Google pour autoriser l'accès.

Description courte
Endpoint qui construit et renvoie l'URL de consentement Google incluant le paramètre `state`.

Acceptance Criteria (AC)
- POST /api/sync/gmail/start renvoie 200 et un payload JSON { "oauth_url": string }.
- oauth_url contient au minimum : client_id, redirect_uri, scope, response_type=code et state.
- oauth_url commence par "https://accounts.google.com/o/oauth2/v2/auth?" et contient "state=".
- Si les variables d'environnement OAuth requises sont absentes, l'API renvoie 500 (ou 400 selon convention d'erreur) avec message explicite.
- Le paramètre state est unique/cryptographiquement aléatoire et enregistré côté serveur (DB ou store temporaire) pour validation au callback.

Scénarios de test (Given / When / Then)
- Given que les variables d'environnement OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI) sont présentes,
  When j'appelle POST /api/sync/gmail/start,
  Then la réponse contient oauth_url commençant par "https://accounts.google.com/o/oauth2/v2/auth?" et contenant "state=".

- Given que les variables d'environnement sont manquantes,
  When j'appelle POST /api/sync/gmail/start,
  Then la réponse est 500 (ou 400) avec message d'erreur clair.

Tâches d'implémentation
- [ ] Créer la route POST /api/sync/gmail/start (controller + route).
- [ ] Implémenter le builder d'URL (utiliser URLSearchParams ou équivalent).
- [ ] Générer un `state` sécurisé et le persister temporairement (DB, Redis ou table oauth_states).
- [ ] Valider la présence des variables d'environnement et renvoyer erreur explicite si manquantes.
- [ ] Ajouter tests unitaires pour la fonction de build d'URL (vérifier présence des paramètres).
- [ ] Ajouter test d'intégration qui appelle l'endpoint et vérifie le format de oauth_url.
- [ ] Mettre à jour l'OpenAPI / docs ([`app/backend/openapi.yaml`](app/backend/openapi.yaml:1)) et la documentation produit/service (référence : [`ARCHITECTURE.md`](ARCHITECTURE.md:1)).
- [ ] Ajouter un exemple de réponse dans la documentation d'API.

Notes d'implémentation
- Paramètres d'environnement attendus : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI (confirmés dans le codebase).
- Utiliser response_type=code pour flux Authorization Code.
- State doit être horodaté ou contenir un TTL côté serveur pour protéger contre la réutilisation.
- Ne pas renvoyer de tokens côté /start — seulement l'URL.
- Voir ticket source pour contexte : [`docs/tickets.md`](docs/tickets.md:15).

Checklist de livraison
- [ ] Code review passée
- [ ] Tests CI verts
- [ ] Documentation OpenAPI mise à jour
- [ ] Déploiement en staging validé

Créé à partir du ticket : [`docs/tickets.md`](docs/tickets.md:15)