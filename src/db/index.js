import mongoose from "mongoose";


const connectDB = async ()=>{
   try {
      await mongoose.connect(process.env.MONGO_URI)
        console.log("MONGODB Connection successfull")
   } catch (error) {
    console.error("failed to connect to MONGODB",error)

    process.exit(1);
   }
};

export default connectDB;