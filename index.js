"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
exports.__esModule = true;
var ejs = require("ejs");
exports.generateDockerFile = function (params) {
    var peers = [];
    var services = [];
    var volumes = [];
    for (var index = 1; index <= params.noOfNodes; index++) {
        services.push("\n      node" + index + ":\n        << : *quorum-def\n        hostname: node" + index + "\n        ports:\n          - \"2200" + (index - 1) + ":8545\"\n        volumes:\n          - vol" + index + ":/qdata\n          - ./examples/7nodes:/examples:ro\n        depends_on:\n          - txmanager" + index + "\n        environment:\n          - PRIVATE_CONFIG=/qdata/tm/tm.ipc\n          - NODE_ID=" + index + "\n        networks:\n          quorum-examples-net:\n            ipv4_address: 172.16.239.1" + index + "\n      txmanager" + index + ":\n        << : *tx-manager-def\n        hostname: txmanager" + index + "\n        ports:\n          - \"908" + index + ":9080\"\n        volumes:\n          - vol" + index + ":/qdata\n          - ./examples/7nodes:/examples:ro\n        networks:\n          quorum-examples-net:\n            ipv4_address: 172.16.239.10" + index + "\n        environment:\n          - NODE_ID=" + index + "\n    ");
        volumes.push("\n      vol" + index + ":\n    ");
        peers.push("                { \"url\": \"http://txmanager" + index + ":9000\" }");
    }
    return {
        volumes: volumes.join(""),
        services: services.join(""),
        peers: peers.join(",\n")
    };
};
exports.renderCompose = function (params) { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, new Promise(function (resolve, reject) {
                ejs.renderFile("./dockerComposeTemplate.yaml", params, {}, function (err, str) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(str);
                });
            })];
    });
}); };
exports.generate = function (params) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
    return [2 /*return*/, exports.renderCompose(exports.generateDockerFile(params))];
}); }); };
