# Historisch glas in gebouwen

Statische webapp (geen build-stap nodig).

## Publiceren via GitHub Pages
1. Maak een repository en zet alle bestanden uit deze map in de root (`index.html`, `app.js`, `style.css`, `data.js`).
2. Ga naar **Settings → Pages**, kies *Deploy from a branch*, branch `main`, map `/ (root)`.
3. De site staat na een minuut op `https://<gebruiker>.github.io/<repo>/`.

## Data bijwerken
Pas het Excel-bestand aan en draai `python build_data.py bestand.xlsx` (vereist pandas + openpyxl). Dit herschrijft `data.js`; commit en push.
