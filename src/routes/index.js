import express  from 'express';
import authRoute from './authroute.js';
import messagingRoute from './messagingRoute.js';

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/messaging',
    route: messagingRoute,
  }
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;

