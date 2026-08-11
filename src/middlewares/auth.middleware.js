import {User} from "../models/user.model.js";
 import {Apierror} from "../utils/ApiError.js";
  import {Apiresponse} from "../utils/ApiResponse.js";
   import {asynchandler} from "../utils/AsyncHandler.js";
   import jwt from "jsonwebtoken";
   import mongoose from "mongoose";


const verifyJWT = asynchandler(async(req,res,next)=>{
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")

    if (!token){
        throw new Apierror(401,"token is missing")
    }
   try {
    const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)

    const user = await User.findById(decodedToken?._id).select(
        "-password -refreshToken -emailVerificationExpiry -emailVerificationToken",
    )

    if (!user) {
        throw new Apierror(401,"Invalid Access Token")
    }

    req.user =user;

    next();
}

catch (error) {
    throw new Apierror(401,"Invalid Access Token")
}



});