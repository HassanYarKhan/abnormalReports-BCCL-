import dbInstanceRFID from "./dbconfigRFID.js";
// import dbInstanceVTS from "./dbconfigVTS.js";

async function connectDB(){

  try {
    await dbInstanceRFID.authenticate();
    console.log("RFID Database connection established successfully.");

    // await dbInstanceVTS.authenticate();
    // console.log("VTS Database connection established successfully.");

  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }

}

export default connectDB;