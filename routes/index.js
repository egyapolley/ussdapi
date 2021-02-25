const express = require("express");
const router = express.Router();
const User = require("../model/user");
const validator = require("../utils/validators");
const passport = require("passport");
const utils = require("../utils/main_utils")
const BasicStrategy = require("passport-http").BasicStrategy;
const moment = require("moment");


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


router.get("/account", passport.authenticate('basic', {
    session: false
}), async (req, res) => {

    try {

        const {error} = validator.validateBalanceQuery(req.body);
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


        const url = "http://172.25.39.13:3004";
        const sampleHeaders = {
            'User-Agent': 'NodeApp',
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': 'urn:CCSCD1_QRY',
        };

        let getBalancexml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pi="http://xmlns.oracle.com/communications/ncc/2009/05/15/pi">
   <soapenv:Header/>
   <soapenv:Body>
      <pi:CCSCD1_QRY>
         <pi:username>admin</pi:username>
         <pi:password>admin</pi:password>
         <pi:MSISDN>${subscriberNumber}</pi:MSISDN>
         <pi:LIST_TYPE>BALANCE</pi:LIST_TYPE>
         <pi:WALLET_TYPE>Primary</pi:WALLET_TYPE>
         <pi:BALANCE_TYPE>ALL</pi:BALANCE_TYPE>
      </pi:CCSCD1_QRY>
   </soapenv:Body>
</soapenv:Envelope>`;

        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: getBalancexml, timeout: 3000}); // Optional timeout parameter(milliseconds)

        const {body} = response;

        const unlimitedBalances = [];



        if (parser.validate(body) === true) {
            let jsonObj = parser.parse(body, options);


            const soapResponseBody = jsonObj.Envelope.Body
            if (soapResponseBody.Fault) {
                return res.json({status: 1, message: soapResponseBody.Fault.faultstring})

            } else {
                let accountType = soapResponseBody['CCSCD1_QRYResponse']['PRODUCT']
                let accountState =soapResponseBody['CCSCD1_QRYResponse']['STATUS']
                let balanceResult = soapResponseBody['CCSCD1_QRYResponse']['BALANCES']['BALANCE_ITEM'];

                switch (accountState){
                    case 'A':
                    case 'D':
                        accountState='ACTIVE'
                        break;
                    case 'F':
                    case 'T':
                    case 'P':
                    case 'S':
                        accountState='INACTIVE';
                        break
                }

                if (balanceResult) {

                    const data_balanceTypes = [
                        'Promotional Data',
                        'Bonus Data',
                        'Gift Data',
                        'Ten4Ten',
                        'TestDrive Data',
                        'Data'
                    ]

                    let all_balances = []

                    const unlimited_balanceTypes = [
                        'UL_AlwaysON_Lite Status',
                        'UL_AlwaysON_Starter Status',
                        'UL_AlwaysON_Streamer Status',
                        'UL_AlwaysON_Standard Status',
                        'UL_AlwaysON_Super Status',
                        'UL_AlwaysON_Ultra Status',
                        'UL_AlwaysON_Maxi Status',
                        'Staff_AlwaysON_1GB Count',
                        'Staff_AlwaysON_2GB Count',
                        'Staff_AlwaysON_3GB Count',
                        'Staff_AlwaysON_4GB Count',
                        'Staff_AlwaysON_5GB Count',
                        'ULNitePlan Status',
                        'ULDayNitePlan Status',
                        'ULBusiness2 Status'
                    ]


                    balanceResult.forEach(function (item) {
                        if (item.BUCKETS) {
                            let balanceType = item.BALANCE_TYPE_NAME.toString();

                            if (Array.isArray(item.BUCKETS.BUCKET_ITEM)) {
                                let bucket_item = item.BUCKETS.BUCKET_ITEM;
                                bucket_item.forEach(function (bucket) {
                                    let temp_balance = {}
                                    let bucketexpiry = bucket.BUCKET_EXPIRY.toString();
                                    temp_balance.balance_type = balanceType
                                    temp_balance.value = bucket.BUCKET_VALUE;
                                    temp_balance.expiry_date = bucketexpiry
                                    all_balances.push(temp_balance)


                                })


                            } else {

                                let bucket = item.BUCKETS.BUCKET_ITEM
                                let bucketexpiry = bucket.BUCKET_EXPIRY.toString();


                                let temp_balance = {}
                                temp_balance.balance_type = balanceType
                                temp_balance.value = bucket.BUCKET_VALUE;
                                temp_balance.expiry_date = bucketexpiry
                                all_balances.push(temp_balance)

                            }
                        }


                    });

                    all_balances = all_balances.filter(item => data_balanceTypes.includes(item.balance_type) || unlimited_balanceTypes.includes(item.balance_type) || item.balance_type === 'Bundle ExpiryTrack Status' || item.balance_type.endsWith('Surfplus Data')||item.balance_type.endsWith('Cash'))
                    const bundleExpiryTrack = all_balances.find(item => item.balance_type === 'Bundle ExpiryTrack Status')
                    const mainDataExpiry = bundleExpiryTrack?utils.formatDate(bundleExpiryTrack.expiry_date):null

                    let mainDataValue =0;
                    let cashBalanceValue=0;
                    all_balances.forEach(item => {
                        const balanceType = item.balance_type.toString();
                        const balanceValue = item.value?item.value:0;
                        const expiry_date= item.expiry_date?utils.formatDate(item.expiry_date):null
                        if (balanceType.endsWith('Surfplus Data')){
                            mainDataValue+=item.value

                        }else if(balanceType ==='General Cash' && balanceValue > 0){
                            cashBalanceValue += balanceValue


                        }

                        else if (balanceType === 'UL_AlwaysON_Lite Status' && balanceValue > 0 ){
                            unlimitedBalances.push({
                                balance_type:'AlwaysON Lite Package',
                                value:'ACTIVE',
                                expiry_date
                            })

                        }else if (balanceType === 'UL_AlwaysON_Standard Status' && balanceValue > 0){
                            unlimitedBalances.push({
                                balance_type:'AlwaysON Standard Package',
                                value:'ACTIVE',
                                expiry_date
                            })

                        }else if (balanceType === 'UL_AlwaysON_Starter Status' && balanceValue > 0){
                            unlimitedBalances.push({
                                balance_type:'AlwaysON Starter Package',
                                value:'ACTIVE',
                                expiry_date
                            })

                        }else if (balanceType === 'UL_AlwaysON_Streamer Status' && balanceValue > 0){
                            unlimitedBalances.push({
                                balance_type:'AlwaysON Streamer Package',
                                value:'ACTIVE',
                                expiry_date
                            })

                        }else if (balanceType === 'UL_AlwaysON_Super Status' && balanceValue > 0){
                            unlimitedBalances.push({
                                balance_type:'AlwaysON Super Package',
                                value:'ACTIVE',
                                expiry_date
                            })

                        }else if (balanceType === 'UL_AlwaysON_Ultra Status' && balanceValue > 0){
                            unlimitedBalances.push({
                                balance_type:'AlwaysON Ultra Package',
                                value:'ACTIVE',
                                expiry_date
                            })

                        }else if (balanceType === 'UL_AlwaysON_Maxi Status' && balanceValue > 0){
                            unlimitedBalances.push({
                                balance_type:'AlwaysON Maxi Package',
                                value:'ACTIVE',
                                expiry_date
                            })

                        }else if (balanceType === 'ULNitePlan Status' && balanceValue > 0){
                            unlimitedBalances.push({
                                balance_type:'Unlimited Night Package',
                                value:'ACTIVE',
                                expiry_date
                            })

                        }else if (balanceType === 'ULDayNitePlan Status' && balanceValue > 0){
                            unlimitedBalances.push({
                                balance_type:'Unlimited Package',
                                value:'ACTIVE',
                                expiry_date
                            })

                        }else if (balanceType === 'ULBusiness2 Status' && balanceValue > 0){
                            unlimitedBalances.push({
                                balance_type:'Unlimited Business Package',
                                value:'ACTIVE',
                                expiry_date
                            })

                        }else if (balanceType.match(/^Staff.*Count/) && balanceValue >0){
                            unlimitedBalances.push({
                                balance_type:'Staff Package',
                                value:'ACTIVE',
                                expiry_date
                            })

                        }
                    })

                    let promo_balances = all_balances.filter(item => data_balanceTypes.includes(item.balance_type))
                    promo_balances = promo_balances.map(item => {

                        item.value =item.value?parseFloat(item.value/1024).toFixed(3):0;
                        item.expiry_date=item.expiry_date?utils.formatDate(item.expiry_date):null;
                        return item;

                    })

                    res.json({
                        status: 0,
                        reason: "success",
                        subscriberNumber,
                        accountState,
                        accountType,

                        account_balance:  {
                            cash_balance:[{balance_type:'Cash',value:parseFloat(cashBalanceValue/100).toFixed(2),expiry_date:null}],
                            data_balance:[{balance_type:"Data",value:parseFloat(mainDataValue/1024).toFixed(3),expiry_date:mainDataExpiry}, ...promo_balances],
                            unlimited_balance:unlimitedBalances
                        }
                    })


                }
            }
        }

    } catch (error) {
        console.log(error)
        res.json({
            status: 1,
            reason: "System Failure"
        })

    }


})

router.post("/voucher", passport.authenticate('basic', {
    session: false
}), async (req, res) => {
    const {error} = validator.validateVoucher(req.body);
    if (error) {
        return res.json({
            status: 2,
            reason: error.message
        })
    }
    const {subscriberNumber, channel,transactionId, voucherCode} = req.body;
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

    let xmlvoucher = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:vouc="http://SCLINSMSVM01P/wsdls/Surfline/VoucherRecharge.wsdl">
   <soapenv:Header/>
   <soapenv:Body>
      <vouc:VoucherRechargeRequest>
         <CC_Calling_Party_Id>233255000102</CC_Calling_Party_Id>
         <CHANNEL>${channel}</CHANNEL>
         <TRANSACTION_ID>${transactionId}</TRANSACTION_ID>
         <WALLET_TYPE>Primary</WALLET_TYPE>
         <VoucherNumber>${voucherCode}</VoucherNumber>
         <ScenarioID>1</ScenarioID>
      </vouc:VoucherRechargeRequest>
   </soapenv:Body>
</soapenv:Envelope>
`;
    try {
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlvoucher, timeout: 5000}); // Optional timeout parameter(milliseconds)

        const {body} = response;

        let jsonObj = parser.parse(body, options);
        if (!jsonObj.Envelope.Body.VoucherRechargeResult) {

            res.json({
                status:0,
                reason:"success"
            })



        }


    } catch (error) {
        console.log(error.toString())
        let jsonObj = parser.parse(error.toString(), options);
        const soapResponseBody = jsonObj.Envelope.Body;
        console.log(soapResponseBody)
        const errorCode = soapResponseBody.Fault.detail.VoucherRechargeFault.errorCode;
        let faultMessage = "System Error";
        switch (errorCode) {
            case 60:
                faultMessage = "Account is not ACTIVE";
                break;
            case 63:
                faultMessage = "Missing input parameters";
                break;
            case 67:
                faultMessage = "Voucher already USED";
                break;
            case 68:
                faultMessage = "Voucher is INVALID";
                break;
        }


        res.json({status: 1, reason:faultMessage});

    }


})

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
                                    bundle_price: parseFloat(price).toFixed(2),
                                    bundle_validity: validity,
                                    bundle_id: bundleId,
                                    bundle_subscriptionType: {
                                        one_time: true,
                                        autorenewal: autorenewal > 1,
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


})

router.post("/bundles_ca", passport.authenticate('basic', {
    session: false
}), async (req, res) => {

    const {error} = validator.validateDataRecharge(req.body);
    if (error) {
        return res.json({
            status: 2,
            reason: error.message
        })
    }
    const {subscriberNumber, channel,transactionId, bundleId,subscriptionType} = req.body;
    if (channel.toLowerCase() !== req.user.channel) {
        return res.json({
            status: 2,
            reason: `Invalid Request channel ${channel}`
        })

    }


    const url = "http://172.25.39.16:2222"

    const sampleHeaders = {
        'User-Agent': 'NodeApp',
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'http://SCLINSMSVM01P/wsdls/Surfline/DATA_Recharges/DATA_Recharges',
        'Authorization': 'Basic YWlhb3NkMDE6YWlhb3NkMDE='
    };


    let xmlRequest = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:data="http://SCLINSMSVM01P/wsdls/Surfline/DATA_Recharges.wsdl">
   <soapenv:Header/>
   <soapenv:Body>
      <data:DATA_RechargesRequest>
         <CC_Calling_Party_Id>${subscriberNumber}</CC_Calling_Party_Id>
         <CHANNEL>${channel}</CHANNEL>
         <TRANSACTION_ID>${transactionId}</TRANSACTION_ID>
         <BundleName>${bundleId}</BundleName>
         <SubscriptionType>${subscriptionType}</SubscriptionType>
      </data:DATA_RechargesRequest>
   </soapenv:Body>
</soapenv:Envelope>`;

    try {
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlRequest, timeout: 7000}); // Optional timeout parameter(milliseconds)

        const {body} = response;
        let jsonObj = parser.parse(body, options);
        if (!jsonObj.Envelope.Body.DATA_RechargesResult) {
            res.json({status: 0, reason:"success"});


        }


    } catch (error) {
        console.log(error.toString())
        let jsonObj = parser.parse(error.toString(), options);
        const soapResponseBody = jsonObj.Envelope.Body;
        const errorCode = soapResponseBody.Fault.detail.DATA_RechargesFault.errorCode;
        let faultMessage = "System Error";
        switch (errorCode) {
            case 50:
                faultMessage = "Account is not active";
                break;
            case 51:
                faultMessage = "Invalid Bundle";
                break;
            case 53:
                faultMessage = "Transient Error";
                break;
            case 55:
                faultMessage = "Account has insufficient credit/General Failure";
                break;

            case 102:
                faultMessage = "Purchase not allowed.Account has active unlimited bundle";
                break;
            case 105:
                faultMessage = "Purchase of this bundle  is not allowed at this time";
                break;
        }

        res.json({status:1, reason:faultMessage});


    }


})

router.post("/bundles_ep", passport.authenticate('basic', {
    session: false
}), async (req, res) => {

    const {error} = validator.validatePackagePurchase(req.body);
    if (error) {
        return res.json({
            status: 2,
            reason: error.message
        })
    }
    const {subscriberNumber, channel, accountId, transactionId, bundleId} = req.body;
    if (channel.toLowerCase() !== req.user.channel) {
        return res.json({
            status: 2,
            reason: `Invalid Request channel ${channel}`
        })
    }

    if (accountId !== req.user.accountNumber) {
        return res.json({
            status: 2,
            reason: `Invalid Request accountId ${accountId}`
        })

    }

    const url = "http://172.25.39.16:2222";
    const sampleHeaders = {
        'User-Agent': 'NodeApp',
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'http://SCLINSMSVM01P/wsdls/Surfline/VoucherRecharge_USSD/VoucherRecharge_USSD',
        'Authorization': 'Basic YWlhb3NkMDE6YWlhb3NkMDE='
    };

    let xmlRequest = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:dat="http://SCLINSMSVM01P/wsdls/Surfline/DATARechargeUSSDMobileMoney.wsdl">
   <soapenv:Header/>
   <soapenv:Body>
      <dat:DATARechargeUSSDMoMoRequest>
         <CC_Calling_Party_Id>${accountId}</CC_Calling_Party_Id>
         <CHANNEL>${channel}</CHANNEL>
         <TRANSACTION_ID>${transactionId}</TRANSACTION_ID>
         <Recipient_Number>${subscriberNumber}</Recipient_Number>
         <BundleName>${bundleId}</BundleName>
         <SubscriptionType>One-Off</SubscriptionType>
      </dat:DATARechargeUSSDMoMoRequest>
   </soapenv:Body>
</soapenv:Envelope>`;
    try {
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlRequest, timeout: 5000}); // Optional timeout parameter(milliseconds)

        const {body} = response;

        let jsonObj = parser.parse(body, options);
        let result = jsonObj.Envelope.Body;
        if (result.DATARechargeUSSDMoMoResult && result.DATARechargeUSSDMoMoResult.ServiceRequestID) {
            let serviceRequestID = result.DATARechargeUSSDMoMoResult.ServiceRequestID;
            res.json({
                status: 0,
                reason: "success",
                serviceRequestId: serviceRequestID,
                clientTransactionId: transactionId,
            })


        }


    } catch (err) {
        let errorBody = err.toString();
        if (parser.validate(errorBody) === true) {
            let jsonObj = parser.parse(errorBody, options);
            if (jsonObj.Envelope.Body.Fault) {
                let soapFault = jsonObj.Envelope.Body.Fault;
                let faultString = soapFault.faultstring;
                console.log(faultString);
                let errorcode = soapFault.detail.DATARechargeUSSDMoMoFault.errorCode;
                console.log(errorcode)
                switch (errorcode) {
                    case 62:
                        faultString = "Invalid Request Parameter values";
                        break;
                    case 61:
                        faultString = "subscriberNumber not valid";
                        break;

                    default:
                        faultString = "System Error";

                }
                return res.json(
                    {
                        status: 1,
                        reason: faultString,
                        serviceRequestId: null,
                        clientTransactionId: transactionId
                    })

            }


        }

        console.log(errorBody)
        res.json({error: "System Failure"})

    }

})

router.post("/user", async (req, res) => {
    try {
        let {username, password, channel, accountNumber} = req.body;
        let user = new User({
            username,
            password,
            channel,
            accountNumber
        });
        user = await user.save();
        res.json(user);

    } catch (error) {
        res.json({error: error.toString()})
    }


});


module.exports = router;

