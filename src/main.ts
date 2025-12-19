// 1. Cargar variables de entorno ANTES de nada
import 'dotenv/config';

import express from 'express';
// import cron from 'node-cron';
import { scrapeUseCase, expireUseCase, getActiveJobsUseCase, enrichJobsUseCase } from './servir-jobs/container'; // Ajusta la ruta si 'container' está en otro lado
import { JobMapper } from './servir-jobs/application/mappers/JobMapper';
const app = express();
const PORT = process.env.PORT || 3000;

// --- MODO CLI (Ejecución Manual) ---
// Útil para probar sin esperar al cron o para pipelines de CI/CD
if (process.argv.includes('run-now')) {
  (async () => {
    console.log('🚀 [CLI] Iniciando modo de ejecución manual...');
    const startTime = Date.now();

    try {
      // 1. Ejecutar Scraping
      // Puedes pasar argumentos por consola si quisieras hacerlo dinámico
      await scrapeUseCase.execute(['LIMA'], 'INGENIERIA DE SISTEMAS');
      
      // 2. Limpiar expirados
      await expireUseCase.execute();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ [CLI] Proceso finalizado con éxito en ${duration}s`);
      process.exit(0);
    } catch (error) {
      console.error('❌ [CLI] Error crítico:', error);
      process.exit(1);
    } finally {
      // await prisma.$disconnect();
    }
  })();
} 
// --- MODO SERVIDOR (API + CRON) ---
else {
  
  // Middleware básico
  app.use(express.json());

  // Endpoint para forzar sincronización vía HTTP (ej: webhook)
  app.post('/api/jobs/sync', async (req, res) => {
    console.log('🌐 [API] Petición de sincronización recibida');
    try {
      const { locations, profile } = req.body;
      // Usamos valores por defecto si no vienen en el body
      await scrapeUseCase.execute(
        locations || ['LIMA'], 
        profile || 'INGENIERIA DE SISTEMAS'
      );
      await expireUseCase.execute();
      
      res.status(200).json({ status: 'ok', message: 'Sincronización completada' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'error', message: (error as Error).message });
    }
  });

  app.get('/api/jobs', async (req, res) => {
    try {
      console.log('🌐 [API] Consultando ofertas activas...');
      const jobs = await getActiveJobsUseCase.execute();

      const responseJobs = jobs.map(job => JobMapper.toDTO(job));
      
      res.status(200).json({
        success: true,
        count: jobs.length,
        data: responseJobs
      });
    } catch (error) {
      console.error('❌ Error obteniendo jobs:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  });

  app.post('/api/jobs/enrich-all', async (req, res) => {
    try {
      const { locations, profile } = req.body;
      const locs = locations || ['LIMA'];
      const prof = profile || 'INGENIERIA DE SISTEMAS';

      console.log("🌐 [API] Solicitud de Enriquecimiento Masivo recibida.");
      
      const result = await enrichJobsUseCase.execute(locs, prof);

      res.status(200).json({
        success: true,
        message: 'Proceso de enriquecimiento finalizado.',
        stats: result
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: (error as Error).message });
    }
  });

  // Cron Job: Ejecutar todos los días a las 6:00 AM
  // Formato: Minuto Hora DíaMes Mes DíaSemana
  // cron.schedule('0 6 * * *', async () => {
  //   console.log('⏰ [CRON] Ejecutando tarea programada matutina...');
  //   try {
  //     await scrapeUseCase.execute(['LIMA', 'PIURA'], 'INGENIERIA DE SISTEMAS');
  //     await expireUseCase.execute();
  //     console.log('✅ [CRON] Tarea finalizada.');
  //   } catch (error) {
  //     console.error('❌ [CRON] Error en tarea programada:', error);
  //   }
  // });

  // Iniciar Servidor
  const server = app.listen(PORT, () => {
    console.log(`
    ┌──────────────────────────────────────────────────┐
    │  🚀 MICROSERVICIO SERVIR-SCRAPER ACTIVO          │
    │  📡 Puerto: ${PORT}                                 │
    │  ⏰ Cron: 0 6 * * * (Diario 6:00 AM)             │
    │  🛠  Modo: ${process.env.NODE_ENV || 'Development'}            │
    └──────────────────────────────────────────────────┘
    `);
  });

  // Graceful Shutdown (Cierre limpio)
  const shutdown = async () => {
    console.log('\n🛑 Apagando servidor...');
    server.close();
    // await prisma.$disconnect();
    console.log('Base de datos desconectada. Bye!');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}