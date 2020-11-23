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






}

