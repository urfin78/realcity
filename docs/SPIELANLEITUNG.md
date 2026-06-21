# RealCity — Kurz-Spielanleitung

Baue auf echtem Gelände eine Stadt auf, die sich selbst trägt. Dein Budget startet
bei **100.000 €**, alle **5 Sekunden** vergeht ein *Tick*: Zonen wachsen, Steuern
fließen, Unterhalt und Kredite werden abgebucht.

## In 30 Sekunden loslegen

1. In der **Werkzeugleiste unten** eine **Stadt wählen** und **„Laden"** klicken.
2. Werkzeug **Straße** wählen und eine kurze Straße ziehen (Klick je Feld).
3. Ein **Kraftwerk** an die Straße setzen — ohne Strom wächst nichts.
4. Direkt an der Straße **Wohnen** und daneben **Gewerbe**/**Industrie** setzen.
5. Zuschauen: Mit Straße + Strom + passender Nachbarschaft steigen die Zonen
   über die Ticks von Stufe 0 auf bis zu 3 und werfen Steuern ab.

## Bildschirm-Aufteilung

- **Oben links:** Statusanzeige (Budget, Bevölkerung, Tick, Saldo, Schulden,
  Zonen-/Straßen-Zähler) und die **RCI-Balken**.
- **Oben rechts:** Wirtschafts-Panel mit den **Steuer-Reglern** und dem
  **Kredit**-Knopf.
- **Unten mittig:** Werkzeugleiste mit **Stadtauswahl**, **„Laden"**, **„Neu"**
  und allen Bau-Werkzeugen.

## Steuerung

| Aktion | Bedienung |
|--------|-----------|
| Karte verschieben | Ziehen mit der Maus (oder Wischen auf Touch) |
| Zoomen | Mausrad |
| Bauen / Werkzeug anwenden | Linksklick auf ein Feld |
| Feld prüfen | Werkzeug **Inspect**, dann Klick |

Beim Überfahren zeigt eine **Vorschau** die Kosten und ob das Feld baubar ist
(grün = ja, rot = blockiert).

## Werkzeuge & Kosten

| Werkzeug | Kosten | Hinweis |
|----------|-------:|---------|
| Straße | 500 € | Verbindet Zonen; Voraussetzung für Wachstum |
| Wohnen / Gewerbe / Industrie | 1.000 € | Zonen wachsen automatisch (Stufe 0–3) |
| Verwaltung | 1.000 € | Kostet nur Unterhalt, bringt keine Einnahmen |
| Kraftwerk | 5.000 € | Versorgt verbundene Zonen mit Strom |
| Abriss | — | Entfernt ein Feld, erstattet **50 %** der Baukosten |

Auf **steilem Gelände** wird der Bau teurer (Hang-Aufschlag); **Wasser** und sehr
**steile Hänge** sind nicht bebaubar.

## Damit Zonen wachsen

Eine Zone steigt pro Tick nur auf, wenn **alle** Bedingungen erfüllt sind:

- **Straße** als direkter Nachbar (Anbindung ans Netz),
- **Strom** aus einem verbundenen Kraftwerk,
- passende **Nachbarschaft**:
  - *Wohnen* braucht Gewerbe **oder** Industrie in der Nähe (Arbeitsplätze),
  - *Gewerbe* braucht Wohnen in der Nähe (Kundschaft),
  - *Industrie* braucht nur Anbindung + Strom.

Fehlt eine Bedingung, **verfällt** die Zone über die Ticks wieder.

## Strom & Versorgung

Ein Kraftwerk liefert **30 Versorgungseinheiten** und speist alle Zonen, die über
Straßen/Zonen mit ihm verbunden sind. Jede Zone braucht so viel Strom wie ihre
Stufe (mind. 1). Reicht die Kapazität nicht, bleiben die überzähligen Zonen
unversorgt — baue dann ein weiteres Kraftwerk (Kapazität im selben Netz addiert
sich). Im **Inspect** kennzeichnet „⚡✗" eine Zone ohne Strom.

## Nachfrage (RCI)

Die Balken im HUD (**W/G/I**) zeigen die globale Nachfrage nach Wohnen, Gewerbe
und Industrie. Grün nach rechts = gefragt (wächst leichter), rot nach links =
Überangebot (wächst langsamer). Ein ausgewogener Mix hält alle drei im Plus —
grob als Ziel **Wohnen : Gewerbe : Industrie ≈ 50 : 20 : 30**.

## Geld im Griff behalten

- **Steuersätze** (0–20 %, je Zonentyp im Panel oben rechts): höher = mehr Einnahmen,
  aber langsameres Wachstum. Start ist 10 %.
- **Unterhalt** läuft pro Tick für Straßen, Zonen, Verwaltung und Kraftwerke.
- **Kredit** „+50.000 €" gibt es auf Knopfdruck — kostet aber Zins und Tilgung
  pro Tick.
- **Bankrott:** Bleibt das Budget zu lange im Minus, ist das Spiel vorbei. Dann
  hilft nur **Neu** (Stadt zurücksetzen) oder höhere Steuern / weniger Ausgaben.

## Lage-Boni

Wohnzonen nahe **Wasser** (+30 %) oder ungerodetem **Wald** (+15 %) wachsen besser
und bringen mehr Einnahmen. Wer Wald **rodet** (Bau darauf), bekommt einmalig
300 € gutgeschrieben, verliert aber dessen Naherholungs-Bonus.

## Speichern

Der Spielstand wird **automatisch je Stadt im Browser** gespeichert (jeder Tick).
Beim erneuten Laden derselben Stadt geht es weiter. **Neu** setzt die Stadt zurück.
