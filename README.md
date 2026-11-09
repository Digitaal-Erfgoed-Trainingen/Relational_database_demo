# Glas in gebouwen

Een educatieve interface bij de cursus **Dataorganisatie in spreadsheets voor bouwhistorie**. De toepassing maakt de één-op-veel-relatie tussen Gebouw (parent) en Glasobject (child) zichtbaar.

## Starten

Pak de ZIP uit en open `index.html` in een actuele browser. De tabellen en detailpagina’s werken zonder installatie. Alleen de achtergrondkaart heeft internet nodig. De kaart verschijnt uitsluitend na het openen met de kaartknop.

## Publiceren op GitHub Pages

1. Maak een repository op GitHub, bijvoorbeeld `historisch-glas`.
2. Upload de **uitgepakte inhoud** van dit pakket naar de hoofdmap van de repository. `index.html`, `assets/` en `data/` moeten direct naast elkaar staan. Upload niet alleen de ZIP.
3. Open **Settings → Pages**.
4. Kies onder **Build and deployment** voor **Deploy from a branch**.
5. Selecteer de branch **main** en de map **/ (root)**. Klik op **Save**.
6. Na publicatie staat de website-URL bij Pages. Open die URL om de toepassing te gebruiken.

De toepassing gebruikt relatieve bestandspaden en hash-navigatie. Zij werkt daarom ook onder een repositorypad en in een submap van een bestaande cursuswebsite. Er is geen Node-installatie, buildstap, API-sleutel of serverdatabase nodig.

De mappen `scripts/` en `bronbestanden/` zijn alleen nodig om de gegevens opnieuw te maken. Voor het tonen van de website volstaan `index.html`, `assets/`, `data/` en `.nojekyll`.

Officiële uitleg: [GitHub Pages-publicatiebron instellen](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Wat kun je ermee?

- Gebouwen en glasobjecten bekijken in afzonderlijke tabellen.
- Zoeken zonder onderscheid tussen hoofdletters en kleine letters of accenten. Meerdere zoekwoorden moeten allemaal voorkomen.
- Gebouwen filteren op afgeleide plaatsnaam, gekoppelde objecten, herkomst en bronstatus.
- Glasobjecten filteren op gebouw, techniek/eigenschap, jaarbereik, koppelmethode en ingevulde of ontbrekende datering.
- Tabellen sorteren en bladeren met 20, 50 of 100 rijen per pagina.
- Elk gebouw openen met de volledige lijst gekoppelde glasobjecten.
- Elk glasobject openen met een link naar zijn gebouw en de andere glasobjecten in dat gebouw.
- De oorspronkelijke bronvelden van ieder oorspronkelijk record bekijken, inclusief lege velden.
- De **hele gefilterde selectie** exporteren naar CSV, dus niet alleen de huidige pagina. CSV gebruikt UTF-8 met BOM en een puntkomma als scheidingsteken.
- De actieve selectie op de kaart tonen. In de objectentabel worden objecten bij hun gebouw gegroepeerd. Een objectdetail toont de locatie van het gebouw, niet een exacte raampositie.
- Primaire sleutels, vreemde sleutels, cardinaliteit en een JOIN uitleggen met echte voorbeelden en vier korte opdrachten.
- De bijbehorende SQLite-database, het SQL-schema, de JSON-export en de koppeltabel downloaden via “Over de gegevens”.

Filter- en detail-URL’s zijn deelbaar. Voorbeeld: `#gebouw/G0005` en `#glasobjecten?gebouw=G0005`. De toepassing is een leesomgeving: bezoekers kunnen de bronrecords niet wijzigen.

## Data en belangrijke bewerkingen

De originele bestanden staan ongewijzigd in `bronbestanden/`:

- `historisch-glas-in-gebouwen_real-life_gebouw.xlsx`: 1.229 gebouwrecords.
- `historisch-glas-in-gebouwen_real-life_glasobject.xlsx`: 82 glasobjectrecords en het werkblad Keuzelijstjes.

Er is in deze bestanden geen gedeelde gebouwsleutel. Daarom zijn expliciete sleutels toegevoegd:

| Tabel | Primaire sleutel | Vreemde sleutel |
| --- | --- | --- |
| `gebouw` | `gebouw_id`, bijvoorbeeld `G0005` | — |
| `glasobject` | `glasobject_id`, bijvoorbeeld `GL0027` | `gebouw_id`, verwijst naar `gebouw.gebouw_id` |

Gebouwsleutels met `G` zijn gebaseerd op het oorspronkelijke ObjectID. Glasobjectsleutels met `GL` zijn gebaseerd op het oorspronkelijke objectid. De bron-ID’s en GlobalID’s zijn bewaard. Voorlopige gebouwsleutels met `A` zijn vastgelegd in het conversiescript.

### Koppelingen

| Methode | Glasobjecten | Toelichting |
| --- | ---: | --- |
| Naam en adres | 1 | Broerenkerk (Zwolle): exacte overeenkomst van beide velden. |
| Koppelvoorstel op naamsvariant | 23 | St Servaas (Maastricht) → St Servaas basiliek (Maastricht), G0005. Ondersteund door dezelfde plaats en nabijgelegen afgeleide coördinaten; inhoudelijk nog te bevestigen. |
| Voorlopig gebouw | 58 | Tien afzonderlijke gebouwverwijzingen zonder eenduidige match in het gebouwenbestand. Er zijn tien voorlopige parentrecords afgeleid uit de objecten. |

De interface bevat daarmee **1.239 gebouwrecords en 82 glasobjecten**. De voorlopige records zijn nadrukkelijk gemarkeerd. Zij zijn geen bevestigde aanvulling op de oorspronkelijke inventarisatie. Er is niet op dichtstbijzijnde punt gekoppeld en een algemene naam zoals “Woonhuis” is niet zonder adrescontrole met een bestaand gebouw samengevoegd.

Het bestand `data/koppelingen.csv` legt elke groep, de gekozen parent en de motivering vast. De originele gebouwnaam en het originele adres van ieder glasobject staan in zijn bronvelden.

### Coördinaten, plaatsen en ontbrekende gegevens

De x- en y-waarden lijken coördinaten zonder decimaalteken te zijn. Voor de kaart is de decimaal bij x na het eerste cijfer geplaatst en bij y na het tweede. Alleen waarden in het bereik 3–8° O en 50–54° N worden geaccepteerd. Dit is een aanname, geen geografische validatie. Nul- en ontbrekende coördinaten worden uitgesloten. De originele x/y-waarden worden bewaard.

Bij voorlopige gebouwen wordt de mediaan van de beschikbare afgeleide objectcoördinaten gebruikt. Er zijn **1.237 gebouwen met een bruikbare afgeleide positie en 2 zonder positie**. Objecten met ontbrekende eigen coördinaten kunnen op de kaart wel via hun gebouw worden gegroepeerd. De kaart beweert niet hun exacte locatie te tonen.

Plaatsnamen zijn waar mogelijk afgeleid uit het adres of de naam. Deze extra kolom is geen geverifieerde gemeentenaam. De gemeente- en provincievelden uit de bron blijven apart beschikbaar. De tegenstrijdigheid bij “St Bavo (Haarlem)” met een adres in Spaarndam is niet inhoudelijk opgelost.

Bij 610 oorspronkelijke gebouwen ontbreekt de naam. Bij twee glasobjecten bevat het jaarveld `999`. Deze waarden en testrecords zijn niet verwijderd of inhoudelijk gecorrigeerd. Verloren voorloopnullen van numerieke identificaties zijn niet geraden. Witruimte aan de buitenkant van tekst is voor de leesweergave verwijderd; de bronwaarden blijven ongewijzigd aanwezig in `source` en `bronvelden_json`.

Vijf als Excel-datum opgeslagen cellen zijn als ISO-datumtijd geëxporteerd. De overige tekstuele datums blijven in hun bronschrijfwijze staan. De oorspronkelijke Excelbestanden zijn byte voor byte behouden.

Een telling van gekoppelde glasobjecten is **geen** telling van alle aanwezige ramen. Een gebouw met 0 gekoppelde glasobjecten kan wel historisch glas bevatten.

## SQLite in de les

Open `data/historisch-glas.sqlite` met een SQLite-client. De database bevat:

- `gebouw`: parenttabel, met 1.239 records.
- `glasobject`: childtabel, met 82 records en een verplichte vreemde sleutel.
- `gebouw_met_aantal`: view met het aantal gekoppelde glasobjecten per gebouw.
- `glasobject_met_gebouw`: view met object- en gebouwgegevens samen.

Schakel referentiële integriteit voor elke SQLite-verbinding in:

```sql
PRAGMA foreign_keys = ON;
```

Bekijk een parent met alle bijbehorende children:

```sql
SELECT g.gebouw_id,
       g.naam AS gebouw,
       o.glasobject_id,
       o.naam AS glasobject
FROM gebouw AS g
LEFT JOIN glasobject AS o
  ON g.gebouw_id = o.gebouw_id
WHERE g.gebouw_id = 'G0005';
```

Vergelijk het aantal ramen in de bron met de gekoppelde objectrecords:

```sql
SELECT gebouw_id, naam, aantal_ramen_bron, aantal_glasobjecten
FROM gebouw_met_aantal
ORDER BY aantal_glasobjecten DESC;
```

De website leest een JSON-export van dezelfde gekoppelde gegevens. Er draait geen SQLite-engine in de browser en wijzigingen in een gedownloade SQLite-kopie veranderen de website niet.

## Gegevens opnieuw opbouwen

Python 3 is voldoende; er zijn geen extra Python-pakketten nodig.

```bash
python scripts/build_data.py
```

Het script leest de twee werkboeken uit `bronbestanden/`, maakt de sleutels en exports opnieuw, en controleert de database-integriteit en foreign keys. Het verwerkt in dit pakket de eerste werkbladen als hoofdtabel en het tweede werkblad van het objectenbestand als keuzelijst. De kolomnamen moeten gelijk blijven. Als een nieuwe gebouwverwijzing in de objecten voorkomt, stopt het script met een melding zodat de nieuwe koppeling bewust kan worden beoordeeld. De expliciete keuzes staan in `existing` en `derived_ids`.

Publiceer na een wijziging de bijgewerkte inhoud van `data/`, waaronder zowel `dataset.js` als `dataset.json` en de SQLite-database. `dataset.js` maakt rechtstreeks openen van index.html mogelijk zonder een fetch-verzoek. Bewerk de twee exports niet onafhankelijk.

## Vormgeving en onderdelen

Vormgeving geïnspireerd op de [cursuswebsite](https://digitaal-erfgoed-trainingen.github.io/Dataorganisatie_spreadsheets_bouwhistorie/index.html): Mulish, een lichte achtergrond, paarse accenten en navigatie aan de zijkant. Het raambeelmerk is voor deze interface gemaakt.

- [Leaflet 1.9.4](https://leafletjs.com/), lokaal meegeleverd met licentie in `assets/vendor/leaflet-LICENSE.txt`.
- [OpenStreetMap](https://www.openstreetmap.org/copyright), achtergrondtegels via internet en bronvermelding in de kaart.
- Mulish, lokaal meegeleverd met SIL Open Font License in `assets/fonts/OFL.txt`.
- Context van de gegevens: Van der Stok, *Glas in gebouwen*, Rijksdienst voor het Cultureel Erfgoed; aangeleverde werkboeken.

De toepassing laadt geen externe lettertypen, analysetools of API-sleutels. Achtergrondtegels worden pas opgevraagd wanneer de kaart wordt geopend.
