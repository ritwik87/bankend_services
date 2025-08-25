import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { specs } from './swagger.config';

const router = Router();

// Load assets from CDN instead of local files
const swaggerUiOptions = {
  customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.10.5/swagger-ui.css',
  customJs: [
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.10.5/swagger-ui-bundle.js',
    'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.10.5/swagger-ui-standalone-preset.js'
  ],
  customSiteTitle: 'DUPR Service API Documentation',
  customfavIcon: '/favicon.ico'
};

// Serve Swagger UI using CDN assets
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(specs, swaggerUiOptions));

// JSON endpoint for OpenAPI spec
router.get('/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

export default router;