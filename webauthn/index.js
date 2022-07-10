const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieSession = require('cookie-session');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const utils = require('./utils');

let database = {};

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.use(
    cookieSession({
        name: 'session',
        keys: [crypto.randomBytes(32).toString('hex')],

        // Cookie Options
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
    })
);
app.use(cookieParser());

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
});

app.get('/register', function (req, res) {
    let username = req.body.username;

    database[username] = {
        name: username,
        registered: false,
        id: utils.randomBase64URLBuffer(),
        authenticators: [],
    };

    let challengeMakeCred = utils.generateServerMakeCredRequest(
        username,
        database[username].id
    );
    challengeMakeCred.status = 'ok';

    req.session.challenge = challengeMakeCred.challenge;
    req.session.username = username;

    res.json(challengeMakeCred);
});

app.get('/register_final', function (req, res) {
    if (
        !req.body ||
        !req.body.id ||
        !req.body.rawId ||
        !req.body.response ||
        !req.body.type ||
        req.body.type !== 'public-key'
    ) {
        res.json({
            status: 'failed',
            message:
                'Response missing one or more of id/rawId/response/type fields, or type is not public-key!',
        });

        return;
    }

    let webauthnResp = req.body;
    let clientData = JSON.parse(
        base64url.decode(webauthnResp.response.clientDataJSON)
    );

    /* Check challenge... */
    if (clientData.challenge !== req.session.challenge) {
        res.json({
            status: 'failed',
            message: "Challenges don't match!",
        });
    }

    /* ...and origin */
    if (clientData.origin !== config.origin) {
        response.json({
            status: 'failed',
            message: "Origins don't match!",
        });
    }

    let result;
    if (webauthnResp.response.attestationObject !== undefined) {
        /* This is create cred */
        result = utils.verifyAuthenticatorAttestationResponse(webauthnResp);

        if (result.verified) {
            database[request.session.username].authenticators.push(
                result.authrInfo
            );
            database[request.session.username].registered = true;
        }
    } else if (webauthnResp.response.authenticatorData !== undefined) {
        /* This is get assertion */
        result = utils.verifyAuthenticatorAssertionResponse(
            webauthnResp,
            database[request.session.username].authenticators
        );
    } else {
        res.json({
            status: 'failed',
            message: 'Can not determine type of response!',
        });
    }

    if (result.verified) {
        req.session.loggedIn = true;
        res.json({ status: 'ok' });
    } else {
        res.json({
            status: 'failed',
            message: 'Can not authenticate signature!',
        });
    }
});

app.listen(8000);
