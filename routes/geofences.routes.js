/*===============================

Routes -
1. Get geofence by Vehicle Number.
2. Get Positions by Vehicle Number, fromDate, toDate.

=================================*/

import { Router } from "express";
import { getGeofencesByVehicleNumber } from "../controllers/geofences.controller.js";

const geofenceRouter = new Router();

geofenceRouter.get('/getGeofencesByVehicleNumber', getGeofencesByVehicleNumber);

export default geofenceRouter;

