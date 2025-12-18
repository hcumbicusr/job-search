# Job Search Scraper

Este es un microservicio de scraping diseñado para extraer ofertas de trabajo del portal "Servir". El proyecto está construido con TypeScript y Node.js, y utiliza Puppeteer para el scraping web.

## Características

- **Scraping de Ofertas de Trabajo**: Extrae información detallada de las ofertas de trabajo.
- **API REST**: Proporciona un endpoint para activar el proceso de scraping manualmente.
- **Modo CLI**: Permite ejecutar el scraper desde la línea de comandos para tareas de CI/CD o pruebas.
- **Base de Datos**: Utiliza PostgreSQL para almacenar las ofertas de trabajo.

## Arquitectura

El proyecto sigue una arquitectura hexagonal (aunque no se indica explícitamente, la estructura de carpetas lo sugiere), separando el dominio de la aplicación de la infraestructura:

- `src/servir-jobs/application`: Contiene los casos de uso de la aplicación (ej. `ScrapeAndSyncUseCase`).
- `src/servir-jobs/domain`: Contiene las entidades de dominio, repositorios y eventos.
- `src/servir-jobs/infrastructure`: Contiene las implementaciones concretas de servicios externos como el scraper (Puppeteer), la base de datos (Postgres con Prisma) y el bus de eventos.

## Requisitos Previos

- [Node.js](https://nodejs.org/) (v18 o superior)
- [npm](https://www.npmjs.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Docker](https://www.docker.com/)

## Instalación

1.  **Clonar el repositorio:**

    ```bash
    git clone https://github.com/hcumbicusr/job-search.git
    cd job-search
    ```

2.  **Instalar dependencias:**

    ```bash
    npm install
    ```

3.  **Configurar variables de entorno:**

    Crea un archivo `.env` en la raíz del proyecto y añade las siguientes variables:

    ```env
    # NODE_ENV=production|staging|development
    NODE_ENV=development
    PORT=5000
    DATABASE_URL=postgresql://username:password@localhost:5432/jobdb
    ```

## Uso

### Modo Desarrollo

Para ejecutar el servidor de desarrollo, que levanta la API y permite la sincronización manual:

```bash
npm run dev
```

El servidor se iniciará en el puerto especificado en el archivo `.env` (por defecto 3000).

### Uso con Docker

1.  **Configurar variables de entorno para Docker:**

    Crea un archivo `.env-docker` en la raíz del proyecto y añade las siguientes variables:

    ```env
    POSTGRES_USER=username
    POSTGRES_PASSWORD=password
    POSTGRES_DB=jobdb
    ```

2.  **Levantar los servicios:**

    ```bash
    docker-compose up --build -d
    ```

### Modo CLI

Para ejecutar el proceso de scraping una sola vez desde la línea de comandos:

```bash
npx ts-node src/main.ts run-now
```

### API Endpoints

#### `POST /api/jobs/sync`

Dispara el proceso de scraping y sincronización de ofertas de trabajo.

**Request Body (Opcional):**

```json
{
  "locations": ["LIMA", "PIURA", "TUMBES"],
  "profile": "INGENIERIA DE SISTEMAS"
}
```

Si no se proporciona un cuerpo, se utilizarán los valores por defecto del código, los cuales son:

```json
{
  "locations": ["LIMA"],
  "profile": "INGENIERIA DE SISTEMAS"
}
```
