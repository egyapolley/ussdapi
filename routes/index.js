const express = require("express");
const router = express.Router();
const User = require("../model/user");
const validator = require("../utils/validators");
const passport = require("passport");
const BasicStrategy = require("passport-http").BasicStrategy;



const soapRequest = require("easy-soap-request");
const parser = require('fast-xml-parser');
const he = require('he');
const options = {
    attributeNamePrefix: "@_",
    attrNodeName: "attr", //default is 'false'
    textNodeName: "#text",
    ignoreAttributes: true,
    ignoreNameSpace: true,
    allowBooleanAttributes: false,
    parseNodeValue: true,
    parseAttributeValue: false,
    trimValues: true,
    cdataTagName: "__cdata", //default is 'false'
    cdataPositionChar: "\\c",
    parseTrueNumberOnly: false,
    arrayMode: false,
    attrValueProcessor: (val, attrName) => he.decode(val, {isAttributeValue: true}),
    tagValueProcessor: (val, tagName) => he.decode(val),
    stopNodes: ["parse-me-as-string"]
};

passport.use(new BasicStrategy(
    function (username, password, done) {
        User.findOne({username: username}, function (err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false);
            }
            user.comparePassword(password, function (error, isMatch) {
                if (err) return done(error);
                else if (isMatch) {
                    return done(null, user)
                } else {
                    return done(null, false);
                }

            })

        });
    }
));


router.get("/bundles", passport.authenticate('basic', {
    session: false
}), async (req, res) => {

    const {error} = validator.validatePackageQuery(req.body);
    if (error) {
        return res.json({
            status: 2,
            reason: error.message
        })
    }
    const {subscriberNumber, channel} = req.body;
    if (channel.toLowerCase() !== req.user.channel) {
        return res.json({
            status: 2,
            reason: `Invalid Request channel ${channel}`
        })

    }

    const url = "http://172.25.39.16:2222";
    const sampleHeaders = {
        'User-Agent': 'NodeApp',
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'http://SCLINSMSVM01P/wsdls/Surfline/VoucherRecharge_USSD/VoucherRecharge_USSD',
        'Authorization': 'Basic YWlhb3NkMDE6YWlhb3NkMDE='
    };

    let xmlRequest = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pac="http://SCLINSMSVM01P/wsdls/Surfline/Package_Query_USSD.wsdl">
   <soapenv:Header/>
   <soapenv:Body>
      <pac:PackageQueryUSSDRequest>
         <CC_Calling_Party_Id>${subscriberNumber}</CC_Calling_Party_Id>
      </pac:PackageQueryUSSDRequest>
   </soapenv:Body>
</soapenv:Envelope>`;
    try {
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlRequest, timeout: 6000}); // Optional timeout parameter(milliseconds)

        const {body} = response;

        let jsonObj = parser.parse(body, options);
        let result = jsonObj.Envelope.Body;
        if (result.PackageQueryUSSDResult) {


            let packages = result.PackageQueryUSSDResult;

            const categoriesSet = new Set();
            const bundleEl_Value_Array = [];
            let resultEl_value;
            let acctType = null;

            for (const [k, v] of Object.entries(packages)) {

                if (k.startsWith("bundle")) {
                    let regex = /(.+?)\|/
                    let match = regex.exec(v.toString());
                    categoriesSet.add(match[1]);
                    bundleEl_Value_Array.push(v.toString())

                }
                if (k.startsWith("Result")) {
                    resultEl_value = v.toString();

                }
                if (k.startsWith("AccountType")) {
                    acctType = v.toString();

                }


            }

            if (categoriesSet.size > 0 && bundleEl_Value_Array.length > 0) {
                const final_bundles = [];
                let catArray = [...categoriesSet];
                for (let i = 0; i < catArray.length; i++) {
                    let catValue = catArray[i];
                    let catObject = {};
                    catObject.name = catValue;
                    catObject.bundles = [];
                    for (let j = 0; j < bundleEl_Value_Array.length; j++) {
                        if (bundleEl_Value_Array[j].startsWith(catValue)) {
                            let tempStringArray = bundleEl_Value_Array[j].split("|");
                            let bundleDetails = tempStringArray[1];
                            let bundleId = tempStringArray[2];
                            let autorenewal = tempStringArray[3];
                            let bundleDetailtemp = bundleDetails.split(/\s@|\s\//g);
                            let dataValue = bundleDetailtemp[0];
                            let price = bundleDetailtemp[1].substring(3);
                            let validity = bundleDetailtemp[2];

                            catObject.bundles.push(
                                {
                                    bundle_ui_display: bundleDetails,
                                    bundle_value: dataValue,
                                    bundle_price :parseFloat(price).toFixed(2),
                                    bundle_validity:validity,
                                    bundle_id: bundleId,
                                    bundle_subscriptionType: {
                                        one_time:true,
                                        autorenewal:autorenewal>1,
                                    }

                                });
                        }

                    }
                    final_bundles.push({
                        packages: catObject
                    })

                }

                res.json({
                    subscriberNumber: subscriberNumber,
                    subscriberAcctType: acctType,
                    status: 0,
                    reason: "success",
                    internetBundles: final_bundles,


                });


            } else {
                res.json({
                    subscriberNumber: subscriberNumber,
                    subscriberAcctType: acctType,
                    status: 1,
                    reason: resultEl_value,
                    internetBundles: null,


                });


            }
        }


    } catch (e) {
        console.log(e)
        res.json({
            status: 1,
            reason: "System failure",
        });

    }


});

router.post("/user", async (req, res) => {
    try {
        let {username, password, channel} = req.body;
        let user = new User({
            username,
            password,
            channel,
        });
        user = await user.save();
        res.json(user);

    } catch (error) {
        res.json({error: error.toString()})
    }


});



module.exports = router;

