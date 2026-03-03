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
- package.json sisältää oikeat riippuvuudet, build-, test- ja start-scriptit
- Testit kattavat kriittiset toiminnot
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

TÄRKEÄÄ CODE-tyyppisille tehtäville:
- Suunnitelman PITÄÄ sisältää package.json luonti oikeilla riippuvuuksilla
- Testit pitää suunnitella osaksi toteutusta (vitest, jest, tai vastaava)
- Projektin pitää olla ajettavissa: npm install && npm run build && npm test
- Jos kyseessä on web-sovellus, sisällytä start-scripti

Vastaa suomeksi. Ole tiivis mutta kattava. Älä lisää ylimääräisiä otsikoita tai johdantotekstiä — aloita suoraan suunnitelmalla.`
}

/**
 * Build an execution prompt for CODE cards.
 * Instructs Claude to implement a COMPLETE, RUNNABLE project.
 * The code will be built and tested automatically after execution.
 */
export function buildExecutionPrompt(title: string, planText: string): string {
  return `Olet koodisuorittaja. Sinulle on annettu tehtävä ja suunnitelma sen toteuttamiseksi.

Tehtävä: ${title}

Suunnitelma:
${planText}

TÄRKEÄT VAATIMUKSET — lue nämä huolellisesti:

1. **Luo VALMIS ja AJETTAVA projekti** — ei placeholder-koodia tai TODO-kommentteja
2. **package.json on pakollinen** ja sen PITÄÄ sisältää:
   - Kaikki tarvittavat riippuvuudet (dependencies)
   - "build" scripti (esim. tsc tai vastaava) — vähintään "echo build ok"
   - "test" scripti joka ajaa oikeat testit (esim. vitest, jest, mocha)
   - "start" scripti jos kyseessä on palvelu/sovellus
3. **Kirjoita oikeita testejä** — testien pitää testata kriittisiä toimintoja
4. **TypeScript on suositeltava** — lisää tsconfig.json jos käytät TS:ää
5. **Varmista koodin laatu**:
   - Ei käyttämättömiä importteja
   - Selkeä rakenne (src/ tai vastaava)
   - Error handling kriittisissä kohdissa

KOODAUSPROSESSI:
1. Luo ensin package.json
2. Toteuta varsinainen koodi
3. Kirjoita testit
4. Tarkista Bash-työkalulla että tiedostot ovat oikeissa paikoissa

Kun olet valmis, kirjoita yhteenveto:
- Mitä tiedostoja loit
- Miten projekti ajetaan (npm install && npm run build && npm test)
- Jos sovellus: miten se käynnistetään (npm start)`
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
 * Build a testing prompt that includes REAL build/test output.
 * The AI evaluates both the code quality AND the actual build results.
 * Must begin with HYVÄKSYTTY or HYLÄTTY.
 */
export function buildTestingPrompt(
  title: string,
  planText: string,
  executionResult: string,
  buildOutput?: string,
): string {
  const buildSection = buildOutput
    ? `\n\nTODELLINEN BUILD/TESTI-TULOS (ajettiin automaattisesti):\n${buildOutput}`
    : ''

  return `Olet laadunvarmistaja. Arvioi, onko tehtävä suoritettu hyväksymiskriteerien mukaisesti.

Tehtävä: ${title}

Alkuperäinen suunnitelma ja hyväksymiskriteerit:
${planText}

Suorituksen tulos (AI-agentin raportti):
${executionResult}
${buildSection}

Arvioi TIUKASTI:
1. Onko KAIKKI hyväksymiskriteerit täytetty? (jos yksikin puuttuu → HYLÄTTY)
2. Menivätkö build ja testit läpi? (jos epäonnistui → HYLÄTTY)
3. Onko koodi valmis tuotantoon vai onko siinä puutteita?
4. Onko projektissa oikeat riippuvuudet, testit ja rakenne?

TÄRKEÄÄ:
- Jos build tai testit epäonnistuivat → HYLÄTTY (ilman poikkeusta)
- Jos koodissa on TODO-kommentteja tai keskeneräistä → HYLÄTTY
- Jos testit puuttuvat kokonaan → HYLÄTTY
- Hyväksy VAIN valmis, toimiva ja testattu kokonaisuus

Vastaa suomeksi. Aloita yhteenvedolla (HYVÄKSYTTY/HYLÄTTY), sitten perustele.
Jos HYLÄTTY, listaa KAIKKI puutteet niin, että uudelleensuunnittelija voi korjata ne.`
}
