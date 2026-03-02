/**
 * Build a planning prompt for a card.
 * The prompt asks Claude to create a structured plan for the card's idea.
 * Works for all card types — specialized prompts can be added in Phase 6.
 */
export function buildPlanningPrompt(
  title: string,
  description: string,
  retryContext?: {
    previousPlan: string
    testFeedback: string
    userFeedback?: string
    attempt: number
  },
): string {
  const descriptionSection = description.trim()
    ? `\n\nKuvaus:\n${description.trim()}`
    : ''

  if (retryContext) {
    return `Olet tehtävien suunnittelija. Tämä on UUDELLEENSUUNNITTELUKIERROS (yritys ${retryContext.attempt}/5).

Tehtävä: ${title}${descriptionSection}

EDELLINEN SUUNNITELMA (hylättiin):
${retryContext.previousPlan}

TESTIRAPORTIN PALAUTE (miksi hylättiin):
${retryContext.testFeedback}
${retryContext.userFeedback ? `\nKÄYTTÄJÄN PALAUTE:\n${retryContext.userFeedback}` : ''}

Korjaa suunnitelma niin, että se vastaa KAIKKIIN hylkäysperusteisiin. Varmista erityisesti:
- Kaikki puuttuvat tiedostot ja komponentit luodaan
- Jokainen hyväksymiskriteeri täyttyy kokonaan
- Koodi on valmis, ajettavissa ja dokumentoitu
- Älä jätä mitään kesken — lopputuotteen pitää olla valmis

Suunnitelman tulee sisältää:
1. **Tavoite**: Mitä tehtävällä saavutetaan (1-2 lausetta)
2. **Korjattavat ongelmat**: Mitä edellisessä iteraatiossa oli vikana
3. **Vaiheet**: Konkreettiset toteutusvaiheet (numeroitu lista)
4. **Hyväksymiskriteerit**: Miten tiedetään että tehtävä on VARMASTI valmis

Vastaa suomeksi. Ole tarkka ja kattava — tämä suunnitelma ei saa epäonnistua.`
  }

  return `Olet tehtävien suunnittelija. Käyttäjä on lisännyt uuden idean kanban-taululle.

Tehtävä: ${title}${descriptionSection}

Luo selkeä ja toteuttamiskelpoinen suunnitelma tälle tehtävälle. Suunnitelman tulee sisältää:

1. **Tavoite**: Mitä tehtävällä saavutetaan (1-2 lausetta)
2. **Vaiheet**: Konkreettiset toteutusvaiheet (numeroitu lista, 3-7 vaihetta)
3. **Hyväksymiskriteerit**: Miten tiedetään että tehtävä on valmis (2-4 kriteeriä)

Vastaa suomeksi. Ole tiivis mutta kattava. Älä lisää ylimääräisiä otsikoita tai johdantotekstiä — aloita suoraan suunnitelmalla.`
}

/**
 * Build an execution prompt for CODE cards.
 * Instructs Claude to implement the plan using available tools,
 * create files in the working directory, and summarize what was done.
 */
export function buildExecutionPrompt(title: string, planText: string): string {
  return `Olet koodisuorittaja. Sinulle on annettu tehtävä ja suunnitelma sen toteuttamiseksi.

Tehtävä: ${title}

Suunnitelma:
${planText}

Toteuta suunnitelma käyttäen saatavillasi olevia työkaluja. Luo tarvittavat tiedostot työhakemistoon.
Kun olet valmis, kirjoita lyhyt yhteenveto siitä mitä teit ja mitä tiedostoja loit.`
}

/**
 * Build an execution prompt for RESEARCH/BUSINESS/GENERAL cards.
 * No file operations — asks Claude to execute the task in text
 * and produce a comprehensive result.
 */
export function buildExecutionPromptApi(title: string, planText: string): string {
  return `Olet tehtävien suorittaja. Sinulle on annettu tehtävä ja suunnitelma.

Tehtävä: ${title}

Suunnitelma:
${planText}

Suorita tämä tehtävä suunnitelman mukaisesti. Tuota kattava, laadukas tulos.
Vastaa suomeksi.`
}

/**
 * Build a testing/quality-assurance prompt for all card types.
 * Asks Claude to evaluate whether the execution result meets the
 * acceptance criteria from the plan. Must begin with HYVÄKSYTTY or HYLÄTTY.
 */
export function buildTestingPrompt(
  title: string,
  planText: string,
  executionResult: string,
): string {
  return `Olet laadunvarmistaja. Arvioi, onko tehtävä suoritettu hyväksymiskriteerien mukaisesti.

Tehtävä: ${title}

Alkuperäinen suunnitelma ja hyväksymiskriteerit:
${planText}

Suorituksen tulos:
${executionResult}

Arvioi:
1. Onko kaikki hyväksymiskriteerit täytetty?
2. Onko lopputulos laadukas?
3. Mikä on yhteenvetosi: HYVÄKSYTTY tai HYLÄTTY?

Vastaa suomeksi. Aloita yhteenvedolla (HYVÄKSYTTY/HYLÄTTY), sitten perustele.`
}
