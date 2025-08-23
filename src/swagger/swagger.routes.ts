import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { specs } from './swagger.config';

const router = Router();

// Swagger UI setup
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 50px 0 }
    .swagger-ui .info .title { color: #16a34a }
  `,
  customSiteTitle: 'DUPR Service API Documentation',
  customfavIcon: '/favicon.ico'
};

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(specs, swaggerUiOptions));

// JSON endpoint for OpenAPI spec
router.get('/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

export default router;