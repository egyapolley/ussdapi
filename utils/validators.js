const Joi = require("joi");

module.exports = {

    validatePackageQuery: (body) => {

        const schema = Joi.object({
            subscriberNumber: Joi.string()
                .length(12)
                .alphanum()
                .regex(/^233.+/)
                .required()
                .messages({"string.pattern.base": "subscriberNumber must start with 233"}),

            channel: Joi.string()
                .alphanum()
                .min(3)
                .max(50)
                .required(),

        });

        return schema.validate(body)


    },

    validatePackagePurchase: (body) => {

        const schema = Joi.object({
            subscriberNumber: Joi.string()
                .length(12)
                .alphanum()
                .regex(/^233.+/)
                .required()
                .messages({"string.pattern.base": "subscriberNumber must start with 233"}),

            channel: Joi.string()
                .alphanum()
                .min(3)
                .max(50)
                .required(),

            transactionId: Joi.string()
                .min(3)
                .max(300)
                .required(),

            bundleId: Joi.string()
                .min(1)
                .max(10)
                .required(),

            accountId: Joi.string()
                .alphanum()
                .required(),
        });

        return schema.validate(body)


    },

    validateBalanceQuery: (body) =>{
        const schema = Joi.object({
            subscriberNumber: Joi.string()
                .length(12)
                .alphanum()
                .regex(/^233.+/)
                .required()
                .messages({"string.pattern.base": "subscriberNumber must start with 233"}),

            channel: Joi.string()
                .alphanum()
                .min(3)
                .max(50)
                .required(),

        });

        return schema.validate(body)

    },
    validateVoucher: (body) =>{
        const schema = Joi.object({
            subscriberNumber: Joi.string()
                .length(12)
                .alphanum()
                .regex(/^233.+/)
                .required()
                .messages({"string.pattern.base": "subscriberNumber must start with 233"}),

            channel: Joi.string()
                .alphanum()
                .min(3)
                .max(50)
                .required(),
            transactionId: Joi.string()
                .min(3)
                .max(300)
                .required(),

            voucherCode: Joi.string()
                .length(14)
                .required(),

        });

        return schema.validate(body)

    },

    validateDataRecharge: (body) =>{
        const schema = Joi.object({
            subscriberNumber: Joi.string()
                .length(12)
                .alphanum()
                .regex(/^233.+/)
                .required()
                .messages({"string.pattern.base": "subscriberNumber must start with 233"}),

            channel: Joi.string()
                .alphanum()
                .min(3)
                .max(50)
                .required(),
            transactionId: Joi.string()
                .min(3)
                .max(300)
                .required(),

            bundleId: Joi.string()
                .min(1)
                .max(10)
                .required(),


            subscriptionType: Joi.string()
                .valid('One-Off', 'Recurrent')
                .required(),

        });

        return schema.validate(body)

    },
    validateBalanceQueryEp:(body) => {

        const schema = Joi.object({
            channel: Joi.string()
                .alphanum()
                .min(3)
                .max(50)
                .required(),

            accountId: Joi.string()
                .alphanum()
                .required(),
        });

        return schema.validate(body)


    },

    validateExtraTime: (body) =>{
        const schema = Joi.object({
            subscriberNumber: Joi.string()
                .length(12)
                .alphanum()
                .regex(/^233.+/)
                .required()
                .messages({"string.pattern.base": "subscriberNumber must start with 233"}),

            channel: Joi.string()
                .alphanum()
                .min(3)
                .max(50)
                .required(),
            code: Joi.number()
                .required(),

        });

        return schema.validate(body)

    },
    validateGift: (body) =>{
        const schema = Joi.object({

            donorNumber: Joi.string()
                .length(12)
                .alphanum()
                .regex(/^233.+/)
                .required()
                .messages({"string.pattern.base": "subscriberNumber must start with 233"}),
            recipientNumber: Joi.string()
                .length(12)
                .alphanum()
                .regex(/^233.+/)
                .required()
                .messages({"string.pattern.base": "subscriberNumber must start with 233"}),
            transactionId: Joi.string()
                .required(),
            channel: Joi.string()
                .alphanum()
                .min(3)
                .max(50)
                .required(),
            amount: Joi.number()
                .min(1000)
                .max(100000)
                .required(),

        });

        return schema.validate(body)

    },
    validateGetNumber: (body) =>{
        const schema = Joi.object({
            channel: Joi.string()
                .alphanum()
                .min(3)
                .max(50)
                .required(),
            iccId: Joi.string()
                .regex(/[\d+]{18,19}/)
                .label("Sim serial number or ICCID")
                .required()
                // .message("IccId is invalid format. Please check the back of sim card for the serial number")

        });

        return schema.validate(body)

    },






}

