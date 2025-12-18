import puppeteer from 'puppeteer'; // Usamos el paquete estándar
import { IScraperService } from "../../application/services/IScraperService";
import { JobOffer } from "../../domain/entities/JobOffer";

export class PuppeteerScraperAdapter implements IScraperService {
  private readonly TARGET_URL = "https://app.servir.gob.pe/DifusionOfertasExterno/faces/consultas/ofertas_laborales.xhtml";

  async scrapeJobs(locations: string[], searchProfile: string): Promise<Partial<JobOffer>[]> {
    console.log(">> [Scraper] Starting extraction process...");
    
    // CONFIGURACIÓN CRÍTICA PARA DOCKER + RASPBERRY PI
    const browser = await puppeteer.launch({
      // 1. Usar el Chromium del sistema instalado en el Dockerfile (/usr/bin/chromium)
      // Si no encuentra la variable, intenta buscar uno local (útil para dev en PC)
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,

      // 2. Modo Headless: En producción (Docker) debe ser true.
      headless: process.env.NODE_ENV === 'production' ? true : false,

      // 3. Argumentos OBLIGATORIOS para evitar crashes en Docker/ARM
      args: [
        "--no-sandbox",                // Necesario para correr como root en Docker
        "--disable-setuid-sandbox",    // Seguridad
        "--disable-dev-shm-usage",     // CRÍTICO en Raspberry Pi (evita error de memoria compartida)
        "--disable-gpu",               // Ahorro de recursos
        "--disable-extensions",
        "--start-maximized"
      ],
      defaultViewport: null
    });

    const page = await browser.newPage();
    const allFoundJobs: Partial<JobOffer>[] = [];

    try {
      await page.goto(this.TARGET_URL, { waitUntil: "networkidle0" });

      const inputSelector = 'input[type="text"]';
      await page.waitForSelector(inputSelector);
      await page.type(inputSelector, searchProfile, { delay: 50 });

      for (const location of locations) {
        // ... Lógica idéntica a tu código anterior ...
        const isLocationSelected = await this.selectLocationInDropdown(page, location);
        if (!isLocationSelected) continue;

        const previousTitle = await this.getFirstJobTitle(page);
        await this.clickSearchButton(page);
        const hasResults = await this.waitForTableToUpdate(page, previousTitle);
        if (!hasResults) continue;

        let hasNextPage = true;
        let currentPage = 1;

        while (hasNextPage) {
          console.log(`   >> Scraping page ${currentPage} for ${location}...`);
          
          const rawJobs = await this.extractRawDataFromPage(page, location);
          
          const cleanJobs: Partial<JobOffer>[] = rawJobs.map(raw => ({
            puesto: raw.puesto,
            entidad: raw.entidad,
            ubicacion: raw.ubicacion,
            convocatoria: raw.convocatoria,
            remuneracion: raw.remuneracion,
            link: raw.link,
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
      // Importante cerrar el browser para liberar RAM en la Pi
      if (browser) await browser.close();
    }

    return allFoundJobs;
  }

  // --- MÉTODOS PRIVADOS (Se mantienen igual que tu versión) ---

  private async selectLocationInDropdown(page: any, locationName: string): Promise<boolean> {
     return page.evaluate((loc: string) => {
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

   private async clickSearchButton(page: any): Promise<void> {
     await page.evaluate(() => {
       const buttons = Array.from(document.querySelectorAll("button"));
       const searchBtn = buttons.find((b) => (b as HTMLElement).innerText.toUpperCase().includes("BUSCAR"));
       if (searchBtn) (searchBtn as HTMLElement).click();
     });
   }
 
   private async getFirstJobTitle(page: any): Promise<string> {
     try {
       return await page.$eval(".cuadro-vacantes .titulo-vacante label", (el: any) => el.textContent?.trim() || "");
     } catch { return ""; }
   }
 
   private async waitForTableToUpdate(page: any, oldTitle: string): Promise<boolean> {
     try {
       await page.waitForFunction(
         (selector: string, previousTitle: string) => {
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

  private async extractRawDataFromPage(page: any, locationFilter: string): Promise<any[]> {
    return page.evaluate((loc: string) => {
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

        const dateToIsoString = (dateStr: string): string | null => {
            if(!dateStr) return null;
            const parts = dateStr.split('/');
            if(parts.length === 3) {
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
            vacantes: getValueByLabel("Cantidad de Vacantes:"),
            remuneracion: getValueByLabel("Remuneración:"),
            fechaInicioStr: dateToIsoString(getValueByLabel("Fecha Inicio")),
            fechaFinStr: dateToIsoString(getValueByLabel("Fecha Fin")),
            link: "https://app.servir.gob.pe"
          });
        }
      });
      return data;
    }, locationFilter);
  }

  private async goToNextPage(page: any): Promise<boolean> {
      const nextButtonSelector = '[id="frmLstOfertsLabo:j_idt56"]';
      const paginatorTextSelector = ".btn-paginator-cnt";
      const nextBtn = await page.$(nextButtonSelector);
      if (!nextBtn) return false;
      const isDisabled = await page.evaluate((el: any) => el.classList.contains('ui-state-disabled'), nextBtn);
      if (isDisabled) return false;
      
      let previousPaginatorText = "";
      try { previousPaginatorText = await page.$eval(paginatorTextSelector, (el: any) => el.textContent || ""); } catch { return false; }

      await nextBtn.click();

      try {
        await page.waitForFunction((selector: string, oldText: string) => {
            const el = document.querySelector(selector);
            return el && el.textContent !== oldText;
          }, { timeout: 10000 }, paginatorTextSelector, previousPaginatorText
        );
        await new Promise(r => setTimeout(r, 1500));
        return true;
      } catch (e) { return false; }
  }
}