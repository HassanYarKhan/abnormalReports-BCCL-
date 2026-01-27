import { Router } from "express";
import {
  getAreaWiseSummary,
  getWeighbridgeWiseSummary,
  getVehicleWiseSummary,
  getViolationSummary,
  getTotalTripViolationSummary,
  getVehicleWiseTripSummary,
  getDOWiseTripSummary,
  getLatestDOWiseTripSummary,
  getLatestVehicleWiseTripSummary,
  getLatestTotalTripViolationSummary
} from "../controllers/summary.controller.js";

const summaryRouter = Router();

summaryRouter.get("/vehicleWiseSummary", getVehicleWiseSummary);
summaryRouter.get("/weighbridgeWiseSummary", getWeighbridgeWiseSummary);
summaryRouter.get("/areaWiseSummary", getAreaWiseSummary);
summaryRouter.get("/violationSummary", getViolationSummary);
summaryRouter.get("/totalTripViolationSummary", getTotalTripViolationSummary);
summaryRouter.get("/vehicleWiseTripSummary", getVehicleWiseTripSummary);
summaryRouter.get("/doWiseTripSummary", getDOWiseTripSummary);
summaryRouter.get("/trips/latest/vehicleWise", getLatestVehicleWiseTripSummary);
summaryRouter.get("/trips/latest/doWise", getLatestDOWiseTripSummary);
summaryRouter.get("/trips/latest/totalViolations", getLatestTotalTripViolationSummary);


export default summaryRouter;
