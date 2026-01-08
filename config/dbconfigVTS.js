import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const dbInstanceVTS = new Sequelize(
    process.env.VTS_DB_NAME,
    process.env.VTS_DB_USER,
    process.env.VTS_DB_PASS,
  {
    host: process.env.VTS_DB_HOST,
    dialect: "mysql",
    logging: false,
  }
);

export default dbInstanceVTS;
