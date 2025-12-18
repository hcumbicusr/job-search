import puppeteer, { Page } from "puppeteer";
import { IScraperService } from "../../application/services/IScraperService";
import { JobOffer } from "../../domain/entities/JobOffer";

export class PuppeteerScraperAdapter implements IScraperService {
  private readonly TARGET_URL = "https://app.servir.gob.pe/DifusionOfertasExterno/faces/consultas/ofertas_laborales.xhtml";

  async scrapeJobs(locations: string[], searchProfile: string): Promise<Partial<JobOffer>[]> {
    console.log(">> [Scraper] Starting extraction process...");
    
    const browser = await puppeteer.launch({
      headless: true, // false: abre el navegador
      defaultViewport: null,
      args: ["--start-maximized"],
    });

    const page = await browser.newPage();
    const allFoundJobs: Partial<JobOffer>[] = [];

    try {
      await page.goto(this.TARGET_URL, { waitUntil: "networkidle0" });

      // ... (Lógica de llenado de Inputs y Selects igual que antes) ...
      const inputSelector = 'input[type="text"]';
      await page.waitForSelector(inputSelector);
      await page.type(inputSelector, searchProfile, { delay: 50 });

      for (const location of locations) {
        // ... (Lógica de selección de ubicación y búsqueda igual) ...
        const isLocationSelected = await this.selectLocationInDropdown(page, location);
        if (!isLocationSelected) continue;

        const previousTitle = await this.getFirstJobTitle(page);
        await this.clickSearchButton(page);
        const hasResults = await this.waitForTableToUpdate(page, previousTitle);
        if (!hasResults) continue;

        // --- BUCLE DE PAGINACIÓN ---
        let hasNextPage = true;
        let currentPage = 1;

        while (hasNextPage) {
          console.log(`   >> Scraping page ${currentPage} for ${location}...`);
          
          // 1. Extraemos datos CRUDOS (Strings)
          const rawJobs = await this.extractRawDataFromPage(page, location);
          
          // 2. Convertimos a Entidades de Dominio (Dates reales) en Node.js
          const cleanJobs: Partial<JobOffer>[] = rawJobs.map(raw => ({
            puesto: raw.puesto,
            entidad: raw.entidad,
            ubicacion: raw.ubicacion,
            convocatoria: raw.convocatoria,
            remuneracion: raw.remuneracion,
            link: raw.link,
            // AQUI OCURRE LA MAGIA: String -> Date Object
            fechaInicio: raw.fechaInicioStr ? new Date(raw.fechaInicioStr) : new Date(), 
            fechaFin: raw.fechaFinStr ? new Date(raw.fechaFinStr) : new Date(),
          }));

          allFoundJobs.push(...cleanJobs);
          console.log(`      + Extracted ${cleanJobs.length} jobs.`);

          const paginationResult = await this.goToNextPage(page);
          if (paginationResult) currentPage++;
          else hasNextPage = false;
        }
      }
    } catch (error) {
      console.error("[Scraper] Critical Error:", error);
      throw error;
    } finally {
      await browser.close();
    }

    return allFoundJobs;
  }

  // ... (Tus métodos privados selectLocationInDropdown, clickSearchButton, etc. se mantienen igual) ...
  // Solo pegaré los métodos que cambian:

  private async selectLocationInDropdown(page: Page, locationName: string): Promise<boolean> {
     return page.evaluate((loc) => {
       const selects = Array.from(document.querySelectorAll("select"));
       const targetSelect = selects.find((s) => Array.from(s.options).some((o) => o.text.includes(loc)));
       if (targetSelect) {
         const option = Array.from(targetSelect.options).find((o) => o.text.includes(loc));
         if (option) {
           targetSelect.value = option.value;
           targetSelect.dispatchEvent(new Event("change", { bubbles: true }));
           return true;
         }
       }
       return false;
     }, locationName);
   }

   private async clickSearchButton(page: Page): Promise<void> {
     await page.evaluate(() => {
       const buttons = Array.from(document.querySelectorAll("button"));
       const searchBtn = buttons.find((b) => b.innerText.toUpperCase().includes("BUSCAR"));
       if (searchBtn) searchBtn.click();
     });
   }
 
   private async getFirstJobTitle(page: Page): Promise<string> {
     try {
       return await page.$eval(".cuadro-vacantes .titulo-vacante label", el => el.textContent?.trim() || "");
     } catch { return ""; }
   }
 
   private async waitForTableToUpdate(page: Page, oldTitle: string): Promise<boolean> {
     try {
       await page.waitForFunction(
         (selector, previousTitle) => {
           const newTitleEl = document.querySelector(`${selector} .titulo-vacante label`);
           const currentTitle = newTitleEl ? newTitleEl.textContent?.trim() : "";
           const noRecords = document.body.innerText.includes("No se encontraron registros");
           return (currentTitle !== "" && currentTitle !== previousTitle) || noRecords;
         },
         { timeout: 15000 }, ".cuadro-vacantes", oldTitle
       );
       await new Promise(r => setTimeout(r, 1000));
       return (await page.$(".cuadro-vacantes")) !== null;
     } catch { return false; }
   }

  // --- CAMBIO PRINCIPAL AQUÍ ---
  // Ahora devuelve 'any[]' con strings, no JobOffer directos
  private async extractRawDataFromPage(page: Page, locationFilter: string): Promise<any[]> {
    return page.evaluate((loc) => {
      const jobCards = document.querySelectorAll(".cuadro-vacantes");
      const data: any[] = [];

      jobCards.forEach((card) => {
        const getValueByLabel = (labelText: string): string => {
          const titles = Array.from(card.querySelectorAll(".sub-titulo"));
          const foundLabel = titles.find((el) => (el as HTMLElement).innerText.includes(labelText));
          if (foundLabel && foundLabel.nextElementSibling) {
             return (foundLabel.nextElementSibling as HTMLElement).innerText.trim().replace(/\n/g, " ");
          }
          return "";
        };

        const title = card.querySelector(".titulo-vacante label")?.textContent?.trim();
        const entity = card.querySelector(".nombre-entidad")?.textContent?.trim();

        // Helper para convertir "14/12/2025" a "2025-12-14" (ISO String Format YYYY-MM-DD)
        // Devolvemos string, NO objeto Date, para evitar problemas de serialización
        const dateToIsoString = (dateStr: string): string | null => {
            if(!dateStr) return null;
            const parts = dateStr.split('/'); // ["14", "12", "2025"]
            if(parts.length === 3) {
                // Retornamos formato ISO simple: "2025-12-14"
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            return null;
        }

        if (title) {
          data.push({
            puesto: title,
            entidad: entity,
            ubicacion: getValueByLabel("Ubicación:"),
            convocatoria: getValueByLabel("Número de Convocatoria:"),
            remuneracion: getValueByLabel("Remuneración:"),
            // Devolvemos STRINGS
            fechaInicioStr: dateToIsoString(getValueByLabel("Fecha Inicio")),
            fechaFinStr: dateToIsoString(getValueByLabel("Fecha Fin")),
            link: "https://app.servir.gob.pe"
          });
        }
      });
      return data;
    }, locationFilter);
  }

  // ... (goToNextPage se mantiene igual) ...
  private async goToNextPage(page: Page): Promise<boolean> {
      const nextButtonSelector = '[id="frmLstOfertsLabo:j_idt56"]';
      const paginatorTextSelector = ".btn-paginator-cnt";
      const nextBtn = await page.$(nextButtonSelector);
      if (!nextBtn) return false;
      const isDisabled = await page.evaluate(el => el.classList.contains('ui-state-disabled'), nextBtn);
      if (isDisabled) return false;
      
      let previousPaginatorText = "";
      try { previousPaginatorText = await page.$eval(paginatorTextSelector, el => el.textContent || ""); } catch { return false; }

      await nextBtn.click();

      try {
        await page.waitForFunction((selector, oldText) => {
            const el = document.querySelector(selector);
            return el && el.textContent !== oldText;
          }, { timeout: 10000 }, paginatorTextSelector, previousPaginatorText
        );
        await new Promise(r => setTimeout(r, 1500));
        return true;
      } catch (e) { return false; }
  }
}