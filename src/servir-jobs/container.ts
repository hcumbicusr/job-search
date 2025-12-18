// import { PrismaJobRepository } from "./infrastructure/persistence/PrismaJobRepository";
import { PostgresJobRepository } from "./infrastructure/persistence/PostgresJobRepository";
import { PuppeteerScraperAdapter } from "./infrastructure/scraping/PuppeteerScraperAdapter";
import { NodeEventBus } from "./infrastructure/events/NodeEventBus";
import { ScrapeAndSyncUseCase } from "./application/use-cases/ScrapeAndSyncUseCase";
import { UpdateExpiredUseCase } from "./application/use-cases/UpdateExpiredUseCase";

// const repository = new PrismaJobRepository(prisma);
const repository = new PostgresJobRepository();
const scraper = new PuppeteerScraperAdapter();
const eventBus = new NodeEventBus();

const scrapeUseCase = new ScrapeAndSyncUseCase(repository, scraper, eventBus);
const expireUseCase = new UpdateExpiredUseCase(repository);

export { scrapeUseCase, expireUseCase };