const mongoose = require("mongoose");

const bcrypt = require("bcrypt");
const SALT_FACTOR =10;

const UserSchema = new mongoose.Schema({
    username: {
        type:String,
        lowercase:true,
        required:true,
        unique:true,
        index:{unique:true}
    },
    password:{
        type:String,
        required:true,

    },

    accountNumber:{
        type:String,
        default:"",
        required:false,
        unique:true,
    },

    channel:{
        type:String,
        lowercase: true,
        required:true,
        unique:true,
    }


});

UserSchema.pre("save", function(next) {
    const user = this;


    if (!user.isModified('password')) return next();
    bcrypt.genSalt(SALT_FACTOR, function(err, salt) {
        if (err) return next(err);

        bcrypt.hash(user.password, salt, function(err, hash) {
            if (err) return next(err);
            user.password = hash;
            next();
        });
    });

});

UserSchema.methods.comparePassword = function(candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(null, isMatch);
    });
};

const User = mongoose.model("user",UserSchema);
module.exports = User;

