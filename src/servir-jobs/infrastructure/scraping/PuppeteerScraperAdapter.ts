import puppeteer, {Browser, Page} from 'puppeteer'; // Usamos el paquete estándar
import { IScraperService } from "../../application/services/IScraperService";
import { JobOffer } from "../../domain/entities/JobOffer";
import { EnrichedJobDTO } from '../../application/dtos/EnrichedJobDTO';

export class PuppeteerScraperAdapter implements IScraperService {
  private readonly TARGET_URL = "https://app.servir.gob.pe/DifusionOfertasExterno/faces/consultas/ofertas_laborales.xhtml";

  async scrapeJobs(locations: string[], searchProfile: string): Promise<Partial<JobOffer>[]> {
    console.log(">> [Scraper] Starting extraction process...");
    
    // 1. Iniciamos Browser (Reutilizamos configuración Docker/ARM)
    const browser = await this.launchBrowser();
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
            vacantes: raw.vacantes,
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

  async scrapeEnrichedJobs(locations: string[], searchProfile: string): Promise<EnrichedJobDTO[]> {
    console.log(">> [Scraper] Iniciando enriquecimiento masivo...");
    
    // 1. Lanzar Browser (Reutilizamos tu config de Docker)
    const browser = await this.launchBrowser();
    const page = await browser.newPage();
    // 1. AUMENTAR TIMEOUT GLOBAL (90 segundos)
    page.setDefaultNavigationTimeout(90000); 
    page.setDefaultTimeout(90000);

    // 2. INTERCEPTAR Y BLOQUEAR IMÁGENES (Ahorra CPU y Red)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    const enrichedResults: EnrichedJobDTO[] = [];

    try {
      await page.goto(this.TARGET_URL, { waitUntil: "domcontentloaded" });
      
      // Llenar buscador (reutilizamos lógica)
      const inputSelector = 'input[type="text"]';
      await page.waitForSelector(inputSelector, { timeout: 60000 });
      await new Promise(r => setTimeout(r, 2000));

      await page.type(inputSelector, searchProfile, { delay: 100 });

      for (const location of locations) {
        console.log(`\n[Scraper] Procesando ubicación: ${location}`);
        
        // Seleccionar Ubicación y Buscar
        const isSelected = await this.selectLocationInDropdown(page, location);
        if (!isSelected) continue;

        const prevTitle = await this.getFirstJobTitle(page);
        await this.clickSearchButton(page);
        const hasResults = await this.waitForTableToUpdate(page, prevTitle);
        if (!hasResults) continue;

        // --- BUCLE DE PAGINACIÓN ---
        let hasNextPage = true;
        let currentPage = 1;

        while (hasNextPage) {
          console.log(`   >> Procesando página ${currentPage}...`);
          
          // A. Contamos cuántas tarjetas hay en esta página
          const cardsCount = await page.$$eval('.cuadro-vacantes', els => els.length);
          console.log(`      Detectadas ${cardsCount} ofertas. Entrando una por una...`);

          // B. Iteramos por ÍNDICE (Importante: porque el DOM cambia al volver atrás)
          for (let i = 0; i < cardsCount; i++) {
            
            // 1. Recuperamos la tarjeta actual (Re-query obligatorio por "Stale Element")
            // Evaluamos datos básicos ANTES de entrar (para el ID)
            const basicInfo = await page.evaluate((index) => {
                const cards = document.querySelectorAll('.cuadro-vacantes');
                const card = cards[index];
                if (!card) return null;

                // Extraer datos básicos para el ID
                const title = card.querySelector(".titulo-vacante label")?.textContent?.trim() || "";
                const entity = card.querySelector(".nombre-entidad")?.textContent?.trim() || "";
                
                // Helper de fecha interno
                const getLabel = (txt: string) => {
                    const titles = Array.from(card.querySelectorAll(".sub-titulo"));
                    const found = titles.find((el) => (el as HTMLElement).innerText.includes(txt));
                    return found && found.nextElementSibling ? (found.nextElementSibling as HTMLElement).innerText.trim() : "";
                };
                
                const fechaFinRaw = getLabel("Fecha Fin");
                let fechaFinStr = "";
                if (fechaFinRaw) {
                    const parts = fechaFinRaw.split('/'); // 14/12/2025
                    if(parts.length === 3) fechaFinStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }

                return { title, entity, fechaFinStr };
            }, i);

            if (!basicInfo) continue;

            // 2. Click en "Ver más" de la tarjeta i
            // Buscamos el botón dentro de la tarjeta i y hacemos click
            await page.evaluate((index) => {
                const cards = document.querySelectorAll('.cuadro-vacantes');
                const btn = cards[index].querySelector('button[title="¡Ver más!"]');
                if (btn) (btn as HTMLElement).click();
            }, i);

            // 3. Esperar a que cargue el detalle
            try {
                await page.waitForSelector('#idDatosConvocatoria', { timeout: 10000 });
            } catch (e) {
                console.warn(`      [!] Error cargando detalle index ${i}. Saltando.`);
                // Intentar volver si se quedó a medias o recargar
                continue; 
            }

            // 4. Extraer Detalles (Requerimientos, N°, Url)
            const detailInfo = await page.evaluate(() => {
                // --- A. EXTRAER N° AVISO ---
                const numEl = document.querySelector('.cuadro-seccion-lat .sub-titulo-2');
                const rawNum = numEl ? numEl.textContent?.trim() : ''; 
                const numeroAviso = rawNum ? rawNum.replace(/\D/g, '') : '';

                // --- B. EXTRAER URL DETALLE (CORREGIDO) ---
                let detalleUrl = "";
                // 1. Buscamos todos los subtítulos
                const labels = Array.from(document.querySelectorAll('.sub-titulo'));
                // 2. Encontramos el que dice "DETALLE"
                const labelDetalle = labels.find(el => el.textContent?.toUpperCase().includes("DETALLE"));
                
                if (labelDetalle) {
                    // 3. Subimos al padre directo (div.col-sm-12)
                    const parentContainer = labelDetalle.parentElement;
                    if (parentContainer) {
                        // 4. Buscamos cualquier <a> dentro de ese bloque. 
                        // Esto es seguro porque el HTML agrupa label y link en el mismo div.
                        const linkEl = parentContainer.querySelector('a');
                        if (linkEl) detalleUrl = linkEl.href;
                    }
                }

                // --- C. EXTRAER REQUERIMIENTOS (CORREGIDO PARA TU HTML) ---
                let requerimientos = "";
                // Buscamos el título "REQUERIMIENTO:"
                const reqLabel = labels.find(el => el.textContent?.toUpperCase().includes("REQUERIMIENTO"));
                
                if (reqLabel) {
                    // El HTML muestra que el UL está en un div hermano o contenedor superior.
                    // Estrategia segura: Subir al contenedor principal de la sección (.cuadro-seccion)
                    const mainContainer = reqLabel.closest('.cuadro-seccion');
                    if (mainContainer) {
                        const list = mainContainer.querySelector('ul');
                        if (list) {
                            // Usamos innerText para mantener los saltos de línea visuales
                            requerimientos = (list as HTMLElement).innerText; 
                        }
                    }
                }

                return { numeroAviso, detalleUrl, requerimientos };
            });

            // 5. Agregamos a la lista de resultados
            enrichedResults.push({
                puesto: basicInfo.title,
                entidad: basicInfo.entity,
                fechaFinStr: basicInfo.fechaFinStr,
                numeroAviso: detailInfo.numeroAviso,
                requerimientos: detailInfo.requerimientos,
                detalleUrl: detailInfo.detalleUrl
            });

            // 6. VOLVER A LA LISTA
            // Buscamos el enlace "Volver a la lista" en la parte superior derecha
            // O usamos history.back() si es AJAX (JSF suele usar AJAX, history back puede ser peligroso)
            // Mejor buscamos el botón específico: <a ...>Volver a la lista</a>
            const backSuccess = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('button, .btnlink'));
                const backLink = links.find(l => l.textContent?.includes("Volver a la lista"));
                if (backLink) {
                    (backLink as HTMLElement).click();
                    return true;
                }
                return false;
            });

            if (!backSuccess) {
                console.error("      [!] No se encontró botón Volver. Intentando window.history.back()");
                await page.goBack();
            }

            // 7. Esperar a que la tabla se restaure
            await page.waitForSelector('.cuadro-vacantes', { timeout: 10000 });
            // Pequeña pausa para asegurar estabilidad del DOM
            await new Promise(r => setTimeout(r, 500)); 
          }

          // C. Siguiente Página (Fuera del bucle de items)
          const paginationResult = await this.goToNextPage(page);
          if (paginationResult) currentPage++;
          else hasNextPage = false;
        }
      }

    } catch (e) {
        console.error("Error en scrapeEnrichedJobs", e);
    } finally {
        await browser.close();
    }
    
    return enrichedResults;
  }

  private async launchBrowser(): Promise<Browser> {
     return puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: process.env.NODE_ENV === 'production' ? true : false,
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage", 
        "--disable-gpu", 
        "--disable-extensions", 
        "--start-maximized",
        // Flags extra para rendimiento en ARM
        "--disable-accelerated-2d-canvas",
        "--disable-speech-api", 
        "--no-first-run",
        "--no-zygote"
      ],
      defaultViewport: null
    });
  }

  private async performSearch(page: Page, location: string, profile: string) {
      const inputSelector = 'input[type="text"]';
      await page.waitForSelector(inputSelector);
      await page.type(inputSelector, profile, { delay: 50 });
      
      const isSelected = await this.selectLocationInDropdown(page, location);
      if(isSelected) {
          await this.clickSearchButton(page);
      }
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