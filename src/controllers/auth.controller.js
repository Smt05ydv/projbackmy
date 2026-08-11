
import {User} from "../models/user.model.js";
 import {Apierror} from "../utils/ApiError.js";
  import {Apiresponse} from "../utils/ApiResponse.js";
   import {asynchandler} from "../utils/AsyncHandler.js";
   import {emailVerificationMailgenContent,
    forgotPasswordMailgenContent,
sendEmail} from "../utils/mail.js"

import jwt from "jsonwebtoken";



   const generateAccessAndRefreshToken= async(userId)=>{
    try {
        const user= await User.findById(userId);

       const accessToken= await user.generateAccessToken()
       const refreshToken= await user.generateRefreshToken()

       user.refreshToken = refreshToken

    await user.save({validateBeforeSave:false});

    return {refreshToken,accessToken}


    } catch (error) {
        throw new Apierror (500, "something went wrong while generating access token")
    }
   };


   const registerUser = asynchandler(async(req,res)=>{
    const { email, username,password,role} = req.body;
        const existedUser= await User.findOne({
            $or: [{username},{email}],
        });
            if (existedUser) {
                throw new Apierror (409,"user with same email or username already exists",[]);
            }


           const user = await User.create({
                username,
                email,
                password,
                isEmailVerified: false,
        
            });

            const {unHashedToken, hashedToken, tokenExpiry}= user.generateTemporaryToken();

            user.emailVerificationToken= hashedToken;
            user.emailVerificationExpiry= tokenExpiry;

           await user.save({
                validateBeforeSave:false
            });

            await sendEmail({
                email:user?.email,
                subject: "please verify your email",
                mailgenContent:emailVerificationMailgenContent(
                    user.username,
                    `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`
                )
            });


            const createdUser= await User.findById(user._id)
            .select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry",);

            if(!createdUser){
                throw new Apierror(500,"something went wrong while registeriing a user");
            }

            return res
            .status(201)
            .json(
                new Apiresponse(
                    200,
                    {user:createdUser},
                    "User registered successfully and verification mail send to your email"
                ),
            );




       });



    const login= asynchandler(async(req,res)=>{
        const {email,password,username} = req.body

        if (!email){
            throw new Apierror(
                400, "email is required"
            )
        }
        const user = await User.findOne({email})
        if (!user){
            throw new Apierror(400,"user does not exist")
        }

        const isPasswordValid = await user.isPasswordCorrect(password)
         if (!isPasswordValid){
            throw new Apierror(400, "Invalid credentials")
         }
        const {accessToken, refreshToken} =  await generateAccessAndRefreshToken(user._id)

        const loggedInUser= await User.findById(user._id)
        .select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry",);

        const options ={
          httpOnly:true,
          secure:true,
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken,options)
            .cookie("refreshToken",refreshToken,options)
            .json(
                new Apiresponse (
                    200,
                    {user:loggedInUser,
                        accessToken,
                        refreshToken,
                    },
                    "User loggedIn successfully"
                ),
            );
        
    }) ;
    
    const logoutUser= asynchandler(async(req,res)=>{
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    refreshToken:"",
                },
                
            },
            {
                new:true
            },
        );

        const options= {
            httpOnly:true,
            secure:true,
        };

        return res
          .status(200)
          .clearCookie("accessToken",options)
          .clearCookie("refreshToken",options)
          .json(
               new Apiresponse(
                200,
                {},
                "User logged out successfully"
               )
          );


    });

    const getCurrentUser = asynchandler(async(req,res)=>{
        return res
        .status(200)
        .json(
            new Apiresponse(200, req.user, "User fetched successfully")
        );

    });



    const verifyEmail= asynchandler(async(req,res)=>{
        const {verificationToken}= req.params

        if (!verificationToken){
            throw new Apierror(400, "Email verification token is missing")
        }

        let hashedToken= crypto
                        .createHash("sha256")
                        .update(verificationToken)
                        .digest("hex");

     const user = await User.findone({
        emailVerificationToken: hashedToken,
        emailVerificationExpiry:{$gt: Date.now()},
     })

     if (!user){
        throw new Apierror(400,"Token is invalid or expired")
     }

     user.emailVerificationToken = undefined
     user.emailVerificationExpiry= undefined

     user.isEmailVerified = true

     await user.save({validateBeforeSave:false});

     return res
            .status(200)
            .json(
                new Apiresponse(
                    200,
                    {
                        isEmailVerified:true
                    },
                    "email verified successfully",
                ),
            )
    });

    const resendEmailVerification= asynchandler(async(req,res)=>{
        const user = await User.findById(req.user?._id);

        if (!user){
            throw new Apierror(404, "User does not exist")
        }

        if (user.isEmailVerified){
            throw new Apierror(409, "Email is already verified")
        }

        const {hashedToken, unHashedToken, tokenExpiry}= user.generateTemporaryToken()

        user.emailVerificationToken= hashedToken
        user.emailVerificationExpiry= tokenExpiry

        await user.save({validateBeforeSave:false})

        await sendEmail({
            email: user?.email,
            subject: "please verify your email",
              mailgenContent: emaliVerificationMailgenContent(
                user.username,
                `${req.protocol}://${req.get("host")}/api/v1/users/verify-email/${unHashedToken}`
              ),
        });

        return res
               .status(200)
               .json(
                new Apiresponse(
                    200, {},
                    " mail has been sent to your mail id "
        
                )
               )
    });
   

    const refreshAccessToken = asynchandler(async(req,res)=>{

       const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken){
        throw new Apierror (401,"unauthorized Access")
    }
    
    try {
        const decodedToken=  jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)

        const user= await User.findById(decodedToken?._id)

        if (!user){
            throw new Apierror(401,"Invalid refresh token")
        }
          
       if (incomingRefreshToken!== user?.refreshToken) 
       {
        throw new Apierror (401, "Refresh token is expired")
       }

       const options = {
        httpOnly : true,
        secure : true,
       }

       const {accessToken, refreshToken : newRefreshToken}= await generateAccessAndRefreshToken(user._id)


       user.refreshToken = newRefreshToken
       await user.save();

       return res
              .status(201)
              .cookie("accesstoken",accessToken,options)
              .cookie("refresgToken",newRefreshToken,options)
              .json(
                new Apiresponse(
                    200, 
                    {accessToken, refreshToken: newRefreshToken},
                    "Token refreshed successfully"
                ),
              );

    } catch (error) {
        throw new Apierror(401, "Invalid refresh token");
    }
           
    });



    const forgotPasswordRequest = asynchandler(async(req,res)=>{
        const {email} = req.body

        if(!email){
            throw new Apierror(401, "Email is required")
        }

        const user= await User.findOne({email});

        if (!user){
            throw new Apierror(401, "unauthorized access")
        }
         const {hashedToken,unHashedToken,tokenExpiry} = await user.generateTemporaryToken()
        user.forgotPasswordToken= hashedToken
        user.forgotPasswordExpiry= tokenExpiry

        await user.save({validateBeforeSave:fasle});

        sendEmail({
            email: user?.email,
            subject: "password reset request",
            mailgenContent:forgotPasswordMailgenContent(
                user.username,
                `${process.env.FORGOT_PASSWORD_REDIREDT_URL}/${unHashedToken}`,
            ),
        });

        return res
               .status(200)
               .json(new 
                Apiresponse(
                    200, {}, "password reset mail has been sent to your mail id"
                ),
               );
    });


    const resetForgotPassword = asynchandler(async(req,res)=>{

        const {resetToken}= req.params
        const {newPassword}= req.body
 
        const hashedToken = await crypto.
                                  createHash("sha256")
                                  .update(resetToken)
                                  .digest("hex")

       const user = await User.findOne({
        forgotPasswordToken: hashedToken,
        forgotPasswordExpiry: {$gt :Date.now()}
       }) 

       if (!user){
        throw new Apierror(401, "Email or User does not exist")
       }

       user.forgotPasswordToken= undefined
       user.forgotPasswordExpiry= undefined

       
       user.password= newPassword
       user.save({validateBeforeSave:false});

       return res
              .status(200)
              .json(
                new Apiresponse(
                    200,
                    {},
                    "password reset successfully"
                ), )
    });


    const changeCurrentPassword= asynchandler(async(req,res)=>{
        const {oldPassword,newPassword}= req.body

        const user= await User.findById(req.user?._id)

        const isPasswordValid = await user.isPasswordCorrect(oldPassword)

        if(!isPasswordValid){
            throw new Apierror(400,"old password is wrong")
        }

        user.password= newPassword
        await user.save({validateBeforeSave:false});


        return res
               .status(200)
               .json(
                new Apiresponse(
                    200,
                    {},
                    "Password changed successfully"
                )
               );
    });




       






