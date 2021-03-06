import * as ejs from "ejs";

type Args = { noOfNodes: number };


const template = `
# The following environment variables are substituted if present
# * QUORUM_CONSENSUS: default to istanbul
# * QUORUM_DOCKER_IMAGE: default to quorumengineering/quorum:2.2.1
# * QUORUM_TX_MANAGER_DOCKER_IMAGE: default to quorumengineering/tessera:0.7.3
# To use Constellation, set QUORUM_TX_MANAGER_DOCKER_IMAGE to Constellation docker image,
# e.g.: QUORUM_TX_MANAGER_DOCKER_IMAGE=quorumengineering/constellation:0.3.2 docker-compose up -d
version: "3.6"
x-quorum-def:
  &quorum-def
  restart: "on-failure"
  image: "\${QUORUM_DOCKER_IMAGE:-quorumengineering/quorum:2.2.1}"
  expose:
    - "21000"
    - "50400"
  healthcheck:
    test: ["CMD", "wget", "--spider", "--proxy", "off", "http://localhost:8545"]
    interval: 3s
    timeout: 3s
    retries: 10
    start_period: 5s
  labels:
    com.quorum.consensus: \${QUORUM_CONSENSUS:-istanbul}
  entrypoint:
    - /bin/sh
    - -c
    - |
      UDS_WAIT=10
      for i in $$(seq 1 100)
      do
        set -e
        if [ -S $\${PRIVATE_CONFIG} ] && \
          [ "I'm up!" == "$$(wget --timeout $\${UDS_WAIT} -qO- --proxy off 172.16.239.10$\${NODE_ID}:9000/upcheck)" ];
        then break
        else
          echo "Sleep $\${UDS_WAIT} seconds. Waiting for TxManager."
          sleep $\${UDS_WAIT}
        fi
      done
      DDIR=/qdata/dd
      rm -rf $\${DDIR}
      mkdir -p $\${DDIR}/keystore
      mkdir -p $\${DDIR}/geth
      cp /examples/raft/nodekey$\${NODE_ID} $\${DDIR}/geth/nodekey
      cp /examples/keys/key$\${NODE_ID} $\${DDIR}/keystore/
      cat /examples/permissioned-nodes.json | sed 's/^\(.*\)@.*\?\(.*\)raftport=5040\([0-9]\)\(.*\)$$/\1@172.16.239.1\3:21000?discport=0\&raftport=50400\4/g' > $\${DDIR}/static-nodes.json
      cp $\${DDIR}/static-nodes.json $\${DDIR}/permissioned-nodes.json
      cat $\${DDIR}/static-nodes.json
      GENESIS_FILE="/examples/istanbul-genesis.json"
      if [ "\${QUORUM_CONSENSUS:-istanbul}" == "raft" ]; then
        GENESIS_FILE="/examples/genesis.json"
      fi
      NETWORK_ID=$$(cat $\${GENESIS_FILE} | grep chainId | awk -F " " '{print $$2}' | awk -F "," '{print $$1}')
      GETH_ARGS_raft="--raft --raftport 50400"
      GETH_ARGS_istanbul="--emitcheckpoints --istanbul.blockperiod 1 --mine --minerthreads 1 --syncmode full"
      geth --datadir $\${DDIR} init $\${GENESIS_FILE}
      geth \
        --identity node$\${NODE_ID}-\${QUORUM_CONSENSUS:-istanbul} \
        --datadir $\${DDIR} \
        --permissioned \
        --nodiscover \
        --verbosity 5 \
        --networkid $\${NETWORK_ID} \
        --rpc \
        --rpcaddr 0.0.0.0 \
        --rpcport 8545 \
        --rpcapi admin,db,eth,debug,miner,net,shh,txpool,personal,web3,quorum,\${QUORUM_CONSENSUS:-istanbul} \
        --port 21000 \
        --unlock 0 \
        --password /examples/passwords.txt \
        $\${GETH_ARGS_\${QUORUM_CONSENSUS:-istanbul}}
x-tx-manager-def:
  &tx-manager-def
  image: "\${QUORUM_TX_MANAGER_DOCKER_IMAGE:-quorumengineering/tessera:0.8}"
  expose:
    - "9000"
    - "9080"
  restart: "no"
  healthcheck:
    test: ["CMD-SHELL", "[ -S /qdata/tm/tm.ipc ] || exit 1"]
    interval: 3s
    timeout: 3s
    retries: 20
    start_period: 5s
  entrypoint:
    - /bin/sh
    - -c
    - |
      DDIR=/qdata/tm
      rm -rf $\${DDIR}
      mkdir -p $\${DDIR}
      DOCKER_IMAGE="\${QUORUM_TX_MANAGER_DOCKER_IMAGE:-quorumengineering/tessera:0.8}"
      TX_MANAGER=$$(echo $\${DOCKER_IMAGE} | sed 's/^.*\/\(.*\):.*$$/\1/g')
      echo "TxManager: $\${TX_MANAGER}"
      case $\${TX_MANAGER}
      in
        tessera)
          cp /examples/keys/tm$\${NODE_ID}.pub $\${DDIR}/tm.pub
          cp /examples/keys/tm$\${NODE_ID}.key $\${DDIR}/tm.key
          #extract the tessera version from the jar
          TESSERA_VERSION=$$(unzip -p /tessera/tessera-app.jar META-INF/MANIFEST.MF | grep Tessera-Version | cut -d" " -f2)
          echo "Tessera version (extracted from manifest file): $\${TESSERA_VERSION}"
          # sorting versions to use enhanced config for >=0.8
          export V=$$(echo -e "0.8\n$\${TESSERA_VERSION}" | sort -n -r -t '.' -k 1,1 -k 2,2 | head -n1)
          TESSERA_CONFIG_TYPE=
          if [ "$\${V}" == "$\${TESSERA_VERSION}" ]; then
              TESSERA_CONFIG_TYPE="-enhanced"
          fi

          echo Config type $\${TESSERA_CONFIG_TYPE}

          #generating the two config flavors
          cat <<EOF > $\${DDIR}/tessera-config.json
          {
              "useWhiteList": false,
              "jdbc": {
                  "username": "sa",
                  "password": "",
                  "url": "jdbc:h2:./$\${DDIR}/db;MODE=Oracle;TRACE_LEVEL_SYSTEM_OUT=0",
                  "autoCreateTables": true
              },
              "server": {
                  "port": 9000,
                  "hostName": "http://$$(hostname -i)",
                  "sslConfig": {
                      "tls": "OFF",
                      "generateKeyStoreIfNotExisted": true,
                      "serverKeyStore": "$\${DDIR}/server-keystore",
                      "serverKeyStorePassword": "quorum",
                      "serverTrustStore": "$\${DDIR}/server-truststore",
                      "serverTrustStorePassword": "quorum",
                      "serverTrustMode": "TOFU",
                      "knownClientsFile": "$\${DDIR}/knownClients",
                      "clientKeyStore": "$\${DDIR}/client-keystore",
                      "clientKeyStorePassword": "quorum",
                      "clientTrustStore": "$\${DDIR}/client-truststore",
                      "clientTrustStorePassword": "quorum",
                      "clientTrustMode": "TOFU",
                      "knownServersFile": "$\${DDIR}/knownServers"
                  }
              },
              "peer": [
<%- peers %>
              ],
              "keys": {
                  "passwords": [],
                  "keyData": [
                      {
                          "config": $$(cat $\${DDIR}/tm.key),
                          "publicKey": "$$(cat $\${DDIR}/tm.pub)"
                      }
                  ]
              },
              "alwaysSendTo": [],
              "unixSocketFile": "$\${DDIR}/tm.ipc"
          }
      EOF

          cat <<EOF > $\${DDIR}/tessera-config-enhanced.json
          {
            "useWhiteList": false,
            "jdbc": {
              "username": "sa",
              "password": "",
              "url": "jdbc:h2:./$\${DDIR}/db;MODE=Oracle;TRACE_LEVEL_SYSTEM_OUT=0",
              "autoCreateTables": true
            },
            "serverConfigs":[
            {
              "app":"ThirdParty",
              "enabled": true,
              "serverSocket":{
                "type":"INET",
                "port": 9080,
                "hostName": "http://$$(hostname -i)"
              },
              "communicationType" : "REST"
            },
            {
              "app":"Q2T",
              "enabled": true,
              "serverSocket":{
                "type":"UNIX",
                "path":"$\${DDIR}/tm.ipc"
              },
              "communicationType" : "UNIX_SOCKET"
            },
            {
              "app":"P2P",
              "enabled": true,
              "serverSocket":{
                "type":"INET",
                "port": 9000,
                "hostName": "http://$$(hostname -i)"
              },
              "sslConfig": {
                "tls": "OFF",
                "generateKeyStoreIfNotExisted": true,
                "serverKeyStore": "$\${DDIR}/server-keystore",
                "serverKeyStorePassword": "quorum",
                "serverTrustStore": "$\${DDIR}/server-truststore",
                "serverTrustStorePassword": "quorum",
                "serverTrustMode": "TOFU",
                "knownClientsFile": "$\${DDIR}/knownClients",
                "clientKeyStore": "$\${DDIR}/client-keystore",
                "clientKeyStorePassword": "quorum",
                "clientTrustStore": "$\${DDIR}/client-truststore",
                "clientTrustStorePassword": "quorum",
                "clientTrustMode": "TOFU",
                "knownServersFile": "$\${DDIR}/knownServers"
              },
              "communicationType" : "REST"
            }
            ],
            "peer": [
<%- peers %>
            ],
            "keys": {
              "passwords": [],
              "keyData": [
                {
                  "config": $$(cat $\${DDIR}/tm.key),
                  "publicKey": "$$(cat $\${DDIR}/tm.pub)"
                }
              ]
            },
            "alwaysSendTo": []
          }
      EOF

          java -Xms128M -Xmx128M -jar /tessera/tessera-app.jar -configfile $\${DDIR}/tessera-config$\${TESSERA_CONFIG_TYPE}.json
          ;;
        constellation)
          echo "socket=\"$\${DDIR}/tm.ipc\"\npublickeys=[\"/examples/keys/tm$\${NODE_ID}.pub\"]\n" > $\${DDIR}/tm.conf
          constellation-node \
            --url=http://$$(hostname -i):9000/ \
            --port=9000 \
            --socket=$\${DDIR}/tm.ipc \
            --othernodes=http://172.16.239.101:9000/,http://172.16.239.102:9000/,http://172.16.239.103:9000/,http://172.16.239.104:9000/,http://172.16.239.105:9000/ \
            --publickeys=/examples/keys/tm$\${NODE_ID}.pub \
            --privatekeys=/examples/keys/tm$\${NODE_ID}.key \
            --storage=$\${DDIR} \
            --verbosity=4
          ;;
        *)
          echo "Invalid Transaction Manager"
          exit 1
          ;;
      esac
services:
  <%- services %>
networks:
  quorum-examples-net:
    driver: bridge
    ipam:
      driver: default
      config:
      - subnet: 172.16.239.0/24
volumes:
  <%- volumes %>
`;

export const generateDockerFile = (params: Args): { peers: string, services: string; volumes: string; } => {
  let peers = [];
  let services = [];
  let volumes = [];

  for (let index = 1; index <= params.noOfNodes; index++) {
    services.push(`
      node${index}:
        << : *quorum-def
        hostname: node${index}
        ports:
          - "2200${index - 1}:8545"
        volumes:
          - vol${index}:/qdata
          - ./examples/7nodes:/examples:ro
        depends_on:
          - txmanager${index}
        environment:
          - PRIVATE_CONFIG=/qdata/tm/tm.ipc
          - NODE_ID=${index}
        networks:
          quorum-examples-net:
            ipv4_address: 172.16.239.1${index}
      txmanager${index}:
        << : *tx-manager-def
        hostname: txmanager${index}
        ports:
          - "908${index}:9080"
        volumes:
          - vol${index}:/qdata
          - ./examples/7nodes:/examples:ro
        networks:
          quorum-examples-net:
            ipv4_address: 172.16.239.10${index}
        environment:
          - NODE_ID=${index}
    `);

    volumes.push(`
      vol${index}:
    `);

    peers.push(`                { "url": "http://txmanager${index}:9000" }`);
  }

  return {
    volumes: volumes.join(""),
    services: services.join(""),
    peers: peers.join(",\n")
  };
};

export const renderCompose = (params: { peers: string; }) => ejs.render(template, params, {});

export const generate = (params: Args) => renderCompose(generateDockerFile(params));
