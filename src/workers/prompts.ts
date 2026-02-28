/**
 * Build a planning prompt for a card.
 * The prompt asks Claude to create a structured plan for the card's idea.
 * Works for all card types — specialized prompts can be added in Phase 6.
 */
export function buildPlanningPrompt(title: string, description: string): string {
  const descriptionSection = description.trim()
    ? `\n\nKuvaus:\n${description.trim()}`
    : ''

  return `Olet tehtävien suunnittelija. Käyttäjä on lisännyt uuden idean kanban-taululle.

Tehtävä: ${title}${descriptionSection}

Luo selkeä ja toteuttamiskelpoinen suunnitelma tälle tehtävälle. Suunnitelman tulee sisältää:

1. **Tavoite**: Mitä tehtävällä saavutetaan (1-2 lausetta)
2. **Vaiheet**: Konkreettiset toteutusvaiheet (numeroitu lista, 3-7 vaihetta)
3. **Hyväksymiskriteerit**: Miten tiedetään että tehtävä on valmis (2-4 kriteeriä)

Vastaa suomeksi. Ole tiivis mutta kattava. Älä lisää ylimääräisiä otsikoita tai johdantotekstiä — aloita suoraan suunnitelmalla.`
}
