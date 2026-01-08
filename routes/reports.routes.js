import Router from "express";
import {getReportsByVehicleNumber, getReportsForPresentDay, getReportsByWBCode, getReportsByAreaId, getTripTimeReportsByDONumber} from "../controllers/reports.controller.js";

const reportsRouter = Router();

reportsRouter.post("/getReportsByVehicleNumber", getReportsByVehicleNumber);
reportsRouter.get("/getReportsForPresentDay", getReportsForPresentDay);
reportsRouter.post("/getReportsByWBCode", getReportsByWBCode);
reportsRouter.get("/getReportsByAreaId", getReportsByAreaId);
reportsRouter.post("/getTripTimeReportsByDONumber", getTripTimeReportsByDONumber);
export default reportsRouter;