import * as ejs from "ejs";

type Args = { noOfNodes: number };

const generateDockerFile = (params: Args): { peers: string, services: string; volumes: string; } => {
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

const renderCompose = (params: { peers: string; }) => {
  ejs.renderFile("./dockerComposeTemplate.yaml", params, {}, (err, str) => {
    console.log(str);
  });
};

renderCompose(generateDockerFile({ noOfNodes: 5 }));
