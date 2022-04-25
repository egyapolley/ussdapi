const express = require("express");
const router = express.Router();
const User = require("../model/user");
const validator = require("../utils/validators");
const passport = require("passport");
const utils = require("../utils/main_utils")
const BasicStrategy = require("passport-http").BasicStrategy;
const axios = require("axios")
const moment = require("moment")


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

        const {subscriberNumber, channel} = getReqData(req);

        const {error} = validator.validateBalanceQuery({subscriberNumber, channel});
        if (error) {
            return res.json({
                status: 2,
                reason: error.message
            })
        }

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
         <pi:username>${process.env.PI_USER}</pi:username>
         <pi:password>${process.env.PI_PASS}</pi:password>
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


        let jsonObj = parser.parse(body, options);


        const soapResponseBody = jsonObj.Envelope.Body
        if (soapResponseBody.Fault) {
            return res.json({status: 1, message: soapResponseBody.Fault.faultstring})

        } else {
            let accountType = soapResponseBody['CCSCD1_QRYResponse']['PRODUCT']
            let accountState = soapResponseBody['CCSCD1_QRYResponse']['STATUS']
            let balanceResult = soapResponseBody['CCSCD1_QRYResponse']['BALANCES']['BALANCE_ITEM'];

            switch (accountState) {
                case 'A':
                case 'D':
                    accountState = 'ACTIVE'
                    break;
                case 'F':
                case 'T':
                case 'P':
                case 'S':
                    accountState = 'INACTIVE';
                    break
            }

            if (balanceResult) {

                const data_balanceTypes = [
                    'Promotional Data',
                    'Bonus Data',
                    'Gift Data',
                    'Ten4Ten',
                    'TestDrive Data',
                    'SanBraFie Data',
                    'Data'
                ]

                const unlimited_data ={
                    'UL_AlwaysON_Lite Data':'AlwaysON Lite Data',
                    'UL_AlwaysON_Starter Data':'AlwaysON Starter Data',
                    'UL_AlwaysON_Streamer Data':'AlwaysON Streamer Data',
                    'UL_AlwaysON_Standard Data':'AlwaysON Standard Data',
                    'UL_AlwaysON_Super Data':'AlwaysON Super Data',
                    'UL_AlwaysON_Ultra Data':'AlwaysON Ultra Data',
                    'UL_AlwaysON_Maxi Data':'AlwaysON Maxi Data',
                    'UL_AlwaysON_OneYear Data':'Yolo Data',
                    'Staff_AlwaysON_1GB Data':' Staff Data',
                    'Staff_AlwaysON_2GB Data':'Staff Data',
                    'Staff_AlwaysON_3GB Data':'Staff Data',
                    'Staff_AlwaysON_4GB Data':'Staff Data',
                    'Staff_AlwaysON_5GB Data':'Staff Data',
                    'Staff_AlwaysON_10GB Data':'Staff Data',
                }

                const zero_data_unlimited = [

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
                    'UL_AlwaysON_OneYear Status',
                    'Staff_AlwaysON_1GB Count',
                    'Staff_AlwaysON_2GB Count',
                    'Staff_AlwaysON_3GB Count',
                    'Staff_AlwaysON_4GB Count',
                    'Staff_AlwaysON_5GB Count',
                    'Staff_AlwaysON_10GB Count',
                    'ULNitePlan Status',
                    'ULDayNitePlan Status',
                    'ULBusiness2 Status',
                    'TaxifyUL_Lite Status',
                    'TaxifyUL_Super Status',
                    'UL_AlwaysON_OneYear Status'
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

                all_balances = all_balances.filter(item => data_balanceTypes.includes(item.balance_type) || unlimited_balanceTypes.includes(item.balance_type) || item.balance_type === 'Bundle ExpiryTrack Status' || item.balance_type.endsWith('Surfplus Data') || item.balance_type.endsWith('Cash')||Object.keys(unlimited_data).includes(item.balance_type))
                const bundleExpiryTrack = all_balances.find(item => item.balance_type === 'Bundle ExpiryTrack Status')
                const mainDataExpiry = bundleExpiryTrack ? utils.formatDate(bundleExpiryTrack.expiry_date) : null

                let mainDataValue = 0;
                let cashBalanceValue = 0;
                all_balances.forEach(item => {
                    const balanceType = item.balance_type.toString();
                    const balanceValue = item.value ? item.value : 0;
                    const expiry_date = item.expiry_date ? utils.formatDate(item.expiry_date) : null
                    if (balanceType.endsWith('Surfplus Data')) {
                        mainDataValue += item.value

                    } else if (balanceType === 'General Cash' && balanceValue > 0) {
                        cashBalanceValue += balanceValue


                    } else if (balanceType === 'UL_AlwaysON_Lite Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'AlwaysON Lite Package',
                            value: 'ACTIVE',
                            expiry_date
                        })
                        zero_data_unlimited.push({
                            balanceType:'AlwaysON Lite Data',
                            value:0,
                            expiry_date:null,
                        })

                    } else if (balanceType === 'UL_AlwaysON_Standard Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'AlwaysON Standard Package',
                            value: 'ACTIVE',
                            expiry_date
                        })
                        zero_data_unlimited.push({
                            balanceType:'AlwaysON Standard Data',
                            value:0,
                            expiry_date:null,
                        })

                    }
                    else if (balanceType === 'UL_AlwaysON_OneYear Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'Yolo Package',
                            value: 'ACTIVE',
                            expiry_date
                        })

                        zero_data_unlimited.push({
                            balanceType:'Yolo Data',
                            value:0,
                            expiry_date:null,
                        })

                    }
                    else if (balanceType === 'UL_AlwaysON_Starter Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'AlwaysON Starter Package',
                            value: 'ACTIVE',
                            expiry_date
                        })
                        zero_data_unlimited.push({
                            balanceType:'AlwaysON Starter Data',
                            value:0,
                            expiry_date:null,
                        })

                    } else if (balanceType === 'UL_AlwaysON_Streamer Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'AlwaysON Streamer Package',
                            value: 'ACTIVE',
                            expiry_date
                        })
                        zero_data_unlimited.push({
                            balanceType:'AlwaysON Streamer Data',
                            value:0,
                            expiry_date:null,
                        })

                    } else if (balanceType === 'UL_AlwaysON_Super Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'AlwaysON Super Package',
                            value: 'ACTIVE',
                            expiry_date
                        })

                        zero_data_unlimited.push({
                            balanceType:'AlwaysON Super Data',
                            value:0,
                            expiry_date:null,
                        })

                    } else if (balanceType === 'UL_AlwaysON_Ultra Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'AlwaysON Ultra Package',
                            value: 'ACTIVE',
                            expiry_date
                        })

                        zero_data_unlimited.push({
                            balanceType:'AlwaysON Ultra Data',
                            value:0,
                            expiry_date:null,
                        })

                    } else if (balanceType === 'UL_AlwaysON_Maxi Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'AlwaysON Maxi Package',
                            value: 'ACTIVE',
                            expiry_date
                        })

                        zero_data_unlimited.push({
                            balanceType:'AlwaysON Maxi Data',
                            value:0,
                            expiry_date:null,
                        })

                    } else if (balanceType === 'ULNitePlan Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'Unlimited Night Package',
                            value: 'ACTIVE',
                            expiry_date
                        })

                    } else if (balanceType === 'ULDayNitePlan Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'Unlimited Package',
                            value: 'ACTIVE',
                            expiry_date
                        })

                    } else if (balanceType === 'ULBusiness2 Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'Unlimited Business Package',
                            value: 'ACTIVE',
                            expiry_date
                        })

                    } else if (balanceType === 'TaxifyUL_Lite Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'Unlimited Lite',
                            value: 'ACTIVE',
                            expiry_date
                        })

                    }else if (balanceType === 'TaxifyUL_Super Status' && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'Unlimited Super',
                            value: 'ACTIVE',
                            expiry_date
                        })

                    }else if (balanceType.match(/^Staff.*Count/) && balanceValue > 0) {
                        unlimitedBalances.push({
                            balance_type: 'Staff Package',
                            value: 'ACTIVE',
                            expiry_date
                        })

                        zero_data_unlimited.push({
                            balanceType:'Staff Data',
                            value:0,
                            expiry_date:null,
                        })

                    }
                })

                let promo_balances = all_balances.filter(item => data_balanceTypes.includes(item.balance_type))
                promo_balances = promo_balances.map(item => {

                    item.value = item.value ? parseFloat(item.value / 1024).toFixed(3) : 0;
                    item.expiry_date = item.expiry_date ? utils.formatDate(item.expiry_date) : null;
                    return item;

                })

                let unlimited_data_temp = all_balances.filter(item => Object.keys(unlimited_data).includes(item.balance_type))

                unlimited_data_temp = unlimited_data_temp.map(item =>{
                    item.value = item.value ? parseFloat(item.value / 1024).toFixed(3) : 0;
                    item.expiry_date =  null;
                    item.balance_type = unlimited_data[item.balance_type]
                    return item

                })

                unlimited_data_temp.sort((a, b) => b.value - a.value)

                let finalUnlimitedData = unlimited_data_temp.length >0 ? unlimited_data_temp[0]: zero_data_unlimited.length>0?zero_data_unlimited[0]:null;

                const data_balance = [
                    {
                        balance_type: "Data",
                        value: parseFloat(mainDataValue / 1024).toFixed(3),
                        expiry_date: mainDataExpiry
                    }, ...promo_balances

                ]
                if (finalUnlimitedData) data_balance.push(finalUnlimitedData)

                res.json({
                    status: 0,
                    reason: "success",
                    subscriberNumber,
                    accountState,
                    accountType,

                    account_balance: {
                        cash_balance: [{
                            balance_type: 'Cash',
                            value: parseFloat(cashBalanceValue / 100).toFixed(2),
                            expiry_date: null
                        }],
                        data_balance,
                        unlimited_balance: unlimitedBalances
                    }
                })


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
    const {subscriberNumber, channel, transactionId, voucherCode} = req.body;
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
        'Authorization': `${process.env.OSD_AUTH}`
    };

    let xmlvoucher = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:vouc="http://SCLINSMSVM01P/wsdls/Surfline/VoucherRecharge.wsdl">
   <soapenv:Header/>
   <soapenv:Body>
      <vouc:VoucherRechargeRequest>
         <CC_Calling_Party_Id>${subscriberNumber}</CC_Calling_Party_Id>
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
                status: 0,
                reason: "success"
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


        res.json({status: 1, reason: faultMessage});

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
        'Authorization': `${process.env.OSD_AUTH}`
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
    const {subscriberNumber, channel, transactionId, bundleId, subscriptionType} = req.body;
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
        'Authorization': `${process.env.OSD_AUTH}`
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
            res.json({status: 0, reason: "success"});


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
                break
            case 102:
                faultMessage = "Purchase not allowed.Account has active unlimited bundle";
                break;
            case 105:
                faultMessage = "Purchase of this bundle  is not allowed at this time";
                break;
        }

        res.json({status: 1, reason: faultMessage});


    }


})

/*router.post("/bundles_ep", passport.authenticate('basic', {
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
        'Authorization': `${process.env.OSD_AUTH}`
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

})*/

router.post("/redeem_extra", passport.authenticate('basic', {
    session: false
}), async (req, res) => {

    const {error} = validator.validateExtraTime(req.body);
    if (error) {
        return res.json({
            status: 2,
            reason: error.message
        })
    }
    const {subscriberNumber, channel, code} = req.body;
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
        'Authorization': `${process.env.OSD_AUTH}`
    };

    let xmlRequest = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ext="http://SCLINSMSVM01P/wsdls/Surfline/ExtraTimeDataRedemption.wsdl">
   <soapenv:Header/>
   <soapenv:Body>
      <ext:ExtraTimeRedemptionRequest>
         <CC_Calling_Party_Id>${subscriberNumber}</CC_Calling_Party_Id>
         <CHANNEL>${channel}</CHANNEL>
         <PIN>${code}</PIN>
      </ext:ExtraTimeRedemptionRequest>
   </soapenv:Body>
</soapenv:Envelope>`;
    try {
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlRequest, timeout: 5000}); // Optional timeout parameter(milliseconds)

        const {body} = response;

        let jsonObj = parser.parse(body, options);
        let result = jsonObj.Envelope.Body;
        if (result.ExtraTimeRedemptionResult && result.ExtraTimeRedemptionResult.ServiceRequestID) {
            let serviceRequestID = result.ExtraTimeRedemptionResult.ServiceRequestID;
            res.json({status: 0, reason: "success", serviceRequestId: serviceRequestID})

        }


    } catch (err) {
        let errorBody = err.toString();
        if (parser.validate(errorBody) === true) {
            let jsonObj = parser.parse(errorBody, options);
            if (jsonObj.Envelope.Body.Fault) {
                let soapFault = jsonObj.Envelope.Body.Fault;
                let faultString = soapFault.faultstring;
                console.log(faultString);
                let errorcode = soapFault.detail.ExtraTimeRedemptionFault.errorCode;
                console.log(errorcode)
                switch (errorcode) {
                    case 31:
                        faultString = `Subscriber number ${subscriberNumber} is not active `;
                        break;
                    case 32:
                        faultString = `Code ${code} is not valid`;
                        break;

                    default:
                        faultString = "System Error";

                }
                return res.json({status: 1, reason: faultString, serviceRequestId: null})

            }


        }

        console.log(errorBody)
        res.json({error: "System Failure"})

    }

})

router.post("/gift", passport.authenticate('basic', {
    session: false
}), async (req, res) => {

    const {error} = validator.validateGift(req.body);
    if (error) {
        return res.json({
            status: 2,
            reason: error.message
        })
    }
    const {donorNumber, recipientNumber, channel, amount, transactionId} = req.body;
    if (channel.toLowerCase() !== req.user.channel) {
        return res.json({
            status: 2,
            reason: `Invalid Request channel ${channel}`
        })
    }

    if (amount % 100 !== 0) return res.json({status: 1, reason: "Amount should be multiples of 100MB"})

    const url = "http://172.25.39.16:2222";
    const sampleHeaders = {
        'User-Agent': 'NodeApp',
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'http://SCLINSMSVM01P/wsdls/Surfline/VoucherRecharge_USSD/VoucherRecharge_USSD',
        'Authorization': `${process.env.OSD_AUTH}`
    };

    let xmlRequest = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:gif="http://SCLINSMSVM01P/wsdls/Surfline/Gifting.wsdl">
   <soapenv:Header/>
   <soapenv:Body>
      <gif:GiftingRequest>
         <CC_Calling_Party_Id>${donorNumber}</CC_Calling_Party_Id>
         <CHANNEL>${channel}</CHANNEL>
         <TRANSACTION_ID>${transactionId}</TRANSACTION_ID>
         <Recipient_Number>${recipientNumber}</Recipient_Number>
         <AMOUNT>${amount}</AMOUNT>
      </gif:GiftingRequest>
   </soapenv:Body>
</soapenv:Envelope>`;
    try {
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlRequest, timeout: 5000}); // Optional timeout parameter(milliseconds)

        const {body} = response;

        let jsonObj = parser.parse(body, options);
        let result = jsonObj.Envelope.Body;
        if (result.GiftingResult && result.GiftingResult.ServiceRequestID) {
            let serviceRequestID = result.GiftingResult.ServiceRequestID;
            res.json({status: 0, reason: "success", serviceRequestId: serviceRequestID})

        }


    } catch (err) {
        let errorBody = err.toString();
        if (parser.validate(errorBody) === true) {
            let jsonObj = parser.parse(errorBody, options);
            if (jsonObj.Envelope.Body.Fault) {
                let soapFault = jsonObj.Envelope.Body.Fault;
                let faultString = soapFault.faultstring;
                console.log(faultString);
                let errorcode = soapFault.detail.GiftingFault.errorCode;
                console.log(errorcode)
                switch (errorcode) {
                    case 67:
                        faultString = `${amount} is less than the minimum.Minimum value is 1000MB `;
                        break;
                    case 71:
                        faultString = `Donor account ${donorNumber} is not eligible. You can transfer 15 days after top-up`;
                        break;
                    case 69:
                        faultString = `Exceed maximum number of transfers in the month`;
                        break;
                    case 60:
                        faultString = `Donor account ${donorNumber} is not active`;
                        break;
                    case 65:
                        faultString = `Transfer is not allowed on same account`;
                        break;
                    default:
                        faultString = "System Error";

                }
                return res.json({status: 1, reason: faultString, serviceRequestId: null})
            }

        }

        console.log(errorBody)
        res.json({error: "System Failure"})

    }

})

router.get("/balance_ep", passport.authenticate('basic', {
    session: false
}), async (req, res) => {
    let {accountId, channel} = req.query;
    const {error} = validator.validateBalanceQueryEp({accountId, channel});
    if (error) {
        return res.json({
            status: 2,
            reason: error.message
        })
    }
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


    const url = "http://172.25.39.13:3003";
    const sampleHeaders = {
        'User-Agent': 'NodeApp',
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': 'urn:CCSCD1_QRY',
    };

    let xmlRequest = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pi="http://xmlns.oracle.com/communications/ncc/2009/05/15/pi">
   <soapenv:Header/>
   <soapenv:Body>
      <pi:CCSCD1_QRY>
         <pi:username>${process.env.PI_USER}</pi:username>
         <pi:password>${process.env.PI_PASS}</pi:password>
         <pi:MSISDN>${accountId}</pi:MSISDN>
         <pi:LIST_TYPE>BALANCE</pi:LIST_TYPE>
         <pi:WALLET_TYPE>Primary</pi:WALLET_TYPE>
         <pi:BALANCE_TYPE>General Cash</pi:BALANCE_TYPE>
      </pi:CCSCD1_QRY>
   </soapenv:Body>
</soapenv:Envelope>`;

    try {
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlRequest, timeout: 5000}); // Optional timeout parameter(milliseconds)

        const {body} = response;
        let balance = null;

        if (parser.validate(body) === true) { //optional (it'll return an object in case it's not valid)
            let jsonObj = parser.parse(body, options);
            if (jsonObj.Envelope.Body.CCSCD1_QRYResponse && jsonObj.Envelope.Body.CCSCD1_QRYResponse.BALANCE) {
                balance = jsonObj.Envelope.Body.CCSCD1_QRYResponse.BALANCE.toString();
                if (balance) {
                    balance = parseFloat((parseFloat(balance) / 100).toFixed(2));
                    return res.json(
                        {
                            status: 0,
                            reason: "success",
                            balance: balance.toLocaleString()
                        })
                }


            } else {
                let soapFault = jsonObj.Envelope.Body.Fault;
                let faultString = soapFault.faultstring;
                console.log(soapFault);
                return res.json(
                    {
                        status: 1,
                        reason: faultString,
                    })


            }

        }


    } catch (error) {
        console.log(error)
        res.json(
            {
                status: 1,
                reason: "System Failure",
            })


    }


});

router.get("/msisdn", passport.authenticate('basic', {
    session: false
}), async (req, res) => {
    let {iccId, channel} = req.query;
    const {error} = validator.validateGetNumber({iccId, channel});
    if (error) {
        console.log(JSON.stringify(error))
        return res.json({
            status: 2,
            reason: error.message.includes("required pattern") ? `${iccId} is invalid format.Please check back of sim card for correct serial id` : error.message
        })
    }
    if (channel.toLowerCase() !== req.user.channel) {
        return res.json({
            status: 2,
            reason: `Invalid Request channel ${channel}`
        })
    }

    let url = `http://172.25.37.23:8080/USSDgetNumber/services/getNumber/${iccId}`
    try {
        const {data} = await axios.get(url, {timeout: 10000})
        if (data.statusCode === "0") {
            return res.json({
                status: 0,
                reason: "success",
                subscriberNumber: data.subscriberNumber
            })
        } else {
            res.json({
                status: 1,
                reason: "Invalid serial entered. Please check back of sim"
            })
        }
    } catch (ex) {
        console.log(ex)
        res.json({
            status: 1,
            reason: "System Error"
        })
    }


});

router.post("/cash", passport.authenticate('basic', {session: false}), async (req, res) => {
    const {error} = validator.validateCashCredit(req.body);
    if (error) {
        console.log(JSON.stringify(error))
        return res.json({
            status: 2,
            reason: error.message.includes("required pattern") ? `${iccId} is invalid format.Please check back of sim card for correct serial id` : error.message
        })
    }

    const {amount, subscriberNumber, transactionId, channel} = req.body
    if (channel.toLowerCase() !== req.user.channel) {
        return res.json({
            status: 2,
            reason: `Invalid Request channel ${channel}`
        })
    }


    try {
        const url = "http://172.25.39.16:2222";
        const sampleHeaders = {
            'User-Agent': 'NodeApp',
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': 'http://SCLINSMSVM01P/wsdls/Surfline/VoucherRecharge_USSD/VoucherRecharge_USSD',
            'Authorization': `${process.env.OSD_AUTH}`
        };

        const XML = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cus="http://172.25.39.13/wsdls/Surfline/CustomRecharge.wsdl">
       <soapenv:Header/>
       <soapenv:Body>
          <cus:CustomRechargeRequest>
             <CC_Calling_Party_Id>${subscriberNumber}</CC_Calling_Party_Id>
             <Recharge_List_List>
                <Recharge_List>
                   <Balance_Type_Name>General Cash</Balance_Type_Name>
                   <Recharge_Amount>${amount}</Recharge_Amount>
                   <Balance_Expiry_Extension_Period/>
                   <Balance_Expiry_Extension_Policy/>
                   <Bucket_Creation_Policy/>
                   <Balance_Expiry_Extension_Type/>
                </Recharge_List>
             </Recharge_List_List>
             <Balance_Type_Name>General Cash</Balance_Type_Name>
             <CHANNEL>${channel}</CHANNEL>
             <TRANSACTION_ID>${transactionId}</TRANSACTION_ID>
             <WALLET_TYPE>Primary</WALLET_TYPE>
          </cus:CustomRechargeRequest>
       </soapenv:Body>
    </soapenv:Envelope>`;
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: XML, timeout: 10000});
        const {body} = response;
        let jsonObj = parser.parse(body, options);
        const soapResponseBody = jsonObj.Envelope.Body;
        if (!soapResponseBody.CustomRechargeResult) {
            res.json({status: 0, reason: "success"})
        } else {
            res.json({status: 1, reason: "System Error"})
        }
    } catch (err) {
        let errorBody = err.toString();
        if (parser.validate(errorBody) === true) {
            let jsonObj = parser.parse(errorBody, options);
            if (jsonObj.Envelope.Body.Fault) {
                let soapFault = jsonObj.Envelope.Body.Fault;
                let faultString = soapFault.faultstring;
                console.log(faultString);
                let errorcode = soapFault.detail.CustomRechargeFault.errorCode;
                switch (errorcode) {
                    case 60:
                        faultString = `Subscriber number ${subscriberNumber} is INVALID`;
                        break;
                    default:
                        faultString = "System Error";
                }
                return res.json({status: 1, reason: faultString})
            }

        }

        console.log(errorBody)
        res.json({error: "System Failure"})
    }
})

router.get("/usage_hist", passport.authenticate('basic', {session: false}), async (req, res) => {
    let {subscriberNumber, channel} = req.query;
    const {error} = validator.validateBalanceQuery({subscriberNumber, channel});
    if (error) {
        return res.json({
            status: 2,
            reason: error.message
        })
    }
    if (channel.toLowerCase() !== req.user.channel) {
        return res.json({
            status: 2,
            reason: `Invalid Request channel ${channel}`
        })
    }

    try {
        const url = "http://172.25.39.13:3004";
        const sampleHeaders = {
            'User-Agent': 'NodeApp',
            'Content-Type': 'text/xml;charset=UTF-8',
            'SOAPAction': 'urn:CCSCD7_QRY',
        };
        let xmlRequest = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pi="http://xmlns.oracle.com/communications/ncc/2009/05/15/pi">
       <soapenv:Header/>
       <soapenv:Body>
          <pi:CCSCD7_QRY>
             <pi:AUTH/>
             <pi:username>${process.env.PI_USER}</pi:username>
             <pi:password>${process.env.PI_PASS}</pi:password>
             <pi:MSISDN>${subscriberNumber}</pi:MSISDN>
             <pi:WALLET_TYPE>Primary</pi:WALLET_TYPE>
             <pi:EDR_TYPE>1</pi:EDR_TYPE>
             <pi:MAX_RECORDS>500</pi:MAX_RECORDS>
             <pi:DAYS/>
          </pi:CCSCD7_QRY>
       </soapenv:Body>
    </soapenv:Envelope>
    `;
        const {response} = await soapRequest({url: url, headers: sampleHeaders, xml: xmlRequest, timeout: 15000}); // Optional timeout parameter(milliseconds)
        const {body} = response;
        let jsonObj = parser.parse(body, options);
        if (jsonObj.Envelope.Body.CCSCD7_QRYResponse) {
            let finalResult = [];
            let obj = {}
            if (jsonObj['Envelope']['Body']['CCSCD7_QRYResponse']['EDRS'] && jsonObj['Envelope']['Body']['CCSCD7_QRYResponse']['EDRS']['EDR_ITEM']) {
                let result = jsonObj['Envelope']['Body']['CCSCD7_QRYResponse']['EDRS']['EDR_ITEM'];
                if (Array.isArray(result)) {
                    result.forEach(function (edr) {
                        if (!edr.EXTRA_INFORMATION.includes("NACK=INSF")) {
                            let record_date = edr.RECORD_DATE.toString().substr(0, 8);
                            let cost = (/DURATION_CHARGED=(.+?)\|/i.exec(edr.EXTRA_INFORMATION))[1]
                            cost = cost ? parseFloat(cost) : 0
                            obj[record_date] = obj[record_date] === undefined ? cost : obj[record_date] + cost
                        }
                    });

                } else {
                    let edr = result;
                    if (!edr.EXTRA_INFORMATION.includes("NACK=INSF")) {
                        let record_date = edr.RECORD_DATE.toString().substr(0, 8);
                        let cost = (/DURATION_CHARGED=(.+?)\|/i.exec(edr.EXTRA_INFORMATION))[1];
                        cost = cost ? parseFloat(cost) : 0
                        obj[record_date] = obj[record_date] === undefined ? cost : obj[record_date] + cost
                    }

                }

            }

            if (Object.keys(obj).length > 0){

                for (const [k, v] of Object.entries(obj)) {
                    finalResult.push({record_date: k, cost: v})
                }
                finalResult = finalResult.sort((a, b) => b.record_date - a.record_date).map(value => {
                    let {record_date, cost} = value
                    record_date = moment(record_date, "YYYYMMDD").format("DD-MM-YYYY")
                    cost = (cost / 1024).toFixed(3)
                    return {record_date, cost}
                })

            }

            res.json({status: 0, reason: "success", data: finalResult})

        } else {
            let soapFault = jsonObj.Envelope.Body.Fault;
            let faultString = soapFault.faultstring;
            console.log(soapFault)
            return res.json({status: 1, reason: faultString})
        }


    } catch (ex) {
        console.log(ex)
        res.json({
            status: 1,
            reason: "System Error"
        })
    }


});

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


function getReqData(req) {
    if (Object.keys(req.query).length > 0) return req.query
    else return req.body
}


