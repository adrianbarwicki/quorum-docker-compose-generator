"use strict";
exports.__esModule = true;
var ejs = require("ejs");
var generateDockerFile = function (params) {
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
var renderCompose = function (params) {
    ejs.renderFile("./dockerComposeTemplate.yaml", params, {}, function (err, str) {
        console.log(str);
    });
};

renderCompose(generateDockerFile({ noOfNodes: 5, consenusAlgo: "Istanbul" }));
