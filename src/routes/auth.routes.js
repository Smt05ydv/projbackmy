import { Router} from "express";

import {registerUser,loginUser,logoutUser} from "../controllers/auth.controller.js";

import {validate} from "../middlewares/validate.middleware.js";

import {verifyJWT} from "../middlewares/auth.middleware.js";

import {userLoginValidator,userRegisterValidator} from "../validators/index.js"

const router = Router();

router.post("/register",
    userRegisterVAlidator(),validate(),registerUser
)