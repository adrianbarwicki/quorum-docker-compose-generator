"use strict";
exports.__esModule = true;
var ejs = require("ejs");
var template = "\n# The following environment variables are substituted if present\n# * QUORUM_CONSENSUS: default to istanbul\n# * QUORUM_DOCKER_IMAGE: default to quorumengineering/quorum:2.2.1\n# * QUORUM_TX_MANAGER_DOCKER_IMAGE: default to quorumengineering/tessera:0.7.3\n# To use Constellation, set QUORUM_TX_MANAGER_DOCKER_IMAGE to Constellation docker image,\n# e.g.: QUORUM_TX_MANAGER_DOCKER_IMAGE=quorumengineering/constellation:0.3.2 docker-compose up -d\nversion: \"3.6\"\nx-quorum-def:\n  &quorum-def\n  restart: \"on-failure\"\n  image: \"${QUORUM_DOCKER_IMAGE:-quorumengineering/quorum:2.2.1}\"\n  expose:\n    - \"21000\"\n    - \"50400\"\n  healthcheck:\n    test: [\"CMD\", \"wget\", \"--spider\", \"--proxy\", \"off\", \"http://localhost:8545\"]\n    interval: 3s\n    timeout: 3s\n    retries: 10\n    start_period: 5s\n  labels:\n    com.quorum.consensus: ${QUORUM_CONSENSUS:-istanbul}\n  entrypoint:\n    - /bin/sh\n    - -c\n    - |\n      UDS_WAIT=10\n      for i in $$(seq 1 100)\n      do\n        set -e\n        if [ -S $${PRIVATE_CONFIG} ] &&           [ \"I'm up!\" == \"$$(wget --timeout $${UDS_WAIT} -qO- --proxy off 172.16.239.10$${NODE_ID}:9000/upcheck)\" ];\n        then break\n        else\n          echo \"Sleep $${UDS_WAIT} seconds. Waiting for TxManager.\"\n          sleep $${UDS_WAIT}\n        fi\n      done\n      DDIR=/qdata/dd\n      rm -rf $${DDIR}\n      mkdir -p $${DDIR}/keystore\n      mkdir -p $${DDIR}/geth\n      cp /examples/raft/nodekey$${NODE_ID} $${DDIR}/geth/nodekey\n      cp /examples/keys/key$${NODE_ID} $${DDIR}/keystore/\n      cat /examples/permissioned-nodes.json | sed 's/^(.*)@.*?(.*)raftport=5040([0-9])(.*)$$/1@172.16.239.13:21000?discport=0&raftport=504004/g' > $${DDIR}/static-nodes.json\n      cp $${DDIR}/static-nodes.json $${DDIR}/permissioned-nodes.json\n      cat $${DDIR}/static-nodes.json\n      GENESIS_FILE=\"/examples/istanbul-genesis.json\"\n      if [ \"${QUORUM_CONSENSUS:-istanbul}\" == \"raft\" ]; then\n        GENESIS_FILE=\"/examples/genesis.json\"\n      fi\n      NETWORK_ID=$$(cat $${GENESIS_FILE} | grep chainId | awk -F \" \" '{print $$2}' | awk -F \",\" '{print $$1}')\n      GETH_ARGS_raft=\"--raft --raftport 50400\"\n      GETH_ARGS_istanbul=\"--emitcheckpoints --istanbul.blockperiod 1 --mine --minerthreads 1 --syncmode full\"\n      geth --datadir $${DDIR} init $${GENESIS_FILE}\n      geth         --identity node$${NODE_ID}-${QUORUM_CONSENSUS:-istanbul}         --datadir $${DDIR}         --permissioned         --nodiscover         --verbosity 5         --networkid $${NETWORK_ID}         --rpc         --rpcaddr 0.0.0.0         --rpcport 8545         --rpcapi admin,db,eth,debug,miner,net,shh,txpool,personal,web3,quorum,${QUORUM_CONSENSUS:-istanbul}         --port 21000         --unlock 0         --password /examples/passwords.txt         $${GETH_ARGS_${QUORUM_CONSENSUS:-istanbul}}\nx-tx-manager-def:\n  &tx-manager-def\n  image: \"${QUORUM_TX_MANAGER_DOCKER_IMAGE:-quorumengineering/tessera:0.8}\"\n  expose:\n    - \"9000\"\n    - \"9080\"\n  restart: \"no\"\n  healthcheck:\n    test: [\"CMD-SHELL\", \"[ -S /qdata/tm/tm.ipc ] || exit 1\"]\n    interval: 3s\n    timeout: 3s\n    retries: 20\n    start_period: 5s\n  entrypoint:\n    - /bin/sh\n    - -c\n    - |\n      DDIR=/qdata/tm\n      rm -rf $${DDIR}\n      mkdir -p $${DDIR}\n      DOCKER_IMAGE=\"${QUORUM_TX_MANAGER_DOCKER_IMAGE:-quorumengineering/tessera:0.8}\"\n      TX_MANAGER=$$(echo $${DOCKER_IMAGE} | sed 's/^.*/(.*):.*$$/1/g')\n      echo \"TxManager: $${TX_MANAGER}\"\n      case $${TX_MANAGER}\n      in\n        tessera)\n          cp /examples/keys/tm$${NODE_ID}.pub $${DDIR}/tm.pub\n          cp /examples/keys/tm$${NODE_ID}.key $${DDIR}/tm.key\n          #extract the tessera version from the jar\n          TESSERA_VERSION=$$(unzip -p /tessera/tessera-app.jar META-INF/MANIFEST.MF | grep Tessera-Version | cut -d\" \" -f2)\n          echo \"Tessera version (extracted from manifest file): $${TESSERA_VERSION}\"\n          # sorting versions to use enhanced config for >=0.8\n          export V=$$(echo -e \"0.8\n$${TESSERA_VERSION}\" | sort -n -r -t '.' -k 1,1 -k 2,2 | head -n1)\n          TESSERA_CONFIG_TYPE=\n          if [ \"$${V}\" == \"$${TESSERA_VERSION}\" ]; then\n              TESSERA_CONFIG_TYPE=\"-enhanced\"\n          fi\n\n          echo Config type $${TESSERA_CONFIG_TYPE}\n\n          #generating the two config flavors\n          cat <<EOF > $${DDIR}/tessera-config.json\n          {\n              \"useWhiteList\": false,\n              \"jdbc\": {\n                  \"username\": \"sa\",\n                  \"password\": \"\",\n                  \"url\": \"jdbc:h2:./$${DDIR}/db;MODE=Oracle;TRACE_LEVEL_SYSTEM_OUT=0\",\n                  \"autoCreateTables\": true\n              },\n              \"server\": {\n                  \"port\": 9000,\n                  \"hostName\": \"http://$$(hostname -i)\",\n                  \"sslConfig\": {\n                      \"tls\": \"OFF\",\n                      \"generateKeyStoreIfNotExisted\": true,\n                      \"serverKeyStore\": \"$${DDIR}/server-keystore\",\n                      \"serverKeyStorePassword\": \"quorum\",\n                      \"serverTrustStore\": \"$${DDIR}/server-truststore\",\n                      \"serverTrustStorePassword\": \"quorum\",\n                      \"serverTrustMode\": \"TOFU\",\n                      \"knownClientsFile\": \"$${DDIR}/knownClients\",\n                      \"clientKeyStore\": \"$${DDIR}/client-keystore\",\n                      \"clientKeyStorePassword\": \"quorum\",\n                      \"clientTrustStore\": \"$${DDIR}/client-truststore\",\n                      \"clientTrustStorePassword\": \"quorum\",\n                      \"clientTrustMode\": \"TOFU\",\n                      \"knownServersFile\": \"$${DDIR}/knownServers\"\n                  }\n              },\n              \"peer\": [\n<%- peers %>\n              ],\n              \"keys\": {\n                  \"passwords\": [],\n                  \"keyData\": [\n                      {\n                          \"config\": $$(cat $${DDIR}/tm.key),\n                          \"publicKey\": \"$$(cat $${DDIR}/tm.pub)\"\n                      }\n                  ]\n              },\n              \"alwaysSendTo\": [],\n              \"unixSocketFile\": \"$${DDIR}/tm.ipc\"\n          }\n      EOF\n\n          cat <<EOF > $${DDIR}/tessera-config-enhanced.json\n          {\n            \"useWhiteList\": false,\n            \"jdbc\": {\n              \"username\": \"sa\",\n              \"password\": \"\",\n              \"url\": \"jdbc:h2:./$${DDIR}/db;MODE=Oracle;TRACE_LEVEL_SYSTEM_OUT=0\",\n              \"autoCreateTables\": true\n            },\n            \"serverConfigs\":[\n            {\n              \"app\":\"ThirdParty\",\n              \"enabled\": true,\n              \"serverSocket\":{\n                \"type\":\"INET\",\n                \"port\": 9080,\n                \"hostName\": \"http://$$(hostname -i)\"\n              },\n              \"communicationType\" : \"REST\"\n            },\n            {\n              \"app\":\"Q2T\",\n              \"enabled\": true,\n              \"serverSocket\":{\n                \"type\":\"UNIX\",\n                \"path\":\"$${DDIR}/tm.ipc\"\n              },\n              \"communicationType\" : \"UNIX_SOCKET\"\n            },\n            {\n              \"app\":\"P2P\",\n              \"enabled\": true,\n              \"serverSocket\":{\n                \"type\":\"INET\",\n                \"port\": 9000,\n                \"hostName\": \"http://$$(hostname -i)\"\n              },\n              \"sslConfig\": {\n                \"tls\": \"OFF\",\n                \"generateKeyStoreIfNotExisted\": true,\n                \"serverKeyStore\": \"$${DDIR}/server-keystore\",\n                \"serverKeyStorePassword\": \"quorum\",\n                \"serverTrustStore\": \"$${DDIR}/server-truststore\",\n                \"serverTrustStorePassword\": \"quorum\",\n                \"serverTrustMode\": \"TOFU\",\n                \"knownClientsFile\": \"$${DDIR}/knownClients\",\n                \"clientKeyStore\": \"$${DDIR}/client-keystore\",\n                \"clientKeyStorePassword\": \"quorum\",\n                \"clientTrustStore\": \"$${DDIR}/client-truststore\",\n                \"clientTrustStorePassword\": \"quorum\",\n                \"clientTrustMode\": \"TOFU\",\n                \"knownServersFile\": \"$${DDIR}/knownServers\"\n              },\n              \"communicationType\" : \"REST\"\n            }\n            ],\n            \"peer\": [\n<%- peers %>\n            ],\n            \"keys\": {\n              \"passwords\": [],\n              \"keyData\": [\n                {\n                  \"config\": $$(cat $${DDIR}/tm.key),\n                  \"publicKey\": \"$$(cat $${DDIR}/tm.pub)\"\n                }\n              ]\n            },\n            \"alwaysSendTo\": []\n          }\n      EOF\n\n          java -Xms128M -Xmx128M -jar /tessera/tessera-app.jar -configfile $${DDIR}/tessera-config$${TESSERA_CONFIG_TYPE}.json\n          ;;\n        constellation)\n          echo \"socket=\"$${DDIR}/tm.ipc\"\npublickeys=[\"/examples/keys/tm$${NODE_ID}.pub\"]\n\" > $${DDIR}/tm.conf\n          constellation-node             --url=http://$$(hostname -i):9000/             --port=9000             --socket=$${DDIR}/tm.ipc             --othernodes=http://172.16.239.101:9000/,http://172.16.239.102:9000/,http://172.16.239.103:9000/,http://172.16.239.104:9000/,http://172.16.239.105:9000/             --publickeys=/examples/keys/tm$${NODE_ID}.pub             --privatekeys=/examples/keys/tm$${NODE_ID}.key             --storage=$${DDIR}             --verbosity=4\n          ;;\n        *)\n          echo \"Invalid Transaction Manager\"\n          exit 1\n          ;;\n      esac\nservices:\n  <%- services %>\nnetworks:\n  quorum-examples-net:\n    driver: bridge\n    ipam:\n      driver: default\n      config:\n      - subnet: 172.16.239.0/24\nvolumes:\n  <%- volumes %>\n";
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
exports.renderCompose = function (params) { return ejs.render(template, params, {}); };
exports.generate = function (params) { return exports.renderCompose(exports.generateDockerFile(params)); };
