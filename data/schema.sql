PRAGMA foreign_keys = ON;
CREATE TABLE gebouw (
    gebouw_id TEXT PRIMARY KEY NOT NULL,
    naam TEXT, adres TEXT, plaats TEXT, gemeente TEXT, provincie TEXT,
    architect TEXT, rce_nummer TEXT, bag_pand_id TEXT,
    aantal_ramen_bron INTEGER, status TEXT, bron TEXT,
    herkomst TEXT NOT NULL CHECK (herkomst IN ('bronbestand', 'afgeleid')),
    lengtegraad_afgeleid REAL, breedtegraad_afgeleid REAL,
    bronvelden_json TEXT NOT NULL
);
CREATE TABLE glasobject (
    glasobject_id TEXT PRIMARY KEY NOT NULL,
    gebouw_id TEXT NOT NULL REFERENCES gebouw(gebouw_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    naam TEXT, jaar_ontstaan INTEGER, glastechniek_1 TEXT, glastechniek_2 TEXT,
    glastechniek_3 TEXT, glastechniek_4 TEXT, kunstenaar TEXT, ontwerper TEXT,
    uitvoerend_atelier TEXT, gebouwdeel TEXT, etage TEXT, thema TEXT,
    volgnummer INTEGER, koppelmethode TEXT NOT NULL, koppeling_toelichting TEXT NOT NULL,
    bronvelden_json TEXT NOT NULL
);
CREATE INDEX idx_glasobject_gebouw ON glasobject(gebouw_id);
CREATE VIEW gebouw_met_aantal AS
SELECT g.*, COUNT(o.glasobject_id) AS aantal_glasobjecten
FROM gebouw g LEFT JOIN glasobject o ON g.gebouw_id = o.gebouw_id
GROUP BY g.gebouw_id;
CREATE VIEW glasobject_met_gebouw AS
SELECT o.*, g.naam AS gebouwnaam, g.adres, g.plaats
FROM glasobject o JOIN gebouw g ON o.gebouw_id = g.gebouw_id;
