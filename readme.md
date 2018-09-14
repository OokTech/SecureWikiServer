# Secure Wiki Server

This is a server that can be used to serve TiddlyWiki online. It is made to
work with the Bob plugin.

## Setup concerns

Each of these needs instructions and more explanation.

- Make sure that the sub-modules are properly initialised and updated.
  - At the moment this is just tiddlywiki in the `TiddlyWiki5` folder
- Need to make an index wiki and correctly list the path to it.
  - The wiki needs to include the Bob plugin.
- Set the paths to the plugin, themes and editions folders (if any)
- Need to make sure that the .crt and private key files for the ssl part exist
  and the paths are listed correctly
- need to make sure that the key used to sign the tokens exists
  - Also the path to the key file. By default it is in `./.ssh/id_rsa`
    (relative to `~`)
- Need to setup accounts for people.
  - The command to add a person is `node addperson.js Name Password Level`
  - Guest gets set up with `node addperson.js Guest Guest Guest`
- In the wiki setup you have to set the `useExternalWSS` setting to true
- Make `~/Plugins`, `~/Themes` and `~/Editions` folders and put any plugins,
  themes and editions you want to have accessible to the Bob server in them.
  - The folders should be the same as they are in the tiddlywiki core, so
    plugins and themes are in folders like `Author/PluginName` and editions are
    in folders that are named the same as the edition.

## What it does

There is an https server that can serve pages. It accepts POSTs to
`/authenticate` with the `name` and `pwd` in the POST body. These are checked
against what is listed in the `/people` folder. If the credentials match than
a signed json web token is returned as part of response to the https request.
This token is then sent with every websocket message to the websocket server to
have authenticated communication with the server.

## Setup instructions

- Make sure you have npm and node installed (which version is needed? I don't
  know. Newest one and LTS versions work.)
- Clone the repo onto your server
- `npm install` to install all the dependencies
- Make sure you have the certificate files on the server (instructions to make
  your own self signed certs here: https://www.digitalocean.com/community/tutorials/openssl-essentials-working-with-ssl-certificates-private-keys-and-csrs)
- Update `certPath` and `serverKeyPath` in the `Config.toml` file in the
  `Config` folder to point to the certificate and key files.
- If needed generate a public-private key pair for token signing
- Update the `tokenPrivateKeyPath` to point to your private key. It just
  occurred to me that you can use the same key as the signing key for the
  certificate. There are security reasons that you would want separate keys.
- If you want you can change the `httpsPort` value also. If you have root
  access you can make this `443` and run the server as root. Otherwise it must
  be greater than `1024`
- Run `./start.sh`
- Go to the url of your server on the needed port. So if your server is
  `www.example.com` and `httpsPort` is left as the default `8443`, then you go
  to `www.example.com:8443`.
- To stop the wiki server run `./stop.sh`

## Components

- An express server (but a normal node http(s) server would work also.)
- The ws node module for the websockets
- The jsonwebtoken module for the JWT part
- The bcrypt module for storing hashed passwords for authentication

## Some explanation

- The express server is well developed and has many modules and is very
  extensible so we used it here.
- Never store passwords. The bcrypt module takes care of that for us by storing
  appropriately salted hashes of the passwords instead of the passwords them
  selves. See the docs for the bcrypt library for more about that.
- Authentication for https traffic is pretty standard, but https authentication
  doesn't apply to the websockets channel. So using the https channel you
  authenticate and then get a signed token from the server. Then you send this
  token along with all the websocket messages over the wss channel. Then the
  server can just verify the token.
- The tokens have the authentication level listed in the token so you can have
  different levels of authentication.

## Some notes to expand upon

- The websocket connections are saved in the connections object. To include it
  in a script use `var connections = require('./js/websocketserver').connections`. Each element in the connections
  object has the properties `socket` which is the connection object for sending
  messages, and `active` which is a boolean value indicating if the connection is active or not.

  `connection[index].socket.send(message)`

  Messages send should be stringified json objects.

- Setting up SSL and self signed certificates or other certificates. ref: https://www.digitalocean.com/community/tutorials/openssl-essentials-working-with-ssl-certificates-private-keys-and-csrs
- Also this https://blog.cloudboost.io/everything-about-creating-an-https-server-using-node-js-2fc5c48a8d4e
- This for forcing https https://stackoverflow.com/questions/11744975/enabling-https-on-express-js

## Configuration Options

These are the configuration settings that can be set in config.json

- **UNIMPLEMENTED** `filePathBase` is the base used by the file paths. If it is
  set to `homedir` than all the paths are relative to the current home folder.
  If it is anything else than that is used for the base path. To use absolute
  paths everywhere set this to `/`. **NOTE:** Only the `homedir` option is
  implemented so far!
- `serverKeyPath` is the path (with filename) to the private key used by the
  server. This is relative to the `filePathBase` listed above. This is the key
  used to create the certificate.
- `certPath` is the path (with filename) to the certificate to use for https
  and wss. It is relative to the `filePathBase` above.
- `httpsPort` is the port used by the https server.
- `wssPort` is the port used by the wss server.
- `tokenPrivateKeyPath` is the path to the private key used to sign the JSON
  tokens for authentication.
- `tokenTTL` is the length of time that generated tokens are valid for.
- `saltRounds` is the number of salt rounds used to generate the password
  hashes to store them. It shouldn't be less than 10.


## Creating the private key and certificate

This is for self-signed certificates and https. Use at your own risk, it may
make everything explode and give everyone in the world access to your computer.

- `openssl req -newkey rsa:2048 -nodes -keyout domain.key -x509 -days 365 -out domain.crt`
