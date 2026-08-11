import mongoose,{schema} from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";

const userSchema = new Schema({
    avatar:{
        type:{
            url: String,
            localpath:String
        },
        default:{
            url:"https://placehold.co/200x200",
            localpath:"",
        },
    },

    username:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
        index:true,
    },

    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
        
    },

    fullname:{
        type:String,
        trim:true,
    },

    password:{
        type:String,
        required:[true,"password is required"],
    },

    isEmailVerified:{
        type:Boolean,
        default:false,
    },

    refreshToken:{
        type:String,
    },

    forgotPasswordToken:{
        type:String,
    },

    forgotPasswordExpiry:{
        type:Date
    },

    emailVerificationToken:{
        type:String,
    },

    emailVerificationExpiry:{
        type:Date
    },
},

{
    timestamps:true,
},


);

//Hash password before saving
userSchema.pre("save",async function () {
    if (!this.isModified("password")){
        return; }

      this.password =   await bcrypt.hash(this.password,10);
});


// compare password
userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password,this.password);
};






