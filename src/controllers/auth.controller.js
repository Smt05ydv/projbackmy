import {User} from "../models/user.model.js";
 import {Apierror} from "../utils/ApiError.js";
  import {Apiresponse} from "../utils/ApiResponse.js";
   import {asynchandler} from "../utils/AsyncHandler.js";


   const registerUser = asynchandler(async(req,res)=>{
    const { email, username,password,role} = req.body;
        const existedUser= await user.findone({
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
                mailgenContent:emailVerificationContent(
                    user.username,
                    `${req.protocol}://${req.get(host)}/api/v1/users/verify-email/${unHashedToken}`
                )
            });


            const createdUser= await user.findById(user._id)
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
        const user = await User.findone({email})
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
        
    })   


       






