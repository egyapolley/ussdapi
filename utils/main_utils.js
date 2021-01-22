const moment = require("moment")

module.exports = {
    formatDate: (date) => {
        return moment(date, "YYYYMMDDHHmmss").format("DD-MM-YYYY HH:mm:ss")

    }
}
