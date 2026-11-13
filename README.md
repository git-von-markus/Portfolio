# Portfolio – Markus Niebisch

Quellcode von [niebischmarkus.de](https://niebischmarkus.de). Gebaut mit [Astro](https://astro.build), veröffentlicht über GitHub Pages.

## Inhalte bearbeiten

Im **Portfolio-Studio** unter `/studio/` (oder per Doppelklick auf das © unten auf der Seite).

1. Mit einem GitHub-Token anmelden (Anleitung steht auf der Anmeldeseite).
2. Projekte, Texte, Bilder und Profil bearbeiten.
3. „Speichern und veröffentlichen“ – das Studio speichert alles als einen Commit auf `main`, danach baut GitHub Actions die Seite neu (1–2 Minuten).

Neue Projekte starten als Entwurf und sind erst nach dem Umschalten auf „Veröffentlicht“ öffentlich.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/content/projects/*.json` | Ein Projekt pro Datei (Titel, Texte, Medien, Links, Status) |
| `src/data/site.json` | Profil, Werdegang, Kenntnisse, Bereiche, Kontakt, Impressum, Datenschutz |
| `src/assets/media/<projekt>/` | Bilder – werden beim Build automatisch verkleinert und als WebP ausgeliefert |
| `public/files/<projekt>/` | Videos, 3D-Modelle (`.glb`), PDFs – werden unverändert ausgeliefert |
| `src/pages/` | Startseite, Projektseiten, Impressum, Datenschutz, Studio |
| `src/studio/` | Das Studio (Preact), spricht direkt mit der GitHub-API |
| `scripts/fetch-youtube-thumbs.mjs` | Holt beim Build die YouTube-Vorschaubilder, damit Besucher erst nach Klick mit YouTube verbunden werden |

## Lokal starten

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # fertige Seite in dist/
```

## Einmalige Einrichtung auf GitHub

Settings → Pages → Build and deployment → Source: **GitHub Actions**. Die eigene Domain (`niebischmarkus.de`) bleibt dort eingetragen.
