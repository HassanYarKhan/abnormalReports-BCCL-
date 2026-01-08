import dotenv from "dotenv";
import { Sequelize } from "sequelize";

dotenv.config();

const dbInstanceRFID = new Sequelize(
  process.env.RFID_DB_NAME,
  process.env.RFID_DB_USER,
  process.env.RFID_DB_PASS,
  {
    host: process.env.RFID_DB_HOST,
    dialect: "mssql",
    logging: false,
  }
);

export default dbInstanceRFID;
