import { Router } from 'express';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require('../../package.json') as { version: string };

const router = Router();
const startTime = Date.now();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version,
  });
});

export default router;
