module.exports = class ShopifyTask {
    constructor(taskInfo) {
        var path = require('path')
        var fs = require('fs');
        this.configDir = taskInfo.configDir
        this.connection = taskInfo.connection
        this.stopped = "false";
        this.request;
        this.key = getKey(this.configDir)
        this.taskId = taskInfo.id;
        this.site = taskInfo.site;
        this.mode = taskInfo.mode;
        this.webhookLink = JSON.parse(fs.readFileSync(path.join(this.configDir, '/userdata/settings.json'), 'utf8'))[0].webhook;
        this.mode = taskInfo.mode;
        this.productTitle;
        this.link = taskInfo.product;
        this.preloadlimit = 25;
        this.size = taskInfo.size;
        this.profilename = taskInfo.profile;
        this.checkoutURL;
        this.proxyListName = taskInfo.proxies;
        this.cartTotal;
        this.monitorDelay;
        this.errorDelay;
        this.encryptedcard;
        this.checkpointPayload = ""
        const tough = require('tough-cookie')
        this.finishedSubmittingCheckpoint = false;
        this.cookieJar = new tough.CookieJar()
        this.accounts = getAccountInfo(taskInfo.accounts, this.configDir)
        this.profile = getProfileInfo(taskInfo.profile, this.configDir)
        this.proxyArray = getProxyInfo(taskInfo.proxies, this.configDir)
        this.proxy = this.proxyArray.sample()
        this.baseLink = taskInfo.baseLink
        this.shippingPayload = {}
        this.shippingRatePayload = {}
        this.paymentPayload = {}
        let Country = require('country-state-city').Country;
        let State = require('country-state-city').State;
        for (var i = 0; i < Country.getAllCountries().length; i++) {
            if (Country.getAllCountries()[i].name === this.profile.country) {
                this.countryCode = Country.getAllCountries()[i].isoCode
                break;
            }
        }
        for (var i = 0; i < State.getStatesOfCountry(this.countryCode).length; i++) {
            if (State.getStatesOfCountry(this.countryCode)[i].name === this.profile.state) {
                this.stateCode = State.getStatesOfCountry(this.countryCode)[i].isoCode
                break;
            }
        }
        this.captchaResponse = "none"
        this.cartLink = this.baseLink + "/cart"
        this.plainLink = this.baseLink.split("https://")[1]
        this.oglink = this.link
        if (this.link.includes("*")) {
            this.quantity = this.link.split("*")[1].trim()
            this.link = this.link.split("*")[0].trim()
        } else {
            this.quantity = 1
        }
        this.insecurelink = "http://" + this.plainLink
        if (this.link.startsWith("http") && this.link.includes(this.cartLink) == false) {
            if (this.link.includes("?"))
                this.link = this.link.split("?")[0]
            this.searchMethod = "link"
        } else if (this.link.includes(this.cartLink) == true) {
            this.productVariant2 = this.link.split("/cart/")[1].split(":")[0]
            this.searchMethod = "variant"
        } else if (this.link.includes(",") == false && this.link.length == 14 && /^\d+$/.test(this.link)) {
            this.productVariant2 = this.link
            this.searchMethod = "variant"
        } else {
            this.searchMethod = "keywords"
            this.keywords = this.link.split(",")
            this.positiveKeywords = []
            this.negativeKeywords = []
            for (var i = 0; i < this.keywords.length; i++) {
                if (this.keywords[i].trim().startsWith("-"))
                    this.negativeKeywords.push(this.keywords[i].trim().substring(1))
                else
                    this.positiveKeywords.push(this.keywords[i].trim())
            }
        }
    }

    async sendFailError() {
        const got = require('got');
        this.quickTaskLink = "http://localhost:4444/quicktask?storetype=Shopify&input=" + this.baseLink + "/cart/" + this.productVariant + ":1"
        got({
                method: 'post',
                url: 'https://venetiabots.com/api/fail',
                headers: {
                    'key': this.key
                },
                json: {
                    "site": this.site,
                    "mode": this.mode,
                    "product": this.oglink,
                    "size": this.size,
                    "price": Math.trunc(this.cartTotal),
                    "timestamp": new Date(Date.now()).toISOString(),
                    "productTitle": this.productTitle,
                    "image": this.imageURL,
                    "quicktask": this.quickTaskLink
                },
                responseType: 'json'
            }).then(response => {
                this.log("Finished")
            })
            .catch(error => {
                this.log(error)
            })

        var webhooks = this.webhookLink.split(",")
        for (var i = 0; i < webhooks.length; i++) {
            got({
                    method: 'post',
                    url: webhooks[i].trim(),
                    json: {
                        "content": null,
                        "embeds": [{
                            "title": "Venetia Failed Checkout (BP) ! :octagonal_sign:",
                            "color": 14706535,
                            "fields": [{
                                    "name": "Site",
                                    "value": this.site
                                },
                                {
                                    "name": "Mode",
                                    "value": this.mode
                                },
                                {
                                    "name": "Product",
                                    "value": this.productTitle,
                                    "inline": true
                                },
                                {
                                    "name": "Query",
                                    "value": this.oglink,
                                    "inline": true
                                },
                                {
                                    "name": "Size",
                                    "value": this.size
                                },
                                {
                                    "name": "Price",
                                    "value": Math.trunc(this.cartTotal)
                                },
                                {
                                    "name": "Profile",
                                    "value": "||" + this.profilename + "||"
                                },
                                {
                                    "name": "Proxy List",
                                    "value": "||" + this.proxyListName + "||"
                                }
                            ],
                            "footer": {
                                "text": "Powered by Venetia",
                                "icon_url": "https://i.imgur.com/6h06tuW.png"
                            },
                            "timestamp": new Date(Date.now()).toISOString(),
                            "thumbnail": {
                                "url": this.imageURL
                            }
                        }],
                        "username": "Venetia",
                        "avatar_url": "https://i.imgur.com/6h06tuW.png"
                    }
                }).then(response => {
                    this.log("Finished sending webhook")
                })
                .catch(error => {
                    this.log(error.response.body)
                })
        }
    }

    async sendFail() {
        const got = require('got');
        this.quickTaskLink = "http://localhost:4444/quicktask?storetype=Shopify&input=" + this.baseLink + "/cart/" + this.productVariant + ":1"
        got({
                method: 'post',
                url: 'https://venetiabots.com/api/fail',
                headers: {
                    'key': this.key
                },
                json: {
                    "site": this.site,
                    "mode": this.mode,
                    "product": this.oglink,
                    "size": this.size,
                    "price": Math.trunc(this.cartTotal),
                    "timestamp": new Date(Date.now()).toISOString(),
                    "productTitle": this.productTitle,
                    "image": this.imageURL,
                    "quicktask": this.quickTaskLink
                },
                responseType: 'json'
            }).then(response => {
                this.log("Finished")
            })
            .catch(error => {
                this.log(error)
            })

        var webhooks = this.webhookLink.split(",")
        for (var i = 0; i < webhooks.length; i++) {
            got({
                    method: 'post',
                    url: webhooks[i].trim(),
                    json: {
                        "content": null,
                        "embeds": [{
                            "title": "Venetia Failed Checkout! :octagonal_sign:",
                            "color": 14706535,
                            "fields": [{
                                    "name": "Site",
                                    "value": this.site
                                },
                                {
                                    "name": "Mode",
                                    "value": this.mode
                                },
                                {
                                    "name": "Product",
                                    "value": this.productTitle,
                                    "inline": true
                                },
                                {
                                    "name": "Query",
                                    "value": this.oglink,
                                    "inline": true
                                },
                                {
                                    "name": "Size",
                                    "value": this.size
                                },
                                {
                                    "name": "Price",
                                    "value": Math.trunc(this.cartTotal)
                                },
                                {
                                    "name": "Profile",
                                    "value": "||" + this.profilename + "||"
                                },
                                {
                                    "name": "Proxy List",
                                    "value": "||" + this.proxyListName + "||"
                                }
                            ],
                            "footer": {
                                "text": "Powered by Venetia",
                                "icon_url": "https://i.imgur.com/6h06tuW.png"
                            },
                            "timestamp": new Date(Date.now()).toISOString(),
                            "thumbnail": {
                                "url": this.imageURL
                            }
                        }],
                        "username": "Venetia",
                        "avatar_url": "https://i.imgur.com/6h06tuW.png"
                    }
                }).then(response => {
                    this.log("Finished sending webhook")
                })
                .catch(error => {
                    this.log(error.response.body)
                })
        }
    }

    async sendSuccess() {
        const got = require('got');
        this.quickTaskLink = "http://localhost:4444/quicktask?storetype=Shopify&input=" + this.baseLink + "/cart/" + this.productVariant + ":1"
        got({
                method: 'post',
                url: 'https://venetiabots.com/api/success',
                headers: {
                    'key': this.key
                },
                json: {
                    "site": this.site,
                    "mode": this.mode,
                    "product": this.oglink,
                    "size": this.size,
                    "productTitle": this.productTitle,
                    "price": Math.trunc(this.cartTotal),
                    "timestamp": new Date(Date.now()).toISOString(),
                    "image": this.imageURL,
                    "quicktask": this.quickTaskLink
                }
            }).then(response => {
                this.log("Finished")
            })
            .catch(error => {
                this.log(error)
            })

        var webhooks = this.webhookLink.split(",")
        for (var i = 0; i < webhooks.length; i++) {
            got({
                    method: 'post',
                    url: webhooks[i].trim(),
                    json: {
                        "content": null,
                        "embeds": [{
                            "title": "Venetia Successful Checkout! :tada:",
                            "color": 5230481,
                            "fields": [{
                                    "name": "Site",
                                    "value": this.site
                                },
                                {
                                    "name": "Mode",
                                    "value": this.mode
                                },
                                {
                                    "name": "Product",
                                    "value": this.productTitle,
                                    "inline": true
                                },
                                {
                                    "name": "Query",
                                    "value": this.oglink,
                                    "inline": true
                                },
                                {
                                    "name": "Size",
                                    "value": this.size
                                },
                                {
                                    "name": "Price",
                                    "value": Math.trunc(this.cartTotal)
                                },
                                {
                                    "name": "Profile",
                                    "value": "||" + this.profilename + "||"
                                },
                                {
                                    "name": "Proxy List",
                                    "value": "||" + this.proxyListName + "||"
                                }
                            ],
                            "footer": {
                                "text": "Powered by Venetia",
                                "icon_url": "https://i.imgur.com/6h06tuW.png"
                            },
                            "timestamp": new Date(Date.now()).toISOString(),
                            "thumbnail": {
                                "url": this.imageURL
                            }
                        }],
                        "username": "Venetia",
                        "avatar_url": "https://i.imgur.com/6h06tuW.png"
                    }
                }).then(response => {
                    this.log("Finished sending webhook")
                })
                .catch(error => {
                    this.log(error)
                })
        }
    }

    async formatCard() {
        await this.send("Formatting card...")
        if (this.profile.cardNumber.length == 16) {
            var x = this.profile.cardNumber
            var y = "";
            for (var i = 0; i < x.length; i = i + 4) {
                y += x.substring(i, i + 4)
                if (i != x.length - 1)
                    y += " "
            }
            this.profile.cardNumber = y;
        } else if (this.profile.cardNumber.length == 15) {
            var x = this.profile.cardNumber
            var y = ""
            y += x.substring(0, 4)
            y += " "
            y += x.substring(4, 10)
            y += " "
            y += x.substring(10)
            this.profile.cardNumber = y;
        } else {
            await this.send("Error invalid card length")
        }
    }

    async submitCard() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Presubmitting card...")
            try {
                this.request = {
                    method: 'post',
                    url: "https://deposit.us.shopifycs.com/sessions",
                    headers: {
                        'Connection': 'keep-alive',
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'Accept': 'application/json',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'Content-Type': 'application/json',
                        'Origin': 'https://checkout.shopifycs.com',
                        'Sec-Fetch-Site': 'same-site',
                        'Sec-Fetch-Mode': 'cors',
                        'Sec-Fetch-Dest': 'empty',
                        'Referer': 'https://checkout.shopifycs.com/',
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                    json: {
                        "credit_card": {
                            "number": this.profile.cardNumber,
                            "name": this.profile.firstName + " " + this.profile.lastName,
                            "month": parseInt(this.profile.expiryMonth),
                            "year": parseInt(this.profile.expiryYear),
                            "verification_value": this.profile.cvv
                        },
                        "payment_session_scope": this.plainLink
                    },
                    responseType: "json"
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                this.encryptedPayment = response.body.id
                if (this.stopped === "false")
                    await this.send("Submitted card")
                return;
            } catch (error) {
                await this.setDelays()
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error submitting card: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.submitCard()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error submitting card")
                    await sleep(this.errorDelay)
                    await this.submitCard()
                }
            }
        }
    }

    async login() {
        const got = require('got');
        const tunnel = require('tunnel');
        const querystring = require('querystring')
        if (this.stopped === "false") {
            await this.send("Logging in...")
            try {
                this.request = {
                    method: 'post',
                    url: this.baseLink + "/account/login",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'accept': 'application/json, text/javascript, */*; q=0.01',
                        'x-requested-with': 'XMLHttpRequest',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9'
                    },
                    body: querystring.encode({
                        'form_type': 'customer_login',
                        'utf8': '✓',
                        'customer[email]': this.accounts.email,
                        'customer[password]': this.accounts.password,
                        'return_url': "/account"
                    }),
                    followRedirect: false
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
            } catch (error) {
                await this.setDelays()
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error logging in: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.login()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error logging in")
                    await sleep(this.errorDelay)
                    await this.login()
                }
            }
        }
    }

    async findRandomItem() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Preloading...")
            try {
                this.request = {
                    method: 'get',
                    url: this.baseLink + "/products.json?limit=" + this.preloadlimit,
                    cookieJar: this.cookieJar,
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                for (var i = 0; i < response.body.products.length; i++) {
                    for (var j = 0; j < response.body.products[i].variants.length; j++) {
                        if (response.body.products[i].variants[j].available == true) {
                            this.productVariant = response.body.products[i].variants[j].id
                            await this.send("Found product")
                            return;
                        }
                    }
                }
                throw ("Error preloading")
            } catch (error) {
                await this.setDelays()
                if (error === "Error preloading") {
                    await this.send("Error preloading")
                    this.preloadlimit += 25
                    await this.findRandomItem()
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error preloading: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.findRandomItem()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error preloading")
                    await sleep(this.errorDelay)
                    await this.findRandomItem()
                }
            }
        }
    }

    async waitForCheckpoint() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Waiting for checkpoint...")
            try {
                this.request = {
                    method: 'get',
                    url: this.baseLink + "/checkout",
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
                    },
                    followRedirect: false
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                if (response.body.includes("/checkpoint") == false)
                    throw "Waiting for checkpoint"
            } catch (error) {
                await this.setDelays()
                if (error === "Waiting for checkpoint") {
                    await this.send("Waiting for checkpoint...")
                    await sleep(this.monitorDelay)
                    await this.waitForCheckpoint()
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    await this.send("Error waiting: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.waitForCheckpoint()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error waiting")
                    await sleep(this.errorDelay)
                    await this.waitForCheckpoint()
                }
            }
        }
    }

    async clearCart() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Clearing cart...")
            try {
                this.request = {
                    method: 'post',
                    url: this.baseLink + "/cart/clear.js",
                    cookieJar: this.cookieJar,
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                if (response.body.items.length != 0 && response.body.items['item_count'] != 0)
                    throw "Error clearing cart"
            } catch (error) {
                await this.setDelays()
                if (error === "Error clearing cart") {
                    await this.send("Error clearing cart")
                    await sleep(this.errorDelay)
                    await this.clearCart()
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error clearing cart: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.clearCart()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error clearing cart")
                    await sleep(this.errorDelay)
                    await this.clearCart()
                }
            }
        }
    }

    async findProductByKeywords() {
        const got = require('got');
        const tunnel = require('tunnel');
        this.cookie = "shopify_digest=" + await makeid(7)
        this.cookieJar.setCookie(this.cookie + '; Domain=' + this.plainLink + '; Path=/; Secure; SameSite=Lax; hostOnly=false; aAge=10ms; cAge=10ms', this.baseLink)
        if (this.stopped === "false") {
            await this.send("Monitoring keywords...")
            try {
                this.request = {
                    method: 'get',
                    url: this.baseLink + "/products.json?limit=25",
                    cookieJar: this.cookieJar,
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                var positiveMatch = true;
                var negativeMatch = true;
                var index;
                for (var i = 0; i < response.body.products.length; i++) {
                    for (var j = 0; j < this.positiveKeywords.length; j++) {
                        if (response.body.products[i].title.toLowerCase().includes(this.positiveKeywords[j].toLowerCase()) == false)
                            positiveMatch = false;
                    }
                    for (var k = 0; k < this.negativeKeywords.length; k++) {
                        if (response.body.products[i].title.toLowerCase().includes(this.negativeKeywords[k].toLowerCase()) == true)
                            negativeMatch = false;
                    }
                    if (positiveMatch && negativeMatch) {
                        index = i;
                        break;
                    } else {
                        positiveMatch = true;
                        negativeMatch = true;
                    }
                }
                if (typeof index === 'undefined')
                    throw "Waiting for product"
                response.body.product = response.body.products[index]
                this.productTitle = response.body.product.title
                try {
                    this.imageURL = response.body.product.images[0].src
                } catch (error) {
                    this.log("No image")
                }
                await this.sendProductTitle(this.productTitle)
                if (this.size === "RS") {
                    this.productVariant = response.body.product.variants.sample().id;
                    await this.send("Found product")
                    return;
                } else {
                    for (var i = 0; i < response.body.product.variants.length; i++) {
                        if (response.body.product.variants[i].title.includes(this.size)) {
                            this.productVariant = response.body.product.variants[i].id;
                            await this.send("Found product")
                            return;
                        }
                    }
                }
                throw "Error finding variant"
            } catch (error) {
                await this.setDelays()
                if (error === "Error finding variant") {
                    await this.send("Waiting for size...")
                    await sleep(this.monitorDelay)
                    await this.findProductByKeywords()
                } else
                if (error === "Waiting for product") {
                    await sleep(this.monitorDelay)
                    await this.findProductByKeywords()
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    if (error.response.statusCode === 404) {
                        await sleep(this.monitorDelay)
                        await this.findProductByKeywords()
                    } else {
                        await this.send("Error finding product: " + error.response.statusCode)
                        await sleep(this.errorDelay)
                        await this.findProductByKeywords()
                    }
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error finding variant")
                    await sleep(this.errorDelay)
                    await this.findProductByKeywords()
                }
            }
        }
    }

    async findProductByLink() {
        const got = require('got');
        const tunnel = require('tunnel');
        this.cookie = "shopify_digest=" + await makeid(7)
        this.cookieJar.setCookie(this.cookie + '; Domain=' + this.plainLink + '; Path=/; Secure; SameSite=Lax; hostOnly=false; aAge=10ms; cAge=10ms', this.baseLink)
        if (this.stopped === "false") {
            await this.send("Monitoring link...")
            try {
                this.request = {
                    method: 'get',
                    url: this.link + ".json",
                    cookieJar: this.cookieJar,
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                if (this.site.includes("DSM Eflash")) {
                    this.request.url = this.link
                    this.request.responseType = 'text'
                }
                let response = await got(this.request);
                if (response.url.includes("/password"))
                    throw "Password page up"
                if (this.site.includes("DSM Eflash")) {
                    var HTMLParser = require('node-html-parser');
                    var root = HTMLParser.parse(response.body);
                    response.body = {}
                    response.body.product = JSON.parse(root.querySelector('[id="ProductJson-product-template"]').rawText)
                }
                this.productTitle = response.body.product.title
                try {
                    this.imageURL = response.body.product.image.src
                } catch (error) {
                    this.log("No image")
                }
                await this.sendProductTitle(this.productTitle)
                if (this.size === "RS") {
                    this.productVariant = response.body.product.variants.sample().id;
                    await this.send("Found product")
                    return;
                } else {
                    for (var i = 0; i < response.body.product.variants.length; i++) {
                        if (response.body.product.variants[i].title.includes(this.size)) {
                            this.productVariant = response.body.product.variants[i].id;
                            await this.send("Found product")
                            return;
                        }
                    }
                }
                throw "Error finding variant"
            } catch (error) {
                await this.setDelays()
                if (error === "Error finding variant") {
                    await this.send("Waiting for size...")
                    await sleep(this.monitorDelay)
                    await this.findProductByLink()
                } else
                if (error === "Password page up") {
                    await this.send("Password page up")
                    await sleep(this.monitorDelay)
                    await this.findProductByLink()
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    if (error.response.statusCode === 404) {
                        await sleep(this.monitorDelay)
                        await this.findProductByLink()
                    } else {
                        this.log(error.response.body)
                        await this.send("Error finding product: " + error.response.statusCode)
                        await sleep(this.errorDelay)
                        await this.findProductByLink()
                    }
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error finding variant")
                    await sleep(this.errorDelay)
                    await this.findProductByLink()
                }
            }
        }
    }

    async findProductByVariant() {
        const got = require('got');
        const tunnel = require('tunnel');
        this.cookie = "shopify_digest=" + await makeid(7)
        this.cookieJar.setCookie(this.cookie + '; Domain=' + this.plainLink + '; Path=/; Secure; SameSite=Lax; hostOnly=false; aAge=10ms; cAge=10ms', this.baseLink)
        if (this.stopped === "false") {
            await this.send("Monitoring variant...")
            try {
                this.request = {
                    method: 'get',
                    url: this.baseLink + "/variants/" + this.productVariant2 + ".js",
                    cookieJar: this.cookieJar,
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                if (response.url.includes("/password"))
                    throw "Password page up"
                this.productTitle = response.body.name
                this.productVariant = response.body.id
                await this.sendProductTitle(this.productTitle)
            } catch (error) {
                await this.setDelays()
                if (error === "Password page up") {
                    await this.send("Password page up")
                    await sleep(this.monitorDelay)
                    await this.findProductByVariant()
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    if (error.response.statusCode === 404) {
                        await sleep(this.monitorDelay)
                        await this.findProductByVariant()
                    } else {
                        this.log(error.response.body)
                        await this.send("Error finding product: " + error.response.statusCode)
                        await sleep(this.errorDelay)
                        await this.findProductByVariant()
                    }
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error finding variant")
                    await sleep(this.errorDelay)
                    await this.findProductByVariant()
                }
            }
        }
    }

    async addToCart() {
        const got = require('got');
        const tunnel = require('tunnel');
        const querystring = require('querystring')
        if (this.stopped === "false") {
            this.log(this.productVariant)
            await this.send("Adding to cart...")
            try {
                this.request = {
                    method: 'post',
                    url: this.baseLink + '/cart/add.js',
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'accept': 'application/json, text/javascript, */*; q=0.01',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                    },
                    body: querystring.encode({
                        'utf8': '\u2713',
                        'id': this.productVariant,
                        'quantity': this.quantity
                    }),
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                await this.send("Carted")
                for (var i = 0; i < response.headers['set-cookie'].length; i++) {
                    if (response.headers['set-cookie'][i].includes("cart=")) {
                        this.cartToken = response.headers['set-cookie'][i].split(";")[0].split("cart=")[1]
                        break;
                    }
                }
                return;
            } catch (error) {
                await this.setDelays()
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    await this.send("Error adding to cart: " + error.response.statusCode)
                    this.log(error.response.body)
                    await sleep(this.errorDelay)
                    await this.addToCart()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected ATC error")
                    await sleep(this.errorDelay)
                    await this.addToCart()
                }
            }
        }
    }

    async loadCheckoutforPreload() {
        const got = require('got');
        const tunnel = require('tunnel');
        const querystring = require('querystring')
        if (this.stopped === "false") {
            await this.send("Loading checkout...")
            try {
                this.request = {
                    method: 'get',
                    url: this.baseLink + "/checkout",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'accept': 'application/json, text/javascript, */*; q=0.01',
                        'x-requested-with': 'XMLHttpRequest',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'referer': this.baseLink
                    }
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                this.log(response.url)
                if (response.url.includes("/checkpoint")) {
                    await this.send("Found checkpoint")
                    var HTMLParser = require('node-html-parser');
                    var root = HTMLParser.parse(response.body);
                    if (this.stopped === "false")
                        await this.sendCaptchaCheckpoint()

                    if (this.stopped === "false")
                        await this.retrieveCaptchaResponse()

                    await this.loadCheckoutforPreload()
                } else if (response.url.includes("/queue")) {
                    for (var i = 0; i < response.headers['set-cookie'].length; i++) {
                        if (response.headers['set-cookie'][i].includes("_checkout_queue_token")) {
                            this.checkoutQueueToken = response.headers['set-cookie'][i].split(";")[0].split("_checkout_queue_token=")[1]
                            break;
                        }
                    }
                    if (this.stopped === "false") {
                        await this.pollQueue()
                        await this.loadCheckoutforPreload()
                    }
                }
            } catch (error) {
                await this.setDelays()
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error loading checkout: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.loadCheckoutforPreload()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error loading checkout")
                    await sleep(this.errorDelay)
                    await this.loadCheckoutforPreload()
                }
            }
        }
    }

    async loadCheckout() {
        const got = require('got');
        const tunnel = require('tunnel');
        const querystring = require('querystring')
        if (this.stopped === "false") {
            await this.send("Loading checkout...")
            try {
                this.request = {
                    method: 'get',
                    url: this.baseLink + "/checkout",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'accept': 'application/json, text/javascript, */*; q=0.01',
                        'x-requested-with': 'XMLHttpRequest',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'referer': this.baseLink
                    }
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                if (response.url.includes("/checkpoint")) {
                    await this.send("Found checkpoint")
                    var HTMLParser = require('node-html-parser');
                    var root = HTMLParser.parse(response.body);
                    if (this.stopped === "false")
                        await this.sendCaptchaCheckpoint()

                    if (this.stopped === "false")
                        await this.retrieveCaptchaResponse()

                    await this.loadCheckout()
                } else if (response.url.includes("/queue")) {
                    for (var i = 0; i < response.headers['set-cookie'].length; i++) {
                        if (response.headers['set-cookie'][i].includes("_checkout_queue_token")) {
                            this.checkoutQueueToken = response.headers['set-cookie'][i].split(";")[0].split("_checkout_queue_token=")[1]
                            break;
                        }
                    }
                    if (this.stopped === "false") {
                        await this.pollQueue()
                        await this.loadCheckout()
                    }
                } else if (response.headers['content-location'] != null && response.headers['content-location'].includes("/login") && this.stopped === "false") {
                    throw "Error: Account required"
                } else if (response.headers['content-location'] != null && response.headers['content-location'].includes("/stock_problems") && this.stopped === "false") {
                    throw "Waiting for restock"
                } else if (this.stopped === "false") {
                    this.checkoutURL = response.url
                    if (this.stopped === "false")
                        await this.sendCaptchaCheckpoint()

                    if (this.stopped === "false")
                        await this.retrieveCaptchaResponse()
                    var HTMLParser = require('node-html-parser');
                    var root = HTMLParser.parse(response.body);
                    this.authToken = root.querySelector('[name="authenticity_token"]').getAttribute('value')
                    if (this.stopped === "false")
                        await this.send("Loaded checkout")
                    this.test = "_method=patch" //patch
                    this.test += "&authenticity_token=" + this.authToken //auth token
                    this.test += "&previous_step=contact_information" //previous step
                    this.test += "&step=shipping_method" //shipping method
                    if (root.querySelector('[id="checkout_email_or_phone"]') != null) {
                        this.test += "&checkout%5Bemail_or_phone%5D=" + encodeURIComponent(this.profile.email)
                    } else {
                        this.test += "&checkout%5Bemail%5D=" + encodeURIComponent(this.profile.email) //email
                    }
                    this.test += "&checkout%5Bbuyer_accepts_marketing%5D=0"
                    this.test += "&checkout%5Bbuyer_accepts_marketing%5D=1"
                    if (root.querySelector('[id="checkout_pick_up_in_store_selected"]') != null) {
                        this.test += "&checkout%5Bpick_up_in_store%5D%5Bselected%5D=false" //delivery
                        this.test += "&checkout%5Bid%5D=delivery-shipping" //delivery
                    }
                    this.test += "&checkout%5Bshipping_address%5D%5Bfirst_name%5D="
                    this.test += "&checkout%5Bshipping_address%5D%5Blast_name%5D="
                    if (root.querySelector('[id="checkout_shipping_address_company"]') != null) {
                        this.test += "&checkout%5Bshipping_address%5D%5Bcompany%5D=" //company field
                    }
                    this.test += "&checkout%5Bshipping_address%5D%5Baddress1%5D="
                    this.test += "&checkout%5Bshipping_address%5D%5Baddress2%5D="
                    this.test += "&checkout%5Bshipping_address%5D%5Bcity%5D="
                    this.test += "&checkout%5Bshipping_address%5D%5Bcountry%5D="
                    this.test += "&checkout%5Bshipping_address%5D%5Bprovince%5D="
                    this.test += "&checkout%5Bshipping_address%5D%5Bzip%5D="
                    this.test += "&checkout%5Bshipping_address%5D%5Bphone%5D="
                    this.test += "&checkout%5Bshipping_address%5D%5Bfirst_name%5D=" + this.profile.firstName //first name
                    this.test += "&checkout%5Bshipping_address%5D%5Blast_name%5D=" + this.profile.lastName //last name
                    if (root.querySelector('[id="checkout_shipping_address_company"]') != null) {
                        this.test += "&checkout%5Bshipping_address%5D%5Bcompany%5D=" //company field
                    }
                    this.test += "&checkout%5Bshipping_address%5D%5Baddress1%5D=" + this.profile.address1.replaceAll(" ", "+") //address 1
                    this.test += "&checkout%5Bshipping_address%5D%5Baddress2%5D="
                    this.test += "&checkout%5Bshipping_address%5D%5Bcity%5D=" + this.profile.city.replaceAll(" ", "+") //city
                    this.test += "&checkout%5Bshipping_address%5D%5Bcountry%5D=" + this.profile.country.replaceAll(" ", "+") //country
                    this.test += "&checkout%5Bshipping_address%5D%5Bprovince%5D=" + this.stateCode //state
                    this.test += "&checkout%5Bshipping_address%5D%5Bzip%5D=" + this.profile.zipcode //zipcode
                    this.test += "&checkout%5Bshipping_address%5D%5Bphone%5D=" + "%28" + this.profile.phone.substring(0, 3) + "%29" + "+" + this.profile.phone.substring(3, 6) + "-" + this.profile.phone.substring(6) //phone number
                    if (root.querySelector('[id="checkout_remember_me"]') != null) {
                        this.test += "&checkout%5Bremember_me%5D=" //remember me
                        this.test += "&checkout%5Bremember_me%5D=0"
                    }
                    if (root.querySelector('[id="i-agree__checkbox"]') != null) {
                        this.test += "&checkout%5Battributes%5D%5BI-agree-to-the-Terms-and-Conditions%5D=Yes" //agree
                    }
                    if (root.querySelector('[value="fs_count"]') != null) {
                        this.test += "&"
                        this.fscount = root.querySelector('[value="fs_count"]').getAttribute('name')
                        this.searchBy = this.fscount.split("-count")[0]
                        this.searchBy = "#fs_" + this.searchBy
                        var count = 0;
                        this.values = root.querySelector(this.searchBy)
                        for (var i = 0; i < this.values.childNodes.length; i++) {
                            if (this.values.childNodes[i].tagName === "TEXTAREA") {
                                count++;
                                var id = this.values.childNodes[i].getAttribute('id')
                                this.shippingPayload[id] = "";
                            }
                        }

                        this.test2 = querystring.encode(this.shippingPayload)
                        var totalfscount = "&" + this.fscount + "=" + count
                        totalfscount = totalfscount + "&" + this.fscount + "=fs_count"
                        this.test2 = this.test2 + totalfscount
                        this.shippingPayload = this.test + this.test2
                    } else {
                        this.shippingPayload = this.test
                    }
                    this.shippingPayload = this.shippingPayload + "&checkout%5Bclient_details%5D%5Bbrowser_width%5D=1583&checkout%5Bclient_details%5D%5Bbrowser_height%5D=789&checkout%5Bclient_details%5D%5Bjavascript_enabled%5D=1&checkout%5Bclient_details%5D%5Bcolor_depth%5D=24&checkout%5Bclient_details%5D%5Bjava_enabled%5D=false&checkout%5Bclient_details%5D%5Bbrowser_tz%5D=240"
                    this.log(this.shippingPayload)
                }
            } catch (error) {
                await this.setDelays()
                if (error === "Error: Account required") {
                    await this.send("Error: Account required")
                    await sleep(this.errorDelay)
                    await this.loadCheckout()
                } else
                if (error === "Waiting for restock") {
                    await this.send("Waiting for restock")
                    await sleep(this.errorDelay)
                    await this.loadCheckout()
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error loading checkout: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.loadCheckout()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error loading checkout")
                    await sleep(this.errorDelay)
                    await this.loadCheckout()
                }
            }
        }
    }

    async sendCaptchaCheckpoint() {
        if (this.stopped === "false") {
            this.connection.send(JSON.stringify({
                event: "sendCaptcha",
                data: {
                    "captchaURL": this.baseLink + "/checkpoint",
                    "captchaType": "Shopify Checkpoint",
                    "sessionCookies": this.cookieJar,
                    "taskID": this.taskId,
                    "taskProxy": this.proxy,
                    "siteURL": this.baseLink
                }
            }))
            await this.send("Waiting for captcha...")
        }
    }

    async pollQueue() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Polling queue...")
            try {
                this.request = {
                    method: 'post',
                    url: this.baseLink + "/queue/poll",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'content-type': 'application/json',
                        'accept': '*/*',
                        'origin': this.baseLink,
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'referer': this.baseLink + '/throttle/queue',
                        'accept-language': 'en-US,en;q=0.9',
                    },
                    json: {
                        "query": "\n      {\n        poll(token: $token) {\n          token\n          pollAfter\n          queueEtaSeconds\n          productVariantAvailability {\n            id\n            available\n          }\n        }\n      }\n    ",
                        "variables": {
                            "token": this.checkoutQueueToken
                        },
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                this.checkoutQueueToken = response.body.data.poll.token
                var now = new Date(Date.now())
                var then = new Date(response.body.data.poll.pollAfter)
                await this.send("In queue - ETA: " + response.body.data.poll.queueEtaSeconds + "s")
                await sleep(Math.abs(then - now))
                if (response.body.data.poll['__typename'] === "PollContinue")
                    await this.pollQueue()
                else if (response.body.data.poll['__typename'] === "PollComplete")
                    return;
                else
                    throw ("Error polling queue")
            } catch (error) {
                await this.setDelays()
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error polling queue: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.pollQueue()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error polling queue")
                    await sleep(this.errorDelay)
                    await this.pollQueue()
                }
            }
        }
    }

    async pollQueueFast() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Polling queue...")
            try {
                this.request = {
                    method: 'post',
                    url: this.baseLink + "/queue/poll",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'content-type': 'application/json',
                        'accept': '*/*',
                        'origin': this.baseLink,
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'referer': this.baseLink + '/throttle/queue',
                        'accept-language': 'en-US,en;q=0.9',
                        'x-shopify-storefront-access-token': this.accessToken,
                    },
                    json: {
                        "query": "{ poll(token: $token) { token pollAfter } }",
                        "variables": {
                            "token": this.checkoutQueueToken
                        },
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                this.checkoutQueueToken = response.body.data.poll.token
                var now = new Date(Date.now())
                var then = new Date(response.body.data.poll.pollAfter)
                await this.send("In queue")
                await sleep(Math.abs(then - now))
                if (response.body.data.poll['__typename'] === "PollContinue")
                    await this.pollQueueFast()
                else if (response.body.data.poll['__typename'] === "PollComplete")
                    return;
                else
                    throw ("Error polling queue")
            } catch (error) {
                await this.setDelays()
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error polling queue: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.pollQueueFast()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error polling queue")
                    await sleep(this.errorDelay)
                    await this.pollQueueFast()
                }
            }
        }
    }

    async retrieveCaptchaResponse() {
        while (this.finishedSubmittingCheckpoint == false) {
            await sleep(100)
        }
        return;
    }


    async submitShipping() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Submitting shipping...")
            try {
                this.request = {
                    method: 'post',
                    url: this.checkoutURL,
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'accept': 'application/json, text/javascript, */*; q=0.01',
                        'x-requested-with': 'XMLHttpRequest',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'referer': this.baseLink
                    },
                    body: this.shippingPayload,
                    followRedirect: false
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                if (response.headers['content-location'] != null && response.headers['content-location'].includes("/stock_problems") && this.stopped === "false") {
                    throw "Waiting for restock"
                } else if (this.stopped === "false") {
                    await this.send("Submitted shipping")
                    this.log(response.statusCode)
                }
            } catch (error) {
                await this.setDelays()
                if (error === "Waiting for restock") {
                    await this.send("Waiting for restock")
                    await sleep(this.errorDelay)
                    await this.submitShipping()
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    if (error.response.statusCode === 404) {
                        await this.send("Waiting for restock")
                        await sleep(this.errorDelay)
                        await this.submitShipping()
                    } else {
                        this.log(error.response.body)
                        await this.send("Error submitting shipping: " + error.response.statusCode)
                        await sleep(this.errorDelay)
                        await this.submitShipping()
                    }
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error submitting shipping")
                    await sleep(this.errorDelay)
                    await this.submitShipping()
                }
            }
        }
    }

    async loadShippingRate() {
        const got = require('got');
        const tunnel = require('tunnel');
        const querystring = require('querystring')
        if (this.stopped === "false") {
            await this.send("Loading rates...")
            try {
                this.request = {
                    method: 'get',
                    url: this.checkoutURL + "?previous_step=contact_information&step=shipping_method",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'accept': 'application/json, text/javascript, */*; q=0.01',
                        'x-requested-with': 'XMLHttpRequest',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'referer': this.baseLink
                    }
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                var HTMLParser = require('node-html-parser');
                var root = HTMLParser.parse(response.body);
                if (response.url.includes("/checkpoint")) {
                    await this.send("Found checkpoint")
                    var HTMLParser = require('node-html-parser');
                    var root = HTMLParser.parse(response.body);
                    if (this.stopped === "false")
                        await this.sendCaptchaCheckpoint()

                    if (this.stopped === "false")
                        await this.retrieveCaptchaResponse()

                    await this.loadShippingRate()
                } else if (response.url.includes("/queue")) {
                    for (var i = 0; i < response.headers['set-cookie'].length; i++) {
                        if (response.headers['set-cookie'][i].includes("_checkout_queue_token")) {
                            this.checkoutQueueToken = response.headers['set-cookie'][i].split(";")[0].split("_checkout_queue_token=")[1]
                            break;
                        }
                    }
                    if (this.stopped === "false") {
                        await this.pollQueue()
                        await this.loadShippingRate()
                    }
                } else if (response.headers['content-location'] != null && response.headers['content-location'].includes("/stock_problems") && this.stopped === "false") {
                    throw "Waiting for restock"
                } else
                if (typeof root.querySelectorAll(".input-radio")[0] !== 'undefined') {
                    this.shippingRate = root.querySelectorAll(".input-radio")[0].getAttribute("value")
                    this.test2 = "_method=patch" //patch
                    this.test2 += "&authenticity_token=" + this.authToken //auth token 
                    this.test2 += "&previous_step=shipping_method" //previous step
                    this.test2 += "&step=payment_method" //current step
                    this.test2 += "&checkout%5Bshipping_rate%5D%5Bid%5D=" + encodeURIComponent(this.shippingRate)
                    if (root.querySelector('[id="i-agree__checkbox"]') != null) {
                        this.test2 += "&checkout%5Battributes%5D%5BI-agree-to-the-Terms-and-Conditions%5D=Yes" // agree
                    }
                    if (root.querySelector('[value="fs_count"]') != null) {
                        this.fscount = root.querySelector('[value="fs_count"]').getAttribute('name')
                        this.searchBy = this.fscount.split("-count")[0]
                        this.searchBy = "#fs_" + this.searchBy
                        var count = 0;
                        this.fscountvalues = ""
                        this.values = root.querySelector(this.searchBy)
                        for (var i = 0; i < this.values.childNodes.length; i++) {
                            if (this.values.childNodes[i].tagName === "TEXTAREA") {
                                count++;
                                this.fscountvalues += "&" + this.values.childNodes[i].getAttribute('id') + "="
                            }
                        }
                        this.test2 += this.fscountvalues
                        this.test2 += "&" + this.fscount + "=" + count + "&" + this.fscount + "=" + "fs_count"
                    }
                    this.test2 += "&checkout%5Bclient_details%5D%5Bbrowser_width%5D=1263"
                    this.test2 += "&checkout%5Bclient_details%5D%5Bbrowser_height%5D=913"
                    this.test2 += "&checkout%5Bclient_details%5D%5Bjavascript_enabled%5D=1"
                    this.test2 += "&checkout%5Bclient_details%5D%5Bcolor_depth%5D=24"
                    this.test2 += "&checkout%5Bclient_details%5D%5Bjava_enabled%5D=false"
                    this.test2 += "&checkout%5Bclient_details%5D%5Bbrowser_tz%5D=240"
                    this.shippingRatePayload = this.test2
                    this.log(this.shippingRatePayload)
                } else {
                    await sleep(300)
                    await this.loadShippingRate()
                }
                if (this.stopped === "false")
                    await this.send("Loaded rates")
                return;
            } catch (error) {
                await this.setDelays()
                if (error === "Waiting for restock") {
                    await this.send("Waiting for restock")
                    await sleep(this.errorDelay)
                    await this.loadShippingRate()
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error loading rates: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.loadShippingRate()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error loading rates")
                    await sleep(this.errorDelay)
                    await this.loadShippingRate()
                }
            }
        }
    }

    async submitRate() {
        const got = require('got');
        const tunnel = require('tunnel');
        const querystring = require('querystring')
        if (this.stopped === "false") {
            await this.send("Submitting rate...")
            try {
                this.request = {
                    method: 'post',
                    url: this.checkoutURL,
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'accept': 'application/json, text/javascript, */*; q=0.01',
                        'x-requested-with': 'XMLHttpRequest',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'referer': this.baseLink
                    },
                    body: this.shippingRatePayload,
                    followRedirect: false
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                if (response.headers['content-location'] != null && response.headers['content-location'].includes("/stock_problems") && this.stopped === "false") {
                    throw "Waiting for restock"
                } else
                if (this.stopped === "false") {
                    await this.send("Submitted rate")
                    this.log(response.statusCode)
                }
            } catch (error) {
                await this.setDelays()
                if (error === "Waiting for restock") {
                    await this.send("Waiting for restock")
                    await sleep(this.errorDelay)
                    await this.submitRate()
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    if (error.response.statusCode === 404) {
                        await this.send("Waiting for restock")
                        await sleep(this.errorDelay)
                        await this.submitRate()
                    } else {
                        this.log(error.response.body)
                        await this.send("Error submitting rate: " + error.response.statusCode)
                        await sleep(this.errorDelay)
                        await this.submitRate()
                    }
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error submitting rate")
                    await sleep(this.errorDelay)
                    await this.submitRate()
                }
            }
        }
    }

    async loadPayment() {
        const got = require('got');
        const tunnel = require('tunnel');
        const querystring = require('querystring')
        if (this.stopped === "false") {
            await this.send("Loading payment...")
            try {
                this.request = {
                    method: 'get',
                    url: this.checkoutURL + "?previous_step=shipping_method&step=payment_method",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'accept': 'application/json, text/javascript, */*; q=0.01',
                        'x-requested-with': 'XMLHttpRequest',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'referer': this.baseLink
                    }
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                var HTMLParser = require('node-html-parser');
                var root = HTMLParser.parse(response.body);
                if (response.url.includes("/checkpoint")) {
                    await this.send("Found checkpoint")
                    var HTMLParser = require('node-html-parser');
                    var root = HTMLParser.parse(response.body);
                    if (this.stopped === "false")
                        await this.sendCaptchaCheckpoint()

                    if (this.stopped === "false")
                        await this.retrieveCaptchaResponse()

                    await this.loadPayment()
                } else if (response.url.includes("/queue")) {
                    for (var i = 0; i < response.headers['set-cookie'].length; i++) {
                        if (response.headers['set-cookie'][i].includes("_checkout_queue_token")) {
                            this.checkoutQueueToken = response.headers['set-cookie'][i].split(";")[0].split("_checkout_queue_token=")[1]
                            break;
                        }
                    }
                    if (this.stopped === "false") {
                        await this.pollQueue()
                        await this.loadPayment()
                    }
                } else if (response.headers['content-location'] != null && response.headers['content-location'].includes("/login") && this.stopped === "false") {
                    throw "Error: Account required"
                } else if (response.headers['content-location'] != null && response.headers['content-location'].includes("/stock_problems") && this.stopped === "false") {
                    await this.setDelays()
                    await this.send("OOS, retrying")
                    await sleep(this.monitorDelay)
                    await this.loadPayment()
                } else
                if (root.querySelector('[name="checkout[payment_gateway]"]') != null) {
                    this.paymentGateway = root.querySelector('[name="checkout[payment_gateway]"]').getAttribute('value')
                    this.totalPrice = root.querySelector('[name="checkout[total_price]"]').getAttribute('value')
                    this.cartTotal = this.totalPrice
                    this.cartTotal = this.cartTotal.toString()
                    this.cartTotal = this.cartTotal.substring(0, this.cartTotal.length - 2)
                    if (root.querySelector('[value="fs_count"]') != null) {
                        this.test3 = "_method=patch" //patch
                        this.test3 += "&authenticity_token=" + this.authToken //auth token
                        this.test3 += "&previous_step=payment_method" //previous step
                        this.test3 += "&step=" //final step
                        this.test3 += "&s=" + this.encryptedPayment //payment
                        if (root.querySelector('[value="fs_count"]') != null) {
                            this.fscount = root.querySelector('[value="fs_count"]').getAttribute('name')
                            this.searchBy = this.fscount.split("-count")[0]
                            this.searchBy = "#fs_" + this.searchBy
                            var count = 0;
                            this.values = root.querySelector(this.searchBy)
                            this.fscountvalues2 = ""
                            for (var i = 0; i < this.values.childNodes.length; i++) {
                                if (this.values.childNodes[i].tagName === "TEXTAREA") {
                                    count++;
                                    this.fscountvalues2 += "&" + this.values.childNodes[i].getAttribute('id') + "="
                                }
                            }
                            this.test3 += this.fscountvalues2
                            this.test3 += "&" + this.fscount + "=" + count + "&" + this.fscount + "=" + "fs_count"
                        }
                        this.test3 += "&checkout%5Bpayment_gateway%5D=" + this.paymentGateway //payment gateway
                        this.test3 += "&checkout%5Bcredit_card%5D%5Bvault%5D=false"
                        this.test3 += "&checkout%5Bdifferent_billing_address%5D=false"
                        if (root.querySelector('[id="post_purchase_page_requested"]') != null) {
                            this.test3 += "&checkout%5Bpost_purchase_page_requested%5D=0" //post purchase page requested
                        }
                        if (root.querySelector('[id="checkout_remember_me"]') != null) {
                            this.test3 += "&checkout%5Bremember_me%5D=" //remember me
                            this.test3 += "&checkout%5Bremember_me%5D=0"
                        }
                        if (root.querySelector('[id="checkout_vault_phone"]') != null) {
                            this.test3 += "&checkout%5Bvault_phone%5D=%2B1" + this.profile.phone //vault phone
                        }
                        this.test3 += "&checkout%5Btotal_price%5D=" + this.totalPrice //total price
                        this.test3 += "&complete=1"
                        this.test3 += "&checkout%5Bclient_details%5D%5Bbrowser_width%5D=1263"
                        this.test3 += "&checkout%5Bclient_details%5D%5Bbrowser_height%5D=913"
                        this.test3 += "&checkout%5Bclient_details%5D%5Bjavascript_enabled%5D=1"
                        this.test3 += "&checkout%5Bclient_details%5D%5Bcolor_depth%5D=24"
                        this.test3 += "&checkout%5Bclient_details%5D%5Bjava_enabled%5D=false"
                        this.test3 += "&checkout%5Bclient_details%5D%5Bbrowser_tz%5D=240"

                        this.paymentPayload = this.test3
                        this.log(this.paymentPayload)
                    } else {
                        if (typeof this.authToken === 'undefined')
                            this.authToken = root.querySelector('[name="authenticity_token"]').getAttribute('value')

                        this.paymentPayload = querystring.encode({
                            '_method': 'patch',
                            'authenticity_token': this.authToken,
                            'previous_step': 'payment_method',
                            'step': '',
                            's': this.encryptedPayment,
                            'checkout[payment_gateway]': this.paymentGateway,
                            'checkout[credit_card][vault]': 'false',
                            'checkout[different_billing_address]': 'false',
                            'checkout[attributes][I-agree-to-the-Terms-and-Conditions]': 'Yes',
                            'checkout[total_price]': this.totalPrice,
                            'complete': '1',
                            'checkout[client_details][browser_width]': '1583',
                            'checkout[client_details][browser_height]': '757',
                            'checkout[client_details][javascript_enabled]': '1',
                            'checkout[client_details][color_depth]': '24',
                            'checkout[client_details][java_enabled]': 'false',
                            'checkout[client_details][browser_tz]': '240'
                        })
                        this.log(this.paymentPayload)
                    }
                } else {
                    await sleep(300)
                    await this.loadPayment()
                }
                if (this.stopped === "false")
                    await this.send("Loaded payment")
                return;
            } catch (error) {
                await this.setDelays()
                if (error === "Error: Account required") {
                    await this.send("Error: Account required")
                    await sleep(this.errorDelay)
                    await this.loadPayment()
                }
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error loading payment: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.loadPayment()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error loading payment")
                    await sleep(this.errorDelay)
                    await this.loadPayment()
                }
            }
        }
    }

    async submitOrder() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Submitting order...")
            try {
                this.request = {
                    method: 'post',
                    url: this.checkoutURL,
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'accept': 'application/json, text/javascript, */*; q=0.01',
                        'x-requested-with': 'XMLHttpRequest',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'referer': this.baseLink
                    },
                    body: this.paymentPayload
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                var request = got(this.request)
                var timeout = setTimeout(() => request.cancel(), 15000);
                let response = await request;
                clearTimeout(timeout);
                var HTMLParser = require('node-html-parser');
                var root = HTMLParser.parse(response.body);
                this.log(response.body)
                if (response.headers['content-location'] != null && response.headers['content-location'].includes("/process") && this.stopped === "false") {
                    await this.send("Submitted order")
                    this.log(this.checkoutURL)
                } else if (response.body.includes("Error")) {
                    throw "Error submitting order"
                } else throw "OOS, retrying"
            } catch (error) {
                await this.setDelays()
                if (error === "Promise was canceled") {
                    await this.send("Error: timed out")
                    await sleep(this.errorDelay)
                    await this.submitOrder()
                } else
                if (error === "OOS, retrying") {
                    await this.send("OOS, retrying")
                    await sleep(this.errorDelay)
                    await this.submitOrder()
                } else if (error === "Error submitting order") {
                    this.log(error.response.body)
                    await this.send("Error submitting order")
                    await sleep(this.errorDelay)
                    await this.submitOrder()
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    if (error.response.statusCode === 404) {
                        await this.send("Waiting for restock")
                        await sleep(this.errorDelay)
                        await this.submitOrder()
                    } else {
                        this.log(error.response.body)
                        await this.send("Error submitting order: " + error.response.statusCode)
                        await sleep(this.errorDelay)
                        await this.submitOrder()
                    }
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error submitting order")
                    await sleep(this.errorDelay)
                    await this.submitOrder()
                }
            }
        }
    }

    async processPayment() {
        const got = require('got');
        const tunnel = require('tunnel');
        this.log(this.checkoutURL)
        if (this.stopped === "false") {
            await this.send("Processing...")
            try {
                this.request = {
                    method: 'get',
                    url: this.checkoutURL + "/processing",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'accept': 'application/json, text/javascript, */*; q=0.01',
                        'x-requested-with': 'XMLHttpRequest',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'referer': this.baseLink
                    }
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                var HTMLParser = require('node-html-parser');
                var root = HTMLParser.parse(response.body);
                if (response.headers['content-location'] != null && response.headers['content-location'].includes("/thank") && this.stopped === "false") {
                    await this.send("Check email")
                    await this.sendSuccess()
                } else
                if (response.headers['content-location'] != null && response.headers['content-location'].includes("/process") && this.stopped === "false") {
                    await this.send("Processing...")
                    await sleep(2000)
                    await this.processPayment()
                } else if (response.headers['content-location'] == null) {
                    await this.send("Processing...")
                    await sleep(2000)
                    await this.processPayment()
                } else if (response.headers['content-location'] != null && response.headers['content-location'].includes(this.checkoutURL) && this.stopped === "false") {
                    await this.send("Checkout failed")
                    await this.sendFail()
                }
            } catch (error) {
                await this.setDelays()
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    if (error.response.statusCode === 429) {
                        await this.send("Checkout failed")
                        await this.sendFailError()
                    } else {
                        await this.send("Error processing: " + error.response.statusCode)
                        await sleep(this.errorDelay)
                        await this.processPayment()
                    }
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error processing")
                    await sleep(this.errorDelay)
                    await this.processPayment()
                }
            }
        }
    }

    async getConfig() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Getting config...")
            try {
                this.request = {
                    method: 'get',
                    url: this.baseLink + "/payments/config.json",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
                        'accept': 'application/json, text/javascript, */*; q=0.01',
                        'x-requested-with': 'XMLHttpRequest',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'referer': this.baseLink
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                this.accessToken = response.body.paymentInstruments.accessToken
                if (this.stopped === "false")
                    await this.send("Got config")
            } catch (error) {
                await this.setDelays()
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error getting config: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.getConfig()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error getting config")
                    await sleep(this.errorDelay)
                    await this.getConfig()
                }
            }
        }
    }

    async createCheckout() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Creating checkout...")
            try {
                this.request = {
                    method: 'post',
                    url: this.baseLink + "/wallets/checkouts.json",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'content-type': 'application/json',
                        'cache-control': 'max-age=0',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'accept': '*/*',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-encoding': 'gzip, deflate, br',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'x-shopify-storefront-access-token': this.accessToken,
                        'x-checkout-queue-token': this.checkoutQueueToken
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                this.checkoutURL = response.body.checkout['web_url']
                this.checkoutToken = response.body.checkout.token
                if (this.stopped === "false")
                    await this.send("Created checkout")
            } catch (error) {
                await this.setDelays()
                if (error.response.statusCode === 429) {
                    for (var i = 0; i < error.response.headers['set-cookie'].length; i++) {
                        if (error.response.headers['set-cookie'][i].includes("_checkout_queue_token")) {
                            this.checkoutQueueToken = error.response.headers['set-cookie'][i].split(";")[0].split("_checkout_queue_token=")[1]
                            break;
                        }
                    }
                    if (this.stopped === "false") {
                        await this.pollQueueFast()
                        await this.createCheckout()
                    }
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error creating checkout: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.createCheckout()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error creating checkout")
                    await sleep(this.errorDelay)
                    await this.createCheckout()
                }
            }
        }
    }

    async updateCheckout() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Updating checkout...")
            try {
                this.request = {
                    method: 'put',
                    url: this.baseLink + "/wallets/checkouts/" + this.checkoutToken + ".json",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'content-type': 'application/json',
                        'cache-control': 'max-age=0',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'accept': '*/*',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-encoding': 'gzip, deflate, br',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'x-shopify-storefront-access-token': this.accessToken,
                    },
                    json: {
                        "checkout": {
                            "email": this.profile.email,
                            "cart_token": this.cartToken,
                            "shipping_address": {
                                "first_name": this.profile.firstName,
                                "last_name": this.profile.lastName,
                                "address1": this.profile.address1,
                                "city": this.profile.city,
                                "province_code": this.stateCode,
                                "country_code": this.countryCode,
                                "phone": this.profile.phone,
                                "zip": this.profile.zipcode
                            }
                        }
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                if (this.stopped === "false")
                    await this.send("Updated checkout")
            } catch (error) {
                await this.setDelays()
                if (error.response.statusCode === 412) {
                    for (var i = 0; i < error.response.headers['set-cookie'].length; i++) {
                        if (error.response.headers['set-cookie'][i].includes("_checkout_queue_token")) {
                            this.checkoutQueueToken = error.response.headers['set-cookie'][i].split(";")[0].split("_checkout_queue_token=")[1]
                            break;
                        }
                    }
                    if (this.stopped === "false") {
                        await this.pollQueueFast()
                        await this.updateCheckout()
                    }
                } else
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(JSON.stringify(error.response.body))
                    await this.send("Error updating checkout: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.updateCheckout()
                } else if (this.updateCheckout === "false") {
                    this.log(error)
                    await this.send("Unexpected error updating checkout")
                    await sleep(this.errorDelay)
                    await this.updateCheckout()
                }
            }
        }
    }

    async pollFastRates() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Loading rates...")
            try {
                this.request = {
                    method: 'get',
                    url: this.baseLink + "/wallets/checkouts/" + this.checkoutToken + "/shipping_rates.json",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'content-type': 'application/json',
                        'cache-control': 'max-age=0',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'accept': '*/*',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'referer': this.baseLink,
                        'x-shopify-storefront-access-token': this.accessToken,
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                if (response.body.hasOwnProperty('shipping_rates') == false) {
                    await sleep(300)
                    await this.pollFastRates()
                } else {
                    this.shippingRate = response.body['shipping_rates'][0].id
                    this.log(this.shippingRate)
                    if (this.stopped === "false")
                        await this.send("Got rates")
                }
            } catch (error) {
                await this.setDelays()
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(JSON.stringify(error.response.body))
                    await this.send("Error getting rates: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.pollFastRates()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error getting rates")
                    await sleep(this.errorDelay)
                    await this.pollFastRates()
                }
            }
        }
    }

    async addShippingFast() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Submitting rate...")
            try {
                this.request = {
                    method: 'put',
                    url: this.baseLink + "/wallets/checkouts/" + this.checkoutToken + ".json",
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'content-type': 'application/json',
                        'cache-control': 'max-age=0',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'accept': '*/*',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'referer': this.baseLink,
                        'x-shopify-storefront-access-token': this.accessToken,
                    },
                    json: {
                        "checkout": {
                            "shipping_line": {
                                "handle": this.shippingRate
                            }
                        }
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                if (this.stopped === "false")
                    await this.send("Submitted rate")
            } catch (error) {
                await this.setDelays()
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(JSON.stringify(error.response.body))
                    await this.send("Error submitting rates: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.addShippingFast()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error submitting rates")
                    await sleep(this.errorDelay)
                    await this.addShippingFast()
                }
            }
        }
    }


    async calculateTaxes() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Calculating taxes...")
            try {
                this.request = {
                    method: 'put',
                    url: this.location,
                    cookieJar: this.cookieJar,
                    headers: {
                        'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
                        'content-type': 'application/json',
                        'cache-control': 'max-age=0',
                        'sec-ch-ua-mobile': '?0',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'accept': '*/*',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-dest': 'empty',
                        'accept-language': 'en-US,en;q=0.9',
                        'origin': this.baseLink,
                        'referer': this.baseLink,
                        'x-shopify-storefront-access-token': this.accessToken,
                    },
                    responseType: 'json'
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                if (response.body.checkout['tax_lines'].length == 0) {
                    await sleep(50)
                    await this.calculateTaxes()
                }
            } catch (error) {
                await this.setDelays()
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error calculating taxes: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.calculateTaxes()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error calculating rates")
                    await sleep(this.errorDelay)
                    await this.calculateTaxes()
                }
            }
        }
    }

    async submitCheckpoint() {
        const got = require('got');
        const tunnel = require('tunnel');
        if (this.stopped === "false") {
            await this.send("Submitting checkpoint...")
            try {
                this.request = {
                    method: 'post',
                    url: this.baseLink + "/checkpoint",
                    cookieJar: this.cookieJar,
                    headers: {
                        'cache-control': 'max-age=0',
                        'sec-ch-ua': '"Chromium";v="92", " Not A;Brand";v="99", "Google Chrome";v="92"',
                        'sec-ch-ua-mobile': '?0',
                        'upgrade-insecure-requests': '1',
                        'content-type': 'application/x-www-form-urlencoded',
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                        'sec-fetch-site': 'same-origin',
                        'sec-fetch-mode': 'navigate',
                        'sec-fetch-user': '?1',
                        'sec-fetch-dest': 'document',
                        'accept-language': 'en-US,en;q=0.9',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'origin': this.baseLink,
                        'referer': this.baseLink,
                    },
                    body: this.checkpointPayload,
                    followRedirect: false
                }
                if (this.proxy != '-') {
                    this.request['agent'] = {
                        https: tunnel.httpsOverHttp({
                            proxy: this.proxy
                        })
                    }
                }
                let response = await got(this.request);
                this.log(response.body)
                this.checkpointPayload = ""
                this.finishedSubmittingCheckpoint = true;
            } catch (error) {
                await this.setDelays()
                if (typeof error.response != 'undefined' && this.stopped === "false") {
                    this.log(error.response.body)
                    await this.send("Error submitting checkpoint: " + error.response.statusCode)
                    await sleep(this.errorDelay)
                    await this.submitCheckpoint()
                } else if (this.stopped === "false") {
                    this.log(error)
                    await this.send("Unexpected error submitting checkpoint")
                    await sleep(this.errorDelay)
                    await this.submitCheckpoint()
                }
            }
        }
    }



    async findProduct() {
        if (this.searchMethod === "link")
            await this.findProductByLink()
        else if (this.searchMethod === "variant")
            await this.findProductByVariant()
        else if (this.searchMethod === "keywords")
            await this.findProductByKeywords()
    }

    log(message) {
        const winston = require('winston');
        const logConfiguration = {
            transports: [
                new winston.transports.Console({}),
                new winston.transports.File({
                    filename: this.configDir + '/logs/' + this.taskId + '.log'
                })
            ],
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'MMM-DD-YYYY HH:mm:ss'
                }),
                winston.format.printf(info => `[${[info.timestamp]}] [${this.taskId}]: ${info.message}`),
            )
        };
        const logger = winston.createLogger(logConfiguration);

        logger.info(message)
    }

    async stopTask() {
        this.stopped = "true";
        await this.sendProductTitle(this.oglink)
        this.send("Stopped")
    }

    async sendCaptchaInfo(captchaInfo) {
        const tough = require('tough-cookie')
        this.cookieJar = new tough.CookieJar()
        this.finishedSubmittingCheckpoint = false;
        for (var i = 0; i < captchaInfo.cookies.length; i++) {
            this.cookieJar.setCookie(new tough.Cookie({
                "key": captchaInfo.cookies[i].name,
                "value": captchaInfo.cookies[i].value,
            }), this.baseLink)
        }
        if (captchaInfo.captchaType === "recaptcha") {
            this.checkpointPayload = "authenticity_token="
            this.checkpointPayload += captchaInfo.authToken
            this.checkpointPayload += "&g-recaptcha-response="
            this.checkpointPayload += captchaInfo.captchaResponse
            this.checkpointPayload += "&data_via=cookie"
            this.checkpointPayload += "&commit="
        } else {
            this.checkpointPayload = "authenticity_token="
            this.checkpointPayload += captchaInfo.authToken
            this.checkpointPayload += "&h-captcha-response="
            this.checkpointPayload += captchaInfo.captchaResponse
            this.checkpointPayload += "&data_via=cookie"
            this.checkpointPayload += "&hcaptcha_challenge_response_token="
            this.checkpointPayload += captchaInfo.hcaptchachallengeresponsetoken
            this.checkpointPayload += "&hcaptcha_data="
            this.checkpointPayload += encodeURIComponent(captchaInfo.hcaptchadata)
            this.checkpointPayload += "&commit="
        }
        this.log(this.checkpointPayload)
        await this.submitCheckpoint()
    }

    returnID() {
        return this.taskId;
    }

    async setDelays() {
        var fs = require('fs');
        var path = require('path')
        var delays = JSON.parse(fs.readFileSync(path.join(this.configDir, '/userdata/delays.json'), 'utf8'));
        var groups = JSON.parse(fs.readFileSync(path.join(this.configDir, '/userdata/tasks.json'), 'utf8'));
        var index;
        for (var i = 0; i < groups.length; i++) {
            for (var j = 0; j < groups[i][Object.keys(groups[i])[0]].length; j++) {
                if (Object.keys(groups[i][Object.keys(groups[i])[0]][j])[0] === this.taskId) {
                    index = i;
                    break;
                }
            }
        }
        this.monitorDelay = delays[index].monitor
        this.errorDelay = delays[index].error
    }

    async sendProductTitle(title) {
        this.connection.send(JSON.stringify({
            event: "taskProductTitle",
            data: {
                taskID: this.taskId,
                newTitle: title
            }
        }))
    }

    async send(status) {
        if (this.stopped === "false" || status === "Stopped") {
            this.log(status)
            this.connection.send(JSON.stringify({
                event: "taskStatus",
                data: {
                    taskID: this.taskId,
                    newStatus: status
                }
            }))
        }
    }

    async updateStat(stat) {
        //this.window.webContents.send("updateStats", stat);
        this.log(stat)
    }

    async initialize() {
        await this.send("Started")

        await this.formatCard()
        await this.submitCard()

        if (this.accounts != "-") {
            if (this.stopped === "false")
                await this.login()

            if (this.stopped === "false")
                await this.clearCart()
        }

        if (this.mode === "Prestock") {
            if (this.stopped === "false")
                await this.findRandomItem()

            if (this.stopped === "false")
                await this.addToCart()

            if (this.stopped === "false")
                await this.loadCheckoutforPreload()

            if (this.stopped === "false")
                await this.clearCart()

            if (this.stopped === "false")
                await this.waitForCheckpoint()

            if (this.stopped === "false")
                await this.findRandomItem()

            if (this.stopped === "false")
                await this.addToCart()

            if (this.stopped === "false")
                await this.loadCheckout()

            if (this.stopped === "false")
                await this.submitShipping()

            if (this.stopped === "false")
                await this.loadShippingRate()

            if (this.stopped === "false")
                await this.submitRate()

            if (this.stopped === "false")
                await this.loadPayment()

            if (this.stopped === "false")
                await this.clearCart()

            if (this.stopped === "false")
                await this.findProduct()

            if (this.stopped === "false")
                await this.addToCart()

            if (this.stopped === "false")
                await this.loadPayment()

            if (this.stopped === "false")
                await this.submitOrder()

            if (this.stopped === "false")
                await this.processPayment()
        }


        if (this.mode === "Fast") {
            if (this.stopped === "false")
                await this.getConfig()

            if (this.stopped === "false")
                await this.createCheckout()

            if (this.stopped === "false")
                await this.findProduct()

            if (this.stopped === "false")
                await this.addToCart()

            if (this.stopped === "false")
                await this.updateCheckout()

            if (this.stopped === "false")
                await this.pollFastRates()

            if (this.stopped === "false")
                await this.addShippingFast()

            if (this.stopped === "false")
                await this.loadPayment()

            if (this.stopped === "false")
                await this.submitOrder()

            if (this.stopped === "false")
                await this.processPayment()
        }

        if (this.mode === "Preload") {
            if (this.stopped === "false")
                await this.findRandomItem()

            if (this.stopped === "false")
                await this.addToCart()

            if (this.stopped === "false")
                await this.loadCheckoutforPreload()

            if (this.stopped === "false")
                await this.clearCart()

            if (this.stopped === "false")
                await this.findProduct()

            if (this.stopped === "false")
                await this.addToCart()

            if (this.stopped === "false")
                await this.loadCheckout()

            if (this.stopped === "false")
                await this.submitShipping()

            if (this.stopped === "false")
                await this.loadShippingRate()

            if (this.stopped === "false")
                await this.submitRate()

            if (this.stopped === "false")
                await this.loadPayment()

            if (this.stopped === "false")
                await this.submitOrder()

            if (this.stopped === "false")
                await this.processPayment()
        }

        if (this.mode === "Safe") {
            if (this.stopped === "false")
                await this.findProduct()

            if (this.stopped === "false")
                await this.addToCart()

            if (this.stopped === "false")
                await this.loadCheckout()

            if (this.stopped === "false")
                await this.submitShipping()

            if (this.stopped === "false")
                await this.loadShippingRate()

            if (this.stopped === "false")
                await this.submitRate()

            if (this.stopped === "false")
                await this.loadPayment()

            if (this.stopped === "false")
                await this.submitOrder()

            if (this.stopped === "false")
                await this.processPayment()
        }
    }

}



function getProxyInfo(proxies, configDir) {
    if (proxies === "-")
        return ["-"]

    var fs = require('fs');
    var path = require('path')
    var str = fs.readFileSync(path.join(configDir, '/userdata/proxies.json'), 'utf8');
    var x = JSON.parse(str)
    var proxyStorage = [];
    for (var i = 0; i < x.length; i++) {
        if (x[i].name === proxies) {
            for (var j = 0; j < x[i].proxies.length; j++) {
                if (x[i].proxies[j].username === null) {
                    proxyStorage.push({ "host": x[i].proxies[j].ip, "port": x[i].proxies[j].port })
                } else {
                    proxyStorage.push({ "host": x[i].proxies[j].ip, "port": x[i].proxies[j].port, "proxyAuth": x[i].proxies[j].username + ":" + x[i].proxies[j].password })
                }
            }
        }
    }
    return proxyStorage;
}


function getAccountInfo(accounts, configDir) {
    if (accounts === "-") {
        return "-"
    }
    var fs = require('fs');
    var path = require('path')


    var str = fs.readFileSync(path.join(configDir, '/userdata/accounts.json'), 'utf8');
    var x = JSON.parse(str)
    for (var i = 0; i < x.length; i++) {
        if (x[i].name === accounts) {
            return x[i].account.sample()
        }
    }
}

function getProfileInfo(profiles, configDir) {
    var fs = require('fs');
    var path = require('path')
    var str = fs.readFileSync(path.join(configDir, '/userdata/profiles.json'), 'utf8');
    var x = JSON.parse(str)
    for (var i = 0; i < x.length; i++) {
        if (x[i].name === profiles) {
            return { "firstName": x[i].delivery.firstName, "lastName": x[i].delivery.lastName, "address1": x[i].delivery.address1, "zipcode": x[i].delivery.zip, "city": x[i].delivery.city, "country": x[i].delivery.country, "state": x[i].delivery.state, "email": x[i].email, "phone": x[i].phone, "cardNumber": x[i].card.number, "expiryMonth": x[i].card.expiryMonth, "expiryYear": x[i].card.expiryYear, "cvv": x[i].card.cvv }
        }
    }
}

const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
Array.prototype.sample = function() {
    return this[Math.floor(Math.random() * this.length)];
}


async function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function getKey(configDir) {
    var fs = require('fs');
    var path = require('path')
    var str = fs.readFileSync(path.join(configDir, '/userdata/key.txt'), 'utf8');
    return str;
}